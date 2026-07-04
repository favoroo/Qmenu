const app = getApp();

Page({
  data: {
    avatarUrl: '',
    nickName: '',
    isUploading: false
  },

  onLoad() {
    const userInfo = app.globalData.userInfo || wx.getStorageSync('userInfo');
    if (userInfo) {
      this.setData({
        avatarUrl: userInfo.avatarUrl,
        nickName: userInfo.nickName
      });
    }
  },

  onChooseAvatar(e) {
    const { avatarUrl } = e.detail;
    this.setData({ avatarUrl });
  },

  onInputNickname(e) {
    this.setData({
      nickName: e.detail.value
    });
  },

  async onSubmit() {
    const { avatarUrl, nickName } = this.data;
    if (!nickName.trim()) {
      wx.showToast({ title: '请输入昵称', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '保存中...', mask: true });

    try {
      let finalAvatarUrl = avatarUrl;
      // 如果头像是本地临时文件，先上传到云存储
      if (avatarUrl && (avatarUrl.includes('tmp') || avatarUrl.startsWith('wxfile://') || avatarUrl.startsWith('http://tmp'))) {
        const cloudPath = `avatars/${Date.now()}-${Math.random().toString(36).substr(2, 6)}.png`;
        const uploadRes = await wx.cloud.uploadFile({
          cloudPath,
          filePath: avatarUrl
        });
        finalAvatarUrl = uploadRes.fileID;
      }

      const res = await wx.cloud.callFunction({
        name: 'updateUser',
        data: {
          nickName: nickName.trim(),
          avatarUrl: finalAvatarUrl
        }
      });

      if (res.result && res.result.success) {
        app.globalData.userInfo = res.result.userInfo;
        wx.setStorageSync('userInfo', res.result.userInfo);
        wx.showToast({ title: '保存成功', icon: 'success' });
        
        setTimeout(() => {
          wx.navigateBack({
            fail() {
              wx.switchTab({ url: '/pages/kitchen/index' });
            }
          });
        }, 1500);
      } else {
        throw new Error(res.result ? res.result.errMsg : '更新失败');
      }
    } catch (err) {
      console.error(err);
      wx.showToast({ title: err.message || '保存失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  }
});
