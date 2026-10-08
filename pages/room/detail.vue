<template>
  <view class="room-detail">
    <!-- 房间概要 -->
    <view class="room-summary ui-card">
      <view class="summary-left">
        <text class="room-name">{{ roomName }}</text>
        <text class="room-date">{{ todayStr }}</text>
      </view>
      <text class="ui-badge" :class="occupyBadgeClass">{{ occupyBadgeText }}</text>
    </view>

    <!-- 时间线 -->
    <view class="timeline-section">
      <text class="ui-section-title">今日预定排队（按时间顺序）</text>

      <view v-if="bookings.length === 0 && !loading" class="ui-empty">
        <text class="ui-empty-text">今日暂无预定，可点击下方按钮预定</text>
      </view>

      <view v-else class="timeline">
        <view
          v-for="booking in bookings"
          :key="booking._id"
          class="timeline-item"
          :class="{ 'is-active': booking.is_active }"
        >
          <view class="timeline-dot" :class="dotClass(booking)"></view>
          <view class="timeline-content ui-card" @click="viewBooking(booking)">
            <view class="booking-header">
              <text class="booking-time">{{ formatTime(booking.start_time) }} - {{ formatTime(booking.end_time) }}</text>
              <text v-if="booking.is_active" class="ui-badge ui-badge-active">占用中</text>
              <text v-else class="ui-badge" :class="getStatusClass(booking.status)">
                {{ getStatusText(booking.status) }}
              </text>
            </view>
            <text class="booking-user">申请人：{{ booking.user_name }}</text>
            <text class="booking-reason">事由：{{ booking.reason }}</text>

            <!-- 延长记录 -->
            <view v-if="booking.extensions && booking.extensions.length > 0" class="extensions">
              <text class="extensions-title">延长记录</text>
              <view v-for="(ext, idx) in booking.extensions" :key="idx" class="extension-item">
                <text class="extension-text">
                  第{{ idx + 1 }}次：{{ formatTime(ext.old_end) }} → {{ formatTime(ext.new_end) }}
                </text>
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 底部预定按钮 -->
    <view class="ui-action-bar">
      <button class="ui-btn ui-btn-primary" @click="goApply">立即预定</button>
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
      roomId: '',
      roomName: '',
      bookings: [],
      loading: false,
      todayStr: '',
      currentUser: null
    }
  },
  computed: {
    occupyBadgeClass() {
      const active = this.bookings.some(b => b.is_active)
      return active ? 'ui-badge-active' : 'ui-badge-approved'
    },
    occupyBadgeText() {
      return this.bookings.some(b => b.is_active) ? '占用中' : '空闲'
    }
  },
  onLoad(options) {
    this.roomId = options.roomId
    this.roomName = decodeURIComponent(options.roomName || '')
    this.currentUser = uni.getStorageSync('meeting_user')
    this.loadBookings()
  },
  onShow() {
    if (this.roomId) this.loadBookings()
  },
  methods: {
    async loadBookings() {
      this.loading = true
      try {
        const meetingRoom = uniCloud.importObject('meeting-room')
        const res = await meetingRoom.getRoomDetail(this.roomId)
        if (res.code === 0) {
          this.bookings = res.data
        } else {
          uni.showToast({ title: res.msg || '加载失败，请稍后重试', icon: 'none' })
        }
      } catch (e) {
        console.error('加载预定列表失败', e)
        uni.showToast({ title: '网络繁忙，请稍后重试', icon: 'none' })
      } finally {
        this.loading = false
      }
    },
    goApply() {
      uni.navigateTo({
        url: `/pages/booking/apply?roomId=${this.roomId}&roomName=${encodeURIComponent(this.roomName)}`
      })
    },
    // 点击排队项：管理员进入管理详情（可提前结束/延长/调整时间），普通用户查看预定详情
    viewBooking(booking) {
      const isAdmin = this.currentUser && this.currentUser.role === 'admin'
      const url = isAdmin
        ? `/pages/admin/detail?bookingId=${booking._id}`
        : `/pages/booking/detail?bookingId=${booking._id}`
      uni.navigateTo({ url })
    },
    dotClass(booking) {
      if (booking.is_active) return 'dot-active'
      const map = {
        pending: 'dot-pending',
        approved: 'dot-approved',
        checked_in: 'dot-checked_in',
        cancel_pending: 'dot-pending'
      }
      return map[booking.status] || 'dot-ended'
    },
    formatTime(timestamp) {
      if (!timestamp) return ''
      const d = new Date(timestamp)
      const h = String(d.getHours()).padStart(2, '0')
      const m = String(d.getMinutes()).padStart(2, '0')
      return `${h}:${m}`
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
  },
  created() {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    this.todayStr = `${y}-${m}-${d}`
  }
}
</script>

<style scoped>
.room-detail {
  min-height: 100vh;
  padding: 20rpx 20rpx calc(180rpx + env(safe-area-inset-bottom));
}

/* 房间概要 */
.room-summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24rpx;
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
.room-date {
  font-size: 24rpx;
  color: var(--ui-text-3);
}

/* 时间线 */
.timeline-section {
  padding: 0 4rpx;
}

.timeline {
  padding-left: 20rpx;
}

.timeline-item {
  position: relative;
  padding-left: 40rpx;
  padding-bottom: 24rpx;
  border-left: 4rpx solid var(--ui-border);
}
.timeline-item:last-child {
  border-left-color: transparent;
  padding-bottom: 0;
}

.timeline-dot {
  position: absolute;
  left: -12rpx;
  top: 36rpx;
  width: 20rpx;
  height: 20rpx;
  border-radius: 50%;
  background: var(--ui-brand);
  border: 4rpx solid #FFFFFF;
  box-sizing: content-box;
}
.dot-pending { background: var(--ui-warning); }
.dot-approved { background: var(--ui-success); }
.dot-checked_in { background: var(--ui-brand); }
.dot-ended { background: var(--ui-text-4); }
.dot-active { background: var(--ui-error); }

.timeline-content {
  padding: 24rpx;
}
.timeline-item.is-active .timeline-content {
  border: 2rpx solid rgba(213, 73, 65, 0.4);
}

.booking-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12rpx;
}
.booking-time {
  font-size: 30rpx;
  font-weight: 600;
  color: var(--ui-text-1);
}

.booking-user,
.booking-reason {
  font-size: 26rpx;
  color: var(--ui-text-2);
  margin-top: 8rpx;
  display: block;
}

.extensions {
  margin-top: 16rpx;
  padding-top: 16rpx;
  border-top: 1rpx solid var(--ui-border);
}
.extensions-title {
  font-size: 24rpx;
  color: var(--ui-text-3);
  margin-bottom: 8rpx;
  display: block;
}
.extension-item {
  margin-top: 6rpx;
}
.extension-text {
  font-size: 24rpx;
  color: var(--ui-brand);
}
</style>
