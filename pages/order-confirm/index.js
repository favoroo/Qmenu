const db = require('../../utils/db.js');

Page({
  data: {
    cartItems: [],
    cartTotal: 0,
    remark: '',
    
    // Sharing拼单 variables
    isFromShare: false,
    sharerName: '',
    
    isSubmitting: false
  },

  onLoad(options) {
    this.loadCart();
    
    // Check if entered via share link
    if (options.sharer) {
      this.setData({
        isFromShare: true,
        sharerName: options.sharer
      });
    }
  },

  async loadCart() {
    const app = getApp();
    if (app.globalData.loginPromise) {
      await app.globalData.loginPromise;
    }
    const cart = db.getCart();
    const items = Object.values(cart);
    const total = db.getCartTotal();

    this.setData({
      cartItems: items,
      cartTotal: total
    });
  },

  onRemarkInput(e) {
    this.setData({
      remark: e.detail.value
    });
  },

  // Place Order handler
  handlePlaceOrder() {
    const { remark, isFromShare, sharerName, isSubmitting, cartItems } = this.data;
    
    if (isSubmitting) return;
    if (cartItems.length === 0) {
      wx.showToast({
        title: '购物车是空的哦',
        icon: 'none'
      });
      return;
    }

    this.setData({ isSubmitting: true });

    // Call DB helper to write mock order
    const order = db.createOrder(remark, isFromShare, sharerName);

    if (order) {
      wx.showToast({
        title: '下单成功！正在制作',
        icon: 'success',
        duration: 1500
      });

      wx.vibrateLong();

      // Clear the local cart state in page
      this.setData({
        cartItems: [],
        cartTotal: 0
      });

      // Navigate to historical orders tab
      setTimeout(() => {
        wx.switchTab({
          url: '/pages/order/index'
        });
      }, 1500);
    } else {
      this.setData({ isSubmitting: false });
      wx.showToast({
        title: '下单失败，请重试',
        icon: 'none'
      });
    }
  }
});
