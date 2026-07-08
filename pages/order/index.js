const db = require('../../utils/db.js');
const subscribe = require('../../utils/subscribe.js');
const imageUtil = require('../../utils/image.js');

Page({
  data: {
    orders: [],
    filteredOrders: [],
    activeTab: 'kitchen',     // 'mine' | 'kitchen' | 'cooked'
    myOpenid: '',
    showSubscribeBanner: false,
    showDetailModal: false,
    selectedRecipe: null,
    selectedRecipeCategoryName: '',
    activeTimerStepIndex: -1,
    timerSecondsLeft: 0,
    formattedTimeLeft: '00:00',
    isAdmin: false,

    // 厨师排行榜
    ranking: [],
    rankingPeriod: 'month',   // 'month' | 'year' | 'all'
    rankingTotalChefs: 0,
    totalRatings: 0,
    totalStars: 0,

    // 评分弹窗
    showRatingModal: false,
    ratingOrder: null,
    ratingStars: 0,
    isSubmittingRating: false
  },

  onLoad(options) {
    // Support deep-link from subscription message: pages/order/index?tab=mine|cooked
    if (options && (options.tab === 'mine' || options.tab === 'cooked')) {
      this.setData({ activeTab: options.tab });
    }
  },

  onShow() {
    this.loadOrders();
  },

  onHide() {
    this.stopStepTimer();
  },

  onUnload() {
    this.stopStepTimer();
  },

  onPullDownRefresh() {
    this.loadOrders();
    wx.stopPullDownRefresh();
    wx.showToast({
      title: '已刷新',
      icon: 'none'
    });
  },

  async loadOrders() {
    const app = getApp();
    if (app.globalData.loginPromise) {
      await app.globalData.loginPromise;
    }
    
    const currentGroupId = db.getCurrentGroupId();
    let isAdmin = false;
    let myOpenid = '';
    
    if (app.globalData.userInfo) {
      myOpenid = app.globalData.userInfo.openid || '';
    }
    
    // 复用 kitchen 页已缓存的群组列表，避免重复调用 getGroup
    const cachedGroups = db.getCachedGroupsList();
    const currentGroup = cachedGroups.find(g => g._id === currentGroupId);
    if (currentGroup) {
      isAdmin = currentGroup.ownerId === myOpenid;
    } else if (currentGroupId) {
      // 仅在缓存未命中时回退到云函数调用
      try {
        const res = await wx.cloud.callFunction({
          name: 'getGroup',
          data: { groupId: currentGroupId }
        });
        if (res.result && res.result.success) {
          isAdmin = res.result.group.ownerId === myOpenid;
        }
      } catch (err) {
        console.error(err);
      }
    }
    
    const orders = db.getOrders();
    // 为每个订单附上评分相关信息，便于按钮显隐判定
    const ordersWithRating = orders.map(o => {
      const ordererId = o.userOpenid || o._openid || '';
      const isMyOrder = !!myOpenid && ordererId === myOpenid;
      const isChefMe = !!myOpenid && o.chefId && o.chefId === myOpenid;
      const myRating = (isMyOrder && myOpenid) ? db.getOrderRating(o.id, myOpenid) : null;
      const isRatedByMe = !!(myRating && myRating.raterId === myOpenid);

      // 厨师视角：该订单获得的评分（当我是厨师时）
      let chefRatingStars = 0;
      if (isChefMe) {
        const allRatings = db.getRatings();
        const r = allRatings.find(rt => rt.orderId === o.id && rt.chefId === myOpenid);
        if (r) chefRatingStars = r.stars || 0;
      }

      return {
        ...o,
        isMyOrder: isMyOrder,
        isChefMe: isChefMe,
        myRatingStars: myRating ? myRating.stars : 0,
        isRatedByMe: isRatedByMe,
        chefRatingStars: chefRatingStars,
        // 可评分条件：我是下单者 + 订单已完成 + 有厨师 + 厨师不是我 + 还没评过分
        canRate: isMyOrder && o.status === 'done' && !!o.chefId && !isChefMe && !isRatedByMe
      };
    });
    
    // Determine subscribe banner visibility (kitchen tab, not subscribed recently)
    const subscribedAt = wx.getStorageSync('chefNotifySubscribedAt') || 0;
    const showBanner = this.data.activeTab === 'kitchen' && (Date.now() - subscribedAt > 7 * 24 * 3600 * 1000);
    
    // 初始渲染时：优先使用本地缓存中未过期的https URL，否则将cloud://替换为空字符串（WXML fallback到默认图）
    // 异步解析完成后更新为真实 https:// 链接
    const displayOrders = ordersWithRating.map(o => {
      const newOrder = { ...o };
      newOrder.chefAvatar = imageUtil.getCachedUrlOrEmpty(o.chefAvatar);
      newOrder.userAvatar = imageUtil.getCachedUrlOrEmpty(o.userAvatar);
      if (o.items) {
        newOrder.items = o.items.map(it => ({
          ...it,
          image: imageUtil.getCachedUrlOrEmpty(it.image)
        }));
      }
      return newOrder;
    });

    this.setData({
      orders: displayOrders,
      isAdmin: isAdmin,
      myOpenid: myOpenid,
      showSubscribeBanner: showBanner
    }, () => {
      this.applyTabFilter();
      this.loadRanking();
      // 异步解析订单中的图片（菜谱图、厨师头像）
      this._resolveOrderImages(ordersWithRating);
    });
  },

  // 异步解析订单中的 cloud:// 图片为临时下载链接
  async _resolveOrderImages(orders) {
    if (!orders || orders.length === 0) return;
    try {
      // 收集所有需要解析的 cloud:// fileID
      const fileIDs = [];
      orders.forEach(o => {
        if (imageUtil.isCloudFileURL(o.chefAvatar)) fileIDs.push(o.chefAvatar);
        if (imageUtil.isCloudFileURL(o.userAvatar)) fileIDs.push(o.userAvatar);
        (o.items || []).forEach(item => {
          if (imageUtil.isCloudFileURL(item.image)) fileIDs.push(item.image);
        });
      });
      if (fileIDs.length === 0) return;

      const map = await imageUtil.resolveImages(fileIDs);

      // 替换成功解析为 https:// 的，失败的 cloud:// 设为空字符串（WXML fallback到默认图）
      const resolvedOrders = orders.map(o => {
        const newOrder = { ...o };
        if (o.chefAvatar && imageUtil.isCloudFileURL(o.chefAvatar)) {
          newOrder.chefAvatar = (map[o.chefAvatar] && map[o.chefAvatar].startsWith('https://')) ? map[o.chefAvatar] : '';
        }
        if (o.userAvatar && imageUtil.isCloudFileURL(o.userAvatar)) {
          newOrder.userAvatar = (map[o.userAvatar] && map[o.userAvatar].startsWith('https://')) ? map[o.userAvatar] : '';
        }
        if (o.items) {
          newOrder.items = o.items.map(item => {
            if (item.image && imageUtil.isCloudFileURL(item.image)) {
              const resolved = map[item.image];
              return { ...item, image: (resolved && resolved.startsWith('https://')) ? resolved : '' };
            }
            return { ...item };
          });
        }
        return newOrder;
      });

      // 回写到 db 缓存（只回写成功解析的）
      db.updateOrderImagesInCache(resolvedOrders);

      this.setData({ orders: resolvedOrders }, () => {
        this.applyTabFilter();
      });
    } catch (e) {
      console.warn('[order] 解析订单图片失败', e);
    }
  },

  // Filter orders based on active tab
  applyTabFilter() {
    const { orders, activeTab, myOpenid } = this.data;
    let list = orders;
    if (activeTab === 'mine') {
      list = orders.filter(o => (o.userOpenid || o._openid || '') === myOpenid);
    } else if (activeTab === 'cooked') {
      // 我完成的订单：别人指派给我当厨师的订单
      list = orders.filter(o => o.chefId && o.chefId === myOpenid);
    }
    // kitchen: show all
    this.setData({ filteredOrders: list });
  },

  // Switch tab
  onTabChange(e) {
    const tab = e.currentTarget.dataset.tab;
    const subscribedAt = wx.getStorageSync('chefNotifySubscribedAt') || 0;
    const showBanner = tab === 'kitchen' && (Date.now() - subscribedAt > 7 * 24 * 3600 * 1000);
    this.setData({
      activeTab: tab,
      showSubscribeBanner: showBanner
    }, () => {
      this.applyTabFilter();
    });
  },

  // Subscribe to chef notifications (must be called synchronously from tap)
  async onTapSubscribe() {
    const r = await subscribe.requestChefSubscribe();
    if (r.accepted) {
      this.setData({ showSubscribeBanner: false });
      wx.showToast({ title: '已开启新订单提醒', icon: 'success' });
    } else if (r.state === 'reject' || r.state === 'ban') {
      wx.showToast({ title: '已取消，可稍后再开启', icon: 'none' });
    }
  },

  // Remind chef to prepare order
  async remindChef(e) {
    const orderId = e.currentTarget.dataset.id;
    const order = this.data.orders.find(o => o.id === orderId);
    if (!order || !order.chefId) {
      wx.showToast({ title: '该订单未指定厨师', icon: 'none' });
      return;
    }
    const me = getApp().globalData.userInfo;
    if (order.chefId === me.openid) {
      wx.showToast({ title: '这是自己制作的订单', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '发送提醒...' });
    try {
      const r = await subscribe.callNotifyChef(order);
      wx.hideLoading();
      if (r.sent) {
        wx.showToast({ title: '已提醒厨师', icon: 'success' });
      } else {
        wx.showToast({ title: '厨师未开启提醒，请提醒TA到「厨房订单」开启', icon: 'none', duration: 2500 });
      }
    } catch (err) {
      wx.hideLoading();
      wx.showToast({ title: '提醒失败，请重试', icon: 'none' });
    }
  },

  // Mark an order as cooked/done
  completeOrder(e) {
    const orderId = e.currentTarget.dataset.id;
    const orders = db.getOrders();
    const index = orders.findIndex(o => o.id === orderId);
    
    if (index > -1) {
      orders[index].status = 'done';
      db.saveOrders(orders);
      this.loadOrders();
      wx.showToast({
        title: '订单已制作完成！',
        icon: 'success'
      });
      wx.vibrateShort();
    }
  },

  // Reorder: add order items to cart and redirect to kitchen tab
  reorder(e) {
    const orderId = e.currentTarget.dataset.id;
    const orders = this.data.orders;
    const order = orders.find(o => o.id === orderId);

    if (order) {
      // 构建新购物车对象，一次性全量写入，避免 clearCart + addToCart 的并发竞态
      const recipes = db.getRecipes();
      const newCart = {};

      order.items.forEach(item => {
        const recipe = recipes.find(r => r.id === item.recipeId);
        if (recipe && recipe.status === 1) {
          if (newCart[recipe.id]) {
            newCart[recipe.id].quantity += item.quantity;
          } else {
            newCart[recipe.id] = { recipe, quantity: item.quantity };
          }
        }
      });

      db.saveCart(newCart);

      wx.showToast({
        title: '已添加至购物车',
        icon: 'success',
        duration: 1000
      });

      setTimeout(() => {
        wx.switchTab({
          url: '/pages/kitchen/index'
        });
      }, 1000);
    }
  },

  // Delete order from history
  deleteOrder(e) {
    const orderId = e.currentTarget.dataset.id;
    const self = this;

    wx.showModal({
      title: '删除订单',
      content: '确定要删除这条订单记录吗？',
      async success(res) {
        if (res.confirm) {
          await db.deleteOrder(orderId);
          self.loadOrders();
          wx.showToast({
            title: '删除成功',
            icon: 'success'
          });
        }
      }
    });
  },

  goToKitchen() {
    wx.switchTab({
      url: '/pages/kitchen/index'
    });
  },

  // --- Chef Ranking ---
  loadRanking() {
    const period = this.data.rankingPeriod;
    const ranking = db.getChefRanking(period);
    const allRatings = db.getRatings();
    const now = Date.now();
    let sinceMs = 0;
    if (period === 'month') sinceMs = now - 30 * 24 * 3600 * 1000;
    else if (period === 'year') sinceMs = now - 365 * 24 * 3600 * 1000;
    const periodRatings = sinceMs > 0
      ? allRatings.filter(r => (r.createTimeMs || 0) >= sinceMs)
      : allRatings;
    const totalRatings = periodRatings.length;
    const totalStars = periodRatings.reduce((sum, r) => sum + (r.stars || 0), 0);

    // 初始渲染时：优先使用缓存URL，cloud://则替换为空字符串
    const topRanking = ranking.slice(0, 5);
    const displayRanking = topRanking.map(c => ({
      ...c,
      chefAvatar: imageUtil.getCachedUrlOrEmpty(c.chefAvatar)
    }));

    this.setData({
      ranking: displayRanking,
      rankingTotalChefs: ranking.length,
      totalRatings: totalRatings,
      totalStars: totalStars
    });

    // 异步解析排行榜厨师头像
    if (ranking.length > 0) {
      this._resolveRankingAvatars(topRanking);
    }
  },

  async _resolveRankingAvatars(ranking) {
    try {
      const resolved = await imageUtil.resolveAvatars(ranking.slice(0, 5), 'chefAvatar');
      this.setData({ ranking: resolved });
    } catch (e) {
      console.warn('[order] 解析排行榜头像失败', e);
    }
  },

  switchRankingPeriod(e) {
    const period = e.currentTarget.dataset.period;
    if (!period || period === this.data.rankingPeriod) return;
    this.setData({ rankingPeriod: period }, () => {
      this.loadRanking();
    });
  },

  // --- Order Rating ---
  openRatingModal(e) {
    const orderId = e.currentTarget.dataset.id;
    const order = this.data.orders.find(o => o.id === orderId);
    if (!order) return;
    if (!order.chefId) {
      wx.showToast({ title: '该订单未指定厨师', icon: 'none' });
      return;
    }
    if (order.chefId === this.data.myOpenid) {
      wx.showToast({ title: '不能给自己评分', icon: 'none' });
      return;
    }
    if (order.isRatedByMe) {
      wx.showToast({ title: '该订单已评分', icon: 'none' });
      return;
    }
    this.setData({
      showRatingModal: true,
      ratingOrder: order,
      ratingStars: 0,
      isSubmittingRating: false
    });
  },

  onSelectRatingStar(e) {
    const star = parseInt(e.currentTarget.dataset.star);
    if (!star || star < 1 || star > 10) return;
    this.setData({ ratingStars: star });
  },

  cancelRating() {
    this.setData({
      showRatingModal: false,
      ratingOrder: null,
      ratingStars: 0,
      isSubmittingRating: false
    });
  },

  // 阻止评分弹窗内容区点击事件冒泡到遮罩
  preventTap() {},

  async submitRating() {
    const { ratingOrder, ratingStars, isSubmittingRating } = this.data;
    if (isSubmittingRating) return;
    if (!ratingOrder) return;
    if (!ratingStars || ratingStars < 1 || ratingStars > 10) {
      wx.showToast({ title: '请选择 1-10 星评分', icon: 'none' });
      return;
    }

    this.setData({ isSubmittingRating: true });
    wx.showLoading({ title: '提交中...', mask: true });

    try {
      await db.addRating({
        orderId: ratingOrder.id,
        chefId: ratingOrder.chefId,
        chefName: ratingOrder.chefName,
        chefAvatar: ratingOrder.chefAvatar,
        stars: ratingStars
      });

      wx.hideLoading();
      this.setData({
        showRatingModal: false,
        ratingOrder: null,
        ratingStars: 0,
        isSubmittingRating: false
      });

      // 刷新订单列表（更新可评分状态）与排行榜
      this.loadOrders();

      wx.showToast({ title: '评分成功', icon: 'success' });
      wx.vibrateShort();
    } catch (err) {
      console.error('[rating] 提交评分失败', err);
      wx.hideLoading();
      this.setData({ isSubmittingRating: false });
      wx.showToast({ title: '提交失败，请重试', icon: 'none' });
    }
  },

  // View recipe detail of the selected dish (directly open popup modal on the order page)
  viewRecipeDetail(e) {
    const recipeId = e.currentTarget.dataset.recipeId;
    if (!recipeId) return;

    const recipes = db.getRecipes();
    const recipe = recipes.find(r => r.id === recipeId);
    if (!recipe) {
      wx.showToast({
        title: '该菜谱已不存在',
        icon: 'none'
      });
      return;
    }
    if (recipe.status !== 1) {
      wx.showToast({
        title: '该菜谱已下架',
        icon: 'none'
      });
      return;
    }

    const categories = db.getCategories();
    const category = categories.find(c => c.id === recipe.categoryId);
    const categoryName = category ? category.name : '默认分类';

    this.setData({
      selectedRecipe: recipe,
      selectedRecipeCategoryName: categoryName,
      showDetailModal: true,
      activeTimerStepIndex: -1,
      timerSecondsLeft: 0,
      formattedTimeLeft: '00:00'
    });
    this.stopStepTimer();
    // 异步解析菜谱详情中的步骤图
    this._resolveOrderRecipeDetail(recipe);
  },

  async _resolveOrderRecipeDetail(recipe) {
    try {
      const resolved = await imageUtil.resolveRecipeDetail(recipe);
      if (this.data.selectedRecipe && this.data.selectedRecipe.id === resolved.id) {
        this.setData({ selectedRecipe: resolved });
      }
    } catch (e) {
      console.warn('[order] 解析菜谱详情图片失败', e);
    }
  },

  closeRecipeDetail() {
    this.setData({
      showDetailModal: false,
      selectedRecipe: null
    });
    this.stopStepTimer();
  },

  toggleStepTimer(e) {
    const index = e.currentTarget.dataset.index;
    const minutes = e.currentTarget.dataset.minutes;
    
    if (this.data.activeTimerStepIndex === index) {
      this.stopStepTimer();
      wx.showToast({
        title: '计时已取消',
        icon: 'none'
      });
      return;
    }
    
    this.stopStepTimer();
    
    const seconds = minutes * 60;
    this.setData({
      activeTimerStepIndex: index,
      timerSecondsLeft: seconds,
      formattedTimeLeft: this.formatSeconds(seconds)
    });
    
    wx.showToast({
      title: '开始计时',
      icon: 'success'
    });
    
    const self = this;
    this.stepTimerInterval = setInterval(() => {
      const left = self.data.timerSecondsLeft - 1;
      if (left <= 0) {
        self.stopStepTimer();
        
        wx.vibrateLong();
        setTimeout(() => {
          wx.vibrateLong();
        }, 500);
        
        wx.showModal({
          title: '烹饪定时提醒',
          content: `第 ${index + 1} 步：已完成计时！`,
          confirmColor: '#005BCB',
          showCancel: false
        });
      } else {
        self.setData({
          timerSecondsLeft: left,
          formattedTimeLeft: self.formatSeconds(left)
        });
      }
    }, 1000);
  },

  stopStepTimer() {
    if (this.stepTimerInterval) {
      clearInterval(this.stepTimerInterval);
      this.stepTimerInterval = null;
    }
    this.setData({
      activeTimerStepIndex: -1,
      timerSecondsLeft: 0,
      formattedTimeLeft: '00:00'
    });
  },

  formatSeconds(sec) {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }
});
