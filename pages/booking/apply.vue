<template>
  <view class="apply-page">
    <view class="form-card ui-card">
      <view class="room-info">
        <text class="room-info-label">预定房间</text>
        <text class="room-info-value">{{ roomName }}</text>
      </view>

      <!-- 开始时间 -->
      <view class="form-item">
        <text class="form-label">开始时间</text>
        <uni-datetime-picker
          type="datetime"
          return-type="timestamp"
          v-model="startTimestamp"
          :start="minStart"
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
        提交申请
      </button>
    </view>

    <view v-if="loading" class="ui-loading-mask">
      <text class="ui-loading-text">提交中…</text>
    </view>
  </view>
</template>

<script>
import { requestOnBookingSubmit } from '@/common/subscribeMessage.js'

export default {
  data() {
    return {
      roomId: '',
      roomName: '',
      startTimestamp: '',
      endTimestamp: '',
      reason: '',
      loading: false
    }
  },
  computed: {
    // 结束时间必须晚于开始时间
    timeInvalid() {
      if (!this.startTimestamp || !this.endTimestamp) return false
      return Number(this.endTimestamp) <= Number(this.startTimestamp)
    },
    // 信息填全且时间区间合法才允许提交
    canSubmit() {
      if (!this.startTimestamp || !this.endTimestamp) return false
      if (!this.reason.trim()) return false
      return !this.timeInvalid
    },
    // 开始时间不能早于当前时刻
    minStart() {
      return Date.now()
    },
    // 结束时间不能早于已选的开始时间
    endMin() {
      return this.startTimestamp || Date.now()
    }
  },
  onLoad(options) {
    this.roomId = options.roomId
    this.roomName = decodeURIComponent(options.roomName || '')
  },
  methods: {
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

      if (startTimestamp < Date.now()) {
        uni.showToast({ title: '开始时间不能早于当前时间', icon: 'none' })
        return
      }

      const user = uni.getStorageSync('meeting_user')
      if (!user || !user.uid) {
        uni.showToast({ title: '请先登录', icon: 'none' })
        return
      }

      // 请求订阅消息授权（在提交前请求，提高授权率）
      await requestOnBookingSubmit()

      this.loading = true
      try {
        const meetingRoom = uniCloud.importObject('meeting-room')
        const res = await meetingRoom.submitBooking({
          room_id: this.roomId,
          start_time: startTimestamp,
          end_time: endTimestamp,
          reason: this.reason.trim(),
          user_id: user.uid,
          user_name: user.nickname || user.username
        })

        if (res.code === 0) {
          uni.showToast({ title: res.msg || '提交成功', icon: 'success' })
          setTimeout(() => {
            uni.navigateBack()
          }, 1500)
        } else {
          uni.showToast({ title: res.msg || '提交失败', icon: 'none' })
        }
      } catch (e) {
        console.error('提交申请失败', e)
        uni.showToast({ title: '网络繁忙，请稍后重试', icon: 'none' })
      } finally {
        this.loading = false
      }
    }
  }
}
</script>

<style scoped>
.apply-page {
  min-height: 100vh;
  padding: 20rpx;
}

.room-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 28rpx;
  border-bottom: 1rpx solid var(--ui-border);
  margin-bottom: 28rpx;
}
.room-info-label {
  font-size: 28rpx;
  color: var(--ui-text-2);
}
.room-info-value {
  font-size: 32rpx;
  font-weight: 600;
  color: var(--ui-brand);
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
.input-placeholder {
  color: var(--ui-text-3);
}

.form-error {
  display: block;
  font-size: 24rpx;
  color: var(--ui-error);
  margin-top: 12rpx;
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
