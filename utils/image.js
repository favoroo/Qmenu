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
  if (/^https?:\/\//.test(p)) {
    // 兼容安卓/模拟器中 http://tmp/ 或 https://tmp/ 开头的临时路径
    return p.includes('tmp') || p.includes('127.0.0.1') || p.includes('localhost');
  }
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

// ========== 云存储 fileID → 临时下载链接解析 ==========
// 解决免费版云存储权限无法设为"所有用户可读"的问题
// 临时链接有效期约 2 小时，缓存 1.5 小时以减少云函数调用

const URL_CACHE_KEY = 'img_url_cache';
const URL_CACHE_TTL = 1.5 * 60 * 60 * 1000; // 1.5 小时

// 读取缓存
function _getCache() {
  try {
    return wx.getStorageSync(URL_CACHE_KEY) || {};
  } catch (e) {
    return {};
  }
}

// 写入缓存
function _setCache(cache) {
  try {
    wx.setStorageSync(URL_CACHE_KEY, cache);
  } catch (e) {
    // 缓存写入失败忽略
  }
}

// 从缓存中获取有效URL
function _getCachedUrl(fileID) {
  const cache = _getCache();
  const entry = cache[fileID];
  if (entry && Date.now() - entry.time < URL_CACHE_TTL) {
    return entry.url;
  }
  return null;
}

// 写入单条缓存
function _setCachedUrl(fileID, url) {
  const cache = _getCache();
  cache[fileID] = { url, time: Date.now() };
  // 顺便清理过期缓存（最多保留 200 条）
  const keys = Object.keys(cache);
  if (keys.length > 200) {
    keys.sort((a, b) => cache[a].time - cache[b].time);
    for (let i = 0; i < keys.length - 200; i++) {
      delete cache[keys[i]];
    }
  }
  _setCache(cache);
}

// 当前正在进行的云函数请求（去重合并）
let _pendingPromise = null;
let _pendingFileIDs = [];
let _pendingCallbacks = [];

/**
 * 判断是否为云存储 fileID
 */
function isCloudFileURL(url) {
  return typeof url === 'string' && url.startsWith('cloud://');
}

/**
 * 将 cloud:// 路径替换为空字符串（用于初始渲染时避免路径报错，WXML 会 fallback 到默认图）
 * 非 cloud:// 路径原样返回
 */
function maskCloudUrl(url) {
  if (isCloudFileURL(url)) return '';
  return url;
}

/**
 * 批量解析 cloud:// fileID 为临时下载链接
 * 非 cloud:// 路径（如 /assets/ 开头、https:// 开头）原样返回
 * 解析失败的 fileID 返回原始 cloud:// 路径（允许重试，不上缓存）
 * 
 * @param {string[]} fileIDs - fileID 数组
 * @returns {Promise<Object>} { fileID: tempURL } 映射
 */
function resolveImages(fileIDs) {
  if (!fileIDs || !Array.isArray(fileIDs)) return Promise.resolve({});
  
  const validIDs = fileIDs.filter(id => typeof id === 'string' && id);
  if (validIDs.length === 0) return Promise.resolve({});

  const result = {};
  const needFetch = [];

  // 先从缓存取，非 cloud:// 直接返回
  validIDs.forEach(id => {
    if (!id.startsWith('cloud://')) {
      result[id] = id;
    } else {
      const cached = _getCachedUrl(id);
      if (cached) {
        result[id] = cached;
      } else {
        needFetch.push(id);
      }
    }
  });

  if (needFetch.length === 0) {
    return Promise.resolve(result);
  }

  // 合并请求：如果已有在途请求，把这批加进去
  if (_pendingPromise) {
    needFetch.forEach(id => {
      if (_pendingFileIDs.indexOf(id) === -1) {
        _pendingFileIDs.push(id);
      }
    });
    return new Promise(resolve => {
      _pendingCallbacks.push((allResults) => {
        const merged = { ...result };
        needFetch.forEach(id => {
          if (allResults.hasOwnProperty(id)) merged[id] = allResults[id];
        });
        resolve(merged);
      });
    });
  }

  // 新建请求
  _pendingFileIDs = [...needFetch];
  _pendingCallbacks = [];

  _pendingPromise = new Promise((resolve) => {
    setTimeout(() => {
      const batchIDs = [..._pendingFileIDs];
      const callbacks = [..._pendingCallbacks];
      
      _pendingPromise = null;
      _pendingFileIDs = [];
      _pendingCallbacks = [];

      wx.cloud.callFunction({
        name: 'getTempFileURL',
        data: { fileIDs: batchIDs },
        success: res => {
          const allResults = {};
          if (res.result && res.result.success && res.result.fileList) {
            res.result.fileList.forEach(item => {
              if (item.status === 0 && item.tempFileURL) {
                // 成功：缓存并返回 https URL
                allResults[item.fileID] = item.tempFileURL;
                _setCachedUrl(item.fileID, item.tempFileURL);
              } else {
                // 失败：返回原始 cloud:// 路径（不缓存，下次重试）
                console.warn('[image] getTempFileURL 失败:', item.fileID, item.errMsg || 'status=' + item.status);
                allResults[item.fileID] = item.fileID;
              }
            });
          } else {
            // 云函数整体失败：返回原始 cloud:// 路径
            console.warn('[image] getTempFileURL 云函数返回失败:', res.result && res.result.errMsg);
            batchIDs.forEach(id => { allResults[id] = id; });
          }
          // 填充主结果
          batchIDs.forEach(id => {
            if (!result.hasOwnProperty(id)) result[id] = allResults[id];
          });
          callbacks.forEach(cb => cb(allResults));
          resolve(result);
        },
        fail: (err) => {
          // 网络失败：返回原始 cloud:// 路径（不缓存，下次重试）
          console.warn('[image] getTempFileURL 调用失败:', err);
          const failResults = {};
          batchIDs.forEach(id => {
            result[id] = id;
            failResults[id] = id;
          });
          callbacks.forEach(cb => cb(failResults));
          resolve(result);
        }
      });
    }, 50);
  });

  return _pendingPromise.then(() => result);
}

