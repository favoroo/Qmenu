const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()
  const { groupId, name } = event

  if (!OPENID) {
    return { success: false, errMsg: '未登录' }
  }
  if (!groupId) {
    return { success: false, errMsg: '缺失群组参数' }
  }
  if (!name || !name.trim()) {
    return { success: false, errMsg: '请输入群组名称' }
  }

  try {
    const groupRes = await db.collection('groups').doc(groupId).get()
    const group = groupRes.data

    if (group.ownerId !== OPENID) {
      return { success: false, errMsg: '只有群主才能修改群名称' }
    }

    const newName = name.trim()
    await db.collection('groups').doc(groupId).update({
      data: { name: newName }
    })

    group.name = newName
    return { success: true, group }
  } catch (err) {
    return { success: false, errMsg: err.message || err }
  }
}
