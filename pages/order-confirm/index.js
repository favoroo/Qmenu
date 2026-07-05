const db = require('../../utils/db.js');
const subscribe = require('../../utils/subscribe.js');

Page({
  data: {
    cartItems: [],
    cartTotal: 0,
    remark: '',

    // Sharing拼单 variables
    isFromShare: false,
    sharerName: '',

    // Chef selection
    members: [],
    selectedChef: null,

    isSubmitting: false
  },

  onLoad(options) {
    this.loadCart();
    this.loadMembers();

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

  async loadMembers() {
    const app = getApp();
    if (app.globalData.loginPromise) {
      await app.globalData.loginPromise;
    }
    const groupId = db.getCurrentGroupId();
    if (!groupId) return;

    try {
      const res = await wx.cloud.callFunction({
        name: 'getGroup',
        data: { groupId: groupId }
      });
      if (res.result && res.result.success) {
        const members = (res.result.group.members) || [];
        const me = app.globalData.userInfo;
        // 默认选中自己（自做）
        const defaultChef = members.find(m => m.openid === me.openid) || null;
        this.setData({ members, selectedChef: defaultChef });
      }
    } catch (err) {
      console.error('加载群成员失败', err);
    }
  },

  onSelectChef(e) {
    const openid = e.currentTarget.dataset.openid;
    const member = this.data.members.find(m => m.openid === openid);
    if (member) {
      this.setData({ selectedChef: member });
    }
  },

  onRemarkInput(e) {
    this.setData({
      remark: e.detail.value
    });
  },

  // Place Order handler
  async handlePlaceOrder() {
    const { remark, isFromShare, sharerName, isSubmitting, cartItems, selectedChef } = this.data;

    if (isSubmitting) return;
    if (cartItems.length === 0) {
      wx.showToast({
        title: '购物车是空的哦',
        icon: 'none'
      });
      return;
    }

    this.setData({ isSubmitting: true });

    const chef = selectedChef || null;

    try {
      // Call DB helper to write order (await 确保订单写入云端后再通知厨师)
      const order = await db.createOrder(remark, isFromShare, sharerName, chef);

      if (order) {
        const app = getApp();
        const me = app.globalData.userInfo;
        const needNotify = chef && chef.openid && chef.openid !== me.openid;

        if (needNotify) {
          try {
            const r = await subscribe.callNotifyChef(order);
            if (r.sent) {
              wx.showToast({ title: '下单成功，已通知厨师', icon: 'success', duration: 1500 });
            } else {
              wx.showToast({ title: '已下单，厨师未开启提醒', icon: 'none', duration: 2000 });
            }
          } catch (e) {
            wx.showToast({ title: '已下单，通知发送失败', icon: 'none' });
          }
        } else {
          wx.showToast({
            title: '下单成功！正在制作',
            icon: 'success',
            duration: 1500
          });
        }

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
    } catch (err) {
      console.error('下单失败', err);
      this.setData({ isSubmitting: false });
      wx.showToast({
        title: '下单失败，请检查网络后重试',
        icon: 'none'
      });
    }
  }
});
