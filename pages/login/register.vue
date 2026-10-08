<template>
  <view class="register-page">
    <!-- 品牌区 -->
    <view class="brand">
      <view class="brand-logo">
        <text class="brand-logo-text">会</text>
      </view>
      <text class="brand-title">注册账号</text>
      <text class="brand-subtitle">创建您的会议室预定账号</text>
    </view>

    <!-- 表单 -->
    <view class="form-card ui-card">
      <view class="form-item">
        <text class="form-label">用户名</text>
        <input
          v-model="username"
          placeholder="至少2个字符"
          placeholder-class="input-placeholder"
          class="ui-input"
        />
      </view>
      <view class="form-item">
        <text class="form-label">昵称（可选）</text>
        <input
          v-model="nickname"
          placeholder="显示名称，不填则使用用户名"
          placeholder-class="input-placeholder"
          class="ui-input"
        />
      </view>
      <view class="form-item">
        <text class="form-label">密码</text>
        <input
          v-model="password"
          placeholder="至少6位"
          placeholder-class="input-placeholder"
          class="ui-input"
          password
        />
      </view>
      <view class="form-item">
        <text class="form-label">确认密码</text>
        <input
          v-model="confirmPassword"
          placeholder="请再次输入密码"
          placeholder-class="input-placeholder"
          class="ui-input"
          password
          @confirm="handleRegister"
        />
      </view>
      <button class="ui-btn ui-btn-primary register-btn" @click="handleRegister" :loading="loading" :disabled="!canRegister">
        注 册
      </button>
      <view class="login-link" @click="goLogin">
        <text class="login-text">已有账号？返回登录</text>
      </view>
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
      username: '',
      nickname: '',
      password: '',
      confirmPassword: '',
      loading: false
    }
  },
  computed: {
    canRegister() {
      return this.username.trim().length >= 2 &&
        this.password.length >= 6 &&
        this.password === this.confirmPassword
    }
  },
  methods: {
    async handleRegister() {
      if (this.username.trim().length < 2) {
        uni.showToast({ title: '用户名至少2个字符', icon: 'none' })
        return
      }
      if (this.password.length < 6) {
        uni.showToast({ title: '密码至少6位', icon: 'none' })
        return
      }
      if (this.password !== this.confirmPassword) {
        uni.showToast({ title: '两次密码不一致', icon: 'none' })
        return
      }

      this.loading = true
      try {
        const meetingAuth = uniCloud.importObject('meeting-auth')
        const res = await meetingAuth.register({
          username: this.username.trim(),
          password: this.password,
          nickname: this.nickname.trim() || this.username.trim()
        })

        if (res.code === 0) {
          uni.showToast({ title: '注册成功，请登录', icon: 'success' })
          setTimeout(() => {
            uni.navigateBack()
          }, 1500)
        } else {
          uni.showToast({ title: res.msg || '注册失败', icon: 'none' })
        }
      } catch (e) {
        console.error('注册失败', e)
        uni.showToast({ title: '网络繁忙，请稍后重试', icon: 'none' })
      } finally {
        this.loading = false
      }
    },
    goLogin() {
      uni.navigateBack()
    }
  }
}
</script>

<style scoped>
.register-page {
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
.register-btn {
  margin-top: 16rpx;
}
.login-link {
  margin-top: 32rpx;
  text-align: center;
}
.login-text {
  font-size: 28rpx;
  color: var(--ui-brand);
}
</style>
