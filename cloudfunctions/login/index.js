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

  try {
    // 查找用户是否已存在
    const userRes = await db.collection('users').where({
      openid: openid
    }).get()

    if (userRes.data.length > 0) {
      return {
        success: true,
        openid: openid,
        userInfo: userRes.data[0]
      }
    } else {
      // 创建新用户，设置默认昵称与头像
      const defaultUser = {
        openid: openid,
        nickName: '吃货_' + openid.substring(openid.length - 4),
        avatarUrl: '/assets/images/logo.png', // 默认头像
        createdAt: db.serverDate(),
        updatedAt: db.serverDate()
      }
      const addRes = await db.collection('users').add({
        data: defaultUser
      })
      defaultUser._id = addRes.id
      return {
        success: true,
        openid: openid,
        userInfo: defaultUser
      }
    }
  } catch (err) {
    return {
      success: false,
      errMsg: err.message || err
    }
  }
}
