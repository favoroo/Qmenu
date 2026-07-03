Page({
  data: {
    userInfo: {
      nickName: '饕餮吃货',
      avatarUrl: '/assets/images/logo.png',
      role: 'admin' // default to admin to show admin settings
    }
  },

  onShow() {
    this.loadUserInfo();
  },

  loadUserInfo() {
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo) {
      this.setData({
        userInfo: userInfo
      });
    }
  },

  // Toggle user role between Admin and User for testing purposes
  toggleRole() {
    const userInfo = { ...this.data.userInfo };
    userInfo.role = userInfo.role === 'admin' ? 'user' : 'admin';
    
    wx.setStorageSync('userInfo', userInfo);
    this.setData({ userInfo });
    
    wx.showToast({
      title: `切换为：${userInfo.role === 'admin' ? '管理员' : '普通用户'}`,
      icon: 'success'
    });
    wx.vibrateShort();
  },

  // Reset all local storage data to initial states
  resetCache() {
    const self = this;
    wx.showModal({
      title: '恢复默认设置',
      content: '该操作将清空本地所有自定义菜谱、分类及订单记录，并恢复系统默认演示数据。确定要继续吗？',
      confirmColor: '#ff4d4f',
      success(res) {
        if (res.confirm) {
          wx.clearStorageSync();
          
          // Re-initialize default mock DB
          const db = require('../../utils/db.js');
          db.init();
          
          wx.setStorageSync('userInfo', {
            nickName: '饕餮吃货',
            avatarUrl: '/assets/images/logo.png',
            role: 'admin'
          });
          
          self.loadUserInfo();
          
          wx.showToast({
            title: '重置完成',
            icon: 'success'
          });
          wx.vibrateLong();
        }
      }
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
