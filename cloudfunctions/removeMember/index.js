const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { groupId, memberOpenid } = event

  if (!OPENID) {
    return { success: false, errMsg: '未登录' }
  }
  if (!groupId) {
    return { success: false, errMsg: '缺失群组参数' }
  }
  if (!memberOpenid) {
    return { success: false, errMsg: '缺失成员参数' }
  }

  try {
    const groupRes = await db.collection('groups').doc(groupId).get()
    const group = groupRes.data

    if (group.ownerId !== OPENID) {
      return { success: false, errMsg: '只有群主才能移除成员' }
    }
    if (memberOpenid === group.ownerId) {
      return { success: false, errMsg: '不能移除群主，如需解散请使用解散群组' }
    }

    const target = group.members.find(m => m.openid === memberOpenid)
    if (!target) {
      return { success: false, errMsg: '该成员不在群组中' }
    }

    const newMembers = group.members.filter(m => m.openid !== memberOpenid)
    await db.collection('groups').doc(groupId).update({
      data: { members: newMembers }
    })

    group.members = newMembers
    return { success: true, group }
  } catch (err) {
    return { success: false, errMsg: err.message || err }
  }
}
