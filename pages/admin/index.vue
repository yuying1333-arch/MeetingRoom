<template>
  <view class="admin-index">
    <!-- 非管理员提示 -->
    <view v-if="!isAdmin && !loading" class="no-permission ui-card">
      <text class="no-permission-title">仅管理员可访问</text>
      <text class="no-permission-text">该页面提供审批与会议室管理功能，普通账号无需使用</text>
      <button class="ui-btn ui-btn-outline back-btn" @click="goHome">返回首页</button>
    </view>

    <template v-else>
      <!-- 工具栏 -->
      <view class="toolbar ui-card">
        <button class="toolbar-btn ui-btn ui-btn-primary" @click="goPreFill">预填申请</button>
        <button class="toolbar-btn ui-btn ui-btn-gray" @click="goUsers">用户管理</button>
      </view>

      <!-- 待审批列表 -->
      <view class="section">
        <view class="section-head">
          <text class="ui-section-title">待审批</text>
          <text v-if="pendingList.length" class="ui-badge ui-badge-pending">{{ pendingList.length }}</text>
        </view>

        <view v-if="pendingList.length === 0 && !loading" class="ui-empty">
          <text class="ui-empty-text">暂无待审批申请</text>
        </view>

        <view
          v-for="booking in pendingList"
          :key="booking._id"
          class="booking-card ui-card"
          @click="viewDetail(booking._id)"
        >
          <view class="card-header">
            <text class="room-name">{{ booking.room_name }}</text>
            <text class="ui-badge ui-badge-pending">待审批</text>
          </view>
          <view class="card-body">
            <view class="info-line">
              <text class="info-label">申请人</text>
              <text class="info-value">{{ booking.user_name }}</text>
            </view>
            <view class="info-line">
              <text class="info-label">时间</text>
              <text class="info-value">{{ formatDateTime(booking.start_time) }} - {{ formatDateTime(booking.end_time) }}</text>
            </view>
            <view class="info-line">
              <text class="info-label">事由</text>
              <text class="info-value reason-text">{{ booking.reason }}</text>
            </view>
          </view>
          <view class="card-footer">
            <text class="created-time">{{ formatDateTime(booking.created_at) }}</text>
          </view>
        </view>
      </view>

      <!-- 撤销待确认列表 -->
      <view class="section">
        <view class="section-head">
          <text class="ui-section-title">撤销待确认</text>
          <text v-if="cancelPendingList.length" class="ui-badge ui-badge-warning">{{ cancelPendingList.length }}</text>
        </view>

        <view v-if="cancelPendingList.length === 0 && !loading" class="ui-empty">
          <text class="ui-empty-text">暂无撤销申请</text>
        </view>

        <view
          v-for="booking in cancelPendingList"
          :key="booking._id"
          class="booking-card ui-card"
        >
          <view class="card-header">
            <text class="room-name">{{ booking.room_name }}</text>
            <text class="ui-badge ui-badge-cancel_pending">撤销待确认</text>
          </view>
          <view class="card-body">
            <view class="info-line">
              <text class="info-label">申请人</text>
              <text class="info-value">{{ booking.user_name }}</text>
            </view>
            <view class="info-line">
              <text class="info-label">原时间</text>
              <text class="info-value">{{ formatDateTime(booking.start_time) }} - {{ formatDateTime(booking.end_time) }}</text>
            </view>
            <view class="info-line" v-if="booking.cancel_reason">
              <text class="info-label">撤销理由</text>
              <text class="info-value">{{ booking.cancel_reason }}</text>
            </view>
          </view>
          <view class="card-actions">
            <button class="card-btn ui-btn ui-btn-gray" @click.stop="denyCancel(booking._id)">拒绝撤销</button>
            <button class="card-btn ui-btn ui-btn-warning" @click.stop="confirmCancel(booking._id)">确认撤销</button>
          </view>
        </view>
      </view>

      <!-- 今日全部预定 -->
      <view class="section">
        <text class="ui-section-title">今日全部预定</text>
        <view
          v-for="booking in allBookings"
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
              <text class="info-label">申请人</text>
              <text class="info-value">{{ booking.user_name }}</text>
            </view>
            <view class="info-line">
              <text class="info-label">时间</text>
              <text class="info-value">{{ formatDateTime(booking.start_time) }} - {{ formatDateTime(booking.end_time) }}</text>
            </view>
          </view>
        </view>
        <view v-if="allBookings.length === 0 && !loading" class="ui-empty">
          <text class="ui-empty-text">今日暂无预定</text>
        </view>
      </view>
    </template>

    <view v-if="loading" class="ui-loading-mask">
      <text class="ui-loading-text">加载中…</text>
    </view>
  </view>
</template>

