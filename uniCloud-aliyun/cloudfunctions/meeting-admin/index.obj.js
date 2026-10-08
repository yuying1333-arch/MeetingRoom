const db = uniCloud.database()
const dbCmd = db.command

// 归一化为毫秒时间戳，非法值返回 NaN
function toTimestamp(value) {
  if (value === null || value === undefined || value === '') return NaN
  const ts = Number(value)
  return Number.isFinite(ts) ? ts : NaN
}

// 校验时间区间：两个值都必须是合法时间戳，且结束时间严格晚于开始时间
// 注意必须转成数字再比较，否则字符串会按字典序比较得出错误结果
function checkTimeRange(start, end) {
  const startTs = toTimestamp(start)
  const endTs = toTimestamp(end)
  if (!Number.isFinite(startTs) || !Number.isFinite(endTs)) {
    return { ok: false, msg: '时间格式不正确，请重新选择' }
  }
  if (endTs <= startTs) {
    return { ok: false, msg: '结束时间必须晚于开始时间' }
  }
  return { ok: true, start: startTs, end: endTs }
}

module.exports = {
  _before: async function() {
    // 可以在这里做统一的管理员权限校验
  },

  // 获取待审批列表
  async getPendingList(userId, userRole) {
    if (userRole !== 'admin') {
      return { code: -1, msg: '无管理员权限' }
    }

    const bookingsRes = await db.collection('meeting-bookings')
      .where({ status: 'pending' })
      .orderBy('created_at', 'asc')
      .limit(50)
      .get()

    // 获取房间信息
    const roomIds = [...new Set(bookingsRes.data.map(b => b.room_id))]
    let roomsMap = {}
    if (roomIds.length > 0) {
      const roomsRes = await db.collection('meeting-rooms')
        .where({ _id: dbCmd.in(roomIds) })
        .get()
      roomsRes.data.forEach(r => {
        roomsMap[r._id] = r.name
      })
    }

    const bookings = bookingsRes.data.map(b => ({
      ...b,
      room_name: roomsMap[b.room_id] || '未知房间'
    }))

    return {
      code: 0,
      data: bookings
    }
  },

  // 批准申请
  async approve(bookingId, userId, userRole) {
    if (userRole !== 'admin') {
      return { code: -1, msg: '无管理员权限' }
    }

    const bookingRes = await db.collection('meeting-bookings').doc(bookingId).get()
    const booking = bookingRes.data && bookingRes.data.length > 0 ? bookingRes.data[0] : null

    if (!booking) {
      return { code: -1, msg: '预定记录不存在' }
    }
    if (booking.status !== 'pending') {
      return { code: -1, msg: '该申请已处理' }
    }

    // 再次检查时间冲突
    const conflictRes = await db.collection('meeting-bookings')
      .where({
        room_id: booking.room_id,
        _id: dbCmd.neq(bookingId),
        status: dbCmd.in(['approved', 'checked_in']),
        start_time: dbCmd.lt(booking.end_time),
        end_time: dbCmd.gt(booking.start_time)
      })
      .get()

    if (conflictRes.data.length > 0) {
      return { code: -1, msg: '该时间段已有其他预定被批准，无法批准此申请' }
    }

    const now = Date.now()
    await db.collection('meeting-bookings').doc(bookingId).update({
      status: 'approved',
      admin_id: userId,
      updated_at: now
    })

    return {
      code: 0,
      msg: '已批准'
    }
  },

  // 驳回申请
  async reject(bookingId, reason, userId, userRole) {
    if (userRole !== 'admin') {
      return { code: -1, msg: '无管理员权限' }
    }

    if (!reason || !reason.trim()) {
      return { code: -1, msg: '请填写驳回理由' }
    }

    const bookingRes = await db.collection('meeting-bookings').doc(bookingId).get()
    const booking = bookingRes.data && bookingRes.data.length > 0 ? bookingRes.data[0] : null

    if (!booking) {
      return { code: -1, msg: '预定记录不存在' }
    }
    if (booking.status !== 'pending') {
      return { code: -1, msg: '该申请已处理' }
    }

    const now = Date.now()
    await db.collection('meeting-bookings').doc(bookingId).update({
      status: 'rejected',
      reject_reason: reason.trim(),
      admin_id: userId,
      updated_at: now
    })

    return {
      code: 0,
      msg: '已驳回'
    }
  },

  // 调整时间
  async adjustTime(bookingId, start, end, userId, userRole) {
    if (userRole !== 'admin') {
      return { code: -1, msg: '无管理员权限' }
    }

    const range = checkTimeRange(start, end)
    if (!range.ok) {
      return { code: -1, msg: range.msg }
    }
    start = range.start
    end = range.end

    const bookingRes = await db.collection('meeting-bookings').doc(bookingId).get()
    const booking = bookingRes.data && bookingRes.data.length > 0 ? bookingRes.data[0] : null

    if (!booking) {
      return { code: -1, msg: '预定记录不存在' }
    }
    if (['rejected', 'ended', 'cancelled'].includes(booking.status)) {
      return { code: -1, msg: '该预定已结束，无法调整' }
    }

    // 检查调整后的时间是否与其他预定冲突
    const conflictRes = await db.collection('meeting-bookings')
      .where({
        room_id: booking.room_id,
        _id: dbCmd.neq(bookingId),
        status: dbCmd.in(['approved', 'checked_in']),
        start_time: dbCmd.lt(end),
        end_time: dbCmd.gt(start)
      })
      .get()

    if (conflictRes.data.length > 0) {
      return { code: -1, msg: '调整后的时间段与其他预定冲突' }
    }

    const now = Date.now()
    await db.collection('meeting-bookings').doc(bookingId).update({
      start_time: start,
      end_time: end,
      updated_at: now
    })

    return {
      code: 0,
      msg: '时间已调整'
    }
  },

  // 预填申请（管理员直接创建已批准的预定）
  async preFillBooking(data, userId, userRole) {
    if (userRole !== 'admin') {
      return { code: -1, msg: '无管理员权限' }
    }

    const { room_id, user_name, reason } = data

    if (!room_id || !user_name || !reason) {
      return { code: -1, msg: '请填写完整信息' }
    }

    const range = checkTimeRange(data.start_time, data.end_time)
    if (!range.ok) {
      return { code: -1, msg: range.msg }
    }
    const start_time = range.start
    const end_time = range.end

    // 检查时间冲突
    const conflictRes = await db.collection('meeting-bookings')
      .where({
        room_id: room_id,
        status: dbCmd.in(['approved', 'checked_in']),
        start_time: dbCmd.lt(end_time),
        end_time: dbCmd.gt(start_time)
      })
      .get()

    if (conflictRes.data.length > 0) {
      return { code: -1, msg: '该时间段已被预定' }
    }

    const now = Date.now()
    const bookingData = {
      room_id,
      user_id: 'admin_prefill',
      user_name: user_name.trim(),
      start_time,
      end_time,
      original_end_time: end_time,
      reason,
      status: 'approved',
      admin_id: userId,
      extensions: [],
      created_at: now,
      updated_at: now
    }

    const addRes = await db.collection('meeting-bookings').add(bookingData)

    return {
      code: 0,
      msg: '预填申请已创建',
      data: { id: addRes.id }
    }
  },

  // 获取待确认撤销列表
  async getCancelPendingList(userId, userRole) {
    if (userRole !== 'admin') {
      return { code: -1, msg: '无管理员权限' }
    }

    const bookingsRes = await db.collection('meeting-bookings')
      .where({ status: 'cancel_pending' })
      .orderBy('cancel_requested_at', 'asc')
      .limit(50)
      .get()

    const roomIds = [...new Set(bookingsRes.data.map(b => b.room_id))]
    let roomsMap = {}
    if (roomIds.length > 0) {
      const roomsRes = await db.collection('meeting-rooms')
        .where({ _id: dbCmd.in(roomIds) })
        .get()
      roomsRes.data.forEach(r => {
        roomsMap[r._id] = r.name
      })
    }

    const bookings = bookingsRes.data.map(b => ({
      ...b,
      room_name: roomsMap[b.room_id] || '未知房间'
    }))

    return {
      code: 0,
      data: bookings
    }
  },

  // 确认撤销（管理员同意用户的撤销申请）
  async confirmCancel(bookingId, userId, userRole) {
    if (userRole !== 'admin') {
      return { code: -1, msg: '无管理员权限' }
    }

    const bookingRes = await db.collection('meeting-bookings').doc(bookingId).get()
    const booking = bookingRes.data && bookingRes.data.length > 0 ? bookingRes.data[0] : null

    if (!booking) {
      return { code: -1, msg: '预定记录不存在' }
    }
    if (booking.status !== 'cancel_pending') {
      return { code: -1, msg: '该申请已处理' }
    }

    const now = Date.now()
    await db.collection('meeting-bookings').doc(bookingId).update({
      status: 'cancelled',
      ended_at: now,
      updated_at: now
    })

    return { code: 0, msg: '已确认撤销' }
  },

  // 拒绝撤销（恢复原状态）
  async denyCancel(bookingId, userId, userRole) {
    if (userRole !== 'admin') {
      return { code: -1, msg: '无管理员权限' }
    }

    const bookingRes = await db.collection('meeting-bookings').doc(bookingId).get()
    const booking = bookingRes.data && bookingRes.data.length > 0 ? bookingRes.data[0] : null

    if (!booking) {
      return { code: -1, msg: '预定记录不存在' }
    }
    if (booking.status !== 'cancel_pending') {
      return { code: -1, msg: '该申请已处理' }
    }

    // 恢复到撤销前的状态
    const restoreStatus = booking.pre_cancel_status || 'approved'

    await db.collection('meeting-bookings').doc(bookingId).update({
      status: restoreStatus,
      cancel_reason: '',
      cancel_requested_at: null,
      updated_at: Date.now()
    })

    return { code: 0, msg: '已拒绝撤销，预定保持不变' }
  },

  // 获取用户列表
  async getUserList(userId, userRole) {
    if (userRole !== 'admin') {
      return { code: -1, msg: '无管理员权限' }
    }

    const usersRes = await db.collection('meeting-users')
      .orderBy('created_at', 'asc')
      .limit(200)
      .get()

    // 不返回密码字段
    const users = usersRes.data.map(u => ({
      _id: u._id,
      username: u.username,
      nickname: u.nickname,
      role: u.role,
      created_at: u.created_at
    }))

    return { code: 0, data: users }
  },

  // 修改用户信息（昵称/密码，用户名不可改）
  async updateUser(params) {
    const { adminId, adminRole, targetUserId, nickname, newPassword } = params

    if (adminRole !== 'admin') {
      return { code: -1, msg: '无管理员权限' }
    }
    if (!targetUserId) {
      return { code: -1, msg: '缺少目标用户' }
    }

    const userRes = await db.collection('meeting-users').doc(targetUserId).get()
    if (userRes.data.length === 0) {
      return { code: -1, msg: '用户不存在' }
    }
    const target = userRes.data[0]

    const updateData = {}
    if (nickname && nickname.trim()) {
      updateData.nickname = nickname.trim()
    }
    if (newPassword) {
      if (newPassword.length < 6) {
        return { code: -1, msg: '新密码至少6位' }
      }
      updateData.password = newPassword
    }

    if (Object.keys(updateData).length === 0) {
      return { code: -1, msg: '没有需要修改的内容' }
    }

    await db.collection('meeting-users').doc(targetUserId).update(updateData)

    return { code: 0, msg: '修改成功' }
  },

  // 管理员提前结束会议（可操作任意预定）
  async endEarly(bookingId, userId, userRole) {
    if (userRole !== 'admin') {
      return { code: -1, msg: '无管理员权限' }
    }

    const bookingRes = await db.collection('meeting-bookings').doc(bookingId).get()
    const booking = bookingRes.data && bookingRes.data.length > 0 ? bookingRes.data[0] : null

    if (!booking) {
      return { code: -1, msg: '预定记录不存在' }
    }
    if (!['approved', 'checked_in'].includes(booking.status)) {
      return { code: -1, msg: '当前状态无法提前结束' }
    }

    const now = Date.now()
    await db.collection('meeting-bookings').doc(bookingId).update({
      status: 'ended',
      ended_at: now,
      end_time: now < booking.end_time ? now : booking.end_time,
      updated_at: now
    })

    return { code: 0, msg: '已提前结束，房间已释放' }
  },

  // 管理员延长会议（可操作任意预定）
  async extendBooking(bookingId, newEnd, userId, userRole) {
    if (userRole !== 'admin') {
      return { code: -1, msg: '无管理员权限' }
    }

    const bookingRes = await db.collection('meeting-bookings').doc(bookingId).get()
    const booking = bookingRes.data && bookingRes.data.length > 0 ? bookingRes.data[0] : null

    if (!booking) {
      return { code: -1, msg: '预定记录不存在' }
    }
    if (!['approved', 'checked_in'].includes(booking.status)) {
      return { code: -1, msg: '当前状态无法延长' }
    }

    // 延长后的结束时间必须晚于当前结束时间（数字比较，避免字符串字典序）
    const newEndTs = toTimestamp(newEnd)
    const currentEndTs = toTimestamp(booking.end_time)
    if (!Number.isFinite(newEndTs)) {
      return { code: -1, msg: '时间格式不正确，请重新选择' }
    }
    if (newEndTs <= currentEndTs) {
      return { code: -1, msg: '延长结束时间必须晚于当前结束时间' }
    }

    // 检查延长时间段是否有冲突
    const conflictRes = await db.collection('meeting-bookings')
      .where({
        room_id: booking.room_id,
        _id: dbCmd.neq(bookingId),
        status: dbCmd.in(['pending', 'approved', 'checked_in']),
        start_time: dbCmd.lt(newEndTs),
        end_time: dbCmd.gt(currentEndTs)
      })
      .get()

    if (conflictRes.data.length > 0) {
      return { code: -1, msg: '延长时间段与其他预定冲突' }
    }

    const now = Date.now()
    const extension = {
      old_end: booking.end_time,
      new_end: newEndTs,
      time: now,
      by: 'admin'
    }

    await db.collection('meeting-bookings').doc(bookingId).update({
      end_time: newEndTs,
      extensions: dbCmd.push(extension),
      updated_at: now
    })

    return { code: 0, msg: '延长成功' }
  },

  // 查看所有预定（支持按日期和房间筛选）
  async getAllBookings(userId, userRole, date, roomId) {
    if (userRole !== 'admin') {
      return { code: -1, msg: '无管理员权限' }
    }

    const query = {}
    if (roomId) {
      query.room_id = roomId
    }
    if (date) {
      const targetDate = new Date(date)
      const dayStart = new Date(targetDate).setHours(0, 0, 0, 0)
      const dayEnd = new Date(targetDate).setHours(23, 59, 59, 999)
      query.start_time = dbCmd.gte(dayStart).and(dbCmd.lte(dayEnd))
    }

    const bookingsRes = await db.collection('meeting-bookings')
      .where(query)
      .orderBy('start_time', 'asc')
      .limit(100)
      .get()

    // 获取房间信息
    const roomIds = [...new Set(bookingsRes.data.map(b => b.room_id))]
    let roomsMap = {}
    if (roomIds.length > 0) {
      const roomsRes = await db.collection('meeting-rooms')
        .where({ _id: dbCmd.in(roomIds) })
        .get()
      roomsRes.data.forEach(r => {
        roomsMap[r._id] = r.name
      })
    }

    const bookings = bookingsRes.data.map(b => ({
      ...b,
      room_name: roomsMap[b.room_id] || '未知房间'
    }))

    return {
      code: 0,
      data: bookings
    }
  }
}
