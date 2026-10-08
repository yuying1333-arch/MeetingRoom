const db = uniCloud.database()
const dbCmd = db.command

// 占用判定宽限：会议开始前 5 分钟即视为占用中
const OCCUPY_LEAD_MS = 5 * 60 * 1000

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

// 预置房间数据（按布局图锚点）
const DEFAULT_ROOMS = [
  { _id: 'room_office',     name: '办公室',    type: 'office',    bookable: false, position: 'top-left',     sort: 1 },
  { _id: 'room_meeting1',   name: '会议室1',   type: 'meeting',   bookable: true,  position: 'top-center',   sort: 2 },
  { _id: 'room_meeting2',   name: '会议室2',   type: 'meeting',   bookable: true,  position: 'top-right',    sort: 3 },
  { _id: 'room_meeting3',   name: '会议室3',   type: 'meeting',   bookable: true,  position: 'bottom-left',  sort: 4 },
  { _id: 'room_boardroom',  name: '董事长室',  type: 'boardroom', bookable: true,  position: 'bottom-right', sort: 5 }
]

// 首次访问自动播种房间数据
async function seedRoomsIfNeeded() {
  const countRes = await db.collection('meeting-rooms').count()
  if (countRes.total > 0) return false

  for (const room of DEFAULT_ROOMS) {
    try {
      await db.collection('meeting-rooms').add(room)
    } catch (e) {
      console.error(`房间 ${room.name} 播种失败`, e.message)
    }
  }
  return true
}

