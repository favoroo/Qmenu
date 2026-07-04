const db = require('../../utils/db.js');
const subscribe = require('../../utils/subscribe.js');

Page({
  data: {
    orders: [],
    filteredOrders: [],
    activeTab: 'mine',        // 'mine' | 'kitchen'
    myOpenid: '',
    showSubscribeBanner: false,
    showDetailModal: false,
    selectedRecipe: null,
    selectedRecipeCategoryName: '',
    activeTimerStepIndex: -1,
    timerSecondsLeft: 0,
    formattedTimeLeft: '00:00',
    isAdmin: true
  },

  onLoad(options) {
    // Support deep-link from subscription message: pages/order/index?tab=kitchen
    if (options && options.tab === 'kitchen') {
      this.setData({ activeTab: 'kitchen' });
    }
  },

  onShow() {
    this.loadOrders();
  },

  onHide() {
    this.stopStepTimer();
  },

  onUnload() {
    this.stopStepTimer();
  },

  onPullDownRefresh() {
    this.loadOrders();
    wx.stopPullDownRefresh();
    wx.showToast({
      title: '已刷新',
      icon: 'none'
    });
  },

  async loadOrders() {
    const app = getApp();
    if (app.globalData.loginPromise) {
      await app.globalData.loginPromise;
    }
    
    const currentGroupId = db.getCurrentGroupId();
    let isAdmin = false;
    let myOpenid = '';
    
    if (app.globalData.userInfo) {
      myOpenid = app.globalData.userInfo.openid || '';
    }
    
    // 复用 kitchen 页已缓存的群组列表，避免重复调用 getGroup
    const cachedGroups = db.getCachedGroupsList();
    const currentGroup = cachedGroups.find(g => g._id === currentGroupId);
    if (currentGroup) {
      isAdmin = currentGroup.ownerId === myOpenid;
    } else if (currentGroupId) {
      // 仅在缓存未命中时回退到云函数调用
      try {
        const res = await wx.cloud.callFunction({
          name: 'getGroup',
          data: { groupId: currentGroupId }
        });
        if (res.result && res.result.success) {
          isAdmin = res.result.group.ownerId === myOpenid;
        }
      } catch (err) {
        console.error(err);
      }
    }
    
    const orders = db.getOrders();
    
    // Determine subscribe banner visibility (kitchen tab, not subscribed recently)
    const subscribedAt = wx.getStorageSync('chefNotifySubscribedAt') || 0;
    const showBanner = this.data.activeTab === 'kitchen' && (Date.now() - subscribedAt > 7 * 24 * 3600 * 1000);
    
    this.setData({
      orders: orders,
      isAdmin: isAdmin,
      myOpenid: myOpenid,
      showSubscribeBanner: showBanner
    }, () => {
      this.applyTabFilter();
    });
  },

  // Filter orders based on active tab
  applyTabFilter() {
    const { orders, activeTab, myOpenid } = this.data;
    let list = orders;
    if (activeTab === 'mine') {
      list = orders.filter(o => (o.userOpenid || o._openid || '') === myOpenid);
    }
    // kitchen: show all
    this.setData({ filteredOrders: list });
  },

  // Switch tab
  onTabChange(e) {
    const tab = e.currentTarget.dataset.tab;
    const subscribedAt = wx.getStorageSync('chefNotifySubscribedAt') || 0;
    const showBanner = tab === 'kitchen' && (Date.now() - subscribedAt > 7 * 24 * 3600 * 1000);
    this.setData({
      activeTab: tab,
      showSubscribeBanner: showBanner
    }, () => {
      this.applyTabFilter();
    });
  },

  // Subscribe to chef notifications (must be called synchronously from tap)
  async onTapSubscribe() {
    const r = await subscribe.requestChefSubscribe();
    if (r.accepted) {
      this.setData({ showSubscribeBanner: false });
      wx.showToast({ title: '已开启新订单提醒', icon: 'success' });
    } else if (r.state === 'reject' || r.state === 'ban') {
      wx.showToast({ title: '已取消，可稍后再开启', icon: 'none' });
    }
  },

  // Remind chef to prepare order
  async remindChef(e) {
    const orderId = e.currentTarget.dataset.id;
    const order = this.data.orders.find(o => o.id === orderId);
    if (!order || !order.chefId) {
      wx.showToast({ title: '该订单未指定厨师', icon: 'none' });
      return;
    }
    const me = getApp().globalData.userInfo;
    if (order.chefId === me.openid) {
      wx.showToast({ title: '这是自己制作的订单', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '发送提醒...' });
    try {
      const r = await subscribe.callNotifyChef(order);
      wx.hideLoading();
      if (r.sent) {
        wx.showToast({ title: '已提醒厨师', icon: 'success' });
      } else {
        wx.showToast({ title: '厨师未开启提醒，请提醒TA到「厨房订单」开启', icon: 'none', duration: 2500 });
      }
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: '提醒失败，请重试', icon: 'none' });
    }
  },

  // Mark an order as cooked/done
  completeOrder(e) {
    const orderId = e.currentTarget.dataset.id;
    const orders = db.getOrders();
    const index = orders.findIndex(o => o.id === orderId);
    
    if (index > -1) {
      orders[index].status = 'done';
      db.saveOrders(orders);
      this.loadOrders();
      wx.showToast({
        title: '订单已制作完成！',
        icon: 'success'
      });
      wx.vibrateShort();
    }
  },

  // Reorder: add order items to cart and redirect to kitchen tab
  reorder(e) {
    const orderId = e.currentTarget.dataset.id;
    const orders = this.data.orders;
    const order = orders.find(o => o.id === orderId);
    
    if (order) {
      db.clearCart(); // Clear old items
      
      // Load all current recipes to verify status and details
      const recipes = db.getRecipes();
      
      order.items.forEach(item => {
        // Find matching recipe in database
        const recipe = recipes.find(r => r.id === item.recipeId);
        if (recipe && recipe.status === 1) {
          // Add to cart with its quantity
          for (let i = 0; i < item.quantity; i++) {
            db.addToCart(recipe);
          }
        }
      });
      
      wx.showToast({
        title: '已添加至购物车',
        icon: 'success',
        duration: 1000
      });
      
      setTimeout(() => {
        wx.switchTab({
          url: '/pages/kitchen/index'
        });
      }, 1000);
    }
  },

  // Delete order from history
  deleteOrder(e) {
    const orderId = e.currentTarget.dataset.id;
    const self = this;
    
    wx.showModal({
      title: '删除订单',
      content: '确定要删除这条订单记录吗？',
      success(res) {
        if (res.confirm) {
          db.deleteOrder(orderId);
          self.loadOrders();
          wx.showToast({
            title: '删除成功',
            icon: 'success'
          });
        }
      }
    });
  },

  goToKitchen() {
    wx.switchTab({
      url: '/pages/kitchen/index'
    });
  },

  // View recipe detail of the selected dish (directly open popup modal on the order page)
  viewRecipeDetail(e) {
    const recipeId = e.currentTarget.dataset.recipeId;
    if (!recipeId) return;

    const recipes = db.getRecipes();
    const recipe = recipes.find(r => r.id === recipeId);
    if (!recipe) {
      wx.showToast({
        title: '该菜谱已不存在',
        icon: 'none'
      });
      return;
    }
    if (recipe.status !== 1) {
      wx.showToast({
        title: '该菜谱已下架',
        icon: 'none'
      });
      return;
    }

    const categories = db.getCategories();
    const category = categories.find(c => c.id === recipe.categoryId);
    const categoryName = category ? category.name : '默认分类';

    this.setData({
      selectedRecipe: recipe,
      selectedRecipeCategoryName: categoryName,
      showDetailModal: true,
      activeTimerStepIndex: -1,
      timerSecondsLeft: 0,
      formattedTimeLeft: '00:00'
    });
    this.stopStepTimer();
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
    this.stepTimerInterval = setInterval(() => {
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
    if (this.stepTimerInterval) {
      clearInterval(this.stepTimerInterval);
      this.stepTimerInterval = null;
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
