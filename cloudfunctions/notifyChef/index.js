const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})
const db = cloud.database()

// 订阅消息模板 ID（购物清单提醒）
const TEMPLATE_ID = 'c-bEUg9VIR6K-XNWgtmtGC4HxT30LJpinCHqCQgG13M'

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { orderId, chefId, dishes, amount, ordererName, remark, createTime } = event

  if (!OPENID) {
    return { success: false, errMsg: '未登录' }
  }
  if (!chefId) {
    return { success: false, sent: false, errMsg: '未指定厨师' }
  }

  // 菜品摘要：拼成字符串，截断至 20 字（thing 类型上限）
  const dishSummary = (dishes || '').toString().slice(0, 20)
  const remarkText = (remark || '无').toString().slice(0, 20)
  const ordererText = (ordererName || '吃货').toString().slice(0, 10)
  const timeText = (createTime || '').toString().slice(0, 20)
  // thing5 拼接下单人+备注，整体截断 20 字（thing 类型上限）
  const tipText = (ordererText + '：' + remarkText).slice(0, 20)

  try {
    const result = await cloud.openapi.subscribeMessage.send({
      touser: chefId,
      templateId: TEMPLATE_ID,
      page: 'pages/order/index?tab=kitchen',
      miniprogramState: 'formal', // 开发版 developer / 体验版 trial / 正式版 formal
      lang: 'zh_CN',
      data: {
        thing1: { value: dishSummary },         // 菜品明细（待购物品）
        number2: { value: amount },             // 订单金额（数量，数字类型）
        time3: { value: timeText },             // 下单时间（截止时间）
        time4: { value: timeText },             // 下单时间（购买时间，填充避免空值）
        thing5: { value: tipText }  // 下单人+备注（温馨提示，thing 类型≤20字）
      }
    })
    // best-effort 记录通知状态
    await updateNotifyStatus(orderId, 'sent', null).catch(() => {})
    return { success: true, sent: true, result }
  } catch (err) {
    const errCode = err.errCode !== undefined ? err.errCode : -1
    await updateNotifyStatus(orderId, 'failed', errCode).catch(() => {})
    // 43101: 用户未订阅/拒绝；47003: 模板参数不准确；40037: 模板ID错误
    return { success: true, sent: false, errCode, errMsg: err.errMsg || String(err) }
  }
}

async function updateNotifyStatus(orderId, status, errCode) {
  if (!orderId) return
  const res = await db.collection('orders').where({ id: orderId }).limit(1).get()
  if (res.data.length > 0) {
    await db.collection('orders').doc(res.data[0]._id).update({
      data: {
        lastNotifyStatus: status,
        lastNotifyErrCode: errCode,
        lastNotifyTime: db.serverDate()
      }
    })
  }
}
