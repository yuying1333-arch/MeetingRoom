<template>
  <view class="room-index">
    <!-- 概览条 -->
    <view class="overview ui-card">
      <view class="overview-left">
        <text class="overview-title">会议室总览</text>
        <text class="overview-date">{{ todayStr }}</text>
      </view>
      <view class="overview-right">
        <view class="legend-item">
          <view class="legend-dot dot-free"></view>
          <text class="legend-text">空闲</text>
        </view>
        <view class="legend-item">
          <view class="legend-dot dot-occupied"></view>
          <text class="legend-text">占用中</text>
        </view>
        <view class="legend-item">
          <view class="legend-dot dot-disabled"></view>
          <text class="legend-text">不可预定</text>
        </view>
      </view>
    </view>

    <!-- 可交互平面布局 -->
    <view class="floor-wrap ui-card">
      <view class="floor-grid">
        <!-- 入口 -->
        <view class="cell cell-entrance">
          <text class="entrance-text">入口</text>
        </view>

        <!-- 上排：办公室 / 会议室1 / 会议室2 -->
        <view
          v-for="pos in ['top-left', 'top-center', 'top-right']"
          :key="pos"
          class="cell cell-room"
          :class="roomClass(pos)"
          :style="gridStyle(pos)"
          @click="handleRoomClick(pos)"
        >
          <text class="room-name">{{ roomName(pos) }}</text>
          <text class="room-status" :class="statusTextClass(pos)">{{ statusText(pos) }}</text>
          <text v-if="occupyText(pos)" class="room-time">{{ occupyText(pos) }}</text>
        </view>

        <!-- 走廊 -->
        <view class="cell cell-corridor">
          <text class="corridor-text">走 廊</text>
        </view>

        <!-- 下排：会议室3 / 董事长室 -->
        <view
          v-for="pos in ['bottom-left', 'bottom-right']"
          :key="pos"
          class="cell cell-room cell-room-bottom"
          :class="roomClass(pos)"
          :style="gridStyle(pos)"
          @click="handleRoomClick(pos)"
        >
          <text class="room-name">{{ roomName(pos) }}</text>
          <text class="room-status" :class="statusTextClass(pos)">{{ statusText(pos) }}</text>
          <text v-if="occupyText(pos)" class="room-time">{{ occupyText(pos) }}</text>
        </view>
      </view>
    </view>

    <!-- 说明 -->
    <view class="tip-bar">
      <text class="tip-text">点击房间查看当日排队，空闲时段可直接预定</text>
    </view>

    <!-- 加载中 -->
    <view v-if="loading" class="ui-loading-mask">
      <text class="ui-loading-text">加载中…</text>
    </view>
  </view>
</template>

<script>
// 静态布局兜底：即使云端数据未返回，房间名称和可预定状态也能正确显示
const ROOM_META = {
  'top-left':     { name: '办公室',   bookable: false },
  'top-center':   { name: '会议室1',  bookable: true },
  'top-right':    { name: '会议室2',  bookable: true },
  'bottom-left':  { name: '会议室3',  bookable: true },
  'bottom-right': { name: '董事长室', bookable: true }
}

