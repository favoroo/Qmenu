const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { groupId, newOwnerOpenid } = event

  if (!OPENID) {
    return { success: false, errMsg: '未登录' }
  }
  if (!groupId) {
    return { success: false, errMsg: '缺失群组参数' }
  }
  if (!newOwnerOpenid) {
    return { success: false, errMsg: '缺失新群主参数' }
  }

  try {
    const groupRes = await db.collection('groups').doc(groupId).get()
    const group = groupRes.data

    if (group.ownerId !== OPENID) {
      return { success: false, errMsg: '只有群主才能转让群主' }
    }
    if (newOwnerOpenid === OPENID) {
      return { success: false, errMsg: '您已经是群主' }
    }

    const target = group.members.find(m => m.openid === newOwnerOpenid)
    if (!target) {
      return { success: false, errMsg: '目标成员不在群组中' }
    }

    const newMembers = group.members.map(m => {
      if (m.openid === newOwnerOpenid) return { ...m, role: 'owner' }
      if (m.openid === OPENID) return { ...m, role: 'member' }
      return m
    })

    await db.collection('groups').doc(groupId).update({
      data: { ownerId: newOwnerOpenid, members: newMembers }
    })

    group.ownerId = newOwnerOpenid
    group.members = newMembers
    return { success: true, group }
  } catch (err) {
    return { success: false, errMsg: err.message || err }
  }
}
