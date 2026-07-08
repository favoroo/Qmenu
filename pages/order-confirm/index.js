const db = require('../../utils/db.js');
const subscribe = require('../../utils/subscribe.js');
const imageUtil = require('../../utils/image.js');

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

    // 初始渲染时：优先使用缓存URL，cloud://则替换为空字符串（WXML fallback到默认图）
    const displayItems = items.map(item => ({
      ...item,
      recipe: {
        ...item.recipe,
        image: imageUtil.getCachedUrlOrEmpty(item.recipe.image)
      }
    }));

    this.setData({
      cartItems: displayItems,
      cartTotal: total
    });

    // 异步解析购物车中菜谱的 cloud:// 图片
    this._resolveCartImages(items);
  },

  async _resolveCartImages(items) {
    if (!items || items.length === 0) return;
    try {
      const recipes = items.map(item => item.recipe);
      const resolved = await imageUtil.resolveRecipeImages(recipes);
      const map = {};
      resolved.forEach(r => { map[r.id] = r; });
      const updatedItems = items.map(item => {
        if (item.recipe && map[item.recipe.id]) {
          return { ...item, recipe: map[item.recipe.id] };
        }
        return { ...item };
      });
      this.setData({ cartItems: updatedItems });
    } catch (e) {
      console.warn('[order-confirm] 解析购物车图片失败', e);
    }
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
        // 初始渲染时：优先使用缓存URL，cloud://则替换为空字符串
        const displayMembers = members.map(m => ({
          ...m,
          avatarUrl: imageUtil.getCachedUrlOrEmpty(m.avatarUrl)
        }));
        const displayChef = defaultChef ? {
          ...defaultChef,
          avatarUrl: imageUtil.getCachedUrlOrEmpty(defaultChef.avatarUrl)
        } : null;
        this.setData({ members: displayMembers, selectedChef: displayChef });
        // 异步解析成员头像（使用原始 members 数据）
        this._resolveMemberAvatars(members);
      }
    } catch (err) {
      console.error('加载群成员失败', err);
    }
  },

  async _resolveMemberAvatars(members) {
    if (!members || members.length === 0) return;
    try {
      const resolved = await imageUtil.resolveAvatars(members);
      const selected = this.data.selectedChef;
      const updatedSelected = selected && resolved.find(m => m.openid === selected.openid) || selected;
      this.setData({ members: resolved, selectedChef: updatedSelected });
    } catch (e) {
      console.warn('[order-confirm] 解析成员头像失败', e);
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
