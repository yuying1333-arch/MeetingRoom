/**
 * 会议室订阅消息工具
 * 用于请求用户授权订阅消息，实现提醒功能
 *
 * 使用 ESM 具名导出，供页面 import { xxx } from '@/common/subscribeMessage.js'
 */

// 订阅消息模板 ID（需要在小程序后台申请后替换）
export const TEMPLATE_IDS = {
  // 预定结果通知（批准/驳回）
  BOOKING_RESULT: 'YOUR_BOOKING_RESULT_TEMPLATE_ID',
  // 签到提醒（开始前3分钟）
  CHECKIN_REMINDER: 'YOUR_CHECKIN_REMINDER_TEMPLATE_ID',
  // 即将到期提醒（结束前5分钟）
  EXPIRING_REMINDER: 'YOUR_EXPIRING_REMINDER_TEMPLATE_ID'
}

/**
 * 请求订阅消息授权
 * 仅在微信小程序环境调用 uni.requestSubscribeMessage；
 * 其他环境（H5/App）直接返回空结果，避免报错。
 * @param {Array} templateIds - 模板 ID 列表
 * @returns {Promise}
 */
export function requestSubscribeMessage(templateIds = []) {
  return new Promise((resolve, reject) => {
    const ids = templateIds && templateIds.length > 0 ? templateIds : [
      TEMPLATE_IDS.BOOKING_RESULT,
      TEMPLATE_IDS.CHECKIN_REMINDER,
      TEMPLATE_IDS.EXPIRING_REMINDER
    ]

    // #ifdef MP-WEIXIN
    if (typeof uni !== 'undefined' && uni.requestSubscribeMessage) {
      uni.requestSubscribeMessage({
        tmplIds: ids,
        success(res) {
          console.log('订阅消息授权结果', res)
          resolve(res)
        },
        fail(err) {
          console.error('订阅消息授权失败', err)
          // 授权失败不阻塞主流程
          resolve({})
        }
      })
    } else {
      resolve({})
    }
    // #endif

    // #ifndef MP-WEIXIN
    console.log('非微信小程序环境，跳过订阅消息授权')
    resolve({})
    // #endif
  })
}

/**
 * 提交预定申请时请求订阅授权
 * 任何情况都返回布尔值，不会抛错阻塞提交流程
 */
export async function requestOnBookingSubmit() {
  try {
    await requestSubscribeMessage([
      TEMPLATE_IDS.BOOKING_RESULT,
      TEMPLATE_IDS.CHECKIN_REMINDER
    ])
    return true
  } catch (e) {
    console.error('请求订阅授权失败', e)
    return false
  }
}

/**
 * 获取订阅消息模板 ID
 */
export function getTemplateIds() {
  return TEMPLATE_IDS
}

// 默认导出，兼容 import xxx from 的写法
export default {
  TEMPLATE_IDS,
  requestSubscribeMessage,
  requestOnBookingSubmit,
  getTemplateIds
}
