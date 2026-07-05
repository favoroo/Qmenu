const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})
const db = cloud.database()
const _ = db.command

const MAX_RETRY = 5
const PAGE_SIZE = 100

exports.main = async (event, context) => {
  let processed = 0
  let deleted = 0
  let failed = 0
  let skip = 0

  while (true) {
    let data = []
    try {
      const res = await db.collection('orphan_images')
        .where({ retryCount: _.lt(MAX_RETRY) })
        .skip(skip)
        .limit(PAGE_SIZE)
        .get()
      data = res.data || []
    } catch (err) {
      // orphan_images 集合不存在或其他查询错误,降级为空结束循环
      console.warn('[cleanupOrphanImages] 查询 orphan_images 失败', err)
      break
    }

    if (data.length === 0) break

    for (const record of data) {
      const fileIDs = record.fileIDs || []
      if (fileIDs.length === 0) {
        try {
          await db.collection('orphan_images').doc(record._id).remove()
        } catch (e) {}
        continue
      }

      const res = await cloud.deleteFile({ fileList: fileIDs })
      const successIDs = (res.fileList || []).filter(f => f.status === 0).map(f => f.fileID)
      const remainIDs = fileIDs.filter(id => !successIDs.includes(id))

      if (remainIDs.length === 0) {
        try {
          await db.collection('orphan_images').doc(record._id).remove()
        } catch (e) {}
        deleted += fileIDs.length
      } else {
        try {
          await db.collection('orphan_images').doc(record._id).update({
            data: {
              fileIDs: remainIDs,
              retryCount: (record.retryCount || 0) + 1,
              lastRetry: Date.now()
            }
          })
        } catch (e) {}
        failed += remainIDs.length
        deleted += successIDs.length
      }
      processed++
    }
    skip += data.length
  }

  return { success: true, processed, deleted, failed }
}
