const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})
const db = cloud.database()

function genInviteCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { name } = event

  if (!OPENID) {
    return { success: false, errMsg: '未登录' }
  }
  if (!name || !name.trim()) {
    return { success: false, errMsg: '请输入群组名称' }
  }

  try {
    const userRes = await db.collection('users').where({ openid: OPENID }).get()
    if (userRes.data.length === 0) {
      return { success: false, errMsg: '用户记录不存在' }
    }
    const user = userRes.data[0]

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

    const groupData = {
      name: name.trim(),
      ownerId: OPENID,
      inviteCode: inviteCode,
      members: [{
        openid: OPENID,
        nickName: user.nickName,
        avatarUrl: user.avatarUrl,
        role: 'owner'
      }],
      createdAt: db.serverDate()
    }

    const res = await db.collection('groups').add({
      data: groupData
    })

    groupData._id = res.id
    return {
      success: true,
      group: groupData
    }
  } catch (err) {
    return { success: false, errMsg: err.message || err }
  }
}
