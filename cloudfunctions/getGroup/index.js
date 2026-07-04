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

  try {
    if (groupId) {
      const groupRes = await db.collection('groups').doc(groupId).get()
      const group = groupRes.data
      const isMember = group.members.some(m => m.openid === OPENID)
      if (!isMember) {
        return { success: false, errMsg: '您不是该群组成员，无权查看' }
      }
      return { success: true, group }
    } else {
      const groupsRes = await db.collection('groups').where({
        'members.openid': OPENID
      }).get()
      return { success: true, groups: groupsRes.data }
    }
  } catch (err) {
    return { success: false, errMsg: err.message || err }
  }
}
