<template>
  <view class="mine-page">
    <!-- 用户信息卡 -->
    <view class="user-card ui-card">
      <view class="avatar">
        <text class="avatar-text">{{ avatarLetter }}</text>
      </view>
      <view class="user-info">
        <text class="user-name">{{ user.nickname }}</text>
        <text class="ui-badge" :class="user.role === 'admin' ? 'ui-badge-brand' : 'ui-badge-gray'">
          {{ user.role === 'admin' ? '管理员' : '普通用户' }}
        </text>
      </view>
    </view>

    <!-- 档案修改 -->
    <view class="ui-card section">
      <text class="ui-section-title">修改档案</text>

      <view class="form-item">
        <text class="form-label">昵称</text>
        <input
          v-model="editNickname"
          :placeholder="user.nickname"
          placeholder-class="input-placeholder"
          class="ui-input"
        />
      </view>

      <view class="form-divider"></view>

      <view class="form-item">
        <text class="form-label">修改密码（可选）</text>
      </view>
      <view class="form-item">
        <text class="form-sublabel">原密码</text>
        <input
          v-model="oldPassword"
          placeholder="请输入原密码"
          placeholder-class="input-placeholder"
          class="ui-input"
          password
        />
      </view>
      <view class="form-item">
        <text class="form-sublabel">新密码</text>
        <input
          v-model="newPassword"
          placeholder="请输入新密码（至少6位）"
          placeholder-class="input-placeholder"
          class="ui-input"
          password
        />
      </view>
      <view class="form-item">
        <text class="form-sublabel">确认新密码</text>
        <input
          v-model="confirmNewPassword"
          placeholder="请再次输入新密码"
          placeholder-class="input-placeholder"
          class="ui-input"
          password
        />
      </view>

      <button class="ui-btn ui-btn-primary save-btn" @click="saveProfile" :loading="saving">
        保存修改
      </button>
    </view>

    <!-- 管理员入口 -->
    <view class="ui-card section" v-if="user.role === 'admin'">
      <text class="ui-section-title">管理功能</text>
      <view class="menu-item" @click="goAdmin">
        <text class="menu-text">审批管理</text>
        <text class="menu-arrow">›</text>
      </view>
      <view class="menu-item" @click="goUsers">
        <text class="menu-text">用户管理</text>
        <text class="menu-arrow">›</text>
      </view>
    </view>

    <!-- 操作区 -->
    <view class="section">
      <button class="logout-btn" @click="handleLogout">退出登录</button>
    </view>
  </view>
</template>

