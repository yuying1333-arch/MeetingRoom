// 自定义 tabBar（微信原生组件，uni-app 会原样拷贝到小程序根目录，不经过编译）
// 角色来源：各 tab 页在 onShow 中通过 getTabBar().setData({ selected, role }) 同步
var ALL_TABS = [
  {
    pagePath: '/pages/room/index',
    iconPath: '/static/tabbar/list.png',
    selectedIconPath: '/static/tabbar/list_active.png',
    text: '首页',
    adminOnly: false
  },
  {
    pagePath: '/pages/booking/my-bookings',
    iconPath: '/static/tabbar/grid.png',
    selectedIconPath: '/static/tabbar/grid_active.png',
    text: '我的预定',
    adminOnly: false
  },
  {
    pagePath: '/pages/admin/index',
    iconPath: '/static/tabbar/admin.png',
    selectedIconPath: '/static/tabbar/admin_active.png',
    text: '管理',
    adminOnly: true
  },
  {
    pagePath: '/pages/mine/mine',
    iconPath: '/static/tabbar/me.png',
    selectedIconPath: '/static/tabbar/me_active.png',
    text: '我的',
    adminOnly: false
  }
]

// 读取本地登录信息（兼容 uni-app 存储的字符串/对象两种形式）
function readUser() {
  try {
    var raw = wx.getStorageSync('meeting_user')
    if (!raw) return null
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw)
      } catch (e) {
        return null
      }
    }
    if (raw && raw.data && typeof raw.data === 'object') return raw.data
    return raw
  } catch (e) {
    return null
  }
}

function roleOf(user) {
  return (user && user.role) || 'user'
}

function tabsOf(role) {
  return ALL_TABS.filter(function (item) {
    return !item.adminOnly || role === 'admin'
  })
}

Component({
  data: {
    selected: '',
    role: 'user',
    tabs: tabsOf('user')
  },
  observers: {
    // 角色变化时重算可见 tab（页面 setData 传入 role 即刻生效）
    role: function (role) {
      this.setData({ tabs: tabsOf(role) })
    }
  },
  lifetimes: {
    attached: function () {
      var pages = getCurrentPages()
      var current = pages.length ? '/' + pages[pages.length - 1].route : ''
      var role = roleOf(readUser())
      this.setData({
        selected: current,
        role: role,
        tabs: tabsOf(role)
      })
    }
  },
  methods: {
    onTapItem: function (e) {
      var path = e.currentTarget.dataset.path
      if (!path || path === this.data.selected) return
      wx.switchTab({ url: path })
    }
  }
})
