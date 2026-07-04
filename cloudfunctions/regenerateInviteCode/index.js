const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})
const db = cloud.database()

function genInviteCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

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
      return { success: false, errMsg: '只有群主才能重新生成邀请码' }
    }

    let inviteCode = genInviteCode()
    let isDup = true
    while (isDup) {
      const dup = await db.collection('groups').where({ inviteCode }).get()
      if (dup.data.length === 0) {
        isDup = false
      } else {
        inviteCode = genInviteCode()
      }
    }

    await db.collection('groups').doc(groupId).update({
      data: { inviteCode }
    })

    group.inviteCode = inviteCode
    return { success: true, group }
  } catch (err) {
    return { success: false, errMsg: err.message || err }
  }
}
