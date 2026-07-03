const db = require('../../utils/db.js');

Page({
  data: {
    // ===== Category sort mode (existing) =====
    categories: [],
    dragList: [],
    newCatName: '',
    moveId: null,
    endY: 0,
    itemHeight: 0,

    // ===== Mode toggle =====
    mode: 'dish', // 'dish' | 'sort'

    // ===== Dish management mode =====
    categoryCards: [],

    // ===== Recipe drag state =====
    draggingRecipe: null,
    draggingFromCategoryId: '',
    dragFloatX: 0,
    dragFloatY: 0,
    dragHighlightId: '',
    categoryRects: []
  },

  onShow() {
    this.loadData();
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

  // Unified data loading: categories + recipes grouped into categoryCards
  loadData() {
    const categories = db.getCategories();
    const recipes = db.getRecipes();

    const categoryCards = categories.map(cat => ({
      ...cat,
      isDefault: cat.id === 'cat_default',
      recipes: recipes
        .filter(r => r.categoryId === cat.id)
        .map(r => ({
          id: r.id,
          name: r.name,
          price: r.price,
          image: r.image,
          status: r.status
        }))
    }));

    this.setData({ categories, categoryCards });
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

  // ===== Mode switch =====
  switchMode(e) {
    const mode = e.currentTarget.dataset.mode;
    if (mode === this.data.mode) return;
    this.setData({ mode });
    if (mode === 'sort' && !this.data.itemHeight) {
      this._queryItemHeight();
    }
    wx.vibrateShort({ type: 'light' });
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

    db.addCategory(newCatName.trim(), sortNum);

    this.setData({ newCatName: '' });
    this.loadData();

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
          self.loadData();
          wx.showToast({
            title: '删除成功',
            icon: 'success'
          });
          wx.vibrateShort();
        }
      }
    });
  },

  // ===== Delete Recipe =====
  handleDeleteRecipe(e) {
    const id = e.currentTarget.dataset.id;
    const name = e.currentTarget.dataset.name;
    const self = this;

    wx.showModal({
      title: '删除菜品',
      content: `确定要删除菜品「${name}」吗？此操作不可恢复。`,
      confirmColor: '#E07A5F',
      success(res) {
        if (res.confirm) {
          db.deleteRecipe(id);
          self.loadData();
          wx.showToast({ title: '已删除', icon: 'success' });
          wx.vibrateShort();
        }
      }
    });
  },

  // ===== Recipe drag-to-move =====
  onRecipeLongPress(e) {
    const recipe = e.currentTarget.dataset.recipe;
    const catid = e.currentTarget.dataset.catid;
    const touch = e.touches[0];
    if (!touch || !recipe) return;

    wx.vibrateShort({ type: 'medium' });

    this.setData({
      draggingRecipe: recipe,
      draggingFromCategoryId: catid,
      dragFloatX: touch.clientX,
      dragFloatY: touch.clientY,
      dragHighlightId: ''
    });

    this._queryCategoryRects();
  },

  _queryCategoryRects() {
    const query = wx.createSelectorQuery().in(this);
    query.selectAll('.dish-category-card').boundingClientRect((rects) => {
      if (!rects) return;
      const categoryRects = rects.map((rect, index) => {
        const card = this.data.categoryCards[index];
        return {
          id: card ? card.id : '',
          top: rect.top,
          bottom: rect.bottom
        };
      });
      this.setData({ categoryRects });
    }).exec();
  },

  onRecipeTouchMove(e) {
    if (!this.data.draggingRecipe) return;
    const touch = e.touches[0];
    if (!touch) return;

    const dragFloatX = touch.clientX;
    const dragFloatY = touch.clientY;

    const { categoryRects } = this.data;
    let hitId = '';
    for (let i = 0; i < categoryRects.length; i++) {
      const r = categoryRects[i];
      if (touch.clientY >= r.top && touch.clientY <= r.bottom) {
        hitId = r.id;
        break;
      }
    }

    if (hitId !== this.data.dragHighlightId) {
      this.setData({ dragFloatX, dragFloatY, dragHighlightId: hitId });
    } else {
      this.setData({ dragFloatX, dragFloatY });
    }
  },

  onRecipeTouchEnd() {
    const { draggingRecipe, draggingFromCategoryId, dragHighlightId } = this.data;
    if (!draggingRecipe) return;

    this.setData({
      draggingRecipe: null,
      draggingFromCategoryId: '',
      dragHighlightId: '',
      categoryRects: [],
      dragFloatX: 0,
      dragFloatY: 0
    });

    if (!dragHighlightId) return;
    if (dragHighlightId === draggingFromCategoryId) return;

    db.updateRecipe({ id: draggingRecipe.id, categoryId: dragHighlightId });
    this.loadData();

    const targetCat = this.data.categories.find(c => c.id === dragHighlightId);
    wx.showToast({
      title: `已移至「${targetCat ? targetCat.name : '目标分类'}」`,
      icon: 'success'
    });
    wx.vibrateShort({ type: 'light' });
  },

  // ===== Category drag sort (existing, preserved) =====
  onDragChange(e) {
    const moveId = e.currentTarget.dataset.moveid;
    const y = e.detail.y;
    this.setData({
      moveId: moveId,
      endY: y
    });
  },

  onDragEnd() {
    const { dragList, moveId, endY } = this.data;
    if (moveId === null || !dragList.length) return;

    const originalY = dragList[moveId].y;
    const dragDistance = Math.abs(endY - originalY);
    if (dragDistance < 5) {
      this.setData({ moveId: null, endY: 0 });
      return;
    }

    let newList = JSON.parse(JSON.stringify(dragList));
    newList[moveId].y = endY;
    newList.sort((a, b) => a.y - b.y);

    const categories = newList.map(({ y, ...rest }, index) => ({
      ...rest,
      sort: index + 1
    }));

    db.saveCategories(categories);

    this.setData({ moveId: null, endY: 0 });
    this.loadData();
  }
});
