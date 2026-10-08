<template>
  <view class="users-page">
    <!-- 非管理员提示 -->
    <view v-if="!isAdmin && !loading" class="no-permission ui-card">
      <text class="no-permission-title">仅管理员可访问</text>
      <text class="no-permission-text">用户管理仅对管理员开放</text>
      <button class="ui-btn ui-btn-outline back-btn" @click="goBack">返回</button>
    </view>

    <template v-else>
      <view class="list-section">
        <text class="ui-section-title">用户列表（{{ users.length }}）</text>

        <view v-if="users.length === 0 && !loading" class="ui-empty">
          <text class="ui-empty-text">暂无用户</text>
        </view>

        <view v-for="user in users" :key="user._id" class="user-card ui-card">
          <view class="user-card-header">
            <view class="user-name-box">
              <text class="user-username">{{ user.username }}</text>
              <text class="ui-badge" :class="user.role === 'admin' ? 'ui-badge-brand' : 'ui-badge-gray'">
                {{ user.role === 'admin' ? '管理员' : '普通用户' }}
              </text>
            </view>
            <text class="edit-link" @click="openEdit(user)">编辑</text>
          </view>
          <view class="user-card-body">
            <text class="user-nickname">昵称：{{ user.nickname || '-' }}</text>
          </view>
        </view>
      </view>
    </template>

    <!-- 编辑弹窗 -->
    <view v-if="showEditModal" class="ui-modal-mask" @click="closeEdit">
      <view class="ui-modal" @click.stop>
        <text class="ui-modal-title">编辑用户</text>
        <view class="modal-body">
          <text class="ui-modal-label">用户名（不可修改）</text>
          <view class="ui-input readonly">{{ editUser.username }}</view>

          <text class="ui-modal-label" style="margin-top: 24rpx;">昵称</text>
          <input v-model="editNickname" placeholder="请输入新昵称" placeholder-class="input-placeholder" class="ui-input" />

          <text class="ui-modal-label" style="margin-top: 24rpx;">重置密码（留空则不修改）</text>
          <input v-model="editPassword" placeholder="新密码，至少6位" placeholder-class="input-placeholder" class="ui-input" password />
        </view>
        <view class="ui-modal-footer">
          <button class="ui-modal-btn ui-btn-gray" @click="closeEdit">取消</button>
          <button class="ui-modal-btn ui-btn-primary" @click="saveEdit" :disabled="saving">保存</button>
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
      users: [],
      loading: false,
      saving: false,
      isAdmin: false,
      showEditModal: false,
      editUser: {},
      editNickname: '',
      editPassword: ''
    }
  },
  onShow() {
    const user = uni.getStorageSync('meeting_user')
    if (!user || !user.uid) {
      uni.reLaunch({ url: '/pages/login/login' })
      return
    }
    this.isAdmin = user.role === 'admin'
    if (this.isAdmin) {
      this.loadUsers()
    }
  },
  methods: {
    async loadUsers() {
      this.loading = true
      try {
        const user = uni.getStorageSync('meeting_user')
        const meetingAdmin = uniCloud.importObject('meeting-admin')
        const res = await meetingAdmin.getUserList(user.uid, user.role)
        if (res.code === 0) {
          this.users = res.data
        } else {
          uni.showToast({ title: res.msg || '加载失败，请稍后重试', icon: 'none' })
        }
      } catch (e) {
        console.error('加载用户列表失败', e)
        uni.showToast({ title: '网络繁忙，请稍后重试', icon: 'none' })
      } finally {
        this.loading = false
      }
    },
    openEdit(user) {
      this.editUser = user
      this.editNickname = user.nickname || ''
      this.editPassword = ''
      this.showEditModal = true
    },
    closeEdit() {
      this.showEditModal = false
    },
    async saveEdit() {
      const hasNickname = this.editNickname.trim() && this.editNickname.trim() !== this.editUser.nickname
      const hasPassword = this.editPassword.length > 0

      if (!hasNickname && !hasPassword) {
        uni.showToast({ title: '没有需要修改的内容', icon: 'none' })
        return
      }
      if (hasPassword && this.editPassword.length < 6) {
        uni.showToast({ title: '新密码至少6位', icon: 'none' })
        return
      }

      this.saving = true
      try {
        const admin = uni.getStorageSync('meeting_user')
        const meetingAdmin = uniCloud.importObject('meeting-admin')
        const params = {
          adminId: admin.uid,
          adminRole: admin.role,
          targetUserId: this.editUser._id
        }
        if (hasNickname) params.nickname = this.editNickname.trim()
        if (hasPassword) params.newPassword = this.editPassword

        const res = await meetingAdmin.updateUser(params)
        if (res.code === 0) {
          uni.showToast({ title: '修改成功', icon: 'success' })
          this.closeEdit()
          this.loadUsers()
        } else {
          uni.showToast({ title: res.msg || '修改失败', icon: 'none' })
        }
      } catch (e) {
        console.error('修改用户失败', e)
        uni.showToast({ title: '网络繁忙，请稍后重试', icon: 'none' })
      } finally {
        this.saving = false
      }
    },
    goBack() {
      uni.navigateBack()
    }
  }
}
</script>

<style scoped>
.users-page {
  min-height: 100vh;
  padding: 20rpx 20rpx 60rpx;
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
  margin-bottom: 48rpx;
}
.back-btn {
  width: 320rpx;
}

.list-section {
  /* 列表容器 */
}

.user-card {
  padding: 24rpx 28rpx;
  margin-bottom: 16rpx;
}
.user-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12rpx;
}
.user-name-box {
  display: flex;
  align-items: center;
  gap: 16rpx;
}
.user-username {
  font-size: 32rpx;
  font-weight: 600;
  color: var(--ui-text-1);
}
.edit-link {
  font-size: 28rpx;
  color: var(--ui-brand);
}
.user-nickname {
  font-size: 26rpx;
  color: var(--ui-text-2);
}

/* 弹窗内容 */
.modal-body {
  margin-bottom: 8rpx;
}
.readonly {
  color: var(--ui-text-3);
}
.input-placeholder {
  color: var(--ui-text-3);
}
</style>
