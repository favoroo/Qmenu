const db = require('../../utils/db.js');
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
    rollRecipeImage: '/assets/images/default_food.png',
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
    loading: true
  },

  async onLoad(options) {
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
      try {
        wx.hideTabBar({ animate: false });
      } catch (e) {
        console.warn('hideTabBar in onLoad failed', e);
      }
    }

    await app.globalData.loginPromise;

    // Check if entered via invitation link
    if (options.groupId && options.inviteCode) {
      wx.showLoading({ title: '正在加入群组...', mask: true });
      try {
        const res = await wx.cloud.callFunction({
          name: 'joinGroup',
          data: { inviteCode: options.inviteCode }
        });
        if (res.result && res.result.success) {
          db.setCurrentGroupId(options.groupId);
          wx.showToast({ title: '已成功加入好友群组！', icon: 'success' });
        } else {
          wx.showToast({ title: res.result.errMsg || '加入群组失败', icon: 'none' });
        }
      } catch (err) {
        console.error(err);
      } finally {
        wx.hideLoading();
      }
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
       userInfo.avatarUrl.includes('logo.jpg'));
    const isNew = app.globalData.isNewUser || isDefaultNick || isDefaultAvatar;

    if (isNew && !app.globalData.hasPromptedProfile) {
      app.globalData.hasPromptedProfile = true;
      wx.showModal({
        title: '完善个人信息',
        content: '为了方便在群组内协作与拼单，建议您设置微信头像和昵称。是否现在去设置？',
        confirmText: '去设置',
        cancelText: '暂不设置',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({
              url: '/pages/login/index'
            });
          }
        }
      });
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

  async runSplashWorkflow() {
    try {
      wx.hideTabBar({ animate: false });
    } catch (e) {
      console.warn('hideTabBar in runSplashWorkflow failed', e);
    }

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
        await this.loadGroupsList();
      } catch (err) {
        console.error('[Splash] load error', err);
      }
    })();

    // 保证最少展示 2.5 秒开屏动画，最长 6 秒超时降级
    await Promise.race([
      Promise.all([new Promise(resolve => setTimeout(resolve, 2500)), loadPromise]),
      timeoutPromise
    ]);

    // 开始渐隐动画
    this.setData({ splashFadeOut: true });

    // 等待 css transition (600ms)
    await new Promise(resolve => setTimeout(resolve, 600));

    // 从 DOM 中移除开屏组件，并重新展示 TabBar
    this.setData({ showSplash: false });
    try {
      wx.showTabBar();
    } catch (e) {
      console.warn('showTabBar failed', e);
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
    this.loadData();
    wx.stopPullDownRefresh();
    wx.showToast({
      title: '刷新成功',
      icon: 'success',
      duration: 1000
    });
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

    // 简单差异检测：如果分类和菜谱数据未变化，只更新购物车相关数据
    const dataChanged = this._hasDataChanged(categories, recipes);
    
    if (dataChanged) {
      const groupedRecipes = this.buildGroupedRecipes(categories, recipes, '');
      this.setData({
        categories,
        activeCategoryId,
        activeCategoryName,
        recipes,
        groupedRecipes,
        cart,
        cartCount,
        cartTotal
      }, () => {
        this.filterRecipes();
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

    if (oldCategories.length !== newCategories.length) return true;
    if (oldRecipes.length !== newRecipes.length) return true;

    if (newCategories.length > 0) {
      if (oldCategories[0].id !== newCategories[0].id) return true;
      if (oldCategories[oldCategories.length - 1].id !== newCategories[newCategories.length - 1].id) return true;
    }

    if (newRecipes.length > 0) {
      if (oldRecipes[0].id !== newRecipes[0].id) return true;
      if (oldRecipes[oldRecipes.length - 1].id !== newRecipes[newRecipes.length - 1].id) return true;
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
        image: '/assets/images/default_food.png'
      });
    }

    this.setData({
      showRandomModal: true,
      randomCount: randomCount,
      rollingRecipes: rollingRecipes,
      randomSelectedRecipes: [],
      rollRecipeName: '今天吃什么？',
      rollRecipeImage: '/assets/images/default_food.png',
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
        image: '/assets/images/default_food.png'
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
        image: '/assets/images/default_food.png'
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
        image: '/assets/images/default_food.png'
      });
    }
    
    this.setData({
      randomCount: count,
      rollingRecipes: rollingRecipes,
      randomSelectedRecipes: [],
      rollRecipeName: '今天吃什么？',
      rollRecipeImage: '/assets/images/default_food.png',
      randomSelectedRecipe: null
    });
  },

  onRollingImageError(e) {
    const index = e.currentTarget.dataset.index;
    const rollingRecipes = [...this.data.rollingRecipes];
    if (rollingRecipes[index]) {
      rollingRecipes[index] = {
        ...rollingRecipes[index],
        image: '/assets/images/default_food.png'
      };
      this.setData({ rollingRecipes });
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
          image: '/assets/images/default_food.png'
        });
      }

      this.setData({
        rollingRecipes: rollingRecipes,
        rollRecipeName: rollingRecipes[0] ? rollingRecipes[0].name : '???',
        rollRecipeImage: rollingRecipes[0] ? rollingRecipes[0].image : '/assets/images/default_food.png'
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
            image: '/assets/images/default_food.png'
          });
        }
        
        this.setData({
          rollingRecipes: finalRolling,
          randomSelectedRecipes: finalSelected,
          rollRecipeName: finalRolling[0] ? finalRolling[0].name : '???',
          rollRecipeImage: finalRolling[0] ? finalRolling[0].image : '/assets/images/default_food.png',
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
    if (!this.data.isAdmin) return;
    
    const recipe = e.currentTarget.dataset.recipe;
    const self = this;
    
    wx.vibrateShort({ type: 'medium' });
    
    wx.showActionSheet({
      itemList: ['编辑菜谱', '移动到分类'],
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
      confirmColor: '#2563EB',
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
          confirmColor: '#2563EB',
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
