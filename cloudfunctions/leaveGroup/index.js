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

    if (group.ownerId === OPENID) {
      return { success: false, errMsg: '群主不能退出群组，如需解散请直接解散群组' }
    }

    const newMembers = group.members.filter(m => m.openid !== OPENID)
    await db.collection('groups').doc(groupId).update({
      data: {
        members: newMembers
      }
    })

    return { success: true }
  } catch (err) {
    return { success: false, errMsg: err.message || err }
  }
}