<script>
export default {
  data() {
    return {
      pendingList: [],
      cancelPendingList: [],
      allBookings: [],
      loading: false,
      isAdmin: false
    }
  },
  onShow() {
    this.syncTabBar()
    this.checkAdmin()
    this.loadData()
  },
  methods: {
    // 同步自定义 tabBar 的选中项与角色
    syncTabBar() {
      // #ifdef MP-WEIXIN
      const page = this.$mp && this.$mp.page
      if (page && typeof page.getTabBar === 'function' && page.getTabBar()) {
        const user = uni.getStorageSync('meeting_user')
        page.getTabBar().setData({
          selected: '/pages/admin/index',
          role: (user && user.role) || 'user'
        })
      }
      // #endif
    },
    checkAdmin() {
      const user = uni.getStorageSync('meeting_user')
      if (!user || !user.uid) {
        uni.reLaunch({ url: '/pages/login/login' })
        return
      }
      this.isAdmin = user.role === 'admin'
    },
    async loadData() {
      if (!this.isAdmin) return
      this.loading = true
      try {
        const user = uni.getStorageSync('meeting_user')
        const meetingAdmin = uniCloud.importObject('meeting-admin')

        // 并行加载待审批、撤销待确认和今日全部预定
        const [pendingRes, cancelRes, allRes] = await Promise.all([
          meetingAdmin.getPendingList(user.uid, user.role),
          meetingAdmin.getCancelPendingList(user.uid, user.role),
          meetingAdmin.getAllBookings(user.uid, user.role)
        ])

        if (pendingRes.code === 0) {
          this.pendingList = pendingRes.data
        }
        if (cancelRes.code === 0) {
          this.cancelPendingList = cancelRes.data
        }
        if (allRes.code === 0) {
          this.allBookings = allRes.data
        }
      } catch (e) {
        console.error('加载数据失败', e)
        uni.showToast({ title: '网络繁忙，请稍后重试', icon: 'none' })
      } finally {
        this.loading = false
      }
    },
    viewDetail(bookingId) {
      uni.navigateTo({
        url: `/pages/admin/detail?bookingId=${bookingId}`
      })
    },
    confirmCancel(bookingId) {
      uni.showModal({
        title: '确认撤销',
        content: '确认后该预定将被取消，房间释放',
        success: async (res) => {
          if (res.confirm) {
            const user = uni.getStorageSync('meeting_user')
            const meetingAdmin = uniCloud.importObject('meeting-admin')
            const result = await meetingAdmin.confirmCancel(bookingId, user.uid, user.role)
            uni.showToast({ title: result.msg, icon: result.code === 0 ? 'success' : 'none' })
            if (result.code === 0) this.loadData()
          }
        }
      })
    },
    denyCancel(bookingId) {
      uni.showModal({
        title: '拒绝撤销',
        content: '拒绝后预定保持原状态不变',
        success: async (res) => {
          if (res.confirm) {
            const user = uni.getStorageSync('meeting_user')
            const meetingAdmin = uniCloud.importObject('meeting-admin')
            const result = await meetingAdmin.denyCancel(bookingId, user.uid, user.role)
            uni.showToast({ title: result.msg, icon: result.code === 0 ? 'success' : 'none' })
            if (result.code === 0) this.loadData()
          }
        }
      })
    },
    goPreFill() {
      uni.navigateTo({
        url: '/pages/admin/pre-fill'
      })
    },
    goUsers() {
      uni.navigateTo({
        url: '/pages/admin/users'
      })
    },
    goHome() {
      uni.switchTab({ url: '/pages/room/index' })
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
    this.loadData().then(() => {
      uni.stopPullDownRefresh()
    })
  }
}
</script>

<style scoped>
.admin-index {
  min-height: 100vh;
  padding: 20rpx 20rpx calc(160rpx + env(safe-area-inset-bottom));
}

/* 非管理员提示 */
.no-permission {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 100rpx 60rpx;
  margin-top: 80rpx;
}
.no-permission-title {
  font-size: 34rpx;
  font-weight: 600;
  color: var(--ui-text-1);
  margin-bottom: 16rpx;
}
.no-permission-text {
  font-size: 26rpx;
  color: var(--ui-text-3);
  text-align: center;
  margin-bottom: 48rpx;
}
.back-btn {
  width: 320rpx;
}

/* 工具栏 */
.toolbar {
  display: flex;
  gap: 20rpx;
  margin-bottom: 24rpx;
}
.toolbar-btn {
  flex: 1;
  height: 80rpx;
  line-height: 80rpx;
  font-size: 28rpx;
}

/* 分区 */
.section {
  margin-bottom: 32rpx;
}
.section-head {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 20rpx;
}
.section-head .ui-section-title {
  margin-bottom: 0;
}
.ui-badge-warning {
  background: var(--ui-warning-light);
  color: var(--ui-warning);
}

.booking-card {
  padding: 28rpx;
  margin-bottom: 16rpx;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
  padding-bottom: 16rpx;
  border-bottom: 1rpx solid var(--ui-border);
}
.room-name {
  font-size: 32rpx;
  font-weight: 600;
  color: var(--ui-text-1);
}

.card-body {
  margin-bottom: 12rpx;
}
.info-line {
  display: flex;
  margin-bottom: 10rpx;
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
.reason-text {
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.card-footer {
  padding-top: 12rpx;
  border-top: 1rpx solid var(--ui-border);
}
.created-time {
  font-size: 24rpx;
  color: var(--ui-text-3);
}

.card-actions {
  display: flex;
  gap: 16rpx;
  margin-top: 20rpx;
}
.card-btn {
  flex: 1;
  height: 72rpx;
  line-height: 72rpx;
  font-size: 28rpx;
}
</style>