module.exports = {
  _before: async function() {
    // 云对象前置校验（可选）
  },

  // 获取房间列表 + 当前占用状态 + 当日排队
  async getRoomList() {
    await seedRoomsIfNeeded()

    const now = Date.now()
    const todayStart = new Date().setHours(0, 0, 0, 0)
    const todayEnd = new Date().setHours(23, 59, 59, 999)

    // 获取所有房间
    const roomsRes = await db.collection('meeting-rooms').orderBy('sort', 'asc').get()
    const rooms = roomsRes.data

    // 获取今日有效预定（pending/approved/checked_in，按开始时间升序排队）
    const bookingsRes = await db.collection('meeting-bookings')
      .where({
        status: dbCmd.in(['pending', 'approved', 'checked_in']),
        start_time: dbCmd.lte(todayEnd),
        end_time: dbCmd.gte(todayStart)
      })
      .orderBy('start_time', 'asc')
      .get()

    const bookings = bookingsRes.data

    // 组装房间状态
    const result = rooms.map(room => {
      const roomBookings = bookings.filter(b => b.room_id === room._id)
      // 占用判定：当前时间在 [开始时间-5分钟, 结束时间] 内，且已批准/已签到
      const currentBooking = roomBookings.find(b =>
        ['approved', 'checked_in'].includes(b.status) &&
        now >= b.start_time - OCCUPY_LEAD_MS &&
        now <= b.end_time
      ) || null
      // 下一场尚未开始的预定
      const nextBooking = roomBookings.find(b => now < b.start_time - OCCUPY_LEAD_MS) || null

      return {
        ...room,
        isOccupied: !!currentBooking,
        currentBooking: currentBooking ? {
          id: currentBooking._id,
          user_name: currentBooking.user_name,
          start_time: currentBooking.start_time,
          end_time: currentBooking.end_time,
          status: currentBooking.status
        } : null,
        nextBooking: nextBooking ? {
          id: nextBooking._id,
          user_name: nextBooking.user_name,
          start_time: nextBooking.start_time,
          end_time: nextBooking.end_time,
          status: nextBooking.status
        } : null,
        // 当日排队（含进行中的），按开始时间升序
        queue: roomBookings.map(b => ({
          id: b._id,
          user_name: b.user_name,
          start_time: b.start_time,
          end_time: b.end_time,
          status: b.status,
          is_active: ['approved', 'checked_in'].includes(b.status) &&
            now >= b.start_time - OCCUPY_LEAD_MS && now <= b.end_time
        }))
      }
    })

    return {
      code: 0,
      data: result
    }
  },

  // 获取某房间当日预定排队（按开始时间升序，含占用标记）
  async getRoomDetail(roomId, date) {
    const now = Date.now()
    const targetDate = date ? new Date(date) : new Date()
    const dayStart = new Date(targetDate).setHours(0, 0, 0, 0)
    const dayEnd = new Date(targetDate).setHours(23, 59, 59, 999)

    const bookingsRes = await db.collection('meeting-bookings')
      .where({
        room_id: roomId,
        start_time: dbCmd.gte(dayStart).and(dbCmd.lte(dayEnd)),
        status: dbCmd.in(['pending', 'approved', 'checked_in', 'cancel_pending'])
      })
      .orderBy('start_time', 'asc')
      .get()

    const bookings = bookingsRes.data.map(b => ({
      ...b,
      is_active: ['approved', 'checked_in'].includes(b.status) &&
        now >= b.start_time - OCCUPY_LEAD_MS && now <= b.end_time
    }))

    return {
      code: 0,
      data: bookings
    }
  },

  // 提交预定申请（前端传入 user_id）
  async submitBooking(data) {
    const { room_id, reason, user_id, user_name } = data

    if (!room_id || !reason || !user_id) {
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
        status: dbCmd.in(['pending', 'approved', 'checked_in']),
        start_time: dbCmd.lt(end_time),
        end_time: dbCmd.gt(start_time)
      })
      .get()

    if (conflictRes.data.length > 0) {
      return { code: -1, msg: '该时间段已被预定，请选择其他时间' }
    }

    // 查询提交人角色：管理员提交的预定无需审批，直接批准
    let isAdmin = false
    try {
      const userRes = await db.collection('meeting-users').doc(user_id).get()
      if (userRes.data && userRes.data.length > 0) {
        isAdmin = userRes.data[0].role === 'admin'
      }
    } catch (e) {
      console.error('查询用户角色失败', e)
    }

    const now = Date.now()
    const bookingData = {
      room_id,
      user_id,
      user_name: user_name || '未知用户',
      start_time,
      end_time,
      original_end_time: end_time,
      reason,
      status: isAdmin ? 'approved' : 'pending',
      extensions: [],
      created_at: now,
      updated_at: now
    }
    if (isAdmin) {
      bookingData.admin_id = user_id
    }

    const addRes = await db.collection('meeting-bookings').add(bookingData)

    return {
      code: 0,
      msg: isAdmin ? '预定成功（管理员无需审批）' : '申请已提交，等待审批',
      data: { id: addRes.id }
    }
  },

  // 签到
  async checkIn(bookingId, userId) {
    const bookingRes = await db.collection('meeting-bookings').doc(bookingId).get()
    const booking = bookingRes.data && bookingRes.data.length > 0 ? bookingRes.data[0] : null

    if (!booking) {
      return { code: -1, msg: '预定记录不存在' }
    }
    if (booking.user_id !== userId) {
      return { code: -1, msg: '无权操作' }
    }
    if (booking.status !== 'approved') {
      return { code: -1, msg: '当前状态无法签到' }
    }

    const now = Date.now()
    const checkInStart = booking.start_time - 30 * 60 * 1000
    const checkInEnd = booking.start_time + 30 * 60 * 1000

    if (now < checkInStart) {
      return { code: -1, msg: '签到时间未到，请在开始前30分钟内签到' }
    }
    if (now > checkInEnd) {
      return { code: -1, msg: '已超过签到时间' }
    }

    await db.collection('meeting-bookings').doc(bookingId).update({
      status: 'checked_in',
      checked_in_at: now,
      updated_at: now
    })

    return {
      code: 0,
      msg: '签到成功'
    }
  },

  // 提前结束
  async endEarly(bookingId, userId) {
    const bookingRes = await db.collection('meeting-bookings').doc(bookingId).get()
    const booking = bookingRes.data && bookingRes.data.length > 0 ? bookingRes.data[0] : null

    if (!booking) {
      return { code: -1, msg: '预定记录不存在' }
    }
    if (booking.user_id !== userId) {
      return { code: -1, msg: '无权操作' }
    }
    if (booking.status !== 'checked_in') {
      return { code: -1, msg: '当前状态无法提前结束' }
    }

    const now = Date.now()

    await db.collection('meeting-bookings').doc(bookingId).update({
      status: 'ended',
      ended_at: now,
      end_time: now,
      updated_at: now
    })

    return {
      code: 0,
      msg: '已提前结束'
    }
  },

  // 延长
  async extendBooking(bookingId, newEnd, userId) {
    const bookingRes = await db.collection('meeting-bookings').doc(bookingId).get()
    const booking = bookingRes.data && bookingRes.data.length > 0 ? bookingRes.data[0] : null

    if (!booking) {
      return { code: -1, msg: '预定记录不存在' }
    }
    if (booking.user_id !== userId) {
      return { code: -1, msg: '无权操作' }
    }
    if (booking.status !== 'checked_in') {
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
      time: now
    }

    await db.collection('meeting-bookings').doc(bookingId).update({
      end_time: newEndTs,
      extensions: dbCmd.push(extension),
      updated_at: now
    })

    return {
      code: 0,
      msg: '延长成功'
    }
  },

  // 我的预定列表（前端传入 user_id）
  async getMyBookings(userId, status) {
    if (!userId) {
      return { code: -1, msg: '请先登录' }
    }

    const query = { user_id: userId }
    if (status && status !== 'all') {
      query.status = status
    }

    const bookingsRes = await db.collection('meeting-bookings')
      .where(query)
      .orderBy('created_at', 'desc')
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

  // 用户申请撤销预定
  // pending 状态：直接取消；approved/checked_in 状态：进入 cancel_pending 等待管理员确认
  async cancelBooking(bookingId, userId, reason) {
    const bookingRes = await db.collection('meeting-bookings').doc(bookingId).get()
    const booking = bookingRes.data && bookingRes.data.length > 0 ? bookingRes.data[0] : null

    if (!booking) {
      return { code: -1, msg: '预定记录不存在' }
    }
    if (booking.user_id !== userId) {
      return { code: -1, msg: '无权操作' }
    }

    const now = Date.now()

    // 待审批的申请：直接取消
    if (booking.status === 'pending') {
      await db.collection('meeting-bookings').doc(bookingId).update({
        status: 'cancelled',
        cancel_reason: (reason || '').trim(),
        cancel_requested_at: now,
        updated_at: now
      })
      return { code: 0, msg: '已取消申请' }
    }

    // 已批准/已签到：需管理员确认
    if (booking.status === 'approved' || booking.status === 'checked_in') {
      await db.collection('meeting-bookings').doc(bookingId).update({
        status: 'cancel_pending',
        pre_cancel_status: booking.status,
        cancel_reason: (reason || '').trim(),
        cancel_requested_at: now,
        updated_at: now
      })
      return { code: 0, msg: '撤销申请已提交，等待管理员确认' }
    }

    return { code: -1, msg: '当前状态无法撤销' }
  },

  // 预定详情
  async getBookingDetail(bookingId) {
    const bookingRes = await db.collection('meeting-bookings').doc(bookingId).get()
    const booking = bookingRes.data && bookingRes.data.length > 0 ? bookingRes.data[0] : null

    if (!booking) {
      return { code: -1, msg: '预定记录不存在' }
    }

    // 获取房间信息
    const roomRes = await db.collection('meeting-rooms').doc(booking.room_id).get()
    const room = roomRes.data && roomRes.data.length > 0 ? roomRes.data[0] : null

    return {
      code: 0,
      data: {
        ...booking,
        room_name: room ? room.name : '未知房间'
      }
    }
  }
}