<script>
export default {
  data() {
    return {
      user: {},
      editNickname: '',
      oldPassword: '',
      newPassword: '',
      confirmNewPassword: '',
      saving: false
    }
  },
  computed: {
    avatarLetter() {
      const name = this.user.nickname || ''
      return name.charAt(0).toUpperCase()
    }
  },
  onShow() {
    this.syncTabBar()
    const userInfo = uni.getStorageSync('meeting_user')
    if (!userInfo || !userInfo.uid) {
      uni.reLaunch({ url: '/pages/login/login' })
      return
    }
    this.user = userInfo
    this.editNickname = userInfo.nickname || ''
  },
  methods: {
    // 同步自定义 tabBar 的选中项与角色
    syncTabBar() {
      // #ifdef MP-WEIXIN
      const page = this.$mp && this.$mp.page
      if (page && typeof page.getTabBar === 'function' && page.getTabBar()) {
        const user = uni.getStorageSync('meeting_user')
        page.getTabBar().setData({
          selected: '/pages/mine/mine',
          role: (user && user.role) || 'user'
        })
      }
      // #endif
    },
    async saveProfile() {
      // 校验
      const hasNicknameChange = this.editNickname.trim() && this.editNickname.trim() !== this.user.nickname
      const hasPasswordChange = this.oldPassword || this.newPassword || this.confirmNewPassword

      if (!hasNicknameChange && !hasPasswordChange) {
        uni.showToast({ title: '没有需要修改的内容', icon: 'none' })
        return
      }

      if (hasPasswordChange) {
        if (!this.oldPassword) {
          uni.showToast({ title: '请输入原密码', icon: 'none' })
          return
        }
        if (this.newPassword.length < 6) {
          uni.showToast({ title: '新密码至少6位', icon: 'none' })
          return
        }
        if (this.newPassword !== this.confirmNewPassword) {
          uni.showToast({ title: '两次密码不一致', icon: 'none' })
          return
        }
      }

      this.saving = true
      try {
        const meetingAuth = uniCloud.importObject('meeting-auth')
        const params = { uid: this.user.uid }

        if (hasNicknameChange) {
          params.nickname = this.editNickname.trim()
        }
        if (hasPasswordChange) {
          params.oldPassword = this.oldPassword
          params.newPassword = this.newPassword
        }

        const res = await meetingAuth.updateProfile(params)

        if (res.code === 0) {
          uni.showToast({ title: '修改成功', icon: 'success' })
          // 更新本地存储
          const updated = {
            ...this.user,
            nickname: res.data.nickname || this.user.nickname
          }
          this.user = updated
          uni.setStorageSync('meeting_user', updated)
          // 清空密码字段
          this.oldPassword = ''
          this.newPassword = ''
          this.confirmNewPassword = ''
        } else {
          uni.showToast({ title: res.msg || '修改失败', icon: 'none' })
        }
      } catch (e) {
        console.error('修改档案失败', e)
        uni.showToast({ title: '网络繁忙，请稍后重试', icon: 'none' })
      } finally {
        this.saving = false
      }
    },
    handleLogout() {
      uni.showModal({
        title: '确认退出',
        content: '确定要退出登录吗？',
        success: (res) => {
          if (res.confirm) {
            uni.removeStorageSync('meeting_user')
            uni.reLaunch({ url: '/pages/login/login' })
          }
        }
      })
    },
    goAdmin() {
      uni.switchTab({ url: '/pages/admin/index' })
    },
    goUsers() {
      uni.navigateTo({ url: '/pages/admin/users' })
    }
  }
}
</script>

<style scoped>
.mine-page {
  min-height: 100vh;
  padding: 20rpx 20rpx calc(160rpx + env(safe-area-inset-bottom));
}

/* 用户信息卡 */
.user-card {
  display: flex;
  align-items: center;
  gap: 28rpx;
  margin-bottom: 20rpx;
}
.avatar {
  width: 100rpx;
  height: 100rpx;
  border-radius: 50%;
  background: var(--ui-brand-light);
  display: flex;
  align-items: center;
  justify-content: center;
}
.avatar-text {
  font-size: 44rpx;
  font-weight: 600;
  color: var(--ui-brand);
}
.user-info {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12rpx;
}
.user-name {
  font-size: 36rpx;
  font-weight: 600;
  color: var(--ui-text-1);
}

.section {
  margin-bottom: 20rpx;
}

.form-item {
  margin-bottom: 24rpx;
}
.form-item:last-child {
  margin-bottom: 0;
}
.form-label {
  font-size: 28rpx;
  color: var(--ui-text-1);
  font-weight: 600;
  margin-bottom: 12rpx;
  display: block;
}
.form-sublabel {
  font-size: 26rpx;
  color: var(--ui-text-2);
  margin-bottom: 8rpx;
  display: block;
}
.form-divider {
  height: 1rpx;
  background: var(--ui-border);
  margin: 28rpx 0;
}

.menu-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24rpx 0;
  border-bottom: 1rpx solid var(--ui-border);
}
.menu-item:last-child {
  border-bottom: none;
  padding-bottom: 0;
}
.menu-text {
  font-size: 30rpx;
  color: var(--ui-text-1);
}
.menu-arrow {
  font-size: 36rpx;
  color: var(--ui-text-4);
}

.save-btn {
  margin-top: 32rpx;
}

.logout-btn {
  width: 100%;
  height: 88rpx;
  line-height: 88rpx;
  border-radius: 12rpx;
  font-size: 32rpx;
  font-weight: 600;
  background: #FFFFFF;
  color: var(--ui-error);
  border: 2rpx solid rgba(213, 73, 65, 0.4);
  box-sizing: border-box;
  padding: 0;
}
.logout-btn::after {
  border: none;
}
</style>
