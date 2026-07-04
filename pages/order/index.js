const db = require('../../utils/db.js');

Page({
  data: {
    orders: [],
    showDetailModal: false,
    selectedRecipe: null,
    selectedRecipeCategoryName: '',
    activeTimerStepIndex: -1,
    timerSecondsLeft: 0,
    formattedTimeLeft: '00:00',
    isAdmin: true
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
    const orders = db.getOrders();
    this.setData({
      orders: orders
    });
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
