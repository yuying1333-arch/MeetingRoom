<template>
  <view class="pre-fill-page">
    <view class="form-card ui-card">
      <text class="ui-section-title">预填申请</text>
      <text class="form-desc">为他人直接创建已批准的预定，无需审批</text>

      <!-- 选择房间 -->
      <view class="form-item">
        <text class="form-label">预定房间</text>
        <picker :range="roomNames" @change="onRoomChange">
          <view class="ui-input picker-value" :class="{ placeholder: !selectedRoom }">
            {{ selectedRoom ? selectedRoom.name : '请选择房间' }}
          </view>
        </picker>
      </view>

      <!-- 申请人姓名 -->
      <view class="form-item">
        <text class="form-label">申请人姓名</text>
        <input v-model="userName" placeholder="请输入使用人姓名" placeholder-class="input-placeholder" class="ui-input" />
      </view>

      <!-- 开始时间 -->
      <view class="form-item">
        <text class="form-label">开始时间</text>
        <uni-datetime-picker
          type="datetime"
          return-type="timestamp"
          v-model="startTimestamp"
          placeholder="点击选择开始时间"
          @change="onStartChange"
        />
      </view>

      <!-- 结束时间 -->
      <view class="form-item">
        <text class="form-label">结束时间</text>
        <uni-datetime-picker
          type="datetime"
          return-type="timestamp"
          v-model="endTimestamp"
          :start="endMin"
          placeholder="点击选择结束时间"
          @change="onEndChange"
        />
        <text v-if="timeInvalid" class="form-error">结束时间必须晚于开始时间</text>
      </view>

      <!-- 申请理由 -->
      <view class="form-item">
        <text class="form-label">申请理由</text>
        <textarea
          v-model="reason"
          placeholder="请输入申请理由（必填）"
          placeholder-class="input-placeholder"
          maxlength="500"
          class="ui-textarea"
        />
        <text class="char-count">{{ reason.length }}/500</text>
      </view>

      <!-- 提交按钮 -->
      <button class="ui-btn ui-btn-primary submit-btn" :disabled="!canSubmit" @click="submitBooking">
        提交预填申请
      </button>
    </view>

    <view v-if="loading" class="ui-loading-mask">
      <text class="ui-loading-text">提交中…</text>
    </view>
  </view>
</template>

<script>
export default {
  data() {
    return {
      rooms: [],
      selectedRoom: null,
      userName: '',
      startTimestamp: '',
      endTimestamp: '',
      reason: '',
      loading: false,
      currentUser: null
    }
  },
  computed: {
    roomNames() {
      return this.rooms.filter(r => r.bookable).map(r => r.name)
    },
    // 结束时间必须晚于开始时间
    timeInvalid() {
      if (!this.startTimestamp || !this.endTimestamp) return false
      return Number(this.endTimestamp) <= Number(this.startTimestamp)
    },
    canSubmit() {
      if (!this.selectedRoom || !this.userName.trim()) return false
      if (!this.startTimestamp || !this.endTimestamp) return false
      if (!this.reason.trim()) return false
      return !this.timeInvalid
    },
    // 结束时间不能早于已选的开始时间
    endMin() {
      return this.startTimestamp || ''
    }
  },
  onLoad() {
    this.currentUser = uni.getStorageSync('meeting_user')
    this.loadRooms()
  },
  methods: {
    async loadRooms() {
      try {
        const meetingRoom = uniCloud.importObject('meeting-room')
        const res = await meetingRoom.getRoomList()
        if (res.code === 0) {
          this.rooms = res.data
        }
      } catch (e) {
        console.error('加载房间列表失败', e)
      }
    },
    onRoomChange(e) {
      const bookableRooms = this.rooms.filter(r => r.bookable)
      this.selectedRoom = bookableRooms[e.detail.value]
    },
    // 开始时间变化后，若已选结束时间不晚于它则清空，避免区间倒挂
    // 说明：这里清的是"结束时间"选择器，它不是本次发值方，清空后视图能正常同步
    onStartChange(val) {
      if (!val) return
      if (this.endTimestamp && Number(this.endTimestamp) <= Number(val)) {
        this.endTimestamp = ''
        uni.showToast({ title: '请重新选择晚于开始时间的结束时间', icon: 'none' })
      }
    },
    // 结束时间选择后即时提示：不能早于（或等于）开始时间
    onEndChange(val) {
      if (!val || !this.startTimestamp) return
      if (Number(val) <= Number(this.startTimestamp)) {
        uni.showToast({ title: '结束时间必须晚于开始时间', icon: 'none' })
      }
    },
    async submitBooking() {
      if (!this.canSubmit) {
        uni.showToast({ title: '请填写完整信息', icon: 'none' })
        return
      }

      const startTimestamp = Number(this.startTimestamp)
      const endTimestamp = Number(this.endTimestamp)

      if (endTimestamp <= startTimestamp) {
        uni.showToast({ title: '结束时间必须晚于开始时间', icon: 'none' })
        return
      }

      this.loading = true
      try {
        const meetingAdmin = uniCloud.importObject('meeting-admin')
        const res = await meetingAdmin.preFillBooking({
          room_id: this.selectedRoom._id,
          user_name: this.userName.trim(),
          start_time: startTimestamp,
          end_time: endTimestamp,
          reason: this.reason.trim()
        }, this.currentUser.uid, this.currentUser.role)

        if (res.code === 0) {
          uni.showToast({ title: '预填申请成功', icon: 'success' })
          setTimeout(() => {
            uni.navigateBack()
          }, 1500)
        } else {
          uni.showToast({ title: res.msg || '提交失败', icon: 'none' })
        }
      } catch (e) {
        console.error('提交预填申请失败', e)
        uni.showToast({ title: '网络繁忙，请稍后重试', icon: 'none' })
      } finally {
        this.loading = false
      }
    }
  }
}
</script>

<style scoped>
.pre-fill-page {
  min-height: 100vh;
  padding: 20rpx;
}

.form-desc {
  font-size: 24rpx;
  color: var(--ui-text-3);
  margin: -8rpx 0 28rpx;
  display: block;
}

.form-item {
  margin-bottom: 28rpx;
}
.form-item:last-of-type {
  margin-bottom: 0;
}
.form-label {
  font-size: 28rpx;
  color: var(--ui-text-1);
  font-weight: 600;
  margin-bottom: 16rpx;
  display: block;
}

.form-error {
  display: block;
  font-size: 24rpx;
  color: var(--ui-error);
  margin-top: 12rpx;
}
.input-placeholder {
  color: var(--ui-text-3);
}
.picker-value.placeholder {
  color: var(--ui-text-3);
}

.char-count {
  font-size: 24rpx;
  color: var(--ui-text-3);
  text-align: right;
  margin-top: 8rpx;
  display: block;
}

.submit-btn {
  margin-top: 40rpx;
}
</style>
