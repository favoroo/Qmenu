const app = getApp();
const db = require('../../utils/db.js');

Page({
  data: {
    viewMode: 'list',
    groupsList: [],
    currentGroupId: '',
    myOpenid: '',

    groupId: '',
    group: null,
    isOwner: false,
    inviteCode: '',
    newGroupName: ''
  },

  async onLoad(options) {
    wx.showLoading({ title: '加载中...' });
    await app.globalData.loginPromise;
    wx.hideLoading();

    const myOpenid = app.globalData.userInfo.openid;
    const currentGroupId = db.getCurrentGroupId();
    this.setData({ myOpenid, currentGroupId });

    await this.loadGroupList();

    if (options.groupId) {
      this.openGroupDetail(options.groupId);
    } else {
      wx.setNavigationBarTitle({ title: '我的群组' });
    }
  },

  async loadGroupList() {
    try {
      const res = await wx.cloud.callFunction({ name: 'getGroup' });
      if (res.result && res.result.success) {
        this.setData({ groupsList: res.result.groups || [] });
      }
    } catch (err) {
      console.error(err);
    }
  },

  onTapGroupItem(e) {
    const gId = e.currentTarget.dataset.id;
    if (gId) this.openGroupDetail(gId);
  },

  openGroupDetail(gId) {
    this.setData({ groupId: gId, viewMode: 'detail' });
    this.loadGroupInfo(gId);
  },

  backToList() {
    this.setData({ viewMode: 'list', groupId: '', group: null });
    wx.setNavigationBarTitle({ title: '我的群组' });
    this.loadGroupList();
  },

  async loadGroupInfo(gId) {
    wx.showLoading({ title: '加载群组信息...' });
    try {
      const res = await wx.cloud.callFunction({
        name: 'getGroup',
        data: { groupId: gId }
      });
      if (res.result && res.result.success) {
        const group = res.result.group;
        const myOpenid = this.data.myOpenid;
        this.setData({
          group: group,
          isOwner: group.ownerId === myOpenid
        });
        wx.setNavigationBarTitle({ title: group.name || '群组详情' });
      } else {
        wx.showToast({ title: res.result.errMsg || '获取群组失败', icon: 'none' });
      }
    } catch (err) {
      console.error(err);
      wx.showToast({ title: '网络错误', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  onInputInviteCode(e) {
    this.setData({ inviteCode: e.detail.value });
  },

  onInputGroupName(e) {
    this.setData({ newGroupName: e.detail.value });
  },

  async onCreateGroup() {
    const { newGroupName } = this.data;
    if (!newGroupName.trim()) {
      wx.showToast({ title: '请输入群组名称', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '正在创建...', mask: true });
    try {
      const res = await wx.cloud.callFunction({
        name: 'createGroup',
        data: { name: newGroupName.trim() }
      });

      if (res.result && res.result.success) {
        const group = res.result.group;
        db.setCurrentGroupId(group._id);
        
        wx.hideLoading();
        wx.showToast({ title: '创建成功', icon: 'success' });
        
        this.setData({
          groupId: group._id,
          group: group,
          isOwner: true,
          viewMode: 'detail',
          newGroupName: ''
        });

        db.initCloudData(group._id).then(() => {
          this.loadGroupInfo(group._id);
        });
        
        this.loadGroupList();

        const pages = getCurrentPages();
        const prevPage = pages[pages.length - 2];
        if (prevPage && typeof prevPage.loadGroupsList === 'function') {
          prevPage.loadGroupsList();
        }
      } else {
        wx.hideLoading();
        throw new Error(res.result.errMsg || '创建失败');
      }
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: err.message || '创建失败', icon: 'none' });
    }
  },

  async onJoinGroup() {
    const { inviteCode } = this.data;
    if (!inviteCode.trim()) {
      wx.showToast({ title: '请输入邀请码', icon: 'none' });
      return;
    }

    wx.showLoading({ title: '正在加入...', mask: true });
    try {
      const res = await wx.cloud.callFunction({
        name: 'joinGroup',
        data: { inviteCode: inviteCode.trim() }
      });

      if (res.result && res.result.success) {
        const group = res.result.group;
        db.setCurrentGroupId(group._id);

        wx.hideLoading();
        wx.showToast({ title: '加入成功', icon: 'success' });

        const myOpenid = this.data.myOpenid;
        this.setData({
          groupId: group._id,
          group: group,
          isOwner: group.ownerId === myOpenid,
          viewMode: 'detail',
          inviteCode: ''
        });

        db.initCloudData(group._id).then(() => {
          this.loadGroupInfo(group._id);
        });

        this.loadGroupList();

        const pages = getCurrentPages();
        const prevPage = pages[pages.length - 2];
        if (prevPage && typeof prevPage.loadGroupsList === 'function') {
          prevPage.loadGroupsList();
        }
      } else {
        wx.hideLoading();
        throw new Error(res.result.errMsg || '加入失败');
      }
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: err.message || '加入失败', icon: 'none' });
    }
  },

  copyInviteCode() {
    const { group } = this.data;
    if (!group) return;
    wx.setClipboardData({
      data: group.inviteCode,
      success() {
        wx.showToast({ title: '复制成功' });
      }
    });
  },

  onLeaveGroup() {
    const self = this;
    wx.showModal({
      title: '提示',
      content: '确定要退出该群组吗？退出后您将无法查看此菜单及下单。',
      success(res) {
        if (res.confirm) {
          self.doLeaveGroup();
        }
      }
    });
  },

  async doLeaveGroup() {
    wx.showLoading({ title: '正在退出...', mask: true });
    try {
      const res = await wx.cloud.callFunction({
        name: 'leaveGroup',
        data: { groupId: this.data.groupId }
      });
      if (res.result && res.result.success) {
        wx.showToast({ title: '退出成功' });

        const pages = getCurrentPages();
        const prevPage = pages[pages.length - 2];
        if (prevPage && typeof prevPage.loadGroupsList === 'function') {
          prevPage.loadGroupsList();
        }

        this.backToList();
      } else {
        throw new Error(res.result.errMsg);
      }
    } catch (err) {
      wx.showToast({ title: err.message || '退出失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  onDisbandGroup() {
    const self = this;
    wx.showModal({
      title: '解散群组',
      content: '确定要解散群组吗？此操作将永久删除此群及群内的所有菜品、分类和订单！且不可恢复！',
      confirmColor: '#EF4444',
      success(res) {
        if (res.confirm) {
          self.doDisbandGroup();
        }
      }
    });
  },

  async doDisbandGroup() {
    wx.showLoading({ title: '正在解散...', mask: true });
    try {
      const res = await wx.cloud.callFunction({
        name: 'disbandGroup',
        data: { groupId: this.data.groupId }
      });
      if (res.result && res.result.success) {
        wx.showToast({ title: '解散成功' });

        const pages = getCurrentPages();
        const prevPage = pages[pages.length - 2];
        if (prevPage && typeof prevPage.loadGroupsList === 'function') {
          prevPage.loadGroupsList();
        }

        this.backToList();
      } else {
        throw new Error(res.result.errMsg);
      }
    } catch (err) {
      wx.showToast({ title: err.message || '解散失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  onEditGroupName() {
    const self = this;
    const { group } = this.data;
    if (!group) return;

    wx.showModal({
      title: '修改群名称',
      editable: true,
      placeholderText: '请输入新群组名称',
      content: group.name,
      success(res) {
        if (res.confirm && res.content && res.content.trim()) {
          self.doEditGroupName(res.content.trim());
        }
      }
    });
  },

  async doEditGroupName(newName) {
    wx.showLoading({ title: '正在修改...', mask: true });
    try {
      const res = await wx.cloud.callFunction({
        name: 'updateGroupName',
        data: { groupId: this.data.groupId, name: newName }
      });
      if (res.result && res.result.success) {
        wx.hideLoading();
        wx.showToast({ title: '修改成功', icon: 'success' });
        this.setData({ group: res.result.group });
        wx.setNavigationBarTitle({ title: res.result.group.name });
        this.loadGroupList();

        const pages = getCurrentPages();
        const prevPage = pages[pages.length - 2];
        if (prevPage && typeof prevPage.loadGroupsList === 'function') {
          prevPage.loadGroupsList();
        }
      } else {
        throw new Error(res.result.errMsg);
      }
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: err.message || '修改失败', icon: 'none' });
    }
  },

  onRegenerateInviteCode() {
    const self = this;
    wx.showModal({
      title: '重新生成邀请码',
      content: '重新生成后，原邀请码将立即失效，已分享给好友的旧码将无法使用。确定继续吗？',
      confirmColor: '#EF4444',
      success(res) {
        if (res.confirm) {
          self.doRegenerateInviteCode();
        }
      }
    });
  },

  async doRegenerateInviteCode() {
    wx.showLoading({ title: '正在生成...', mask: true });
    try {
      const res = await wx.cloud.callFunction({
        name: 'regenerateInviteCode',
        data: { groupId: this.data.groupId }
      });
      if (res.result && res.result.success) {
        wx.hideLoading();
        wx.showToast({ title: '已生成新邀请码', icon: 'success' });
        this.setData({ group: res.result.group });
      } else {
        throw new Error(res.result.errMsg);
      }
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: err.message || '生成失败', icon: 'none' });
    }
  },

  onRemoveMember(e) {
    const self = this;
    const memberOpenid = e.currentTarget.dataset.openid;
    const memberName = e.currentTarget.dataset.name;

    wx.showModal({
      title: '移除成员',
      content: `确定要将「${memberName}」移出群组吗？`,
      confirmColor: '#EF4444',
      success(res) {
        if (res.confirm) {
          self.doRemoveMember(memberOpenid);
        }
      }
    });
  },

  async doRemoveMember(memberOpenid) {
    wx.showLoading({ title: '正在移除...', mask: true });
    try {
      const res = await wx.cloud.callFunction({
        name: 'removeMember',
        data: { groupId: this.data.groupId, memberOpenid }
      });
      if (res.result && res.result.success) {
        wx.hideLoading();
        wx.showToast({ title: '已移除', icon: 'success' });
        this.setData({ group: res.result.group });
      } else {
        throw new Error(res.result.errMsg);
      }
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: err.message || '移除失败', icon: 'none' });
    }
  },

  onTransferOwner(e) {
    const self = this;
    const newOwnerOpenid = e.currentTarget.dataset.openid;
    const memberName = e.currentTarget.dataset.name;

    wx.showModal({
      title: '转让群主',
      content: `确定将群主转让给「${memberName}」吗？转让后您将变为普通成员，不再拥有管理权限。`,
      confirmColor: '#005BCB',
      success(res) {
        if (res.confirm) {
          self.doTransferOwner(newOwnerOpenid);
        }
      }
    });
  },

  async doTransferOwner(newOwnerOpenid) {
    wx.showLoading({ title: '正在转让...', mask: true });
    try {
      const res = await wx.cloud.callFunction({
        name: 'transferOwner',
        data: { groupId: this.data.groupId, newOwnerOpenid }
      });
      if (res.result && res.result.success) {
        wx.hideLoading();
        wx.showToast({ title: '转让成功', icon: 'success' });
        this.setData({
          group: res.result.group,
          isOwner: false
        });

        const pages = getCurrentPages();
        const prevPage = pages[pages.length - 2];
        if (prevPage && typeof prevPage.loadGroupsList === 'function') {
          prevPage.loadGroupsList();
        }
      } else {
        throw new Error(res.result.errMsg);
      }
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: err.message || '转让失败', icon: 'none' });
    }
  }
});
