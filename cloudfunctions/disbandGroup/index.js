const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})
const db = cloud.database()

// 收集菜谱中的所有云存储图片 fileID
function collectRecipeFileIDs(recipes) {
  const fileIDs = []
  ;(recipes || []).forEach(r => {
    if (r.image && typeof r.image === 'string' && r.image.startsWith('cloud://')) {
      fileIDs.push(r.image)
    }
    ;(r.steps || []).forEach(s => {
      if (s.image && typeof s.image === 'string' && s.image.startsWith('cloud://')) {
        fileIDs.push(s.image)
      }
    })
  })
  return fileIDs
}

// 分批删除云存储文件(单次上限 50),失败的 fileID 写入 orphan_images 集合
async function deleteCloudFilesBatched(fileIDs) {
  if (!fileIDs || fileIDs.length === 0) return
  const failed = []
  for (let i = 0; i < fileIDs.length; i += 50) {
    const batch = fileIDs.slice(i, i + 50)
    try {
      const res = await cloud.deleteFile({ fileList: batch })
      const failItems = (res.fileList || []).filter(f => f.status !== 0)
      failItems.forEach(f => failed.push(f.fileID))
    } catch (err) {
      // 整批失败,全部记录到孤儿集合
      batch.forEach(f => failed.push(f))
    }
  }
  if (failed.length > 0) {
    try {
      await db.collection('orphan_images').add({
        data: {
          fileIDs: failed,
          createTime: Date.now(),
          source: 'disband_group'
        }
      })
    } catch (e) {
      console.warn('[disbandGroup] 记录孤儿图片失败', e)
    }
  }
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
      return { success: false, errMsg: '只有群主才能解散群组' }
    }

    // 删除 recipes 文档之前,先收集云存储图片 fileID
    const recipeRes = await db.collection('recipes').where({ groupId }).get()
    const fileIDs = collectRecipeFileIDs(recipeRes.data)

    // 分批删除云存储图片(失败记录到 orphan_images 供定时清理)
    await deleteCloudFilesBatched(fileIDs)

    await db.collection('groups').doc(groupId).remove()

    // 批量清理该群组的数据
    await db.collection('categories').where({ groupId }).remove()
    await db.collection('recipes').where({ groupId }).remove()
    await db.collection('orders').where({ groupId }).remove()
    await db.collection('cart').where({ groupId }).remove()
    await db.collection('ratings').where({ groupId }).remove()

    return { success: true }
  } catch (err) {
    return { success: false, errMsg: err.message || err }
  }
}
