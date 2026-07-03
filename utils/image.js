/**
 * 图片处理模块
 * 封装「选图 → 压缩 → 本地持久化 → 删除」全流程，为后续云上传预留接口。
 *
 * 当前 storageMode='local'：压缩后用 FileSystemManager.saveFile 保存到
 * wx.env.USER_DATA_PATH/recipe_imgs/ 下（本地用户文件，重启后仍可用）。
 *
 * 接入服务器时：把 CONFIG.storageMode 改为 'cloud' 并填 uploadUrl，
 * storeImage 会自动走 wx.uploadFile 上传并返回网络 URL，调用方代码无需改动。
 */
const fs = wx.getFileSystemManager();
const USER_DATA_PATH = wx.env.USER_DATA_PATH;
const IMG_DIR = `${USER_DATA_PATH}/recipe_imgs`;

// —— 配置：后续接服务器在此切换 ——
const CONFIG = {
  storageMode: 'local',   // 'local'=本地持久化(当前) | 'cloud'=云上传(预留)
  uploadUrl: '',          // 预留：云上传接口地址
  compress: {
    quality: 80,          // 仅 JPG 有效（iOS 仅 JPG 支持 quality 压缩）
    maxWidth: 1080,       // compressedWidth，等比缩放；2.26.0+ 生效，低版本忽略
    maxHeight: 1080       // compressedHeight
  }
};

function ensureDir() {
  try { fs.mkdirSync(IMG_DIR, true); } catch (e) { /* 目录已存在，忽略 */ }
}

function genFileName(ext) {
  ext = ext || 'jpg';
  return `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
}

// 是否为 chooseMedia 返回的临时路径（需处理）
function isTempPath(p) {
  if (!p) return false;
  if (p.indexOf('/assets/') === 0) return false;        // 代码包资源，不动
  if (p.indexOf(USER_DATA_PATH) !== -1) return false;   // 已持久化的本地用户文件
  if (/^https?:\/\//.test(p)) return false;             // 网络 URL（含未来云地址）
  return true;
}

// 是否为本模块管理的本地持久化文件（可安全删除）
function isManagedLocalFile(p) {
  if (!p) return false;
  return p.indexOf(USER_DATA_PATH) !== -1 && p.indexOf('/recipe_imgs/') !== -1;
}

// 压缩：返回压缩后 tempFilePath；失败降级返回原路径
function compress(tempFilePath) {
  return new Promise(resolve => {
    wx.compressImage({
      src: tempFilePath,
      quality: CONFIG.compress.quality,
      compressedWidth: CONFIG.compress.maxWidth,
      compressedHeight: CONFIG.compress.maxHeight,
      success: res => resolve(res.tempFilePath),
      fail: () => resolve(tempFilePath)   // iOS PNG / 低版本等场景降级
    });
  });
}

// 本地持久化：saveFile 移动临时文件到 USER_DATA_PATH/recipe_imgs
function saveLocal(tempFilePath) {
  ensureDir();
  const target = `${IMG_DIR}/${genFileName()}`;
  return new Promise((resolve, reject) => {
    fs.saveFile({
      tempFilePath,
      filePath: target,
      success: res => resolve(res.savedFilePath || target),
      fail: err => {
        // 1300202 = 超存储上限，给更友好提示
        if (err && /1300202|limit/i.test(err.errMsg || '')) {
          reject(new Error('本地存储空间不足，请清理旧菜谱后重试'));
        } else {
          reject(err);
        }
      }
    });
  });
}

// 预留：上传云存储，返回网络 URL
function uploadCloud(tempFilePath) {
  return new Promise((resolve, reject) => {
    if (!CONFIG.uploadUrl) return reject(new Error('未配置云上传地址'));
    wx.uploadFile({
      url: CONFIG.uploadUrl,
      filePath: tempFilePath,
      name: 'file',
      success: res => {
        try { resolve(JSON.parse(res.data).url); } catch (e) { reject(e); }
      },
      fail: reject
    });
  });
}

// 统一入口：按 storageMode 决定本地或云
function storeImage(tempFilePath) {
  if (CONFIG.storageMode === 'cloud') return uploadCloud(tempFilePath);
  return compress(tempFilePath).then(saveLocal);
}

// 删除（异步，非托管文件静默跳过）
function removeImage(filePath) {
  return new Promise(resolve => {
    if (!isManagedLocalFile(filePath)) return resolve(false);
    fs.unlink({
      filePath,
      success: () => resolve(true),
      fail: () => resolve(false)
    });
  });
}

// 删除（同步，供 db.deleteRecipe 等同步上下文使用）
function removeImageSync(filePath) {
  if (!isManagedLocalFile(filePath)) return false;
  try { fs.unlinkSync(filePath); return true; } catch (e) { return false; }
}

function removeImagesSync(paths) {
  (paths || []).forEach(removeImageSync);
}

// 收集菜谱内所有托管本地图片（封面 + 步骤图）
function collectRecipeImages(recipe) {
  const list = [];
  if (!recipe) return list;
  if (isManagedLocalFile(recipe.image)) list.push(recipe.image);
  (recipe.steps || []).forEach(s => {
    if (isManagedLocalFile(s.image)) list.push(s.image);
  });
  return list;
}

// 清空整个图片目录（供 my.resetCache）
function clearAll() {
  try {
    ensureDir();
    const files = fs.readdirSync(IMG_DIR);
    files.forEach(f => {
      try { fs.unlinkSync(`${IMG_DIR}/${f}`); } catch (e) { /* 忽略单个文件删除失败 */ }
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
  collectRecipeImages,
  clearAll
};
