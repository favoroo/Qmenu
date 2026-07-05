/**
 * 图片处理模块 (云开发版)
 * 封装「选图 → 压缩 → 上传至微信云存储 → 删除」全流程。
 */
const fs = wx.getFileSystemManager();
const USER_DATA_PATH = wx.env.USER_DATA_PATH;
const IMG_DIR = `${USER_DATA_PATH}/recipe_imgs`;

const CONFIG = {
  storageMode: 'cloud',   // 'local'=本地持久化 | 'cloud'=云开发存储
  compress: {
    quality: 80,
    maxWidth: 1080,
    maxHeight: 1080
  }
};

function ensureDir() {
  try { fs.mkdirSync(IMG_DIR, true); } catch (e) { /* 目录已存在，忽略 */ }
}

function genFileName(ext) {
  ext = ext || 'jpg';
  return `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
}

// 是否为 chooseMedia 返回的临时路径
function isTempPath(p) {
  if (!p) return false;
  if (p.indexOf('/assets/') === 0) return false;
  if (p.startsWith('cloud://')) return false;
  if (/^https?:\/\//.test(p)) return false;
  return true;
}

// 是否为本模块管理的云端/本地文件
function isManagedLocalFile(p) {
  if (!p) return false;
  return p.startsWith('cloud://') || (p.indexOf(USER_DATA_PATH) !== -1 && p.indexOf('/recipe_imgs/') !== -1);
}

// 压缩图片
function compress(tempFilePath) {
  return new Promise(resolve => {
    wx.getImageInfo({
      src: tempFilePath,
      success: info => {
        let { width, height } = info;
        const maxSize = CONFIG.compress.maxWidth || 1080;
        let targetWidth = width;
        let targetHeight = height;
        
        if (width > maxSize || height > maxSize) {
          if (width > height) {
            targetHeight = Math.round((height * maxSize) / width);
            targetWidth = maxSize;
          } else {
            targetWidth = Math.round((width * maxSize) / height);
            targetHeight = maxSize;
          }
        }
        
        wx.compressImage({
          src: tempFilePath,
          quality: CONFIG.compress.quality,
          compressedWidth: targetWidth,
          compressedHeight: targetHeight,
          success: res => resolve(res.tempFilePath),
          fail: () => resolve(tempFilePath)
        });
      },
      fail: () => {
        // Fallback: compress quality only without resizing if getImageInfo fails
        wx.compressImage({
          src: tempFilePath,
          quality: CONFIG.compress.quality,
          success: res => resolve(res.tempFilePath),
          fail: () => resolve(tempFilePath)
        });
      }
    });
  });
}

// 本地持久化 (降级备份用)
function saveLocal(tempFilePath) {
  ensureDir();
  const target = `${IMG_DIR}/${genFileName()}`;
  return new Promise((resolve, reject) => {
    fs.saveFile({
      tempFilePath,
      filePath: target,
      success: res => resolve(res.savedFilePath || target),
      fail: err => {
        if (err && /1300202|limit/i.test(err.errMsg || '')) {
          reject(new Error('本地存储空间不足'));
        } else {
          reject(err);
        }
      }
    });
  });
}

// 上传到微信云开发存储
function uploadCloud(tempFilePath) {
  return new Promise((resolve, reject) => {
    const ext = tempFilePath.split('.').pop() || 'jpg';
    const cloudPath = `recipes/${Date.now()}-${Math.random().toString(36).substr(2, 6)}.${ext}`;
    wx.cloud.uploadFile({
      cloudPath,
      filePath: tempFilePath,
      success: res => resolve(res.fileID),
      fail: reject
    });
  });
}

// 统一入口
function storeImage(tempFilePath) {
  if (CONFIG.storageMode === 'cloud') {
    return compress(tempFilePath).then(uploadCloud);
  }
  return compress(tempFilePath).then(saveLocal);
}

// 删除图片 (异步)
function removeImage(filePath) {
  return new Promise(resolve => {
    if (!isManagedLocalFile(filePath)) return resolve(false);
    if (filePath.startsWith('cloud://')) {
      wx.cloud.deleteFile({
        fileList: [filePath],
        success: () => resolve(true),
        fail: () => resolve(false)
      });
    } else {
      fs.unlink({
        filePath,
        success: () => resolve(true),
        fail: () => resolve(false)
      });
    }
  });
}

// 删除图片 (同步/非阻塞)
function removeImageSync(filePath) {
  if (!isManagedLocalFile(filePath)) return false;
  if (filePath.startsWith('cloud://')) {
    // 异步执行云存储文件删除，不阻塞当前流程
    wx.cloud.deleteFile({
      fileList: [filePath]
    });
    return true;
  } else {
    try { fs.unlinkSync(filePath); return true; } catch (e) { return false; }
  }
}

function removeImagesSync(paths) {
  (paths || []).forEach(removeImageSync);
}

// 批量删除图片(可感知失败),云存储删除失败的 fileID 写入 orphan_images 集合供定时清理
async function removeImagesAsync(paths) {
  const validPaths = (paths || []).filter(p => typeof p === 'string' && p)
  const cloudPaths = validPaths.filter(p => p.startsWith('cloud://'))
  const localPaths = validPaths.filter(p => !p.startsWith('cloud://') && isManagedLocalFile(p))
  // 本地图片同步删(失败忽略)
  localPaths.forEach(p => { try { fs.unlinkSync(p); } catch (e) {} })
  if (cloudPaths.length === 0) return
  const results = []
  for (let i = 0; i < cloudPaths.length; i += 50) {
    const batch = cloudPaths.slice(i, i + 50)
    const res = await new Promise(resolve => {
      wx.cloud.deleteFile({
        fileList: batch,
        success: resolve,
        fail: () => resolve({ fileList: batch.map(f => ({ fileID: f, status: -1 })) })
      })
    })
    results.push(...(res.fileList || []))
  }
  const failed = results.filter(r => r.status !== 0).map(r => r.fileID)
  if (failed.length > 0) {
    try {
      const dbInstance = wx.cloud.database()
      await dbInstance.collection('orphan_images').add({
        data: { fileIDs: failed, createTime: Date.now(), source: 'recipe_delete' }
      })
    } catch (e) {
      console.warn('[image] 记录孤儿图片失败', e)
    }
  }
}

// 收集菜谱中的所有图片文件路径/fileID
function collectRecipeImages(recipe) {
  const list = [];
  if (!recipe) return list;
  if (isManagedLocalFile(recipe.image)) list.push(recipe.image);
  (recipe.steps || []).forEach(s => {
    if (isManagedLocalFile(s.image)) list.push(s.image);
  });
  return list;
}

// 清空本地临时图片目录
function clearAll() {
  try {
    ensureDir();
    const files = fs.readdirSync(IMG_DIR);
    files.forEach(f => {
      try { fs.unlinkSync(`${IMG_DIR}/${f}`); } catch (e) {}
    });
    return files.length;
  } catch (e) {
    return 0;
  }
}

module.exports = {
  CONFIG,
  storeImage,
  isTempPath,
  isManagedLocalFile,
  removeImage,
  removeImageSync,
  removeImagesSync,
  removeImagesAsync,
  collectRecipeImages,
  clearAll
};
