/**
 * 订阅消息工具模块
 * 集中管理模板 ID、订阅请求封装、notifyChef 云函数调用
 */

// 厨师新订单提醒模板 ID（购物清单提醒）
const CHEF_NOTIFY_TMPL_ID = 'c-bEUg9VIR6K-XNWgtmtGC4HxT30LJpinCHqCQgG13M'

/**
 * 请求厨师订阅（必须在 tap 事件中同步调用，调用前不得 await）
 * @returns {Promise<{state: string, accepted: boolean}>}
 */
function requestChefSubscribe() {
  return new Promise((resolve) => {
    wx.requestSubscribeMessage({
      tmplIds: [CHEF_NOTIFY_TMPL_ID],
      success(res) {
        const state = res[CHEF_NOTIFY_TMPL_ID] // 'accept' | 'reject' | 'ban'
        if (state === 'accept') {
          // 记录已订阅时间，用于控制横幅显隐
          wx.setStorageSync('chefNotifySubscribedAt', Date.now())
        }
        resolve({ state, accepted: state === 'accept' })
      },
      fail(err) {
        resolve({ state: 'fail', accepted: false, err })
      }
    })
  })
}

/**
 * 调用云函数通知厨师
 * @param {Object} order - 订单对象
 * @returns {Promise<{success: boolean, sent: boolean, errCode?: number, errMsg?: string}>}
 */
function callNotifyChef(order) {
  return wx.cloud.callFunction({
    name: 'notifyChef',
    data: {
      orderId: order.id,
      chefId: order.chefId,
      chefName: order.chefName,
      dishes: (order.items || []).map(i => i.name + 'x' + i.quantity).join('，'),
      amount: order.totalAmount,
      ordererName: order.userName,
      remark: order.remark,
      createTime: order.createTime
    }
  }).then(res => res.result || { success: false, sent: false })
}

module.exports = {
  CHEF_NOTIFY_TMPL_ID,
  requestChefSubscribe,
  callNotifyChef
}
