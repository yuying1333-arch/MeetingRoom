<template>
  <view class="my-bookings">
    <!-- 筛选标签 -->
    <view class="filter-tabs ui-card">
      <view
        v-for="tab in tabs"
        :key="tab.value"
        class="tab-item"
        :class="{ active: currentTab === tab.value }"
        @click="switchTab(tab.value)"
      >
        <text>{{ tab.label }}</text>
      </view>
    </view>

    <!-- 预定列表 -->
    <view class="booking-list">
      <view v-if="bookings.length === 0 && !loading" class="ui-empty">
        <text class="ui-empty-text">暂无预定记录</text>
      </view>

      <view
        v-for="booking in bookings"
        :key="booking._id"
        class="booking-card ui-card"
        @click="viewDetail(booking._id)"
      >
        <view class="card-header">
          <text class="room-name">{{ booking.room_name }}</text>
          <text class="ui-badge" :class="getStatusClass(booking.status)">
            {{ getStatusText(booking.status) }}
          </text>
        </view>

        <view class="card-body">
          <view class="info-line">
            <text class="info-label">时间</text>
            <text class="info-value">
              {{ formatDateTime(booking.start_time) }} - {{ formatDateTime(booking.end_time) }}
            </text>
          </view>
          <view class="info-line">
            <text class="info-label">事由</text>
            <text class="info-value">{{ booking.reason }}</text>
          </view>

          <!-- 驳回理由 -->
          <view v-if="booking.status === 'rejected' && booking.reject_reason" class="info-line">
            <text class="info-label">驳回理由</text>
            <text class="info-value ui-text-error">{{ booking.reject_reason }}</text>
          </view>
        </view>

        <view class="card-footer">
          <text class="created-time">申请时间：{{ formatDateTime(booking.created_at) }}</text>
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
      bookings: [],
      loading: false,
      currentTab: 'all',
      tabs: [
        { label: '全部', value: 'all' },
        { label: '待审批', value: 'pending' },
        { label: '已批准', value: 'approved' },
        { label: '使用中', value: 'checked_in' },
        { label: '已结束', value: 'ended' }
      ]
    }
  },
  onShow() {
    this.syncTabBar()
    this.loadBookings()
  },
  methods: {
    // 同步自定义 tabBar 的选中项与角色
    syncTabBar() {
      // #ifdef MP-WEIXIN
      const page = this.$mp && this.$mp.page
      if (page && typeof page.getTabBar === 'function' && page.getTabBar()) {
        const user = uni.getStorageSync('meeting_user')
        page.getTabBar().setData({
          selected: '/pages/booking/my-bookings',
          role: (user && user.role) || 'user'
        })
      }
      // #endif
    },
    switchTab(tab) {
      this.currentTab = tab
      this.loadBookings()
    },
    async loadBookings() {
      this.loading = true
      try {
        const user = uni.getStorageSync('meeting_user')
        if (!user || !user.uid) {
          uni.showToast({ title: '请先登录', icon: 'none' })
          return
        }

        const meetingRoom = uniCloud.importObject('meeting-room')
        const res = await meetingRoom.getMyBookings(user.uid, this.currentTab)
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
    viewDetail(bookingId) {
      uni.navigateTo({
        url: `/pages/booking/detail?bookingId=${bookingId}`
      })
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
  },
  onPullDownRefresh() {
    this.loadBookings().then(() => {
      uni.stopPullDownRefresh()
    })
  }
}
</script>

<style scoped>
.my-bookings {
  min-height: 100vh;
  padding: 20rpx 20rpx calc(160rpx + env(safe-area-inset-bottom));
}

/* 筛选标签 */
.filter-tabs {
  display: flex;
  gap: 16rpx;
  overflow-x: auto;
  padding: 24rpx;
  margin-bottom: 20rpx;
}
.tab-item {
  flex-shrink: 0;
  padding: 12rpx 28rpx;
  border-radius: 32rpx;
  background: var(--ui-bg-gray);
  font-size: 26rpx;
  color: var(--ui-text-2);
  transition: all 0.2s;
}
.tab-item.active {
  background: var(--ui-brand);
  color: #FFFFFF;
  font-weight: 600;
}

/* 预定列表 */
.booking-list {
  /* 列表容器 */
}

.booking-card {
  padding: 28rpx;
  margin-bottom: 20rpx;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20rpx;
  padding-bottom: 20rpx;
  border-bottom: 1rpx solid var(--ui-border);
}
.room-name {
  font-size: 32rpx;
  font-weight: 600;
  color: var(--ui-text-1);
}

.card-body {
  margin-bottom: 16rpx;
}
.info-line {
  display: flex;
  margin-bottom: 12rpx;
}
.info-line:last-child {
  margin-bottom: 0;
}
.info-label {
  font-size: 26rpx;
  color: var(--ui-text-3);
  width: 140rpx;
  flex-shrink: 0;
}
.info-value {
  font-size: 26rpx;
  color: var(--ui-text-1);
  flex: 1;
}

.card-footer {
  padding-top: 16rpx;
  border-top: 1rpx solid var(--ui-border);
}
.created-time {
  font-size: 24rpx;
  color: var(--ui-text-3);
}
</style>
