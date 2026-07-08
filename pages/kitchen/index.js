const db = require('../../utils/db.js');
const imageUtil = require('../../utils/image.js');
const app = getApp();

let stepTimerInterval = null;

function shuffleArray(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

Page({
  data: {
    categories: [],
    activeCategoryId: '',
    activeCategoryName: '',
    recipes: [],
    filteredRecipes: [],
    groupedRecipes: [],
    scrollTop: 0,
    recipeScrollTop: 0,
    refresherTriggered: false,
    searchQuery: '',
    _scrollThrottleTimer: null,
    _isClickScrolling: false,
    
    // Cart variables
    cart: {},
    cartCount: 0,
    cartTotal: 0,
    showCartPopup: false,
    
    // Random Select Modal variables
    showRandomModal: false,
    isRolling: false,
    rollRecipeName: '???',
    rollRecipeImage: '/assets/images/default_food.jpg',
    randomSelectedRecipe: null,
    randomCount: 1,
    rollingRecipes: [],
    randomSelectedRecipes: [],
    randomSelectedCategoryIds: [],
    randomCategoryList: [],
    randomPoolCount: 0,
    randomAllSelected: true,
    
    // Admin checking
    isAdmin: false,

    // Group variables
    groupsList: [],
    currentGroup: null,
    groupIndex: 0,

    // Recipe Detail popup variables
    showDetailModal: false,
    selectedRecipe: null,
    selectedRecipeCategoryName: '',
    activeTimerStepIndex: -1,
    timerSecondsLeft: 0,
    formattedTimeLeft: '00:00',

    // Move to Category Modal variables
    showMoveCategoryModal: false,
    movingRecipe: null,

    // Animation gating
    animReady: false,
    badgeBump: false,
    hasRendered: false,

    // Splash variables
    showSplash: false,
    splashFadeOut: false,

    // Loading state
    loading: true,

    // Chef ranking (mini bar)
    chefRanking: [],
    chefRankingTotalStars: 0,

    // Profile modal for new users
    showProfileModal: false,
    profileAvatarUrl: '',
    profileNickName: ''
  },

  async onLoad(options) {
    // 初始化内部状态
    this._lastDataVersion = -1;

    // Enable share menu
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    });

    const app = getApp();
    if (!app.globalData.splashShown) {
      this.isSplashLaunch = true;
      app.globalData.splashShown = true;
      this.setData({
        showSplash: true,
        splashFadeOut: false
      });
    }

    await app.globalData.loginPromise;

    // Check if entered via invitation link
    if (options.groupId && options.inviteCode) {
      this.inviteOptions = options;
    }
  },

  async handleInviteJoin(options) {
    const { groupId, inviteCode } = options;
    if (!groupId || !inviteCode) return;

    wx.showLoading({ title: '正在校验邀请...', mask: true });
    try {
      const res = await wx.cloud.callFunction({
        name: 'joinGroup',
        data: { inviteCode, dryRun: true }
      });
      wx.hideLoading();

      if (res.result && res.result.success) {
        const { group, alreadyIn } = res.result;
        
        if (alreadyIn) {
          db.setCurrentGroupId(groupId);
          db.setLastGroupId(groupId);
          wx.showToast({
            title: `已切换至「${group.name}」`,
            icon: 'success',
            duration: 2000
          });
        } else {
          await new Promise((resolve) => {
            wx.showModal({
              title: '加入群组邀请',
              content: `收到好友邀请，是否加入群组「${group.name}」？`,
              confirmText: '加入',
              cancelText: '取消',
              success: async (modalRes) => {
                if (modalRes.confirm) {
                  wx.showLoading({ title: '正在加入...', mask: true });
                  try {
                    const joinRes = await wx.cloud.callFunction({
                      name: 'joinGroup',
                      data: { inviteCode }
                    });
                    wx.hideLoading();
                    
                    if (joinRes.result && joinRes.result.success) {
                      db.setCurrentGroupId(groupId);
                      db.setLastGroupId(groupId);
                      wx.showToast({
                        title: '成功加入群组！',
                        icon: 'success',
                        duration: 2000
                      });
                    } else {
                      wx.showToast({
                        title: joinRes.result.errMsg || '加入群组失败',
                        icon: 'none',
                        duration: 2000
                      });
                    }
                  } catch (err) {
                    wx.hideLoading();
                    console.error(err);
                    wx.showToast({ title: '网络错误，加入失败', icon: 'none' });
                  }
                } else {
                  wx.showToast({ title: '已取消加入', icon: 'none' });
                }
                resolve();
              }
            });
          });
        }
      } else {
        wx.showToast({
          title: res.result.errMsg || '邀请校验失败',
          icon: 'none',
          duration: 2000
        });
      }
    } catch (err) {
      wx.hideLoading();
      console.error(err);
      wx.showToast({ title: '网络错误，校验失败', icon: 'none' });
    }
  },

  async onShow() {
    const firstRender = !this.data.hasRendered;

    // 阶段1：瞬时渲染本地缓存（不 await 任何网络）
    const lastGroupId = db.getLastGroupId();
    if (lastGroupId) {
      db.setCurrentGroupId(lastGroupId);
      db.loadFromLocalCache(lastGroupId);
      
      const cachedGroups = db.getCachedGroupsList();
      const currentGroup = cachedGroups.find(g => g._id === lastGroupId) || null;
      const groupIndex = cachedGroups.findIndex(g => g._id === lastGroupId);
      const myOpenid = (app.globalData.userInfo && app.globalData.userInfo.openid) || 
                       (wx.getStorageSync('userInfo') && wx.getStorageSync('userInfo').openid) || '';
      const isAdmin = currentGroup && currentGroup.ownerId === myOpenid;
      
      this.setData({
        loading: false,
        groupsList: cachedGroups,
        currentGroup: currentGroup,
        groupIndex: groupIndex > -1 ? groupIndex : 0,
        isAdmin: isAdmin
      });
      this.loadData();
    }

    // 首次渲染时播放入场动画
    if (firstRender) {
      setTimeout(() => {
        this.setData({ animReady: true, hasRendered: true });
      }, 50);
    }

    if (this.isSplashLaunch) {
      this.isSplashLaunch = false;
      await this.runSplashWorkflow();
    } else {
      // 阶段2：await 登录 + 后台刷新云端最新数据
      await app.globalData.loginPromise;

      // 处理分享链接入群逻辑
      if (this.inviteOptions) {
        await this.handleInviteJoin(this.inviteOptions);
        this.inviteOptions = null;
      }

      await this.loadGroupsList();
      // Reset cart popup
      this.setData({ showCartPopup: false });
      
      // 检查新用户并提示完善个人信息
      this.checkNewUserPrompt();
    }
  },

  checkNewUserPrompt() {
    const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo');
    const isDefaultNick = userInfo && userInfo.nickName && userInfo.nickName.startsWith('吃货_');
    const isDefaultAvatar = userInfo && userInfo.avatarUrl && 
      (userInfo.avatarUrl.includes('default_avatar.png') || 
       userInfo.avatarUrl.includes('logo.png') || 
       userInfo.avatarUrl.includes('logo.jpg') ||
       userInfo.avatarUrl.startsWith('wxfile://') ||
       userInfo.avatarUrl.startsWith('http://tmp/') ||
       userInfo.avatarUrl.includes('tmp'));
    const isNew = app.globalData.isNewUser || isDefaultNick || isDefaultAvatar;

    if (isNew && !app.globalData.hasPromptedProfile) {
      app.globalData.hasPromptedProfile = true;
      const rawAvatar = (userInfo && userInfo.avatarUrl) || '/assets/images/default_avatar.png';
      this.setData({
        showProfileModal: true,
        profileAvatarUrl: imageUtil.getCachedUrlOrEmpty(rawAvatar),
        profileNickName: (userInfo && !isDefaultNick) ? userInfo.nickName : ''
      });
      // 异步解析头像
      if (imageUtil.isCloudFileURL(rawAvatar)) {
        imageUtil.resolveImage(rawAvatar).then(resolved => {
          if (resolved && resolved.startsWith('https://')) {
            this.setData({ profileAvatarUrl: resolved });
          }
        }).catch(e => console.warn('[kitchen] 解析弹窗头像失败', e));
      }
    }
  },

  onChooseProfileAvatar(e) {
    const { avatarUrl } = e.detail;
    this.setData({
      profileAvatarUrl: avatarUrl
    });
  },

  onInputProfileNickname(e) {
    this.setData({
      profileNickName: e.detail.value
    });
  },

  onCloseProfileModal() {
    this.setData({
      showProfileModal: false
    });
  },

  async onSubmitProfile() {
    const { profileAvatarUrl, profileNickName } = this.data;
    if (!profileNickName || !profileNickName.trim()) {
      wx.showToast({ title: '请输入昵称', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '保存中...', mask: true });

    try {
      let finalAvatarUrl = profileAvatarUrl;
      // 如果头像是本地临时文件，先上传到云存储
      if (profileAvatarUrl && (
        profileAvatarUrl.includes('tmp') || 
        profileAvatarUrl.startsWith('wxfile://') || 
        profileAvatarUrl.startsWith('http://tmp') ||
        (!profileAvatarUrl.startsWith('cloud://') && !profileAvatarUrl.startsWith('/assets/'))
      )) {
        const cloudPath = `avatars/${Date.now()}-${Math.random().toString(36).substr(2, 6)}.png`;
        const uploadRes = await wx.cloud.uploadFile({
          cloudPath,
          filePath: profileAvatarUrl
        });
        finalAvatarUrl = uploadRes.fileID;
      }

      const res = await wx.cloud.callFunction({
        name: 'updateUser',
        data: {
          nickName: profileNickName.trim(),
          avatarUrl: finalAvatarUrl
        }
      });

      if (res.result && res.result.success) {
        app.globalData.userInfo = res.result.userInfo;
        wx.setStorageSync('userInfo', res.result.userInfo);

        // 更新本页面管理员权限检测
        const currentGroup = this.data.currentGroup;
        const myOpenid = res.result.userInfo.openid || '';
        const isAdmin = currentGroup && currentGroup.ownerId === myOpenid;

        this.setData({
          showProfileModal: false,
          isAdmin: isAdmin
        });

        wx.showToast({ title: '保存成功', icon: 'success' });
        
        // 刷新列表数据
        this.loadData();
      } else {
        throw new Error(res.result ? res.result.errMsg : '更新失败');
      }
    } catch (err) {
      console.error(err);
      wx.showToast({ title: err.message || '保存失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  async loadGroupsList() {
    try {
      const res = await wx.cloud.callFunction({ name: 'getGroup' });
      if (res.result && res.result.success) {
        const groups = res.result.groups || [];
        db.cacheGroupsList(groups); // 供 order 页复用

        let currentGroupId = db.getCurrentGroupId();
        
        if (!currentGroupId && groups.length > 0) {
          currentGroupId = groups[0]._id;
        }

        const currentGroup = groups.find(g => g._id === currentGroupId) || null;
        const groupIndex = groups.findIndex(g => g._id === currentGroupId);

        db.setCurrentGroupId(currentGroupId);
        db.setLastGroupId(currentGroupId); // 持久化，下次启动可预加载

        let isAdmin = false;
        if (currentGroupId) {
          await db.initCloudData(currentGroupId);
          const myOpenid = app.globalData.userInfo.openid;
          isAdmin = currentGroup && currentGroup.ownerId === myOpenid;
        }

        // 合并为一次 setData，减少渲染次数
        this.setData({
          groupsList: groups,
          currentGroup: currentGroup,
          groupIndex: groupIndex > -1 ? groupIndex : 0,
          isAdmin: isAdmin,
          loading: false
        });
      }
    } catch (err) {
      console.error(err);
      this.setData({ loading: false });
    }
    this.loadData();
  },

  async onGroupChange(e) {
    const index = e.detail.value;
    const selectedGroup = this.data.groupsList[index];
    if (selectedGroup) {
      const newGroupId = selectedGroup._id;
      db.setCurrentGroupId(newGroupId);
      db.setLastGroupId(newGroupId); // 持久化新选择

      // 先瞬时渲染该群组缓存
      db.loadFromLocalCache(newGroupId);
      const myOpenid = app.globalData.userInfo.openid;
      const isAdmin = selectedGroup.ownerId === myOpenid;

      // 合并 setData，切换群组时重新播放入场动画
      this.setData({
        groupIndex: index,
        currentGroup: selectedGroup,
        isAdmin: isAdmin,
        animReady: false
      }, () => {
        this.loadData();
        setTimeout(() => this.setData({ animReady: true }), 50);
      });

      // 后台刷新云端
      wx.showLoading({ title: '切换中...', mask: true });
      await db.initCloudData(newGroupId);
      wx.hideLoading();
      this.loadData();
    }
  },

  goGroupManage() {
    wx.navigateTo({
      url: '/pages/group/index'
    });
  },

  goToOrders() {
    wx.switchTab({
      url: '/pages/order/index'
    });
  },

  async runSplashWorkflow() {
    try {
      wx.hideTabBar({ animate: false });
    } catch (e) {
      console.warn('hideTabBar in runSplashWorkflow failed', e);
    }

    try {
      const lastGroupId = db.getLastGroupId();
      if (lastGroupId) {
        db.setCurrentGroupId(lastGroupId);
        db.loadFromLocalCache(lastGroupId);
        const cachedGroups = db.getCachedGroupsList();
        const currentGroup = cachedGroups.find(g => g._id === lastGroupId) || null;
        const groupIndex = cachedGroups.findIndex(g => g._id === lastGroupId);
        const userInfo = wx.getStorageSync('userInfo') || {};
        const isAdmin = currentGroup && currentGroup.ownerId === (userInfo.openid || '');

        this.setData({
          groupsList: cachedGroups,
          currentGroup: currentGroup,
          groupIndex: groupIndex > -1 ? groupIndex : 0,
          isAdmin: isAdmin,
          loading: false
        });
        this.loadData();
      }

      const timeoutPromise = new Promise(resolve => setTimeout(resolve, 6000));
      const loadPromise = (async () => {
        try {
          await app.globalData.loginPromise;
          
          // 处理分享链接入群逻辑
          if (this.inviteOptions) {
            await this.handleInviteJoin(this.inviteOptions);
            this.inviteOptions = null;
          }

          await this.loadGroupsList();
        } catch (err) {
          console.error('[Splash] load error', err);
        }
      })();

      // 保证最少展示 1 秒开屏动画，最长 6 秒超时降级
      await Promise.race([
        Promise.all([new Promise(resolve => setTimeout(resolve, 1000)), loadPromise]),
        timeoutPromise
      ]);

      // 开始渐隐动画
      this.setData({ splashFadeOut: true });

      // 等待 css transition (600ms)
      await new Promise(resolve => setTimeout(resolve, 600));
    } finally {
      // 无论流程成功与否，都移除开屏组件并恢复 TabBar
      this.setData({ showSplash: false });
      try {
        wx.showTabBar();
      } catch (e) {
        console.warn('showTabBar failed', e);
      }
    }

    // 重置购物车弹框状态
    this.setData({ showCartPopup: false });

    // 检测新用户绑定微信头像昵称引导
    this.checkNewUserPrompt();
  },

  preventTouchMove() {
    // 阻止穿透滑动
  },

  async onPullDownRefresh() {
    const currentGroupId = db.getCurrentGroupId();
    if (currentGroupId) {
      await db.initCloudData(currentGroupId);
    }
    await this.loadData();
    wx.stopPullDownRefresh();
    wx.showToast({
      title: '刷新成功',
      icon: 'success',
      duration: 1000
    });
  },

  async onRefresherRefresh() {
    if (this.data.refresherTriggered) return;
    this.setData({ refresherTriggered: true });
    
    try {
      const currentGroupId = db.getCurrentGroupId();
      if (currentGroupId) {
        await db.initCloudData(currentGroupId);
      }
      await this.loadData();
      wx.showToast({
        title: '刷新成功',
        icon: 'success',
        duration: 1000
      });
    } catch (e) {
      console.error('Refresher refresh failed:', e);
    } finally {
      this.setData({ refresherTriggered: false });
    }
  },

  async loadData() {
    if (app.globalData.loginPromise) {
      await app.globalData.loginPromise;
    }

    const categories = db.getCategories();
    const recipes = db.getRecipes();
    
    let activeCategoryId = this.data.activeCategoryId;
    // Default to the first category if none is selected
    if (!activeCategoryId && categories.length > 0) {
      activeCategoryId = categories[0].id;
    }
    
    const activeCategory = categories.find(c => c.id === activeCategoryId);
    const activeCategoryName = activeCategory ? activeCategory.name : '默认分类';
    
    const cart = db.getCart();
    const cartCount = db.getCartCount();
    const cartTotal = db.getCartTotal();

    // 厨师排行榜（本月，取 Top 3）
    const ranking = db.getChefRanking('month');
    const topRanking = ranking.slice(0, 3);
    const totalStars = ranking.reduce((sum, r) => sum + r.totalStars, 0);
    const rankingChanged = JSON.stringify(this.data.chefRanking) !== JSON.stringify(topRanking);

    // 检测数据是否变化：字段变化 或 云端数据版本更新（initCloudData刷新了数据）
    const currentDataVersion = db.getDataVersion();
    const cloudDataRefreshed = currentDataVersion !== this._lastDataVersion;
    const dataChanged = cloudDataRefreshed || this._hasDataChanged(categories, recipes);
    
    if (dataChanged || rankingChanged) {
      // 更新数据版本标记
      if (cloudDataRefreshed) {
        this._lastDataVersion = currentDataVersion;
      }

      // 初始渲染时：优先使用本地缓存中未过期的https URL（无闪烁），否则将cloud://替换为空字符串
      // 异步解析完成后再更新为真实的 https:// 链接
      let displayRecipes = recipes;
      let displayRanking = topRanking;
      if (dataChanged) {
        displayRecipes = recipes.map(r => ({
          ...r,
          image: imageUtil.getCachedUrlOrEmpty(r.image)
        }));
      }
      if (rankingChanged) {
        displayRanking = topRanking.map(c => ({
          ...c,
          chefAvatar: imageUtil.getCachedUrlOrEmpty(c.chefAvatar)
        }));
      }
      const groupedRecipes = dataChanged ? this.buildGroupedRecipes(categories, displayRecipes, '') : this.data.groupedRecipes;
      this.setData({
        ...(dataChanged ? {
          categories,
          activeCategoryId,
          activeCategoryName,
          recipes: displayRecipes,
          groupedRecipes
        } : {}),
        cart,
        cartCount,
        cartTotal,
        chefRanking: displayRanking,
        chefRankingTotalStars: totalStars
      }, () => {
        if (dataChanged) {
          this.filterRecipes();
        }
        // 异步解析菜谱图片和头像（云存储权限限制，需通过云函数转临时链接）
        if (dataChanged && recipes.length > 0) {
          this._resolveRecipeImages(recipes, topRanking);
        } else if (rankingChanged) {
          this._resolveRankingAvatars(topRanking);
        }
      });
    } else {
      // 只更新购物车数据，避免列表重渲染
      this.setData({
        cart,
        cartCount,
        cartTotal
      });
    }
  },

  // 异步解析所有菜谱的 cloud:// 图片为临时下载链接
  async _resolveRecipeImages(originalRecipes, originalRanking) {
    try {
      // 解析菜谱封面图（使用原始数据，不是被 mask 过的 display 数据）
      const resolvedRecipes = await imageUtil.resolveRecipeImages(originalRecipes);
      const resolvedGrouped = this.data.groupedRecipes.map(g => ({
        ...g,
        recipes: g.recipes.map(r => {
          const found = resolvedRecipes.find(rr => rr.id === r.id);
          return found || r;
        })
      }));

      // 解析厨师排行榜头像
      const resolvedRanking = await imageUtil.resolveAvatars(originalRanking, 'chefAvatar');

      // 回写到 db 缓存（只回写成功解析为 https:// 的）
      db.updateRecipeImagesInCache(resolvedRecipes);

      this.setData({
        recipes: resolvedRecipes,
        groupedRecipes: resolvedGrouped,
        chefRanking: resolvedRanking
      }, () => {
        this.filterRecipes();
      });
    } catch (e) {
      console.warn('[kitchen] 解析图片失败', e);
    }
  },

  // 单独解析排行榜头像
  async _resolveRankingAvatars(originalRanking) {
    try {
      const resolvedRanking = await imageUtil.resolveAvatars(originalRanking, 'chefAvatar');
      this.setData({ chefRanking: resolvedRanking });
    } catch (e) {
      console.warn('[kitchen] 解析排行榜头像失败', e);
    }
  },

  buildGroupedRecipes(categories, recipes, searchQuery) {
    const activeRecipes = recipes.filter(r => r.status === 1);
    const query = searchQuery ? searchQuery.trim().toLowerCase() : '';
    
    return categories.map(cat => {
      let catRecipes = activeRecipes.filter(r => r.categoryId === cat.id);
      if (query) {
        catRecipes = catRecipes.filter(r => 
          r.name.toLowerCase().includes(query) || 
          (r.desc && r.desc.toLowerCase().includes(query))
        );
      }
      return {
        categoryId: cat.id,
        categoryName: cat.name,
        recipes: catRecipes
      };
    });
  },

  _hasDataChanged(newCategories, newRecipes) {
    const oldCategories = this.data.categories;
    const oldRecipes = this.data.recipes;

    // 1. 长度变化 → 必然变化
    if (oldCategories.length !== newCategories.length) return true;
    if (oldRecipes.length !== newRecipes.length) return true;

    // 2. 逐项比较菜谱关键字段（覆盖改名/改价/改状态/改分类等场景）
    // 注意：不比较 image 字段：
    //   - cloudCache 中始终保存 cloud:// 原始URL，页面 data 中保存解析后的 https:// URL
    //   - 云端数据刷新通过 db.getDataVersion() 版本号检测
    //   - 本函数只检测业务字段的真正变更
    const recipeKeys = ['id', 'name', 'price', 'status', 'categoryId', 'desc'];
    for (let i = 0; i < newRecipes.length; i++) {
      const oldR = oldRecipes[i];
      const newR = newRecipes[i];
      if (!oldR) return true;
      for (const k of recipeKeys) {
        if (oldR[k] !== newR[k]) return true;
      }
    }

    // 3. 逐项比较分类关键字段
    const catKeys = ['id', 'name'];
    for (let i = 0; i < newCategories.length; i++) {
      const oldC = oldCategories[i];
      const newC = newCategories[i];
      if (!oldC) return true;
      for (const k of catKeys) {
        if (oldC[k] !== newC[k]) return true;
      }
    }

    return false;
  },

  // Filter recipes by Search Query (grouped by category)
  filterRecipes() {
    const { recipes, categories, searchQuery } = this.data;
    const groupedRecipes = this.buildGroupedRecipes(categories, recipes, searchQuery);
    const filtered = groupedRecipes.reduce((acc, g) => acc.concat(g.recipes), []);

    this.setData({
      groupedRecipes,
      filteredRecipes: filtered
    });
  },

  // Category Selection - scroll to category section
  selectCategory(e) {
    const categoryId = e.currentTarget.dataset.id;
    const activeCategory = this.data.categories.find(c => c.id === categoryId);
    const activeCategoryName = activeCategory ? activeCategory.name : '默认分类';

    this.setData({
      activeCategoryId: categoryId,
      activeCategoryName,
      _isClickScrolling: true
    });

    // 查询目标元素相对于 scroll-view 的位置
    const query = wx.createSelectorQuery().in(this);
    query.select(`#cat-${categoryId}`).boundingClientRect();
    query.select('.recipe-list').boundingClientRect();
    query.exec((res) => {
      if (!res || !res[0] || !res[1]) {
        this.setData({ _isClickScrolling: false });
        return;
      }
      const targetRect = res[0];
      const listRect = res[1];
      // 计算目标元素相对于 scroll-view 可视区域顶部的偏移
      const offset = targetRect.top - listRect.top;
      // 目标 scrollTop = 当前 scrollTop + 偏移
      const targetScrollTop = this.data.recipeScrollTop + offset;

      // 先设为偏移 1px 的值再设为目标值，确保重复点击同一分类也能触发
      this.setData({
        scrollTop: targetScrollTop + 1
      }, () => {
        this.setData({
          scrollTop: targetScrollTop
        });
      });

      setTimeout(() => {
        this.setData({ _isClickScrolling: false });
      }, 500);
    });
  },

  // Right scroll listener - sync left category highlight
  onRecipeScroll(e) {
    // 记录当前 scroll-view 的实际滚动位置（不触发渲染，仅存储）
    this.data.recipeScrollTop = e.detail.scrollTop;

    if (this.data._isClickScrolling) return;

    if (this.data._scrollThrottleTimer) {
      clearTimeout(this.data._scrollThrottleTimer);
    }

    this.data._scrollThrottleTimer = setTimeout(() => {
      this._updateActiveCategoryByScroll();
    }, 100);
  },

  _updateActiveCategoryByScroll() {
    const query = wx.createSelectorQuery().in(this);
    query.selectAll('.category-title-header').boundingClientRect();
    query.select('.recipe-list').boundingClientRect();
    query.exec((res) => {
      if (!res || !res[0] || !res[1]) return;
      
      const categoryTops = res[0];
      const listRect = res[1];
      const listTop = listRect.top;
      
      let currentCategoryId = this.data.groupedRecipes[0]?.categoryId || '';
      
      for (let i = 0; i < categoryTops.length; i++) {
        const rect = categoryTops[i];
        if (rect.top <= listTop + 20) {
          const group = this.data.groupedRecipes[i];
          if (group) {
            currentCategoryId = group.categoryId;
          }
        } else {
          break;
        }
      }
      
      if (currentCategoryId && currentCategoryId !== this.data.activeCategoryId) {
        const activeCategory = this.data.categories.find(c => c.id === currentCategoryId);
        this.setData({
          activeCategoryId: currentCategoryId,
          activeCategoryName: activeCategory ? activeCategory.name : ''
        });
      }
    });
  },

  // Search Input Handler
  onSearchInput(e) {
    const query = e.detail.value;
    this.setData({
      searchQuery: query
    }, () => {
      this.filterRecipes();
    });
  },

  onSearchClear() {
    this.setData({
      searchQuery: ''
    }, () => {
      this.filterRecipes();
    });
  },

  // --- Cart Actions ---
  onAddCart(e) {
    const recipe = e.currentTarget.dataset.item;
    const cart = db.addToCart(recipe);
    this.setData({
      cart,
      cartCount: db.getCartCount(),
      cartTotal: db.getCartTotal(),
      badgeBump: false
    }, () => {
      this.setData({ badgeBump: true });
      setTimeout(() => this.setData({ badgeBump: false }), 400);
    });
    
    wx.vibrateShort({ type: 'light' });
  },

  onSubtractCart(e) {
    const recipeId = e.currentTarget.dataset.id;
    const cart = db.removeFromCart(recipeId);
    
    const newCount = db.getCartCount();
    this.setData({
      cart,
      cartCount: newCount,
      cartTotal: db.getCartTotal(),
      showCartPopup: newCount > 0 ? this.data.showCartPopup : false
    });
    
    wx.vibrateShort({ type: 'light' });
  },

  toggleCartPopup() {
    if (this.data.cartCount === 0) return;
    this.setData({
      showCartPopup: !this.data.showCartPopup
    });
  },

  clearCart() {
    const self = this;
    wx.showModal({
      title: '清空购物车',
      content: '确定要清空已选菜品吗？',
      success(res) {
        if (res.confirm) {
          db.clearCart();
          self.setData({
            cart: {},
            cartCount: 0,
            cartTotal: 0,
            showCartPopup: false
          });
        }
      }
    });
  },

  // --- Random Selection (Panda Button) ---
  buildRandomCategoryList(selectedIds) {
    return this.data.categories.map(c => ({
      ...c,
      selected: selectedIds.indexOf(c.id) > -1
    }));
  },

  syncRandomUI(selectedIds, extraData, callback) {
    const allIds = this.data.categories.map(c => c.id);
    const categoryList = this.buildRandomCategoryList(selectedIds);
    const allSelected = selectedIds.length === allIds.length;
    const dataToSet = {
      randomSelectedCategoryIds: selectedIds,
      randomCategoryList: categoryList,
      randomAllSelected: allSelected,
      ...extraData
    };
    this.setData(dataToSet, () => {
      this.updateRandomPoolCount();
      if (callback) callback();
    });
  },

  getRandomPool() {
    const { recipes, randomSelectedCategoryIds } = this.data;
    const activeRecipes = recipes.filter(r => r.status === 1);
    if (!randomSelectedCategoryIds || randomSelectedCategoryIds.length === 0) {
      return activeRecipes;
    }
    return activeRecipes.filter(r => randomSelectedCategoryIds.indexOf(r.categoryId) > -1);
  },

  updateRandomPoolCount() {
    const pool = this.getRandomPool();
    this.setData({ randomPoolCount: pool.length });
    return pool;
  },

  openRandomModal() {
    const allCategoryIds = this.data.categories.map(c => c.id);
    const randomCount = this.data.randomCount || 1;
    const rollingRecipes = [];
    for (let i = 0; i < randomCount; i++) {
      rollingRecipes.push({
        id: 'placeholder_' + i,
        name: '今天吃什么？',
        image: '/assets/images/default_food.jpg'
      });
    }

    this.setData({
      showRandomModal: true,
      randomCount: randomCount,
      rollingRecipes: rollingRecipes,
      randomSelectedRecipes: [],
      rollRecipeName: '今天吃什么？',
      rollRecipeImage: '/assets/images/default_food.jpg',
      randomSelectedRecipe: null,
      isRolling: false
    }, () => {
      this.syncRandomUI(allCategoryIds, {});
    });
  },

  closeRandomModal() {
    this.setData({
      showRandomModal: false
    });
  },

  toggleRandomCategory(e) {
    if (this.data.isRolling) return;
    const categoryId = e.currentTarget.dataset.id;
    let selected = [...this.data.randomSelectedCategoryIds];
    const idx = selected.indexOf(categoryId);
    if (idx > -1) {
      if (selected.length <= 1) {
        wx.showToast({ title: '至少选择一个分类', icon: 'none' });
        return;
      }
      selected.splice(idx, 1);
    } else {
      selected.push(categoryId);
    }
    this.syncRandomUI(selected, {
      randomSelectedRecipes: [],
      rollingRecipes: this.data.rollingRecipes.map((r, i) => ({
        id: 'placeholder_' + i,
        name: '今天吃什么？',
        image: '/assets/images/default_food.jpg'
      })),
      randomSelectedRecipe: null
    });
  },

  toggleAllRandomCategories() {
    if (this.data.isRolling) return;
    const allIds = this.data.categories.map(c => c.id);
    const isAllSelected = this.data.randomSelectedCategoryIds.length === allIds.length;
    const newSelected = isAllSelected ? [allIds[0]] : allIds;
    this.syncRandomUI(newSelected, {
      randomSelectedRecipes: [],
      rollingRecipes: this.data.rollingRecipes.map((r, i) => ({
        id: 'placeholder_' + i,
        name: '今天吃什么？',
        image: '/assets/images/default_food.jpg'
      })),
      randomSelectedRecipe: null
    });
  },

  setRandomCount(e) {
    if (this.data.isRolling) return;
    
    const count = parseInt(e.currentTarget.dataset.count) || 1;
    const rollingRecipes = [];
    for (let i = 0; i < count; i++) {
      rollingRecipes.push({
        id: 'placeholder_' + i,
        name: '今天吃什么？',
        image: '/assets/images/default_food.jpg'
      });
    }
    
    this.setData({
      randomCount: count,
      rollingRecipes: rollingRecipes,
      randomSelectedRecipes: [],
      rollRecipeName: '今天吃什么？',
      rollRecipeImage: '/assets/images/default_food.jpg',
      randomSelectedRecipe: null
    });
  },

  onRollingImageError(e) {
    const index = e.currentTarget.dataset.index;
    const rollingRecipes = [...this.data.rollingRecipes];
    if (rollingRecipes[index]) {
      rollingRecipes[index] = {
        ...rollingRecipes[index],
        image: '/assets/images/default_food.jpg'
      };
      this.setData({ rollingRecipes });
    }
  },

  // 图片加载失败（403等）时自动重新解析
  onImageError(e) {
    const { type, id } = e.currentTarget.dataset;
    if (!id && type !== 'profileAvatar') return;

    if (type === 'recipe') {
      const recipes = db.getRecipes();
      const recipe = recipes.find(r => r.id === id);
      if (recipe && recipe.image && imageUtil.isCloudFileURL(recipe.image)) {
        imageUtil.resolveImage(recipe.image).then(resolved => {
          if (resolved && resolved.startsWith('https://')) {
            const groupedRecipes = this.data.groupedRecipes.map(g => ({
              ...g,
              recipes: g.recipes.map(r => r.id === id ? { ...r, image: resolved } : r)
            }));
            this.setData({ groupedRecipes });
            if (this.data.selectedRecipe && this.data.selectedRecipe.id === id) {
              this.setData({ 'selectedRecipe.image': resolved });
            }
            if (this.data.movingRecipe && this.data.movingRecipe.id === id) {
              this.setData({ 'movingRecipe.image': resolved });
            }
          }
        }).catch(err => console.warn('[kitchen] 重新解析菜谱图片失败', err));
      }
    } else if (type === 'avatar') {
      const ranking = db.getChefRanking('month');
      const chef = ranking.find(c => c.chefId === id);
      if (chef && chef.chefAvatar && imageUtil.isCloudFileURL(chef.chefAvatar)) {
        imageUtil.resolveImage(chef.chefAvatar).then(resolved => {
          if (resolved && resolved.startsWith('https://')) {
            const chefRanking = this.data.chefRanking.map(c =>
              c.chefId === id ? { ...c, chefAvatar: resolved } : c
            );
            this.setData({ chefRanking });
          }
        }).catch(err => console.warn('[kitchen] 重新解析头像失败', err));
      }
    } else if (type === 'profileAvatar') {
      const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo');
      const rawAvatar = (userInfo && userInfo.avatarUrl) || '';
      if (rawAvatar && imageUtil.isCloudFileURL(rawAvatar)) {
        imageUtil.resolveImage(rawAvatar).then(resolved => {
          if (resolved && resolved.startsWith('https://')) {
            this.setData({ profileAvatarUrl: resolved });
          }
        }).catch(err => console.warn('[kitchen] 重新解析弹窗头像失败', err));
      }
    }
  },

  startRandomRoll() {
    if (this.data.isRolling) return;
    
    const pool = this.getRandomPool();
    if (pool.length === 0) {
      wx.showToast({ title: '所选分类下没有可用菜品', icon: 'none' });
      return;
    }

    const count = this.data.randomCount || 1;
    const rollCount = Math.min(pool.length, count);

    this.setData({
      isRolling: true,
      randomSelectedRecipes: [],
      randomSelectedRecipe: null
    });

    let counter = 0;
    const maxRolls = 15;
    const interval = setInterval(() => {
      const tempShuffled = shuffleArray(pool);
      const selectedSlice = tempShuffled.slice(0, rollCount);
      
      const rollingRecipes = selectedSlice.map(r => ({
        id: r.id,
        name: r.name,
        image: r.image
      }));
      
      while (rollingRecipes.length < count) {
        rollingRecipes.push({
          id: 'placeholder_' + rollingRecipes.length,
          name: '???',
          image: '/assets/images/default_food.jpg'
        });
      }

      this.setData({
        rollingRecipes: rollingRecipes,
        rollRecipeName: rollingRecipes[0] ? rollingRecipes[0].name : '???',
        rollRecipeImage: rollingRecipes[0] ? rollingRecipes[0].image : '/assets/images/default_food.jpg'
      });

      counter++;
      if (counter >= maxRolls) {
        clearInterval(interval);
        
        const finalShuffled = shuffleArray(pool);
        const finalSelected = finalShuffled.slice(0, rollCount);
        
        const finalRolling = finalSelected.map(r => ({
          id: r.id,
          name: r.name,
          image: r.image
        }));
        
        while (finalRolling.length < count) {
          finalRolling.push({
            id: 'placeholder_' + finalRolling.length,
            name: '???',
            image: '/assets/images/default_food.jpg'
          });
        }
        
        this.setData({
          rollingRecipes: finalRolling,
          randomSelectedRecipes: finalSelected,
          rollRecipeName: finalRolling[0] ? finalRolling[0].name : '???',
          rollRecipeImage: finalRolling[0] ? finalRolling[0].image : '/assets/images/default_food.jpg',
          randomSelectedRecipe: finalSelected[0] || null,
          isRolling: false
        });

        wx.vibrateLong();
      }
    }, 120);
  },

  addRandomToCart() {
    const selected = this.data.randomSelectedRecipes;
    if (!selected || selected.length === 0) return;
    
    let cart = this.data.cart;
    selected.forEach(recipe => {
      cart = db.addToCart(recipe);
    });
    
    this.setData({
      cart,
      cartCount: db.getCartCount(),
      cartTotal: db.getCartTotal(),
      showRandomModal: false
    });
    
    wx.showToast({
      title: selected.length === 1 
        ? `已添加 ${selected[0].name}` 
        : `已添加 ${selected.length} 个菜品`,
      icon: 'success'
    });
  },

  // --- Navigation ---
  goRecipeAdd() {
    const categoryId = this.data.activeCategoryId || '';
    wx.navigateTo({
      url: `/pages/recipe-add/index?categoryId=${categoryId}`
    });
  },

  // Long press recipe card to show action menu (admin only)
  onRecipeLongPress(e) {
    if (!this.data.isAdmin) {
      wx.showToast({
        title: '仅群主可编辑菜谱',
        icon: 'none',
        duration: 1500
      });
      return;
    }
    
    const recipe = e.currentTarget.dataset.recipe;
    const self = this;
    
    wx.vibrateShort({ type: 'medium' });
    
    wx.showActionSheet({
      itemList: ['编辑菜谱', '移动到分类', '删除菜谱'],
      success(res) {
        if (res.tapIndex === 0) {
          // Edit recipe
          wx.navigateTo({
            url: `/pages/recipe-add/index?id=${recipe.id}`
          });
        } else if (res.tapIndex === 1) {
          // Move to category - open category picker
          self.setData({
            movingRecipe: recipe,
            showMoveCategoryModal: true
          });
        } else if (res.tapIndex === 2) {
          // Delete recipe
          wx.showModal({
            title: '删除菜品',
            content: `确定要删除菜品「${recipe.name}」吗？此操作不可恢复。`,
            confirmColor: '#E07A5F',
            async success(modalRes) {
              if (modalRes.confirm) {
                try {
                  await db.deleteRecipe(recipe.id);
                  self.loadData();
                  wx.showToast({ title: '已删除', icon: 'success' });
                  wx.vibrateShort();
                } catch (err) {
                  console.error('删除菜谱失败', err);
                  wx.showToast({ title: '删除失败，请重试', icon: 'none' });
                }
              }
            }
          });
        }
      }
    });
  },

  // --- Move to Category ---
  closeMoveCategoryModal() {
    this.setData({
      showMoveCategoryModal: false,
      movingRecipe: null
    });
  },

  onMoveCategorySelect(e) {
    const targetCategoryId = e.currentTarget.dataset.id;
    const recipe = this.data.movingRecipe;

    if (!recipe) return;

    // If selecting current category, no need to move
    if (recipe.categoryId === targetCategoryId) {
      wx.showToast({ title: '已在该分类中', icon: 'none' });
      this.closeMoveCategoryModal();
      return;
    }

    const targetCategory = this.data.categories.find(c => c.id === targetCategoryId);
    const targetName = targetCategory ? targetCategory.name : '未知分类';

    const self = this;
    wx.showModal({
      title: '确认移动',
      content: `将「${recipe.name}」移动到「${targetName}」？`,
      confirmColor: '#005BCB',
      async success(modalRes) {
        if (modalRes.confirm) {
          try {
            await db.updateRecipe({
              id: recipe.id,
              categoryId: targetCategoryId
            });

            self.closeMoveCategoryModal();
            self.loadData();

            wx.showToast({
              title: `已移至「${targetName}」`,
              icon: 'success'
            });
          } catch (err) {
            console.error('移动菜谱失败', err);
            wx.showToast({ title: '移动失败，请重试', icon: 'none' });
          }
        }
      }
    });
  },

  goRecipeEdit(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/recipe-add/index?id=${id}`
    });
  },

  goCategoryManage() {
    wx.navigateTo({
      url: '/pages/category-manage/index'
    });
  },

  goToConfirmOrder() {
    if (this.data.cartCount === 0) return;
    const currentGroupId = db.getCurrentGroupId();
    wx.navigateTo({
      url: `/pages/order-confirm/index?groupId=${currentGroupId}`
    });
  },

  // --- Sharing Setup ---
  onShareAppMessage() {
    const sharerInfo = app.globalData.userInfo || wx.getStorageSync('userInfo') || { nickName: '吃货好友' };
    const currentGroup = this.data.currentGroup;
    
    let path = '/pages/kitchen/index';
    let title = `「${sharerInfo.nickName}」邀请你一起点私房菜！`;
    
    if (currentGroup) {
      path = `/pages/kitchen/index?groupId=${currentGroup._id}&inviteCode=${currentGroup.inviteCode}`;
      title = `「${sharerInfo.nickName}」邀请你加入群组「${currentGroup.name}」一起拼单！`;
    }
    
    return {
      title: title,
      path: path,
      imageUrl: ''
    };
  },

  onHide() {
    this.stopStepTimer();
  },

  onUnload() {
    this.stopStepTimer();
  },

  // --- Recipe Detail popup methods ---
  showRecipeDetail(e) {
    const recipe = e.currentTarget.dataset.recipe;
    const category = this.data.categories.find(c => c.id === recipe.categoryId);
    const categoryName = category ? category.name : '默认分类';
    this.setData({
      selectedRecipe: recipe,
      selectedRecipeCategoryName: categoryName,
      showDetailModal: true,
      activeTimerStepIndex: -1,
      timerSecondsLeft: 0,
      formattedTimeLeft: '00:00'
    });
    if (stepTimerInterval) {
      clearInterval(stepTimerInterval);
      stepTimerInterval = null;
    }
    // 异步解析菜谱详情中的步骤图
    this._resolveRecipeDetail(recipe);
  },

  async _resolveRecipeDetail(recipe) {
    try {
      const resolved = await imageUtil.resolveRecipeDetail(recipe);
      // 只有当前选中的还是同一个菜谱时才更新
      if (this.data.selectedRecipe && this.data.selectedRecipe.id === resolved.id) {
        this.setData({ selectedRecipe: resolved });
      }
    } catch (e) {
      console.warn('[kitchen] 解析菜谱详情图片失败', e);
    }
  },



  closeRecipeDetail() {
    this.setData({
      showDetailModal: false,
      selectedRecipe: null
    });
    this.stopStepTimer();
  },

  toggleStepTimer(e) {
    const index = e.currentTarget.dataset.index;
    const minutes = e.currentTarget.dataset.minutes;
    
    if (this.data.activeTimerStepIndex === index) {
      this.stopStepTimer();
      wx.showToast({
        title: '计时已取消',
        icon: 'none'
      });
      return;
    }
    
    this.stopStepTimer();
    
    const seconds = minutes * 60;
    this.setData({
      activeTimerStepIndex: index,
      timerSecondsLeft: seconds,
      formattedTimeLeft: this.formatSeconds(seconds)
    });
    
    wx.showToast({
      title: '开始计时',
      icon: 'success'
    });
    
    const self = this;
    stepTimerInterval = setInterval(() => {
      const left = self.data.timerSecondsLeft - 1;
      if (left <= 0) {
        self.stopStepTimer();
        
        wx.vibrateLong();
        setTimeout(() => {
          wx.vibrateLong();
        }, 500);
        
        wx.showModal({
          title: '烹饪定时提醒',
          content: `第 ${index + 1} 步：已完成计时！`,
          confirmColor: '#005BCB',
          showCancel: false
        });
      } else {
        self.setData({
          timerSecondsLeft: left,
          formattedTimeLeft: self.formatSeconds(left)
        });
      }
    }, 1000);
  },

  stopStepTimer() {
    if (stepTimerInterval) {
      clearInterval(stepTimerInterval);
      stepTimerInterval = null;
    }
    this.setData({
      activeTimerStepIndex: -1,
      timerSecondsLeft: 0,
      formattedTimeLeft: '00:00'
    });
  },

  formatSeconds(sec) {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }
});
