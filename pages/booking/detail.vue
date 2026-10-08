<template>
  <view class="booking-detail">
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
      <view v-if="booking.original_end_time && booking.original_end_time !== booking.end_time" class="ui-row">
        <text class="ui-label">原定结束</text>
        <text class="ui-value ui-text-placeholder">{{ formatDateTime(booking.original_end_time) }}</text>
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
          第{{ idx + 1 }}次延长：{{ formatDateTime(ext.old_end) }} → {{ formatDateTime(ext.new_end) }}
        </text>
      </view>
    </view>

    <!-- 操作按钮 -->
    <view class="ui-action-bar" v-if="showActions">
      <!-- 签到按钮 -->
      <button
        v-if="canCheckIn"
        class="ui-action-btn ui-btn ui-btn-primary"
        @click="checkIn"
        :disabled="actionLoading"
      >
        签到
      </button>

      <!-- 延长按钮 -->
      <button
        v-if="canExtend"
        class="ui-action-btn ui-btn ui-btn-outline"
        @click="openExtendModal"
        :disabled="actionLoading"
      >
        延长使用
      </button>

      <!-- 提前结束按钮 -->
      <button
        v-if="canEndEarly"
        class="ui-action-btn ui-btn ui-btn-danger"
        @click="endEarly"
        :disabled="actionLoading"
      >
        提前结束
      </button>

      <!-- 撤销预定按钮 -->
      <button
        v-if="canCancel"
        class="ui-action-btn ui-btn ui-btn-warning"
        @click="showCancelModal = true"
        :disabled="actionLoading"
      >
        撤销预定
      </button>
    </view>

    <!-- 撤销申请弹窗 -->
    <view v-if="showCancelModal" class="ui-modal-mask" @click="showCancelModal = false">
      <view class="ui-modal" @click.stop>
        <text class="ui-modal-title">撤销预定</text>
        <view class="modal-body">
          <text class="ui-modal-label">撤销理由（可选）</text>
          <textarea
            v-model="cancelReason"
            placeholder="请填写撤销理由"
            placeholder-class="input-placeholder"
            maxlength="200"
            class="ui-textarea"
          />
          <text class="modal-tip" v-if="booking.status !== 'pending'">
            已批准的预定撤销后需管理员确认，确认后房间将释放
          </text>
        </view>
        <view class="ui-modal-footer">
          <button class="ui-modal-btn ui-btn-gray" @click="showCancelModal = false">取消</button>
          <button class="ui-modal-btn ui-btn-warning" @click="confirmCancel">确认撤销</button>
        </view>
      </view>
    </view>

    <!-- 延长弹窗 -->
    <view v-if="showExtendModal" class="ui-modal-mask" @click="showExtendModal = false">
      <view class="ui-modal" @click.stop>
        <text class="ui-modal-title">延长使用时间</text>
        <view class="modal-body">
          <text class="ui-modal-label">当前结束时间：{{ formatDateTime(booking.end_time) }}</text>
          <view class="extend-time-picker">
            <text class="ui-modal-label">新结束时间</text>
            <uni-datetime-picker
              type="datetime"
              return-type="timestamp"
              v-model="extendTimestamp"
              :start="extendMinTime"
              placeholder="点击选择新结束时间"
              @change="onExtendChange"
            />
            <text v-if="extendTimeInvalid" class="modal-error">新的结束时间必须晚于当前结束时间</text>
          </view>
        </view>
        <view class="ui-modal-footer">
          <button class="ui-modal-btn ui-btn-gray" @click="showExtendModal = false">取消</button>
          <button class="ui-modal-btn ui-btn-primary" @click="confirmExtend" :disabled="!canConfirmExtend">确定</button>
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
      showExtendModal: false,
      extendTimestamp: '',
      showCancelModal: false,
      cancelReason: '',
      currentUser: null
    }
  },
  computed: {
    showActions() {
      return ['approved', 'checked_in', 'pending', 'cancel_pending'].includes(this.booking.status)
    },
    canCheckIn() {
      if (this.booking.status !== 'approved') return false
      const now = Date.now()
      const checkInStart = this.booking.start_time - 30 * 60 * 1000
      const checkInEnd = this.booking.start_time + 30 * 60 * 1000
      return now >= checkInStart && now <= checkInEnd
    },
    canExtend() {
      return this.booking.status === 'checked_in'
    },
    canEndEarly() {
      return this.booking.status === 'checked_in'
    },
    canCancel() {
      return ['pending', 'approved', 'checked_in'].includes(this.booking.status)
    },
    // 延长：新结束时间必须晚于当前结束时间
    extendTimeInvalid() {
      if (!this.extendTimestamp || !this.booking.end_time) return false
      return Number(this.extendTimestamp) <= Number(this.booking.end_time)
    },
    canConfirmExtend() {
      if (!this.extendTimestamp || !this.booking.end_time) return false
      return !this.extendTimeInvalid
    },
    // 延长的最小可选时间：不早于当前结束时间
    extendMinTime() {
      return this.booking.end_time || Date.now()
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

    async checkIn() {
      this.actionLoading = true
      try {
        const meetingRoom = uniCloud.importObject('meeting-room')
        const res = await meetingRoom.checkIn(this.bookingId, this.currentUser.uid)
        if (res.code === 0) {
          uni.showToast({ title: '签到成功', icon: 'success' })
          this.loadBookingDetail()
        } else {
          uni.showToast({ title: res.msg || '签到失败', icon: 'none' })
        }
      } catch (e) {
        console.error('签到失败', e)
        uni.showToast({ title: '网络繁忙，请稍后重试', icon: 'none' })
      } finally {
        this.actionLoading = false
      }
    },

    async endEarly() {
      uni.showModal({
        title: '确认提前结束',
        content: '确定要提前结束本次使用吗？',
        success: async (res) => {
          if (res.confirm) {
            this.actionLoading = true
            try {
              const meetingRoom = uniCloud.importObject('meeting-room')
              const result = await meetingRoom.endEarly(this.bookingId, this.currentUser.uid)
              if (result.code === 0) {
                uni.showToast({ title: '已提前结束', icon: 'success' })
                this.loadBookingDetail()
              } else {
                uni.showToast({ title: result.msg || '操作失败', icon: 'none' })
              }
            } catch (e) {
              console.error('提前结束失败', e)
              uni.showToast({ title: '网络繁忙，请稍后重试', icon: 'none' })
            } finally {
              this.actionLoading = false
            }
          }
        }
      })
    },

    openExtendModal() {
      this.extendTimestamp = ''
      this.showExtendModal = true
    },

    // 新结束时间选到不晚于当前结束时间时即时提示
    onExtendChange(val) {
      if (!val || !this.booking.end_time) return
      if (Number(val) <= Number(this.booking.end_time)) {
        uni.showToast({ title: '新的结束时间必须晚于当前结束时间', icon: 'none' })
      }
    },

    async confirmExtend() {
      const newEnd = Number(this.extendTimestamp)

      if (!newEnd) {
        uni.showToast({ title: '请选择新的结束时间', icon: 'none' })
        return
      }
      if (newEnd <= Number(this.booking.end_time)) {
        uni.showToast({ title: '新结束时间必须晚于当前结束时间', icon: 'none' })
        return
      }

      this.actionLoading = true
      try {
        const meetingRoom = uniCloud.importObject('meeting-room')
        const res = await meetingRoom.extendBooking(this.bookingId, newEnd, this.currentUser.uid)
        if (res.code === 0) {
          uni.showToast({ title: '延长成功', icon: 'success' })
          this.showExtendModal = false
          this.extendTimestamp = ''
          this.loadBookingDetail()
        } else {
          uni.showToast({ title: res.msg || '延长失败', icon: 'none' })
        }
      } catch (e) {
        console.error('延长失败', e)
        uni.showToast({ title: '网络繁忙，请稍后重试', icon: 'none' })
      } finally {
        this.actionLoading = false
      }
    },

    async confirmCancel() {
      this.actionLoading = true
      try {
        const meetingRoom = uniCloud.importObject('meeting-room')
        const res = await meetingRoom.cancelBooking(this.bookingId, this.currentUser.uid, this.cancelReason)
        if (res.code === 0) {
          uni.showToast({ title: res.msg, icon: 'none' })
          this.showCancelModal = false
          this.cancelReason = ''
          this.loadBookingDetail()
        } else {
          uni.showToast({ title: res.msg || '撤销失败', icon: 'none' })
        }
      } catch (e) {
        console.error('撤销失败', e)
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
.booking-detail {
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
.modal-tip {
  font-size: 24rpx;
  color: var(--ui-warning);
  margin-top: 12rpx;
  display: block;
}
.input-placeholder {
  color: var(--ui-text-3);
}
.extend-time-picker {
  margin-top: 24rpx;
}
</style>
