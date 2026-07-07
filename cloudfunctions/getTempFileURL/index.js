const cloud = require('wx-server-sdk')
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

/**
 * 批量将 cloud:// fileID 转换为临时下载链接
 * 解决免费版云存储权限无法设置为"所有用户可读"的问题
 * 
 * @param {Object} event
 * @param {string[]} event.fileIDs - cloud:// 开头的 fileID 数组
 * @returns {Object} { success: true, fileList: [{ fileID, tempFileURL, status, errMsg }] }
 */
exports.main = async (event, context) => {
  const { fileIDs } = event

  if (!fileIDs || !Array.isArray(fileIDs) || fileIDs.length === 0) {
    return {
      success: false,
      errMsg: 'fileIDs 参数不能为空或不是数组'
    }
  }

  // 过滤掉非 cloud:// 开头的路径
  const cloudFileIDs = fileIDs.filter(id => typeof id === 'string' && id.startsWith('cloud://'))

  if (cloudFileIDs.length === 0) {
    return {
      success: true,
      fileList: []
    }
  }

  // 分批处理（每批最多 50 个）
  const allResults = []
  const BATCH_SIZE = 50

  try {
    for (let i = 0; i < cloudFileIDs.length; i += BATCH_SIZE) {
      const batch = cloudFileIDs.slice(i, i + BATCH_SIZE)

      const result = await cloud.getTempFileURL({
        fileList: batch
      })

      if (result.fileList) {
        for (const item of result.fileList) {
          allResults.push({
            fileID: item.fileID,
            tempFileURL: item.tempFileURL || '',
            status: item.status,
            errMsg: item.errMsg || ''
          })
        }
      }
    }

    return {
      success: true,
      fileList: allResults
    }
  } catch (err) {
    console.error('[getTempFileURL] 云函数执行失败:', err)
    return {
      success: false,
      errMsg: err.message || String(err),
      fileList: allResults
    }
  }
}
