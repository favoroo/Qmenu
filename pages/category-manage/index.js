const db = require('../../utils/db.js');

Page({
  data: {
    categories: [],
    dragList: [],
    newCatName: '',
    moveId: null,
    endY: 0,
    itemHeight: 0
  },

  onShow() {
    this.loadCategories();
  },

  onReady() {
    this._queryItemHeight();
  },

  _queryItemHeight() {
    const query = wx.createSelectorQuery();
    query.select('.category-row').boundingClientRect((rect) => {
      if (rect) {
        this.setData({ itemHeight: rect.height });
        this.initDragList();
      }
    }).exec();
  },

  loadCategories() {
    const list = db.getCategories();
    this.setData({ categories: list });
    this.initDragList();
  },

  initDragList() {
    const { categories, itemHeight } = this.data;
    if (!itemHeight || !categories.length) {
      this.setData({ dragList: [] });
      return;
    }
    const dragList = categories.map((item, index) => ({
      ...item,
      y: itemHeight * index
    }));
    this.setData({ dragList });
  },

  onNameInput(e) {
    this.setData({ newCatName: e.detail.value });
  },

  // Add Category Handler
  handleAddCategory() {
    const { newCatName } = this.data;

    if (!newCatName.trim()) {
      wx.showToast({
        title: '请输入分类名称',
        icon: 'none'
      });
      return;
    }

    const list = db.getCategories();
    const maxSort = list.length > 0
      ? Math.max(...list.map(c => c.sort || 0))
      : 0;
    const sortNum = maxSort + 1;

    // Add to DB
    db.addCategory(newCatName.trim(), sortNum);

    // Reset form
    this.setData({
      newCatName: ''
    });

    this.loadCategories();

    wx.showToast({
      title: '分类添加成功',
      icon: 'success'
    });

    wx.vibrateShort();
  },

  // Delete Category Handler
  handleDeleteCategory(e) {
    const catId = e.currentTarget.dataset.id;
    const catName = e.currentTarget.dataset.name;
    const self = this;

    if (catId === 'cat_default') {
      wx.showToast({
        title: '系统默认分类无法删除',
        icon: 'none'
      });
      return;
    }

    wx.showModal({
      title: '删除分类',
      content: `确定要删除分类「${catName}」吗？属于该分类的菜品将会被归为「默认分类」。`,
      success(res) {
        if (res.confirm) {
          db.deleteCategory(catId);
          self.loadCategories();
          wx.showToast({
            title: '删除成功',
            icon: 'success'
          });
          wx.vibrateShort();
        }
      }
    });
  },

  // Drag sort handlers
  onDragChange(e) {
    const moveId = e.currentTarget.dataset.moveid;
    const y = e.detail.y;
    this.setData({
      moveId: moveId,
      endY: y
    });
  },

  onDragEnd() {
    const { dragList, moveId, endY, itemHeight } = this.data;
    if (moveId === null || !dragList.length) return;

    // Calculate drag distance — treat tiny moves as tap, not drag
    const originalY = dragList[moveId].y;
    const dragDistance = Math.abs(endY - originalY);
    if (dragDistance < 5) {
      this.setData({ moveId: null, endY: 0 });
      return;
    }

    // Deep copy and update dragged item's y
    let newList = JSON.parse(JSON.stringify(dragList));
    newList[moveId].y = endY;

    // Sort by y coordinate
    newList.sort((a, b) => a.y - b.y);

    // Reassign sort values (1, 2, 3...)
    const categories = newList.map(({ y, ...rest }, index) => ({
      ...rest,
      sort: index + 1
    }));

    // Save to DB
    db.saveCategories(categories);

    // Reload
    this.setData({ moveId: null, endY: 0 });
    this.loadCategories();
  }
});
