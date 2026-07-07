const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})
const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  if (!openid) {
    return {
      success: false,
      errMsg: 'Failed to get OPENID'
    }
  }

  const { nickName, avatarUrl } = event
  const updateData = {}
  if (nickName !== undefined) updateData.nickName = nickName
  if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl
  updateData.updatedAt = db.serverDate()

  try {
    const userRes = await db.collection('users').where({
      openid: openid
    }).get()

    if (userRes.data.length > 0) {
      await db.collection('users').doc(userRes.data[0]._id).update({
        data: updateData
      })
      const updatedUser = {
        ...userRes.data[0],
        ...updateData
      }

      // 同步更新该用户所在的群组里的成员头像和昵称
      const groupsRes = await db.collection('groups').where({
        'members.openid': openid
      }).get()

      if (groupsRes.data.length > 0) {
        for (const group of groupsRes.data) {
          const updatedMembers = group.members.map(m => {
            if (m.openid === openid) {
              return {
                ...m,
                nickName: nickName !== undefined ? nickName : m.nickName,
                avatarUrl: avatarUrl !== undefined ? avatarUrl : m.avatarUrl
              }
            }
            return m
          })
          await db.collection('groups').doc(group._id).update({
            data: {
              members: updatedMembers
            }
          })
        }
      }

      return {
        success: true,
        userInfo: updatedUser
      }
    } else {
      return {
        success: false,
        errMsg: 'User not found'
      }
    }
  } catch (err) {
    return {
      success: false,
      errMsg: err.message || err
    }
  }
}