export default {
  data() {
    return {
      rooms: [],
      loading: false,
      loadFailed: false,
      todayStr: ''
    }
  },
  onShow() {
    this.syncTabBar()
    this.checkLogin()
    this.loadRooms()
  },
  methods: {
    // 同步自定义 tabBar 的选中项与角色
    syncTabBar() {
      // #ifdef MP-WEIXIN
      const page = this.$mp && this.$mp.page
      if (page && typeof page.getTabBar === 'function' && page.getTabBar()) {
        const user = uni.getStorageSync('meeting_user')
        page.getTabBar().setData({
          selected: '/pages/room/index',
          role: (user && user.role) || 'user'
        })
      }
      // #endif
    },
    checkLogin() {
      const user = uni.getStorageSync('meeting_user')
      if (!user || !user.uid) {
        uni.reLaunch({ url: '/pages/login/login' })
      }
    },
    async loadRooms() {
      this.loading = true
      try {
        const meetingRoom = uniCloud.importObject('meeting-room')
        const res = await meetingRoom.getRoomList()
        if (res.code === 0) {
          this.rooms = res.data
          this.loadFailed = false
        } else {
          this.loadFailed = true
          uni.showToast({ title: res.msg || '加载失败，请稍后重试', icon: 'none' })
        }
      } catch (e) {
        console.error('加载房间列表失败', e)
        this.loadFailed = true
        uni.showToast({ title: '网络繁忙，请稍后重试', icon: 'none' })
      } finally {
        this.loading = false
      }
    },
    roomByPos(pos) {
      return this.rooms.find(r => r.position === pos) || null
    },
    metaByPos(pos) {
      return ROOM_META[pos] || { name: '', bookable: false }
    },
    isBookable(pos) {
      const room = this.roomByPos(pos)
      if (room) return !!room.bookable
      return this.metaByPos(pos).bookable
    },
    roomName(pos) {
      const room = this.roomByPos(pos)
      if (room && room.name) return room.name
      return this.metaByPos(pos).name
    },
    roomClass(pos) {
      const room = this.roomByPos(pos)
      // 未加载到云端数据时按静态配置渲染
      if (!room) return this.metaByPos(pos).bookable ? 'room-free' : 'room-disabled'
      if (!room.bookable) return 'room-disabled'
      return room.isOccupied ? 'room-occupied' : 'room-free'
    },
    statusText(pos) {
      const room = this.roomByPos(pos)
      if (!room) return this.isBookable(pos) ? '加载中' : '不可预定'
      if (!room.bookable) return '不可预定'
      return room.isOccupied ? '占用中' : '空闲'
    },
    statusTextClass(pos) {
      if (!this.isBookable(pos)) return 'text-disabled'
      const room = this.roomByPos(pos)
      if (!room) return ''
      return room.isOccupied ? 'text-occupied' : 'text-free'
    },
    occupyText(pos) {
      if (!this.isBookable(pos)) return ''
      const room = this.roomByPos(pos)
      if (!room) return this.loadFailed ? '加载失败' : ''
      if (room.isOccupied && room.currentBooking) {
        return `${this.formatTime(room.currentBooking.start_time)} - ${this.formatTime(room.currentBooking.end_time)}`
      }
      if (room.nextBooking) {
        return `下一场 ${this.formatTime(room.nextBooking.start_time)}`
      }
      return '点击查看排队'
    },
    // 网格定位：7 列 3 行
    gridStyle(pos) {
      const map = {
        'top-left': 'grid-column: 2 / span 2; grid-row: 1;',
        'top-center': 'grid-column: 4 / span 2; grid-row: 1;',
        'top-right': 'grid-column: 6 / span 2; grid-row: 1;',
        'bottom-left': 'grid-column: 2 / span 3; grid-row: 3;',
        'bottom-right': 'grid-column: 5 / span 3; grid-row: 3;'
      }
      return map[pos] || ''
    },
    handleRoomClick(pos) {
      // 办公室等不可预定房间：不交互
      if (!this.isBookable(pos)) return

      const room = this.roomByPos(pos)
      if (!room) {
        uni.showToast({
          title: this.loading ? '数据加载中，请稍候' : '内容加载失败，请下拉重试',
          icon: 'none'
        })
        return
      }

      if (!room._id) {
        uni.showToast({ title: '房间信息暂不可用，请稍后再试', icon: 'none' })
        return
      }

      // 空闲/占用统一进入房间详情页：按时间顺序查看当日排队，空闲时段可提交预定
      uni.navigateTo({
        url: `/pages/room/detail?roomId=${room._id}&roomName=${encodeURIComponent(room.name)}`
      })
    },
    formatTime(timestamp) {
      if (!timestamp) return ''
      const d = new Date(timestamp)
      const h = String(d.getHours()).padStart(2, '0')
      const m = String(d.getMinutes()).padStart(2, '0')
      return `${h}:${m}`
    }
  },
  onPullDownRefresh() {
    this.loadRooms().then(() => {
      uni.stopPullDownRefresh()
    })
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
.room-index {
  min-height: 100vh;
  padding: 20rpx 20rpx calc(160rpx + env(safe-area-inset-bottom));
}

/* 概览条 */
.overview {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 28rpx 32rpx;
  margin-bottom: 20rpx;
}
.overview-left {
  display: flex;
  flex-direction: column;
}
.overview-title {
  font-size: 32rpx;
  font-weight: 600;
  color: var(--ui-text-1);
  margin-bottom: 6rpx;
}
.overview-date {
  font-size: 24rpx;
  color: var(--ui-text-3);
}
.overview-right {
  display: flex;
  gap: 24rpx;
}
.legend-item {
  display: flex;
  align-items: center;
  gap: 8rpx;
}
.legend-dot {
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
}
.dot-free { background: var(--ui-success); }
.dot-occupied { background: var(--ui-error); }
.dot-disabled { background: var(--ui-text-4); }
.legend-text {
  font-size: 22rpx;
  color: var(--ui-text-2);
}

/* 平面布局 */
.floor-wrap {
  padding: 32rpx 20rpx;
}
.floor-grid {
  display: grid;
  grid-template-columns: 72rpx repeat(6, 1fr);
  grid-template-rows: 190rpx 56rpx 190rpx;
  gap: 10rpx;
}

.cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
}

/* 入口 */
.cell-entrance {
  grid-column: 1;
  grid-row: 1 / span 3;
  border: 2rpx solid var(--ui-border);
  border-radius: 12rpx;
  background: #FAFAFA;
}
.entrance-text {
  font-size: 26rpx;
  color: var(--ui-text-2);
  writing-mode: vertical-lr;
  letter-spacing: 8rpx;
}

/* 房间窗格 */
.cell-room {
  border-radius: 12rpx;
  background: #FFFFFF;
  transition: opacity 0.2s;
}
.cell-room:active {
  opacity: 0.75;
}
.cell-room-bottom {
  min-height: 190rpx;
}

.room-name {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--ui-text-1);
  margin-bottom: 8rpx;
}
.room-status {
  font-size: 24rpx;
  margin-bottom: 6rpx;
}
.room-time {
  font-size: 22rpx;
  color: var(--ui-text-2);
  padding: 0 8rpx;
  text-align: center;
}

.text-free { color: var(--ui-success); }
.text-occupied { color: var(--ui-error); }
.text-disabled { color: var(--ui-text-3); }

/* 房间状态底色 */
.room-free {
  background: var(--ui-success-light);
  border: 2rpx solid rgba(43, 164, 113, 0.35);
}
.room-occupied {
  background: var(--ui-error-light);
  border: 2rpx solid rgba(213, 73, 65, 0.35);
}
.room-disabled {
  background: var(--ui-bg-gray);
  border: 2rpx solid var(--ui-border);
  pointer-events: none;
}
.room-disabled .room-name,
.room-disabled .room-status,
.room-disabled .room-time {
  color: var(--ui-text-3);
}

/* 走廊 */
.cell-corridor {
  grid-column: 2 / span 6;
  grid-row: 2;
  border-radius: 12rpx;
  background: #FAFAFA;
  border: 2rpx solid var(--ui-border);
}
.corridor-text {
  font-size: 20rpx;
  color: var(--ui-text-3);
  letter-spacing: 8rpx;
}

/* 底部提示 */
.tip-bar {
  margin-top: 8rpx;
  text-align: center;
}
.tip-text {
  font-size: 24rpx;
  color: var(--ui-text-3);
}
</style>
