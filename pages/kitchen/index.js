const db = require('../../utils/db.js');
const app = getApp();

let stepTimerInterval = null;

Page({
  data: {
    categories: [],
    activeCategoryId: '',
    activeCategoryName: '',
    recipes: [],
    filteredRecipes: [],
    searchQuery: '',
    
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
    movingRecipe: null
  },

  async onLoad(options) {
    // Enable share menu
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    });

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
    await app.globalData.loginPromise;
    await this.loadGroupsList();
    // Reset cart popup
    this.setData({ showCartPopup: false });
    
    // 检查新用户并提示完善个人信息
    this.checkNewUserPrompt();
  },

  checkNewUserPrompt() {
    const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo');
    const isDefaultNick = userInfo && userInfo.nickName && userInfo.nickName.startsWith('吃货_');
    const isDefaultAvatar = userInfo && userInfo.avatarUrl && 
      (userInfo.avatarUrl.includes('default_avatar.png') || userInfo.avatarUrl.includes('logo.png'));
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
        let currentGroupId = db.getCurrentGroupId();
        
        if (!currentGroupId && groups.length > 0) {
          currentGroupId = groups[0]._id;
          db.setCurrentGroupId(currentGroupId);
        }

        const currentGroup = groups.find(g => g._id === currentGroupId) || null;
        const groupIndex = groups.findIndex(g => g._id === currentGroupId);

        this.setData({
          groupsList: groups,
          currentGroup: currentGroup,
          groupIndex: groupIndex > -1 ? groupIndex : 0
        });

        if (currentGroupId) {
          await db.initCloudData(currentGroupId);
          const myOpenid = app.globalData.userInfo.openid;
          this.setData({
            isAdmin: currentGroup && currentGroup.ownerId === myOpenid
          });
        } else {
          this.setData({
            isAdmin: false
          });
        }
      }
    } catch (err) {
      console.error(err);
    }
    this.loadData();
  },

  async onGroupChange(e) {
    const index = e.detail.value;
    const selectedGroup = this.data.groupsList[index];
    if (selectedGroup) {
      db.setCurrentGroupId(selectedGroup._id);
      this.setData({
        groupIndex: index,
        currentGroup: selectedGroup
      });
      wx.showLoading({ title: '切换中...' });
      await db.initCloudData(selectedGroup._id);
      const myOpenid = app.globalData.userInfo.openid;
      this.setData({
        isAdmin: selectedGroup.ownerId === myOpenid
      });
      wx.hideLoading();
      this.loadData();
    }
  },

  goGroupManage() {
    wx.navigateTo({
      url: '/pages/group/index'
    });
  },

  onPullDownRefresh() {
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

    this.setData({
      categories,
      activeCategoryId,
      activeCategoryName,
      recipes,
      cart,
      cartCount,
      cartTotal
    }, () => {
      this.filterRecipes();
    });
  },

  // Filter recipes by Category and Search Query
  filterRecipes() {
    const { recipes, activeCategoryId, searchQuery } = this.data;
    let filtered = recipes.filter(r => r.status === 1); // Only active ones

    // Filter by category
    if (activeCategoryId) {
      filtered = filtered.filter(r => r.categoryId === activeCategoryId);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.trim().toLowerCase();
      filtered = filtered.filter(r => 
        r.name.toLowerCase().includes(query) || 
        (r.desc && r.desc.toLowerCase().includes(query))
      );
    }

    this.setData({
      filteredRecipes: filtered
    });
  },

  // Category Selection
  selectCategory(e) {
    const categoryId = e.currentTarget.dataset.id;
    const activeCategory = this.data.categories.find(c => c.id === categoryId);
    const activeCategoryName = activeCategory ? activeCategory.name : '默认分类';
    this.setData({
      activeCategoryId: categoryId,
      activeCategoryName,
      searchQuery: '' // Clear search when category changes
    }, () => {
      this.filterRecipes();
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
      cartTotal: db.getCartTotal()
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
  openRandomModal() {
    const activeRecipes = this.data.recipes.filter(r => r.status === 1);
    if (activeRecipes.length === 0) {
      wx.showToast({
        title: '厨房还没有准备好的菜谱哦！',
        icon: 'none'
      });
      return;
    }
    
    const randomCount = this.data.randomCount || 1;
    const rollingRecipes = [];
    for (let i = 0; i < randomCount; i++) {
      rollingRecipes.push({
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
    });
  },

  closeRandomModal() {
    this.setData({
      showRandomModal: false
    });
  },

  setRandomCount(e) {
    if (this.data.isRolling) return;
    
    const count = parseInt(e.currentTarget.dataset.count) || 1;
    const rollingRecipes = [];
    for (let i = 0; i < count; i++) {
      rollingRecipes.push({
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

  startRandomRoll() {
    if (this.data.isRolling) return;
    
    const activeRecipes = this.data.recipes.filter(r => r.status === 1);
    if (activeRecipes.length === 0) return;

    const count = this.data.randomCount || 1;
    const rollCount = Math.min(activeRecipes.length, count);

    this.setData({
      isRolling: true,
      randomSelectedRecipes: [],
      randomSelectedRecipe: null
    });

    let counter = 0;
    const maxRolls = 15;
    const interval = setInterval(() => {
      // Pick unique recipes for each rolling slot
      const tempShuffled = [...activeRecipes].sort(() => 0.5 - Math.random());
      const selectedSlice = tempShuffled.slice(0, rollCount);
      
      const rollingRecipes = selectedSlice.map(r => ({
        name: r.name,
        image: r.image
      }));
      
      while (rollingRecipes.length < count) {
        rollingRecipes.push({
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
        
        // Final select
        const finalShuffled = [...activeRecipes].sort(() => 0.5 - Math.random());
        const finalSelected = finalShuffled.slice(0, rollCount);
        
        const finalRolling = finalSelected.map(r => ({
          name: r.name,
          image: r.image
        }));
        
        while (finalRolling.length < count) {
          finalRolling.push({
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
      confirmColor: '#2D5A43',
      success(modalRes) {
        if (modalRes.confirm) {
          db.updateRecipe({
            id: recipe.id,
            categoryId: targetCategoryId
          });

          self.closeMoveCategoryModal();
          self.loadData();

          wx.showToast({
            title: `已移至「${targetName}」`,
            icon: 'success'
          });
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
      imageUrl: '/assets/images/logo.png'
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
          confirmColor: '#2D5A43',
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
