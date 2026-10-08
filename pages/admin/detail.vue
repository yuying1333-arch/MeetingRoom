<template>
  <view class="admin-detail">
    <!-- 概要 -->
    <view class="summary ui-card">
      <view class="summary-left">
        <text class="room-name">{{ booking.room_name }}</text>
        <text v-if="booking.start_time" class="summary-time">
          {{ formatDateTime(booking.start_time) }} - {{ formatDateTime(booking.end_time) }}
        </text>
      </view>
      <text class="ui-badge" :class="getStatusClass(booking.status)">
        {{ getStatusText(booking.status) }}
      </text>
    </view>

    <!-- 申请信息 -->
    <view class="ui-card section">
      <text class="ui-section-title">申请信息</text>
      <view class="ui-row">
        <text class="ui-label">申请人</text>
        <text class="ui-value">{{ booking.user_name }}</text>
      </view>
      <view class="ui-row">
        <text class="ui-label">申请时间</text>
        <text class="ui-value">{{ formatDateTime(booking.created_at) }}</text>
      </view>
      <view class="ui-row">
        <text class="ui-label">开始时间</text>
        <text class="ui-value">{{ formatDateTime(booking.start_time) }}</text>
      </view>
      <view class="ui-row">
        <text class="ui-label">结束时间</text>
        <text class="ui-value">{{ formatDateTime(booking.end_time) }}</text>
      </view>
      <view class="ui-row">
        <text class="ui-label">申请理由</text>
        <text class="ui-value">{{ booking.reason }}</text>
      </view>
      <view v-if="booking.checked_in_at" class="ui-row">
        <text class="ui-label">签到时间</text>
        <text class="ui-value ui-text-success">{{ formatDateTime(booking.checked_in_at) }}</text>
      </view>
      <view v-if="booking.ended_at" class="ui-row">
        <text class="ui-label">实际结束</text>
        <text class="ui-value">{{ formatDateTime(booking.ended_at) }}</text>
      </view>
      <view v-if="booking.reject_reason" class="ui-row">
        <text class="ui-label">驳回理由</text>
        <text class="ui-value ui-text-error">{{ booking.reject_reason }}</text>
      </view>
    </view>

    <!-- 延长记录 -->
    <view v-if="booking.extensions && booking.extensions.length > 0" class="ui-card section">
      <text class="ui-section-title">延长记录（{{ booking.extensions.length }}次）</text>
      <view v-for="(ext, idx) in booking.extensions" :key="idx" class="extension-item">
        <text class="extension-text">
          第{{ idx + 1 }}次：{{ formatDateTime(ext.old_end) }} → {{ formatDateTime(ext.new_end) }}
        </text>
      </view>
    </view>

    <!-- 操作按钮 -->
    <view class="ui-action-bar" v-if="showActions">
      <button
        v-if="booking.status === 'pending'"
        class="ui-action-btn ui-btn ui-btn-primary"
        @click="approve"
        :disabled="actionLoading"
      >
        批准
      </button>
      <button
        v-if="booking.status === 'pending'"
        class="ui-action-btn ui-btn ui-btn-danger"
        @click="showRejectModal = true"
        :disabled="actionLoading"
      >
        驳回
      </button>
      <button
        v-if="['approved', 'checked_in'].includes(booking.status)"
        class="ui-action-btn ui-btn ui-btn-danger"
        @click="endEarly"
        :disabled="actionLoading"
      >
        提前结束
      </button>
      <button
        v-if="['approved', 'checked_in'].includes(booking.status)"
        class="ui-action-btn ui-btn ui-btn-success"
        @click="openExtendModal"
        :disabled="actionLoading"
      >
        延长会议
      </button>
      <button
        v-if="['approved', 'checked_in'].includes(booking.status)"
        class="ui-action-btn ui-btn ui-btn-outline"
        @click="showAdjustTimeModal = true"
        :disabled="actionLoading"
      >
        调整时间
      </button>
    </view>

    <!-- 驳回理由弹窗 -->
    <view v-if="showRejectModal" class="ui-modal-mask" @click="showRejectModal = false">
      <view class="ui-modal" @click.stop>
        <text class="ui-modal-title">驳回申请</text>
        <view class="modal-body">
          <text class="ui-modal-label">请输入驳回理由（必填）</text>
          <textarea
            v-model="rejectReason"
            placeholder="请填写驳回理由"
            placeholder-class="input-placeholder"
            maxlength="200"
            class="ui-textarea"
          />
        </view>
        <view class="ui-modal-footer">
          <button class="ui-modal-btn ui-btn-gray" @click="showRejectModal = false">取消</button>
          <button class="ui-modal-btn ui-btn-danger" @click="confirmReject" :disabled="!rejectReason.trim()">确认驳回</button>
        </view>
      </view>
    </view>

    <!-- 调整时间弹窗 -->
    <view v-if="showAdjustTimeModal" class="ui-modal-mask" @click="showAdjustTimeModal = false">
      <view class="ui-modal" @click.stop>
        <text class="ui-modal-title">调整时间</text>
        <view class="modal-body">
          <text class="ui-modal-label">开始时间</text>
          <uni-datetime-picker
            type="datetime"
            return-type="timestamp"
            v-model="adjustStartTs"
            placeholder="点击选择开始时间"
            @change="onAdjustStartChange"
          />

          <text class="ui-modal-label" style="margin-top: 20rpx;">结束时间</text>
          <uni-datetime-picker
            type="datetime"
            return-type="timestamp"
            v-model="adjustEndTs"
            :start="adjustStartTs || ''"
            placeholder="点击选择结束时间"
            @change="onAdjustEndChange"
          />
          <text v-if="adjustTimeInvalid" class="modal-error">结束时间必须晚于开始时间</text>
        </view>
        <view class="ui-modal-footer">
          <button class="ui-modal-btn ui-btn-gray" @click="showAdjustTimeModal = false">取消</button>
          <button class="ui-modal-btn ui-btn-primary" @click="confirmAdjustTime" :disabled="!canConfirmAdjust">确认调整</button>
        </view>
      </view>
    </view>

    <!-- 延长会议弹窗 -->
    <view v-if="showExtendModal" class="ui-modal-mask" @click="showExtendModal = false">
      <view class="ui-modal" @click.stop>
        <text class="ui-modal-title">延长会议</text>
        <view class="modal-body">
          <text class="ui-modal-label">当前结束时间：{{ formatDateTime(booking.end_time) }}</text>
          <text class="ui-modal-label" style="margin-top: 20rpx;">新的结束时间</text>
          <uni-datetime-picker
            type="datetime"
            return-type="timestamp"
            v-model="extendEndTs"
            :start="booking.end_time || ''"
            placeholder="点击选择新的结束时间"
            @change="onExtendEndChange"
          />
          <text v-if="extendTimeInvalid" class="modal-error">新的结束时间必须晚于当前结束时间</text>
        </view>
        <view class="ui-modal-footer">
          <button class="ui-modal-btn ui-btn-gray" @click="showExtendModal = false">取消</button>
          <button class="ui-modal-btn ui-btn-primary" @click="confirmExtend" :disabled="!canConfirmExtend">确认延长</button>
        </view>
      </view>
    </view>

    <view v-if="loading" class="ui-loading-mask">
      <text class="ui-loading-text">加载中…</text>
    </view>
  </view>
