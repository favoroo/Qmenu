const app = getApp();

Page({
  data: {
    userInfo: {
      nickName: '饕餮吃货',
      avatarUrl: '/assets/images/default_avatar.png'
    }
  },

  onShow() {
    this.loadUserInfo();
  },

  async loadUserInfo() {
    // 阶段1：同步读 storage，瞬时显示（冷启动 storage 同步可用）
    const cached = wx.getStorageSync('userInfo');
    if (cached) {
      this.setData({ userInfo: cached });
    }

    // 阶段2：await loginPromise 拿到最新云端 userInfo
    if (app.globalData.loginPromise) {
      await app.globalData.loginPromise;
    }
    const userInfo = app.globalData.userInfo || cached;
    if (userInfo) {
      this.setData({ userInfo });
    }
  },

  goToEditProfile() {
    wx.navigateTo({
      url: '/pages/login/index'
    });
  },

  // Navigations
  goCategoryManage() {
    wx.navigateTo({
      url: '/pages/category-manage/index'
    });
  },

  goGroupManage() {
    wx.navigateTo({
      url: '/pages/group/index'
    });
  },

  showAboutUs() {
    wx.showModal({
      title: '关于 Q 菜单',
      content: '「Q 菜单」私房菜点单与分享小程序框架。\n版本：v1.0.0\n技术栈：原生微信小程序 WXML+WXSS+JS',
      showCancel: false,
      confirmText: '好哒',
      confirmColor: '#007AFF'
    });
  }
});
