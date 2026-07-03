const db = require('../../utils/db.js');

Page({
  data: {
    categories: [],
    newCatName: '',
    newCatSort: '10'
  },

  onShow() {
    this.loadCategories();
  },

  loadCategories() {
    const list = db.getCategories();
    this.setData({
      categories: list
    });
  },

  onNameInput(e) {
    this.setData({ newCatName: e.detail.value });
  },

  onSortInput(e) {
    this.setData({ newCatSort: e.detail.value });
  },

  // Add Category Handler
  handleAddCategory() {
    const { newCatName, newCatSort } = this.data;
    
    if (!newCatName.trim()) {
      wx.showToast({
        title: '请输入分类名称',
        icon: 'none'
      });
      return;
    }

    const sortNum = parseInt(newCatSort) || 10;
    
    // Add to DB
    db.addCategory(newCatName.trim(), sortNum);
    
    // Reset form
    this.setData({
      newCatName: '',
      newCatSort: '10'
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

  // Swap position up
  moveUp(e) {
    const index = e.currentTarget.dataset.index;
    if (index === 0) return; // Already top
    
    const list = [...this.data.categories];
    // Swap sort values
    const tempSort = list[index].sort;
    list[index].sort = list[index - 1].sort;
    list[index - 1].sort = tempSort;
    
    // If they had identical sort values, subtract/add to ensure ordering change
    if (list[index].sort === list[index - 1].sort) {
      list[index - 1].sort = Math.max(1, list[index].sort - 1);
    }
    
    db.saveCategories(list);
    this.loadCategories();
    wx.vibrateShort({ type: 'light' });
  },

  // Swap position down
  moveDown(e) {
    const index = e.currentTarget.dataset.index;
    if (index === this.data.categories.length - 1) return; // Already bottom
    
    const list = [...this.data.categories];
    // Swap sort values
    const tempSort = list[index].sort;
    list[index].sort = list[index + 1].sort;
    list[index + 1].sort = tempSort;
    
    // If identical sorts, adjust
    if (list[index].sort === list[index + 1].sort) {
      list[index + 1].sort = list[index].sort + 1;
    }
    
    db.saveCategories(list);
    this.loadCategories();
    wx.vibrateShort({ type: 'light' });
  }
});
