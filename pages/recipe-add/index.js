const db = require('../../utils/db.js');
const imageUtil = require('../../utils/image.js');

Page({
  data: {
    recipeId: '', // If empty, we are adding. If not empty, we are editing.
    name: '',
    price: '',
    desc: '',
    categories: [],
    categoryIndex: 0,
    categoryName: '请选择分类',
    imagePath: '',
    
    // 用料做法相关
    hasMaterialStep: false,
    materialsPublic: true,
    materials: [{ name: '', weight: '' }],
    stepsPublic: true,
    steps: [{ image: '', desc: '', timer: 0 }],

    // Status checking
    isSubmitting: false
  },

  onLoad(options) {
    this.loadCategories(() => {
      if (options.id) {
        wx.setNavigationBarTitle({
          title: '编辑菜谱'
        });
        this.setData({
          recipeId: options.id
        });
        this.loadRecipeDetails(options.id);
      } else if (options.categoryId) {
        const categoryIndex = this.data.categories.findIndex(c => c.id === options.categoryId);
        if (categoryIndex > -1) {
          this.setData({
            categoryIndex: categoryIndex
          }, () => {
            this.updateCategoryName();
          });
        }
      }
    });
  },

  onShow() {
    // If not editing, load categories normally
    if (!this.data.recipeId) {
      this.loadCategories();
    }
  },

  async loadCategories(callback) {
    const app = getApp();
    if (app.globalData.loginPromise) {
      await app.globalData.loginPromise;
    }
    const categories = db.getCategories();
    this.setData({
      categories: categories
    }, () => {
      this.updateCategoryName();
      if (typeof callback === 'function') callback();
    });
  },

  updateCategoryName() {
    const { categories, categoryIndex } = this.data;
    let categoryName = '请选择分类';
    if (categories && categories.length > 0 && categories[categoryIndex]) {
      categoryName = categories[categoryIndex].name;
    }
    this.setData({ categoryName });
  },

  loadRecipeDetails(id) {
    const recipes = db.getRecipes();
    const recipe = recipes.find(r => r.id === id);
    if (recipe) {
      // Find matching category index
      const categories = this.data.categories;
      const categoryIndex = categories.findIndex(c => c.id === recipe.categoryId);
      
      this.setData({
        name: recipe.name,
        price: recipe.price.toString(),
        desc: recipe.desc || '',
        imagePath: recipe.image || '',
        categoryIndex: categoryIndex > -1 ? categoryIndex : 0,
        hasMaterialStep: recipe.hasMaterialStep || false,
        materialsPublic: recipe.materialsPublic !== false,
        materials: recipe.materials && recipe.materials.length > 0 ? recipe.materials : [{ name: '', weight: '' }],
        stepsPublic: recipe.stepsPublic !== false,
        steps: recipe.steps && recipe.steps.length > 0 ? recipe.steps : [{ image: '', desc: '', timer: 0 }]
      }, () => {
        this.updateCategoryName();
      });
    }
  },

  // Input bindings
  onNameInput(e) {
    this.setData({ name: e.detail.value });
  },

  onPriceInput(e) {
    this.setData({ price: e.detail.value });
  },

  onDescInput(e) {
    this.setData({ desc: e.detail.value });
  },

  onCategoryChange(e) {
    this.setData({
      categoryIndex: parseInt(e.detail.value)
    }, () => {
      this.updateCategoryName();
    });
  },

  // 用料做法开关切换
  onHasMaterialStepChange(e) {
    this.setData({
      hasMaterialStep: e.detail.value
    });
  },

  onMaterialsPublicChange(e) {
    this.setData({
      materialsPublic: e.detail.value
    });
  },

  onStepsPublicChange(e) {
    this.setData({
      stepsPublic: e.detail.value
    });
  },

  // 用料列表动态修改
  onMaterialNameInput(e) {
    const index = e.currentTarget.dataset.index;
    const materials = this.data.materials;
    materials[index].name = e.detail.value;
    this.setData({ materials });
  },

  onMaterialWeightInput(e) {
    const index = e.currentTarget.dataset.index;
    const materials = this.data.materials;
    materials[index].weight = e.detail.value;
    this.setData({ materials });
  },

  deleteMaterialRow(e) {
    const index = e.currentTarget.dataset.index;
    const materials = this.data.materials;
    if (materials.length > 1) {
      materials.splice(index, 1);
      this.setData({ materials });
    }
  },

  addMaterialRow() {
    const materials = this.data.materials;
    materials.push({ name: '', weight: '' });
    this.setData({ materials });
  },

  sortMaterials() {
    const self = this;
    wx.showActionSheet({
      itemList: ['按食材名称排序', '颠倒当前顺序', '清空所有用料'],
      success(res) {
        let materials = [...self.data.materials];
        if (res.tapIndex === 0) {
          materials.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'));
        } else if (res.tapIndex === 1) {
          materials.reverse();
        } else if (res.tapIndex === 2) {
          materials = [{ name: '', weight: '' }];
        }
        self.setData({ materials });
      }
    });
  },

  // 做法步骤动态修改
  onStepDescInput(e) {
    const index = e.currentTarget.dataset.index;
    const steps = this.data.steps;
    steps[index].desc = e.detail.value;
    this.setData({ steps });
  },

  deleteStepRow(e) {
    const index = e.currentTarget.dataset.index;
    const steps = this.data.steps;
    if (steps.length > 1) {
      steps.splice(index, 1);
      this.setData({ steps });
    }
  },

  addStepRow() {
    const steps = this.data.steps;
    steps.push({ image: '', desc: '', timer: 0 });
    this.setData({ steps });
  },

  // Helper to crop image using the custom cropper page
  cropImageHelper(src, successCallback) {
    wx.navigateTo({
      url: `/pages/crop-image/index?src=${encodeURIComponent(src)}`,
      events: {
        cropSuccess: (data) => {
          successCallback(data.tempFilePath);
        }
      },
      fail: (err) => {
        console.error('打开裁剪页面失败', err);
        wx.showToast({ title: '无法打开裁剪界面', icon: 'none' });
        // Fallback to original image
        successCallback(src);
      }
    });
  },

  // Image Upload/Crop Handler for Step Image
  chooseStepImage(e) {
    const index = e.currentTarget.dataset.index;
    const self = this;
    const steps = this.data.steps;
    const currentStepImage = steps[index].image;

    if (currentStepImage) {
      wx.showActionSheet({
        itemList: ['重新上传并裁剪', '裁剪当前图片', '删除步骤图'],
        success(res) {
          if (res.tapIndex === 0) {
            self.selectAndCropStep(index);
          } else if (res.tapIndex === 1) {
            self.cropImageHelper(currentStepImage, (croppedPath) => {
              const updatedSteps = self.data.steps;
              updatedSteps[index].image = croppedPath;
              self.setData({ steps: updatedSteps });
              wx.showToast({ title: '图片已裁剪', icon: 'success' });
            });
          } else if (res.tapIndex === 2) {
            const updatedSteps = self.data.steps;
            updatedSteps[index].image = '';
            self.setData({ steps: updatedSteps });
            wx.showToast({ title: '图片已删除', icon: 'success' });
          }
        }
      });
    } else {
      this.selectAndCropStep(index);
    }
  },

  selectAndCropStep(index) {
    const self = this;
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success(res) {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        self.cropImageHelper(tempFilePath, (croppedPath) => {
          const updatedSteps = self.data.steps;
          updatedSteps[index].image = croppedPath;
          self.setData({ steps: updatedSteps });
          wx.showToast({ title: '图片已选择并裁剪', icon: 'success' });
        });
      }
    });
  },

  setStepTimer(e) {
    const index = e.currentTarget.dataset.index;
    const steps = this.data.steps;
    const currentTimer = steps[index].timer || '';
    const self = this;
    wx.showModal({
      title: '设置烹饪定时',
      content: '',
      editable: true,
      placeholderText: '请输入分钟数 (如: 10)',
      value: currentTimer ? currentTimer.toString() : '',
      success(res) {
        if (res.confirm) {
          const val = parseInt(res.content);
          if (isNaN(val) || val <= 0) {
            steps[index].timer = 0;
          } else {
            steps[index].timer = val;
          }
          self.setData({ steps });
        }
      }
    });
  },

  // Image Upload handler for cover
  chooseImage() {
    const self = this;
    const { imagePath } = this.data;
    
    if (imagePath) {
      wx.showActionSheet({
        itemList: ['重新上传并裁剪', '裁剪当前图片', '删除图片'],
        success(res) {
          if (res.tapIndex === 0) {
            self.selectAndCropCover();
          } else if (res.tapIndex === 1) {
            self.cropImageHelper(imagePath, (croppedPath) => {
              self.setData({ imagePath: croppedPath });
              wx.showToast({ title: '图片已裁剪', icon: 'success' });
            });
          } else if (res.tapIndex === 2) {
            self.setData({ imagePath: '' });
            wx.showToast({ title: '图片已删除', icon: 'success' });
          }
        }
      });
    } else {
      this.selectAndCropCover();
    }
  },

  selectAndCropCover() {
    const self = this;
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success(res) {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        self.cropImageHelper(tempFilePath, (croppedPath) => {
          self.setData({ imagePath: croppedPath });
          wx.showToast({ title: '图片已选择并裁剪', icon: 'success' });
        });
      }
    });
  },

  // Form submission (Save / Update)
  async submitForm() {
    const { 
      recipeId, name, price, desc, categories, categoryIndex, imagePath, isSubmitting,
      hasMaterialStep, materialsPublic, materials, stepsPublic, steps
    } = this.data;
    
    if (isSubmitting) return;

    // Validation
    if (!name.trim()) {
      wx.showToast({
        title: '请输入菜品名称',
        icon: 'none'
      });
      return;
    }

    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum <= 0) {
      wx.showToast({
        title: '请输入有效价格',
        icon: 'none'
      });
      return;
    }

    if (categories.length === 0) {
      wx.showToast({
        title: '请先添加分类',
        icon: 'none'
      });
      return;
    }

    this.setData({ isSubmitting: true });

    try {
      const selectedCategory = categories[categoryIndex];

      // 封面图：仅 tempPath 才持久化（编辑未换图则保持已存路径）
      let finalImage = imagePath || '/assets/images/default_food.png';
      if (imageUtil.isTempPath(imagePath)) {
        finalImage = await imageUtil.storeImage(imagePath);
      }

      // Filter empty items
      const finalMaterials = hasMaterialStep ? materials.filter(m => m.name.trim() || m.weight.trim()) : [];
      const finalSteps = hasMaterialStep ? steps.filter(s => s.desc.trim() || s.image) : [];

      // 步骤图：逐个持久化 tempPath（先过滤空行，避免处理将被丢弃的图）
      for (let i = 0; i < finalSteps.length; i++) {
        if (imageUtil.isTempPath(finalSteps[i].image)) {
          finalSteps[i] = { ...finalSteps[i], image: await imageUtil.storeImage(finalSteps[i].image) };
        }
      }

      const recipeData = {
        name: name.trim(),
        price: priceNum,
        desc: desc.trim(),
        categoryId: selectedCategory.id,
        image: finalImage,
        hasMaterialStep,
        materialsPublic,
        materials: finalMaterials,
        stepsPublic,
        steps: finalSteps
      };

      if (recipeId) {
        // EDIT MODE: 记录旧图，更新后清理被替换的旧图（防孤儿堆积）
        const oldRecipe = db.getRecipes().find(r => r.id === recipeId) || null;
        recipeData.id = recipeId;
        db.updateRecipe(recipeData);
        if (oldRecipe) {
          const oldImgs = imageUtil.collectRecipeImages(oldRecipe);
          const newImgs = imageUtil.collectRecipeImages(recipeData);
          oldImgs.filter(p => newImgs.indexOf(p) === -1).forEach(imageUtil.removeImageSync);
        }

        wx.showToast({
          title: '保存修改成功！',
          icon: 'success',
          duration: 1500
        });
      } else {
        // ADD MODE: Create new recipe
        db.addRecipe(recipeData);

        wx.showToast({
          title: '发布菜谱成功！',
          icon: 'success',
          duration: 1500
        });
      }

      // Go back after success
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    } catch (err) {
      console.error('图片处理失败', err);
      wx.showToast({
        title: err && err.message ? err.message : '图片处理失败，请重试',
        icon: 'none'
      });
      // 异常时复位按钮，允许重试（成功路径靠 navigateBack 离开，保持禁用防重复提交）
      this.setData({ isSubmitting: false });
    }
  },

  // Delete handler (only available in edit mode)
  handleDeleteRecipe() {
    const id = this.data.recipeId;
    const self = this;
    
    wx.showModal({
      title: '删除菜品',
      content: `确定要永久删除菜品「${this.data.name}」吗？这也会将其从购物车中移除。`,
      confirmColor: '#ff4d4f',
      success(res) {
        if (res.confirm) {
          db.deleteRecipe(id);
          wx.showToast({
            title: '删除成功',
            icon: 'success',
            duration: 1500
          });
          
          setTimeout(() => {
            wx.navigateBack();
          }, 1500);
        }
      }
    });
  }
});
