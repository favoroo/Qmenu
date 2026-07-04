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

  loadUserInfo() {
    const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo');
    if (userInfo) {
      this.setData({
        userInfo: userInfo
      });
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

  goRecipeAdd() {
    wx.navigateTo({
      url: '/pages/recipe-add/index'
    });
  },

  showAboutUs() {
    wx.showModal({
      title: '关于 Q 菜单',
      content: '「Q 菜单」私房菜点单与分享小程序框架。\n版本：v1.0.0\n技术栈：原生微信小程序 WXML+WXSS+JS',
      showCancel: false,
      confirmText: '好哒',
      confirmColor: '#1aa05f'
    });
  }
});
