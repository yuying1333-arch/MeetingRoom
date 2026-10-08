<template>
  <view class="login-page">
    <!-- 品牌区 -->
    <view class="brand">
      <view class="brand-logo">
        <text class="brand-logo-text">会</text>
      </view>
      <text class="brand-title">会议室预定</text>
      <text class="brand-subtitle">高效协作，从一间会议室开始</text>
    </view>

    <!-- 表单 -->
    <view class="form-card ui-card">
      <view class="form-item">
        <text class="form-label">用户名</text>
        <input
          v-model="username"
          placeholder="请输入用户名"
          placeholder-class="input-placeholder"
          class="ui-input"
        />
      </view>
      <view class="form-item">
        <text class="form-label">密码</text>
        <input
          v-model="password"
          placeholder="请输入密码"
          placeholder-class="input-placeholder"
          class="ui-input"
          password
          @confirm="handleLogin"
        />
      </view>
      <button class="ui-btn ui-btn-primary login-btn" @click="handleLogin" :loading="loading" :disabled="!canLogin">
        登 录
      </button>
      <view class="register-link" @click="goRegister">
        <text class="register-text">没有账号？立即注册</text>
      </view>
    </view>

    <view v-if="loading" class="ui-loading-mask">
      <text class="ui-loading-text">登录中…</text>
    </view>
  </view>
</template>

<script>
export default {
  data() {
    return {
      username: '',
      password: '',
      loading: false
    }
  },
  computed: {
    canLogin() {
      return this.username.trim() && this.password.trim()
    }
  },
  onLoad() {
    // 检查是否已登录
    const userInfo = uni.getStorageSync('meeting_user')
    if (userInfo && userInfo.uid) {
      this.redirectToHome()
    }
  },
  methods: {
    async handleLogin() {
      if (!this.canLogin) {
        uni.showToast({ title: '请输入用户名和密码', icon: 'none' })
        return
      }
      this.loading = true
      try {
        const meetingAuth = uniCloud.importObject('meeting-auth')
        const res = await meetingAuth.login({
          username: this.username.trim(),
          password: this.password.trim()
        })

        if (res.code === 0) {
          // 存储登录信息
          uni.setStorageSync('meeting_user', {
            uid: res.data.uid,
            nickname: res.data.nickname,
            role: res.data.role
          })

          uni.showToast({ title: '登录成功', icon: 'success' })
          this.redirectToHome()
        } else {
          uni.showToast({ title: res.msg || '登录失败', icon: 'none' })
        }
      } catch (e) {
        console.error('登录失败', e)
        uni.showToast({ title: '网络繁忙，请稍后重试', icon: 'none' })
      } finally {
        this.loading = false
      }
    },
    redirectToHome() {
      uni.reLaunch({ url: '/pages/room/index' })
    },
    goRegister() {
      uni.navigateTo({ url: '/pages/login/register' })
    }
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  background: var(--ui-bg-page);
  padding: 0 48rpx;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

/* 品牌区 */
.brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 64rpx;
}
.brand-logo {
  width: 128rpx;
  height: 128rpx;
  border-radius: 36rpx;
  background: var(--ui-brand);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 28rpx;
  box-shadow: 0 12rpx 32rpx rgba(0, 82, 217, 0.25);
}
.brand-logo-text {
  font-size: 56rpx;
  font-weight: 600;
  color: #FFFFFF;
}
.brand-title {
  font-size: 44rpx;
  font-weight: 600;
  color: var(--ui-text-1);
  margin-bottom: 12rpx;
}
.brand-subtitle {
  font-size: 26rpx;
  color: var(--ui-text-3);
}

/* 表单 */
.form-item {
  margin-bottom: 28rpx;
}
.form-label {
  font-size: 26rpx;
  color: var(--ui-text-2);
  margin-bottom: 12rpx;
  display: block;
}
.input-placeholder {
  color: var(--ui-text-3);
}
.login-btn {
  margin-top: 16rpx;
}
.register-link {
  margin-top: 32rpx;
  text-align: center;
}
.register-text {
  font-size: 28rpx;
  color: var(--ui-brand);
}
</style>
