const db = require('../../utils/db.js');

Page({
  data: {
    // ===== Category list =====
    categories: [],
    newCatName: '',

    // ===== Category drag state =====
    draggingCategory: null,
    draggingCategoryId: '',
    dragHighlightCatId: '',

    // ===== Dish management mode =====
    categoryCards: [],

    // ===== Recipe drag state =====
    draggingRecipe: null,
    draggingFromCategoryId: '',
    draggingFromIndex: -1,
    dragFloatX: 0,
    dragFloatY: 0,
    dragHighlightId: '',
    dropInsertIndex: -1,
    dropIndicatorY: 0,
    categoryRects: [],
    dishRowRects: []
  },

  onShow() {
    this.loadData();
  },

  onReady() {
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

  // ===== Category Drag Sort =====
  onCategoryLongPress(e) {
    const category = e.currentTarget.dataset.category;
    if (!category) return;
    const touch = e.touches[0];
    if (!touch) return;

    wx.vibrateShort({ type: 'medium' });

    this.setData({
      draggingCategory: category,
      draggingCategoryId: category.id,
      dragFloatX: touch.clientX,
      dragFloatY: touch.clientY,
      dragHighlightCatId: ''
    });

    this._queryCategoryRectsOnly();
  },

  _queryCategoryRectsOnly() {
    const query = wx.createSelectorQuery().in(this);
    query.selectAll('.dish-category-card').boundingClientRect((rects) => {
      if (!rects) return;
      const { categoryCards } = this.data;
      const categoryRects = rects.map((rect, index) => {
        const card = categoryCards[index];
        return {
          id: card ? card.id : '',
          top: rect.top,
          bottom: rect.bottom
        };
      });
      this.setData({ categoryRects });
    }).exec();
  },

  onCategoryTouchMove(e) {
    if (!this.data.draggingCategory) return;
    const touch = e.touches[0];
    if (!touch) return;

    const dragFloatX = touch.clientX;
    const dragFloatY = touch.clientY;
    const { categoryRects, dragHighlightCatId } = this.data;

    let targetCatId = '';
    for (let i = 0; i < categoryRects.length; i++) {
      const cr = categoryRects[i];
      if (touch.clientY >= cr.top && touch.clientY <= cr.bottom) {
        targetCatId = cr.id;
        break;
      }
    }

    const patch = { dragFloatX, dragFloatY };
    if (targetCatId !== dragHighlightCatId) {
      patch.dragHighlightCatId = targetCatId;
    }
    this.setData(patch);
  },

  onCategoryTouchEnd() {
    const { draggingCategory, draggingCategoryId, dragHighlightCatId, categories } = this.data;
    if (!draggingCategory) return;

    this.setData({
      draggingCategory: null,
      draggingCategoryId: '',
      dragHighlightCatId: '',
      dragFloatX: 0,
      dragFloatY: 0,
      categoryRects: []
    });

    if (!dragHighlightCatId || dragHighlightCatId === draggingCategoryId) return;

    const dragIndex = categories.findIndex(c => c.id === draggingCategoryId);
    const targetIndex = categories.findIndex(c => c.id === dragHighlightCatId);

    if (dragIndex > -1 && targetIndex > -1) {
      const newList = [...categories];
      const [removed] = newList.splice(dragIndex, 1);
      newList.splice(targetIndex, 0, removed);

      // Re-assign sort values sequentially
      newList.forEach((cat, idx) => {
        cat.sort = idx + 1;
      });

      db.saveCategories(newList);
      this.loadData();

      wx.showToast({
        title: '已调整分类顺序',
        icon: 'success'
      });
      wx.vibrateShort({ type: 'light' });
    }
  },

  // ===== Recipe drag-to-move =====
  onRecipeLongPress(e) {
    const recipe = e.currentTarget.dataset.recipe;
    const catid = e.currentTarget.dataset.catid;
    const touch = e.touches[0];
    if (!touch || !recipe) return;

    // Record original index in source category
    const fromCard = this.data.categoryCards.find(c => c.id === catid);
    const fromIndex = fromCard ? fromCard.recipes.findIndex(r => r.id === recipe.id) : -1;

    wx.vibrateShort({ type: 'medium' });

    this.setData({
      draggingRecipe: recipe,
      draggingFromCategoryId: catid,
      draggingFromIndex: fromIndex,
      dragFloatX: touch.clientX,
      dragFloatY: touch.clientY,
      dragHighlightId: '',
      dropInsertIndex: -1,
      dropIndicatorY: 0
    });

    this._queryDragRects();
  },

  _queryDragRects() {
    const query = wx.createSelectorQuery().in(this);
    query.selectAll('.dish-category-card').boundingClientRect();
    query.selectAll('.dish-cat-header').boundingClientRect();
    query.selectAll('.dish-row').boundingClientRect();
    query.exec((res) => {
      if (!res) return;
      const cardRects = res[0] || [];
      const headerRects = res[1] || [];
      const rowRects = res[2] || [];
      const { categoryCards } = this.data;

      // Category cards: include contentTop (where recipe list starts)
      const categoryRects = cardRects.map((rect, index) => {
        const card = categoryCards[index];
        const header = headerRects[index];
        return {
          id: card ? card.id : '',
          top: rect.top,
          bottom: rect.bottom,
          contentTop: header ? header.bottom : rect.top
        };
      });

      // Recipe rows: map by DOM order (matches categoryCards flatten order)
      const dishRowRects = [];
      let flatIndex = 0;
      categoryCards.forEach(card => {
        card.recipes.forEach(recipe => {
          const rect = rowRects[flatIndex];
          if (rect) {
            dishRowRects.push({
              recipeId: recipe.id,
              categoryId: card.id,
              top: rect.top,
              bottom: rect.bottom,
              midY: rect.top + rect.height / 2
            });
          }
          flatIndex++;
        });
      });

      this.setData({ categoryRects, dishRowRects });
    });
  },

  onRecipeTouchMove(e) {
    if (!this.data.draggingRecipe) return;
    const touch = e.touches[0];
    if (!touch) return;

    const dragFloatX = touch.clientX;
    const dragFloatY = touch.clientY;
    const { categoryRects, dishRowRects, dragHighlightId, dropInsertIndex, dropIndicatorY } = this.data;

    // ---- Level 1: hit target category ----
    let targetCatId = '';
    for (let i = 0; i < categoryRects.length; i++) {
      const cr = categoryRects[i];
      if (touch.clientY >= cr.top && touch.clientY <= cr.bottom) {
        targetCatId = cr.id;
        break;
      }
    }

    // ---- Level 2: calculate insertion index + indicator Y within target category ----
    let insertIndex = -1;
    let indicatorY = 0;
    if (targetCatId) {
      const targetRows = dishRowRects.filter(r => r.categoryId === targetCatId);
      const cr = categoryRects.find(c => c.id === targetCatId);

      if (targetRows.length === 0) {
        // Empty category: single insert position 0
        insertIndex = 0;
        indicatorY = cr ? cr.contentTop : 0;
      } else {
        let found = false;
        for (let i = 0; i < targetRows.length; i++) {
          if (touch.clientY < targetRows[i].midY) {
            insertIndex = i;
            indicatorY = targetRows[i].top;
            found = true;
            break;
          }
        }
        if (!found) {
          insertIndex = targetRows.length;
          indicatorY = targetRows[targetRows.length - 1].bottom;
        }
      }
    }

    // Only update indicator fields when drop position changed
    const patch = { dragFloatX, dragFloatY };
    if (
      targetCatId !== dragHighlightId ||
      insertIndex !== dropInsertIndex ||
      indicatorY !== dropIndicatorY
    ) {
      patch.dragHighlightId = targetCatId;
      patch.dropInsertIndex = insertIndex;
      patch.dropIndicatorY = indicatorY;
    }
    this.setData(patch);
  },

  onRecipeTouchEnd() {
    const {
      draggingRecipe,
      draggingFromCategoryId,
      dragHighlightId,
      dropInsertIndex,
      categoryCards
    } = this.data;
    if (!draggingRecipe) return;

    // 1. Reset drag state
    this.setData({
      draggingRecipe: null,
      draggingFromCategoryId: '',
      draggingFromIndex: -1,
      dragHighlightId: '',
      dropInsertIndex: -1,
      dropIndicatorY: 0,
      dragFloatX: 0,
      dragFloatY: 0,
      categoryRects: [],
      dishRowRects: []
    });

    // 2. Invalid drop (empty area)
    if (!dragHighlightId || dropInsertIndex < 0) return;

    // 3. Deep copy cards and perform array manipulation
    const newCards = JSON.parse(JSON.stringify(categoryCards));
    const fromCard = newCards.find(c => c.id === draggingFromCategoryId);
    const toCard = newCards.find(c => c.id === dragHighlightId);
    if (!fromCard || !toCard) return;

    const fromIndex = fromCard.recipes.findIndex(r => r.id === draggingRecipe.id);
    if (fromIndex < 0) return;
    const [moved] = fromCard.recipes.splice(fromIndex, 1);

    // 4. Fix actual insert index: same-category removal shifts subsequent indices
    let actualInsertIndex = dropInsertIndex;
    if (draggingFromCategoryId === dragHighlightId && fromIndex < dropInsertIndex) {
      actualInsertIndex = dropInsertIndex - 1;
    }
    if (actualInsertIndex < 0) actualInsertIndex = 0;
    if (actualInsertIndex > toCard.recipes.length) actualInsertIndex = toCard.recipes.length;

    // 5. Same category, same position → no change
    if (draggingFromCategoryId === dragHighlightId && actualInsertIndex === fromIndex) return;

    toCard.recipes.splice(actualInsertIndex, 0, moved);

    // 6. Map back to full recipes array (preserve all fields), save with saveRecipes
    const allRecipes = db.getRecipes();
    const recipeMap = {};
    allRecipes.forEach(r => { recipeMap[r.id] = r; });

    const newRecipes = [];
    newCards.forEach(card => {
      card.recipes.forEach(r => {
        const full = recipeMap[r.id];
        if (full) {
          newRecipes.push({ ...full, categoryId: card.id });
        }
      });
    });
    // Fallback: include any recipes not found in cards
    allRecipes.forEach(r => {
      if (!newRecipes.find(nr => nr.id === r.id)) newRecipes.push(r);
    });

    db.saveRecipes(newRecipes);
    this.loadData();

    // 7. Feedback
    const isSameCat = draggingFromCategoryId === dragHighlightId;
    const targetCat = this.data.categories.find(c => c.id === dragHighlightId);
    wx.showToast({
      title: isSameCat ? '已调整顺序' : `已移至「${targetCat ? targetCat.name : '目标分类'}」`,
      icon: 'success'
    });
    wx.vibrateShort({ type: 'light' });
  }
});
