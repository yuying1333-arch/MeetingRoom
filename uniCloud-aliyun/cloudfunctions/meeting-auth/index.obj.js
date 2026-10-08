const db = uniCloud.database()
const collection = db.collection('meeting-users')

// 内置管理员账户（初始密码，建议首次登录后修改）
const BUILTIN_ADMIN = {
  username: 'admin',
  password: '12345678',
  nickname: '管理员',
  role: 'admin'
}

module.exports = {
  _before: async function() {
    // 登录接口无需前置校验
  },

  /**
   * 用户名密码登录
   */
  async login(params) {
    const { username, password } = params

    if (!username || !password) {
      return { code: -1, msg: '请输入用户名和密码' }
    }

    // 1. 先检查是否是内置管理员
    if (username === BUILTIN_ADMIN.username && password === BUILTIN_ADMIN.password) {
      try {
        const adminRes = await collection.where({
          username: BUILTIN_ADMIN.username
        }).get()

        let uid = ''
        if (adminRes.data.length > 0) {
          uid = adminRes.data[0]._id
        } else {
          const addRes = await collection.add({
            username: BUILTIN_ADMIN.username,
            password: BUILTIN_ADMIN.password,
            nickname: BUILTIN_ADMIN.nickname,
            role: BUILTIN_ADMIN.role,
            created_at: Date.now()
          })
          uid = addRes.id
        }

        return {
          code: 0,
          msg: '登录成功',
          data: {
            uid: uid,
            nickname: BUILTIN_ADMIN.nickname,
            role: BUILTIN_ADMIN.role
          }
        }
      } catch (e) {
        console.error('管理员登录异常', e)
        return { code: -1, msg: '系统繁忙，请稍后重试' }
      }
    }

    // 2. 查询普通用户
    try {
      const userRes = await collection.where({
        username: username
      }).get()

      if (userRes.data.length === 0) {
        return { code: -1, msg: '用户名或密码错误' }
      }

      const user = userRes.data[0]

      if (user.password !== password) {
        return { code: -1, msg: '用户名或密码错误' }
      }

      return {
        code: 0,
        msg: '登录成功',
        data: {
          uid: user._id,
          nickname: user.nickname || user.username,
          role: user.role || 'user'
        }
      }
    } catch (e) {
      console.error('登录异常', e)
      return { code: -1, msg: '系统繁忙，请稍后重试' }
    }
  },

  /**
   * 用户注册
   */
  async register(params) {
    const { username, password, nickname } = params

    if (!username || !password) {
      return { code: -1, msg: '用户名和密码不能为空' }
    }
    if (username.length < 2) {
      return { code: -1, msg: '用户名至少2个字符' }
    }
    if (password.length < 6) {
      return { code: -1, msg: '密码至少6位' }
    }
    if (username === BUILTIN_ADMIN.username) {
      return { code: -1, msg: '该用户名已被占用' }
    }

    try {
      const existRes = await collection.where({
        username: username
      }).get()

      if (existRes.data.length > 0) {
        return { code: -1, msg: '该用户名已存在' }
      }

      const addRes = await collection.add({
        username: username,
        password: password,
        nickname: nickname || username,
        role: 'user',
        created_at: Date.now()
      })

      return {
        code: 0,
        msg: '注册成功',
        data: {
          uid: addRes.id,
          nickname: nickname || username,
          role: 'user'
        }
      }
    } catch (e) {
      console.error('注册异常', e)
      return { code: -1, msg: '系统繁忙，请稍后重试' }
    }
  },

  /**
   * 修改档案（昵称/密码）
   */
  async updateProfile(params) {
    const { uid, nickname, oldPassword, newPassword } = params

    if (!uid) {
      return { code: -1, msg: '请先登录' }
    }

    try {
      const userRes = await collection.doc(uid).get()
      if (userRes.data.length === 0) {
        return { code: -1, msg: '用户不存在' }
      }
      const user = userRes.data[0]

      const updateData = {}

      // 修改昵称
      if (nickname && nickname !== user.nickname) {
        updateData.nickname = nickname
      }

      // 修改密码
      if (oldPassword && newPassword) {
        if (user.password !== oldPassword) {
          return { code: -1, msg: '原密码错误' }
        }
        if (newPassword.length < 6) {
          return { code: -1, msg: '新密码至少6位' }
        }
        updateData.password = newPassword
      }

      if (Object.keys(updateData).length === 0) {
        return { code: -1, msg: '没有需要修改的内容' }
      }

      await collection.doc(uid).update(updateData)

      return {
        code: 0,
        msg: '修改成功',
        data: {
          nickname: updateData.nickname || user.nickname
        }
      }
    } catch (e) {
      console.error('修改档案异常', e)
      return { code: -1, msg: '系统繁忙，请稍后重试' }
    }
  }
}
