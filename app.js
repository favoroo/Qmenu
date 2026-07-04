const db = require('./utils/db.js');

App({
  onLaunch() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      wx.cloud.init({
        env: 'cloud1-d1gh3024k4f7a4fa0',
        traceUser: true,
      });
    }

    // 将登录 promise 挂在 App 实例上，供其他页面加载时 await
    this.globalData.loginPromise = this.login();
  },

  async login() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'login'
      });
      if (res.result && res.result.success) {
        const userInfo = res.result.userInfo;
        this.globalData.userInfo = userInfo;
        wx.setStorageSync('userInfo', userInfo);
        
        // 登录成功后，初始化云端默认分类和菜谱
        await db.initCloudData();
        
        return userInfo;
      } else {
        throw new Error(res.result ? res.result.errMsg : '登录失败');
      }
    } catch (err) {
      console.error('[login] 登录失败', err);
      const cached = wx.getStorageSync('userInfo');
      if (cached) {
        this.globalData.userInfo = cached;
        return cached;
      }
      return null;
    }
  },

  globalData: {
    userInfo: null,
    loginPromise: null
  }
});