/**
 * 解析单个 fileID 为临时下载链接
 */
function resolveImage(fileID) {
  if (!fileID) return Promise.resolve('');
  if (!isCloudFileURL(fileID)) return Promise.resolve(fileID);
  return resolveImages([fileID]).then(map => {
    const resolved = map[fileID];
    return (resolved && resolved.startsWith('https://')) ? resolved : '';
  });
}

/**
 * 批量解析菜谱列表中的图片（封面图）
 * 只替换成功解析的，失败的保留原值
 */
function resolveRecipeImages(recipes) {
  if (!recipes || !Array.isArray(recipes) || recipes.length === 0) {
    return Promise.resolve(recipes || []);
  }
  const fileIDs = recipes
    .map(r => r.image)
    .filter(id => isCloudFileURL(id));
  if (fileIDs.length === 0) {
    return Promise.resolve(recipes.map(r => ({ ...r })));
  }
  return resolveImages(fileIDs).then(map => {
    return recipes.map(r => {
      if (r.image && isCloudFileURL(r.image) && map[r.image] && map[r.image].startsWith('https://')) {
        return { ...r, image: map[r.image] };
      }
      // 非云存储图片保持原样；云存储图片解析失败则设为空字符串（WXML fallback 到默认占位图）
      if (r.image && isCloudFileURL(r.image)) {
        return { ...r, image: '' };
      }
      return { ...r };
    });
  });
}

/**
 * 解析单个菜谱详情（含步骤图）
 */
function resolveRecipeDetail(recipe) {
  if (!recipe) return Promise.resolve(recipe);
  const fileIDs = [];
  if (isCloudFileURL(recipe.image)) fileIDs.push(recipe.image);
  (recipe.steps || []).forEach(s => {
    if (isCloudFileURL(s.image)) fileIDs.push(s.image);
  });
  if (fileIDs.length === 0) return Promise.resolve({ ...recipe });
  return resolveImages(fileIDs).then(map => {
    const newRecipe = { ...recipe };
    if (recipe.image && isCloudFileURL(recipe.image) && map[recipe.image] && map[recipe.image].startsWith('https://')) {
      newRecipe.image = map[recipe.image];
    } else if (recipe.image && isCloudFileURL(recipe.image)) {
      newRecipe.image = '';
    }
    if (recipe.steps) {
      newRecipe.steps = recipe.steps.map(s => {
        if (s.image && isCloudFileURL(s.image) && map[s.image] && map[s.image].startsWith('https://')) {
          return { ...s, image: map[s.image] };
        }
        if (s.image && isCloudFileURL(s.image)) {
          return { ...s, image: '' };
        }
        return { ...s };
      });
    }
    return newRecipe;
  });
}

/**
 * 批量解析用户/成员的头像
 * 成功解析的替换为 https URL，失败的 cloud:// 设为空字符串（WXML fallback到默认头像）
 */
function resolveAvatars(users, avatarField) {
  const field = avatarField || 'avatarUrl';
  if (!users || !Array.isArray(users) || users.length === 0) {
    return Promise.resolve(users || []);
  }
  const fileIDs = users
    .map(u => u[field])
    .filter(id => isCloudFileURL(id));
  if (fileIDs.length === 0) {
    return Promise.resolve(users.map(u => ({ ...u })));
  }
  return resolveImages(fileIDs).then(map => {
    return users.map(u => {
      if (u[field] && isCloudFileURL(u[field]) && map[u[field]] && map[u[field]].startsWith('https://')) {
        return { ...u, [field]: map[u[field]] };
      }
      // 云存储头像解析失败则设为空字符串（WXML fallback到默认头像）
      if (u[field] && isCloudFileURL(u[field])) {
        return { ...u, [field]: '' };
      }
      return { ...u };
    });
  });
}

/**
 * 解析单个头像URL
 */
function resolveAvatar(avatarUrl) {
  return resolveImage(avatarUrl);
}

/**
 * 同步版本：从本地缓存中获取已解析的 https URL（用于初始渲染避免闪烁）
 * - 非 cloud:// 路径原样返回
 * - cloud:// 路径：若有未过期的缓存URL则返回，否则返回空字符串（WXML 会 fallback 到默认图）
 *
 * @param {string} url - 图片URL或fileID
 * @returns {string} 可直接用于渲染的URL或空字符串
 */
function getCachedUrlOrEmpty(url) {
  if (!url || typeof url !== 'string') return '';
  if (!url.startsWith('cloud://')) return url;
  const cached = _getCachedUrl(url);
  return cached || '';
}

/**
 * 同步批量版本：批量获取缓存URL
 * @param {string[]} urls - URL/fileID 数组
 * @returns {Object} { originalUrl: resolvedUrl } 映射
 */
function getCachedUrlsOrEmpty(urls) {
  const result = {};
  if (!urls || !Array.isArray(urls)) return result;
  urls.forEach(url => {
    if (typeof url === 'string' && url) {
      result[url] = getCachedUrlOrEmpty(url);
    }
  });
  return result;
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
  clearAll,
  // fileID 解析工具
  isCloudFileURL,
  maskCloudUrl,
  getCachedUrlOrEmpty,
  getCachedUrlsOrEmpty,
  resolveImage,
  resolveImages,
  resolveRecipeImages,
  resolveRecipeDetail,
  resolveAvatar,
  resolveAvatars
};
