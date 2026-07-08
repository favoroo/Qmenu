const app = getApp();
const db = require('../../utils/db.js');
const imageUtil = require('../../utils/image.js');

Page({
  data: {
    userInfo: {
      nickName: '饕餮吃货',
      avatarUrl: '/assets/images/default_avatar.png'
    },
    groupsList: [],
    currentGroup: null,
    isAdmin: false,
    myOpenid: '',
    showJoinModal: false,
    joinInviteCode: ''
  },

  onLoad() {
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    });
  },

  onShow() {
    this.loadUserInfo();
    this.loadGroups();
  },

  async loadUserInfo() {
    // 阶段1：同步读 storage，瞬时显示（冷启动 storage 同步可用）
    const cached = wx.getStorageSync('userInfo');
    if (cached) {
      // 优先使用缓存中未过期的URL，cloud://则替换为空字符串（WXML fallback到默认图）
      this.setData({
        userInfo: { ...cached, avatarUrl: imageUtil.getCachedUrlOrEmpty(cached.avatarUrl) }
      });
      // 异步解析头像
      this._resolveAvatar(cached.avatarUrl);
    }

    // 阶段2：await loginPromise 拿到最新云端 userInfo
    if (app.globalData.loginPromise) {
      await app.globalData.loginPromise;
    }
    const userInfo = app.globalData.userInfo || cached;
    if (userInfo) {
      this.setData({
        userInfo: { ...userInfo, avatarUrl: imageUtil.getCachedUrlOrEmpty(userInfo.avatarUrl) }
      });
      this._resolveAvatar(userInfo.avatarUrl);
    }
  },

  // 异步解析头像 cloud:// → https://
  async _resolveAvatar(avatarUrl) {
    if (!imageUtil.isCloudFileURL(avatarUrl)) return;
    try {
      const resolved = await imageUtil.resolveImage(avatarUrl);
      if (resolved && resolved.startsWith('https://')) {
        this.setData({
          'userInfo.avatarUrl': resolved
        });
      }
    } catch (e) {
      console.warn('[my] 解析头像失败', e);
    }
  },

  async loadGroups() {
    // 阶段1：缓存瞬时渲染
    const cachedGroups = db.getCachedGroupsList();
    let cgid = db.getCurrentGroupId() || (cachedGroups[0] && cachedGroups[0]._id) || '';
    let cg = cachedGroups.find(g => g._id === cgid) || null;
    let openid = (app.globalData.userInfo && app.globalData.userInfo.openid)
               || (wx.getStorageSync('userInfo') || {}).openid || '';
    this.setData({
      groupsList: cachedGroups,
      currentGroup: cg,
      isAdmin: cg && cg.ownerId === openid,
      myOpenid: openid
    });

    // 阶段2：云端刷新
    if (app.globalData.loginPromise) {
      await app.globalData.loginPromise;
    }
    try {
      const res = await wx.cloud.callFunction({ name: 'getGroup' });
      if (res.result && res.result.success) {
        const groups = res.result.groups || [];
        db.cacheGroupsList(groups);
        cgid = db.getCurrentGroupId() || (groups[0] && groups[0]._id) || '';
        cg = groups.find(g => g._id === cgid) || null;
        openid = (app.globalData.userInfo && app.globalData.userInfo.openid) || '';
        this.setData({
          groupsList: groups,
          currentGroup: cg,
          isAdmin: cg && cg.ownerId === openid,
          myOpenid: openid
        });
      }
    } catch (err) {
      console.error('loadGroups error', err);
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


  // --- 加入群组弹窗 ---
  openJoinModal() {
    this.setData({ showJoinModal: true, joinInviteCode: '' });
  },

  closeJoinModal() {
    this.setData({ showJoinModal: false });
  },

  onInputJoinCode(e) {
    this.setData({ joinInviteCode: e.detail.value });
  },

  async onConfirmJoinGroup() {
    const inviteCode = (this.data.joinInviteCode || '').trim();
    if (!inviteCode) {
      wx.showToast({ title: '请输入邀请码', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '正在加入...', mask: true });
    try {
      const res = await wx.cloud.callFunction({
        name: 'joinGroup',
        data: { inviteCode }
      });

      if (res.result && res.result.success) {
        const group = res.result.group;
        db.setCurrentGroupId(group._id);
        db.setLastGroupId(group._id);

        wx.hideLoading();
        wx.showToast({ title: '加入成功', icon: 'success' });

        this.setData({ showJoinModal: false, joinInviteCode: '' });

        await db.initCloudData(group._id);
        await this.loadGroups();
      } else {
        wx.hideLoading();
        wx.showToast({ title: (res.result && res.result.errMsg) || '加入失败', icon: 'none' });
      }
    } catch (err) {
      wx.hideLoading();
      console.error('joinGroup error', err);
      wx.showToast({ title: '网络错误，加入失败', icon: 'none' });
    }
  },

  // --- 分享邀请 ---
  onShareAppMessage() {
    const sharerInfo = app.globalData.userInfo || wx.getStorageSync('userInfo') || { nickName: '吃货好友' };
    const currentGroup = this.data.currentGroup;

    if (!currentGroup) {
      return {
        title: `「${sharerInfo.nickName}」邀请你一起用 Q 菜单点菜！`,
        path: '/pages/kitchen/index',
        imageUrl: ''
      };
    }

    return {
      title: `「${sharerInfo.nickName}」邀请你加入群组「${currentGroup.name}」一起拼单！`,
      path: `/pages/kitchen/index?groupId=${currentGroup._id}&inviteCode=${currentGroup.inviteCode}`,
      imageUrl: ''
    };
  }
});
