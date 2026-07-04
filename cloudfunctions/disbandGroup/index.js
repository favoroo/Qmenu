const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { groupId } = event

  if (!OPENID) {
    return { success: false, errMsg: '未登录' }
  }
  if (!groupId) {
    return { success: false, errMsg: '缺失群组参数' }
  }

  try {
    const groupRes = await db.collection('groups').doc(groupId).get()
    const group = groupRes.data

    if (group.ownerId !== OPENID) {
      return { success: false, errMsg: '只有群主才能解散群组' }
    }

    await db.collection('groups').doc(groupId).remove()

    // 批量清理该群组的数据
    await db.collection('categories').where({ groupId }).remove()
    await db.collection('recipes').where({ groupId }).remove()
    await db.collection('orders').where({ groupId }).remove()
    await db.collection('cart').where({ groupId }).remove()

    return { success: true }
  } catch (err) {
    return { success: false, errMsg: err.message || err }
  }
}
