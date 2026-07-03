const db = require('../../utils/db.js');

let stepTimerInterval = null;

Page({
  data: {
    categories: [],
    activeCategoryId: '',
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
    
    // Admin checking
    isAdmin: true, // Set to true by default for demo and local management

    // Recipe Detail popup variables
    showDetailModal: false,
    selectedRecipe: null,
    selectedRecipeCategoryName: '',
    activeTimerStepIndex: -1,
    timerSecondsLeft: 0,
    formattedTimeLeft: '00:00'
  },

  onLoad(options) {
    // Enable share menu
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    });

    // Check if there is a share link
    if (options.sharer) {
      wx.showToast({
        title: '正在和好友拼单中',
        icon: 'none'
      });
    }
  },

  onShow() {
    this.loadData();
    // Reset cart popup
    this.setData({ showCartPopup: false });
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

  loadData() {
    const categories = db.getCategories();
    const recipes = db.getRecipes();
    
    let activeCategoryId = this.data.activeCategoryId;
    // Default to the first category if none is selected
    if (!activeCategoryId && categories.length > 0) {
      activeCategoryId = categories[0].id;
    }
    
    const cart = db.getCart();
    const cartCount = db.getCartCount();
    const cartTotal = db.getCartTotal();

    this.setData({
      categories,
      activeCategoryId,
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
    this.setData({
      activeCategoryId: categoryId,
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
    
    this.setData({
      showRandomModal: true,
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

  startRandomRoll() {
    if (this.data.isRolling) return;
    
    const activeRecipes = this.data.recipes.filter(r => r.status === 1);
    if (activeRecipes.length === 0) return;

    this.setData({
      isRolling: true,
      randomSelectedRecipe: null
    });

    let counter = 0;
    const maxRolls = 15;
    const interval = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * activeRecipes.length);
      const tempRecipe = activeRecipes[randomIndex];
      this.setData({
        rollRecipeName: tempRecipe.name,
        rollRecipeImage: tempRecipe.image
      });

      counter++;
      if (counter >= maxRolls) {
        clearInterval(interval);
        
        // Final select
        const finalIndex = Math.floor(Math.random() * activeRecipes.length);
        const finalRecipe = activeRecipes[finalIndex];
        
        this.setData({
          rollRecipeName: finalRecipe.name,
          rollRecipeImage: finalRecipe.image,
          randomSelectedRecipe: finalRecipe,
          isRolling: false
        });

        wx.vibrateLong();
      }
    }, 120);
  },

  addRandomToCart() {
    if (!this.data.randomSelectedRecipe) return;
    
    const cart = db.addToCart(this.data.randomSelectedRecipe);
    this.setData({
      cart,
      cartCount: db.getCartCount(),
      cartTotal: db.getCartTotal(),
      showRandomModal: false
    });
    
    wx.showToast({
      title: `已添加 ${this.data.randomSelectedRecipe.name}`,
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
    wx.navigateTo({
      url: '/pages/order-confirm/index'
    });
  },

  // --- Sharing Setup ---
  onShareAppMessage() {
    // Mock user for sharing link
    const sharerInfo = wx.getStorageSync('userInfo') || { nickName: '吃货好友' };
    return {
      title: `「${sharerInfo.nickName}」邀请你一起点私房菜！`,
      path: `/pages/kitchen/index?sharer=${sharerInfo.nickName}`,
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
