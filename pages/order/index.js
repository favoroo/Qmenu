const db = require('../../utils/db.js');

Page({
  data: {
    orders: []
  },

  onShow() {
    this.loadOrders();
  },

  onPullDownRefresh() {
    this.loadOrders();
    wx.stopPullDownRefresh();
    wx.showToast({
      title: '已刷新',
      icon: 'none'
    });
  },

  loadOrders() {
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
      wx.setStorageSync('DB_ORDERS', orders);
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
          let orders = db.getOrders();
          orders = orders.filter(o => o.id !== orderId);
          wx.setStorageSync('DB_ORDERS', orders);
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
  }
});
