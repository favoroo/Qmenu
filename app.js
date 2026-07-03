const db = require('./utils/db.js');

App({
  onLaunch() {
    // Initialize the mock database on local storage
    db.init();

    // Setup a default mock user if none exists
    const userInfo = wx.getStorageSync('userInfo');
    if (!userInfo) {
      wx.setStorageSync('userInfo', {
        nickName: '饕餮吃货',
        avatarUrl: '/assets/images/logo.png',
        role: 'admin'
      });
    }
  },
  globalData: {
    // Global shared variables if any
  }
});