</template>

<script>
export default {
  data() {
    return {
      bookingId: '',
      booking: {},
      loading: false,
      actionLoading: false,
      showRejectModal: false,
      rejectReason: '',
      showAdjustTimeModal: false,
      adjustStartTs: '',
      adjustEndTs: '',
      showExtendModal: false,
      extendEndTs: '',
      currentUser: null
    }
  },
  computed: {
    showActions() {
      return ['pending', 'approved', 'checked_in'].includes(this.booking.status)
    },
    // 调整时间：结束时间必须晚于开始时间
    adjustTimeInvalid() {
      if (!this.adjustStartTs || !this.adjustEndTs) return false
      return Number(this.adjustEndTs) <= Number(this.adjustStartTs)
    },
    canConfirmAdjust() {
      if (!this.adjustStartTs || !this.adjustEndTs) return false
      return !this.adjustTimeInvalid
    },
    // 延长会议：新结束时间必须晚于当前结束时间
    extendTimeInvalid() {
      if (!this.extendEndTs || !this.booking.end_time) return false
      return Number(this.extendEndTs) <= Number(this.booking.end_time)
    },
    canConfirmExtend() {
      if (!this.extendEndTs || !this.booking.end_time) return false
      return !this.extendTimeInvalid
    }
  },
  onLoad(options) {
    this.bookingId = options.bookingId
    this.currentUser = uni.getStorageSync('meeting_user')
    this.loadBookingDetail()
  },
  methods: {
    async loadBookingDetail() {
      this.loading = true
      try {
        const meetingRoom = uniCloud.importObject('meeting-room')
        const res = await meetingRoom.getBookingDetail(this.bookingId)
        if (res.code === 0) {
          this.booking = res.data
          this.adjustStartTs = this.booking.start_time
          this.adjustEndTs = this.booking.end_time
        } else {
          uni.showToast({ title: res.msg || '加载失败，请稍后重试', icon: 'none' })
        }
      } catch (e) {
        console.error('加载预定详情失败', e)
        uni.showToast({ title: '网络繁忙，请稍后重试', icon: 'none' })
      } finally {
        this.loading = false
      }
    },

    async approve() {
      uni.showModal({
        title: '确认批准',
        content: '确定要批准此申请吗？',
        success: async (res) => {
          if (res.confirm) {
            this.actionLoading = true
            try {
              const meetingAdmin = uniCloud.importObject('meeting-admin')
              const result = await meetingAdmin.approve(this.bookingId, this.currentUser.uid, this.currentUser.role)
              if (result.code === 0) {
                uni.showToast({ title: '已批准', icon: 'success' })
                this.loadBookingDetail()
              } else {
                uni.showToast({ title: result.msg || '操作失败', icon: 'none' })
              }
            } catch (e) {
              console.error('批准失败', e)
              uni.showToast({ title: '网络繁忙，请稍后重试', icon: 'none' })
            } finally {
              this.actionLoading = false
            }
          }
        }
      })
    },

    async confirmReject() {
      if (!this.rejectReason.trim()) {
        uni.showToast({ title: '请填写驳回理由', icon: 'none' })
        return
      }

      this.actionLoading = true
      try {
        const meetingAdmin = uniCloud.importObject('meeting-admin')
        const res = await meetingAdmin.reject(this.bookingId, this.rejectReason.trim(), this.currentUser.uid, this.currentUser.role)
        if (res.code === 0) {
          uni.showToast({ title: '已驳回', icon: 'success' })
          this.showRejectModal = false
          this.rejectReason = ''
          this.loadBookingDetail()
        } else {
          uni.showToast({ title: res.msg || '操作失败', icon: 'none' })
        }
      } catch (e) {
        console.error('驳回失败', e)
        uni.showToast({ title: '网络繁忙，请稍后重试', icon: 'none' })
      } finally {
        this.actionLoading = false
      }
    },

    onAdjustStartChange(val) {
      // 开始时间后移时，若已选结束时间不晚于它则清空，避免区间倒挂
      // 说明：这里清的是"结束时间"选择器，它不是本次发值方，清空后视图能正常同步
      if (!val) return
      if (this.adjustEndTs && Number(this.adjustEndTs) <= Number(val)) {
        this.adjustEndTs = ''
        uni.showToast({ title: '请重新选择晚于开始时间的结束时间', icon: 'none' })
      }
    },

    // 调整时间：结束时间选到不晚于开始时间时即时提示
    onAdjustEndChange(val) {
      if (!val || !this.adjustStartTs) return
      if (Number(val) <= Number(this.adjustStartTs)) {
        uni.showToast({ title: '结束时间必须晚于开始时间', icon: 'none' })
      }
    },

    // 延长会议：新结束时间选到不晚于当前结束时间时即时提示
    onExtendEndChange(val) {
      if (!val || !this.booking.end_time) return
      if (Number(val) <= Number(this.booking.end_time)) {
        uni.showToast({ title: '新的结束时间必须晚于当前结束时间', icon: 'none' })
      }
    },

    // 提前结束
    endEarly() {
      uni.showModal({
        title: '提前结束',
        content: '结束后房间立即释放，确认提前结束该会议吗？',
        success: async (res) => {
          if (!res.confirm) return
          this.actionLoading = true
          try {
            const meetingAdmin = uniCloud.importObject('meeting-admin')
            const result = await meetingAdmin.endEarly(this.bookingId, this.currentUser.uid, this.currentUser.role)
            uni.showToast({ title: result.msg, icon: result.code === 0 ? 'success' : 'none' })
            if (result.code === 0) this.loadBookingDetail()
          } catch (e) {
            console.error('提前结束失败', e)
            uni.showToast({ title: '网络繁忙，请稍后重试', icon: 'none' })
          } finally {
            this.actionLoading = false
          }
        }
      })
    },

    openExtendModal() {
      this.extendEndTs = ''
      this.showExtendModal = true
    },

    // 延长会议
    async confirmExtend() {
      const newEnd = Number(this.extendEndTs)
      if (!newEnd || newEnd <= Number(this.booking.end_time)) {
        uni.showToast({ title: '新结束时间必须晚于当前结束时间', icon: 'none' })
        return
      }

      this.actionLoading = true
      try {
        const meetingAdmin = uniCloud.importObject('meeting-admin')
        const res = await meetingAdmin.extendBooking(this.bookingId, newEnd, this.currentUser.uid, this.currentUser.role)
        if (res.code === 0) {
          uni.showToast({ title: '延长成功', icon: 'success' })
          this.showExtendModal = false
          this.loadBookingDetail()
        } else {
          uni.showToast({ title: res.msg || '操作失败', icon: 'none' })
        }
      } catch (e) {
        console.error('延长会议失败', e)
        uni.showToast({ title: '网络繁忙，请稍后重试', icon: 'none' })
      } finally {
        this.actionLoading = false
      }
    },

    async confirmAdjustTime() {
      const newStart = Number(this.adjustStartTs)
      const newEnd = Number(this.adjustEndTs)

      if (!newStart || !newEnd) {
        uni.showToast({ title: '请选择完整的开始和结束时间', icon: 'none' })
        return
      }
      if (newEnd <= newStart) {
        uni.showToast({ title: '结束时间必须晚于开始时间', icon: 'none' })
        return
      }

      this.actionLoading = true
      try {
        const meetingAdmin = uniCloud.importObject('meeting-admin')
        const res = await meetingAdmin.adjustTime(this.bookingId, newStart, newEnd, this.currentUser.uid, this.currentUser.role)
        if (res.code === 0) {
          uni.showToast({ title: '时间已调整', icon: 'success' })
          this.showAdjustTimeModal = false
          this.loadBookingDetail()
        } else {
          uni.showToast({ title: res.msg || '操作失败', icon: 'none' })
        }
      } catch (e) {
        console.error('调整时间失败', e)
        uni.showToast({ title: '网络繁忙，请稍后重试', icon: 'none' })
      } finally {
        this.actionLoading = false
      }
    },

    formatDateTime(timestamp) {
      if (!timestamp) return ''
      const d = new Date(timestamp)
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      const h = String(d.getHours()).padStart(2, '0')
      const m = String(d.getMinutes()).padStart(2, '0')
      return `${month}-${day} ${h}:${m}`
    },
    getStatusText(status) {
      const map = {
        pending: '待审批',
        approved: '已批准',
        checked_in: '使用中',
        ended: '已结束',
        rejected: '已驳回',
        cancelled: '已取消',
        cancel_pending: '撤销待确认'
      }
      return map[status] || status
    },
    getStatusClass(status) {
      return `ui-badge-${status}`
    }
  }
}
</script>

<style scoped>
.admin-detail {
  min-height: 100vh;
  padding: 20rpx 20rpx calc(180rpx + env(safe-area-inset-bottom));
}

/* 概要 */
.summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
}
.summary-left {
  display: flex;
  flex-direction: column;
}
.room-name {
  font-size: 36rpx;
  font-weight: 600;
  color: var(--ui-text-1);
  margin-bottom: 8rpx;
}
.summary-time {
  font-size: 26rpx;
  color: var(--ui-text-2);
}

.section {
  margin-bottom: 20rpx;
}

.extension-item {
  padding: 12rpx 0;
  border-bottom: 1rpx solid var(--ui-border);
}
.extension-item:last-child {
  border-bottom: none;
  padding-bottom: 0;
}
.extension-text {
  font-size: 26rpx;
  color: var(--ui-brand);
}

/* 弹窗内容 */
.modal-body {
  margin-bottom: 8rpx;
}
.modal-error {
  display: block;
  font-size: 24rpx;
  color: var(--ui-error);
  margin-top: 12rpx;
}
.input-placeholder {
  color: var(--ui-text-3);
}
</style>
