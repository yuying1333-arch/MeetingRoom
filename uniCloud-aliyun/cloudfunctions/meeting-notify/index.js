const db = uniCloud.database()
const dbCmd = db.command

// 配置项（需要在小程序后台申请模板 ID）
const CONFIG = {
  APPID: 'YOUR_APPID',
  APPSECRET: 'YOUR_APPSECRET',
  TEMPLATES: {
    CHECKIN_REMINDER: 'YOUR_CHECKIN_TEMPLATE_ID',
    EXPIRING_REMINDER: 'YOUR_EXPIRING_TEMPLATE_ID',
    BOOKING_RESULT: 'YOUR_RESULT_TEMPLATE_ID'
  }
}

// 获取 Access Token
async function getAccessToken() {
  const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${CONFIG.APPID}&secret=${CONFIG.APPSECRET}`
  const res = await uniCloud.httpclient.request(url, {
    method: 'GET',
    dataType: 'json'
  })
  if (res.data.access_token) {
    return res.data.access_token
  } else {
    console.error('获取 access_token 失败', res.data)
    throw new Error('获取 access_token 失败')
  }
}

// 发送订阅消息
async function sendSubscribeMessage(accessToken, params) {
  const url = `https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${accessToken}`
  const res = await uniCloud.httpclient.request(url, {
    method: 'POST',
    contentType: 'json',
    data: params,
    dataType: 'json'
  })
  if (res.data.errcode === 0) {
    console.log('发送成功', params.touser)
    return true
  } else {
    console.error('发送失败', res.data)
    return false
  }
}

// 格式化时间
function formatTime(timestamp) {
  const d = new Date(timestamp)
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${month}-${day} ${h}:${m}`
}

exports.main = async (event, context) => {
  const now = Date.now()
  const results = {
    checkInReminders: [],
    expiringReminders: [],
    approvalReminders: []
  }

  try {
    const accessToken = await getAccessToken()

    // 1. 签到提醒：查询未来3分钟内已批准且未签到的预定
    const threeMinutesLater = now + 3 * 60 * 1000
    const checkInQuery = await db.collection('meeting-bookings')
      .where({
        status: 'approved',
        start_time: dbCmd.gte(now),
        start_time: dbCmd.lte(threeMinutesLater),
        notified_checkin: dbCmd.neq(true) // 防止重复提醒
      })
      .get()

    for (const booking of checkInQuery.data) {
      // 获取用户 openId（假设 meeting-users 表中有 openid 字段）
      const userRes = await db.collection('meeting-users').doc(booking.user_id).get()
      const user = userRes.data && userRes.data.length > 0 ? userRes.data[0] : null
      const openid = user ? user.openid : null

      if (openid) {
        const sent = await sendSubscribeMessage(accessToken, {
          touser: openid,
          template_id: CONFIG.TEMPLATES.CHECKIN_REMINDER,
          data: {
            thing1: { value: booking.room_name || '会议室' },
            time2: { value: formatTime(booking.start_time) },
            thing3: { value: '请及时到场签到' }
          }
        })
        if (sent) {
          await db.collection('meeting-bookings').doc(booking._id).update({
            notified_checkin: true
          })
        }
      }

      results.checkInReminders.push({
        booking_id: booking._id,
        user_name: booking.user_name,
        start_time: booking.start_time
      })
    }

    // 2. 即将到期提醒：查询未来5分钟内即将结束的预定
    const fiveMinutesLater = now + 5 * 60 * 1000
    const expiringQuery = await db.collection('meeting-bookings')
      .where({
        status: 'checked_in',
        end_time: dbCmd.gte(now),
        end_time: dbCmd.lte(fiveMinutesLater),
        notified_expiring: dbCmd.neq(true)
      })
      .get()

    for (const booking of expiringQuery.data) {
      const userRes = await db.collection('meeting-users').doc(booking.user_id).get()
      const user = userRes.data && userRes.data.length > 0 ? userRes.data[0] : null
      const openid = user ? user.openid : null

      if (openid) {
        const sent = await sendSubscribeMessage(accessToken, {
          touser: openid,
          template_id: CONFIG.TEMPLATES.EXPIRING_REMINDER,
          data: {
            thing1: { value: booking.room_name || '会议室' },
            time2: { value: formatTime(booking.end_time) },
            thing3: { value: '使用时间即将结束，请注意' }
          }
        })
        if (sent) {
          await db.collection('meeting-bookings').doc(booking._id).update({
            notified_expiring: true
          })
        }
      }

      results.expiringReminders.push({
        booking_id: booking._id,
        user_name: booking.user_name,
        end_time: booking.end_time
      })
    }

    return {
      code: 0,
      msg: '提醒任务执行完成',
      data: results
    }
  } catch (e) {
    console.error('提醒任务执行失败', e)
    return {
      code: -1,
      msg: '提醒任务执行失败',
      error: e.message
    }
  }
}
