const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})
const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { inviteCode } = event

  if (!OPENID) {
    return { success: false, errMsg: '未登录' }
  }
  if (!inviteCode || !inviteCode.trim()) {
    return { success: false, errMsg: '请输入邀请码' }
  }

  try {
    const code = inviteCode.trim().toUpperCase()
    const groupRes = await db.collection('groups').where({ inviteCode: code }).get()
    if (groupRes.data.length === 0) {
      return { success: false, errMsg: '未找到对应群组，请检查邀请码是否正确' }
    }
    const group = groupRes.data[0]

    if (group.members && group.members.length >= 20) {
      return { success: false, errMsg: '该群组成员人数已达上限(20人)' }
    }

    const userRes = await db.collection('users').where({ openid: OPENID }).get()
    if (userRes.data.length === 0) {
      return { success: false, errMsg: '当前用户记录不存在，请先登录' }
    }
    const user = userRes.data[0]

    const isMember = group.members.some(m => m.openid === OPENID)
    if (isMember) {
      return { success: true, group, alreadyIn: true }
    }

    if (event.dryRun) {
      return { success: true, group, alreadyIn: false }
    }

    const newMember = {
      openid: OPENID,
      nickName: user.nickName,
      avatarUrl: user.avatarUrl,
      role: 'member'
    }

    await db.collection('groups').doc(group._id).update({
      data: {
        members: _.push(newMember)
      }
    })

    group.members.push(newMember)
    return {
      success: true,
      group
    }
  } catch (err) {
    return { success: false, errMsg: err.message || err }
  }
}
