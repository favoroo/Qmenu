const imageUtil = require('./image.js');

// ===== 同步存储适配层 =====
// 当前：基于 wx 本地缓存（同步）。
// 迁移指引（接入服务器）：将下方 get/set/remove/clear 替换为 wx.request 调用后端 REST API。
//   注意 wx.request 为异步，届时需把 db 各方法改为 async/await，调用方相应 await。
const storage = {
  get(key) { return wx.getStorageSync(key); },
  set(key, value) { wx.setStorageSync(key, value); return value; },
  remove(key) { wx.removeStorageSync(key); },
  clear() { wx.clearStorageSync(); }
};

const STORAGE_KEYS = {
  CATEGORIES: 'DB_CATEGORIES',
  RECIPES: 'DB_RECIPES',
  CART: 'DB_CART',
  ORDERS: 'DB_ORDERS'
};

// Seed default data
const DEFAULT_CATEGORIES = [
  { id: 'cat_default', name: '默认分类', sort: 1 },
  { id: 'cat_signature', name: '招牌私房菜', sort: 2 },
  { id: 'cat_soup', name: '滋补汤羹', sort: 3 }
];

const DEFAULT_RECIPES = [
  {
    id: 'rec_001',
    name: '椒麻鸡',
    categoryId: 'cat_signature',
    price: 48,
    image: '/assets/images/default_food.png',
    desc: '地道椒麻鸡，皮脆肉嫩，麻辣爽口，香气扑鼻！',
    status: 1,
    hasMaterialStep: true,
    materialsPublic: true,
    materials: [
      { name: '鸡肉', weight: '1只' },
      { name: '鲜花椒', weight: '50g' },
      { name: '小米辣', weight: '30g' },
      { name: '大葱', weight: '2根' },
      { name: '生姜', weight: '1块' },
      { name: '大蒜', weight: '5瓣' },
      { name: '生抽', weight: '3勺' },
      { name: '花椒油', weight: '2勺' }
    ],
    stepsPublic: true,
    steps: [
      { image: '', desc: '整鸡洗净，冷水下锅，加入大葱段、姜片、料酒，大火烧开转中火煮20分钟至刚熟。', timer: 20 },
      { image: '', desc: '捞出鸡肉，立刻放入冰水中浸泡10分钟，使鸡皮脆嫩爽口，随后沥干水分，用手撕成大小均匀的小块。', timer: 10 },
      { image: '', desc: '将鲜花椒、小米辣、大蒜剁碎放入碗中。锅中烧热花椒油，趁热淋在碎料上激发出香味，再加入生抽、少许盐、糖、鸡精和两勺煮鸡的原汤拌匀。', timer: 3 },
      { image: '', desc: '将调好的椒麻汁均匀淋在撕好的鸡肉块上，撒上葱花，拌匀后静置入味即可食用。', timer: 5 }
    ]
  },
  {
    id: 'rec_002',
    name: '招牌红烧肉',
    categoryId: 'cat_signature',
    price: 58,
    image: '/assets/images/default_food.png',
    desc: '肥而不腻，入口即化，经典的家常美味。',
    status: 1,
    hasMaterialStep: true,
    materialsPublic: true,
    materials: [
      { name: '优质五花肉', weight: '500g' },
      { name: '冰糖', weight: '30g' },
      { name: '八角', weight: '2个' },
      { name: '桂皮', weight: '1小块' },
      { name: '香叶', weight: '2片' },
      { name: '生姜', weight: '1块' },
      { name: '料酒', weight: '2勺' },
      { name: '老抽', weight: '1勺' },
      { name: '生抽', weight: '2勺' }
    ],
    stepsPublic: true,
    steps: [
      { image: '', desc: '五花肉切成2厘米见方的方块，冷水下锅焯水，加入姜片和料酒，烧开后撇去浮沫，捞出用温水洗净控干。', timer: 5 },
      { image: '', desc: '锅中不放油，倒入五花肉块，中小火煸炒至微黄出油，盛出肉块，锅内留底油。', timer: 8 },
      { image: '', desc: '在留有底油的锅中放入冰糖，小火慢慢融化并炒至红褐色且起小泡（糖色），立即倒入肉块快速翻炒上色。', timer: 3 },
      { image: '', desc: '加入八角、桂皮、香叶、姜片，翻炒出香味，再淋入老抽、生抽翻炒均匀，注入没过肉块的开水。', timer: 2 },
      { image: '', desc: '大火烧开后转小火，盖上锅盖慢炖45分钟至肉质酥烂。', timer: 45 },
      { image: '', desc: '最后揭开锅盖，转大火收汁，待汤汁浓稠红亮、均匀裹在肉块上即可出锅。', timer: 5 }
    ]
  },
  {
    id: 'rec_003',
    name: '西红柿鸡蛋汤',
    categoryId: 'cat_soup',
    price: 18,
    image: '/assets/images/default_food.png',
    desc: '清淡解腻，营养丰富，经典汤品。',
    status: 1,
    hasMaterialStep: true,
    materialsPublic: true,
    materials: [
      { name: '熟透西红柿', weight: '2个' },
      { name: '鸡蛋', weight: '2个' },
      { name: '小葱', weight: '2根' },
      { name: '水淀粉', weight: '2勺' },
      { name: '盐', weight: '1茶匙' },
      { name: '香油', weight: '数滴' }
    ],
    stepsPublic: true,
    steps: [
      { image: '', desc: '西红柿顶部划十字，开水烫一下剥皮，切成小丁。鸡蛋打入碗中彻底搅散。小葱切葱花。', timer: 3 },
      { image: '', desc: '锅中放少许油，烧热后放入半锅葱花爆香，倒入西红柿丁小火翻炒，加入半茶匙盐，炒至西红柿完全出沙变软呈糊状。', timer: 4 },
      { image: '', desc: '往锅内倒入两碗开水，大火烧开煮2分钟，淋入水淀粉勾薄芡，使汤汁稍微浓稠。', timer: 2 },
      { image: '', desc: '转小火，将搅散的蛋液徐徐淋入汤中（可以用筷子顺着锅圈搅动一下），形成漂亮的蛋花，关火。', timer: 1 },
      { image: '', desc: '加入剩下的盐调味，淋入香油，撒上葱花即可出锅。', timer: 1 }
    ]
  }
];

const db = {
  // Initialize Database with seed data if empty
  init() {
    let categories = storage.get(STORAGE_KEYS.CATEGORIES);
    if (!categories || categories.length === 0) {
      storage.set(STORAGE_KEYS.CATEGORIES, DEFAULT_CATEGORIES);
    }
    
    let recipes = storage.get(STORAGE_KEYS.RECIPES);
    if (!recipes || recipes.length === 0 || !recipes[0].hasOwnProperty('hasMaterialStep')) {
      storage.set(STORAGE_KEYS.RECIPES, DEFAULT_RECIPES);
    }
    
    let orders = storage.get(STORAGE_KEYS.ORDERS);
    if (!orders) {
      storage.set(STORAGE_KEYS.ORDERS, []);
    }
    
    let cart = storage.get(STORAGE_KEYS.CART);
    if (!cart) {
      storage.set(STORAGE_KEYS.CART, {});
    }
  },

  // --- Category APIs ---
  getCategories() {
    this.init();
    const list = storage.get(STORAGE_KEYS.CATEGORIES) || [];
    return list.sort((a, b) => (a.sort || 0) - (b.sort || 0));
  },

  saveCategories(categories) {
    storage.set(STORAGE_KEYS.CATEGORIES, categories);
  },

  addCategory(name, sort = 10) {
    const list = this.getCategories();
    const newCat = {
      id: 'cat_' + Date.now() + Math.random().toString(36).substr(2, 5),
      name,
      sort: parseInt(sort) || 10
    };
    list.push(newCat);
    this.saveCategories(list);
    return newCat;
  },

  deleteCategory(catId) {
    let list = this.getCategories();
    list = list.filter(item => item.id !== catId);
    this.saveCategories(list);

    // Re-assign dishes in deleted category to "cat_default" or delete their reference
    const recipes = this.getRecipes();
    let changed = false;
    recipes.forEach(r => {
      if (r.categoryId === catId) {
        r.categoryId = 'cat_default'; // move to default
        changed = true;
      }
    });
    if (changed) {
      this.saveRecipes(recipes);
    }
  },

  // --- Recipe APIs ---
  getRecipes() {
    this.init();
    return storage.get(STORAGE_KEYS.RECIPES) || [];
  },

  saveRecipes(recipes) {
    storage.set(STORAGE_KEYS.RECIPES, recipes);
  },

  addRecipe(recipe) {
    const list = this.getRecipes();
    const newRecipe = {
      id: 'rec_' + Date.now() + Math.random().toString(36).substr(2, 5),
      name: recipe.name,
      categoryId: recipe.categoryId || 'cat_default',
      price: parseFloat(recipe.price) || 0,
      image: recipe.image || '/assets/images/default_food.png',
      desc: recipe.desc || '',
      status: 1, // 1: Active, 0: Draft/Inactive
      hasMaterialStep: !!recipe.hasMaterialStep,
      materials: recipe.materials || [],
      materialsPublic: recipe.materialsPublic !== false,
      steps: recipe.steps || [],
      stepsPublic: recipe.stepsPublic !== false
    };
    list.push(newRecipe);
    this.saveRecipes(list);
    return newRecipe;
  },

  updateRecipe(updated) {
    const list = this.getRecipes();
    const index = list.findIndex(r => r.id === updated.id);
    if (index > -1) {
      list[index] = {
        ...list[index],
        ...updated,
        price: parseFloat(updated.price) || 0,
        hasMaterialStep: !!updated.hasMaterialStep,
        materials: updated.materials || [],
        materialsPublic: updated.materialsPublic !== false,
        steps: updated.steps || [],
        stepsPublic: updated.stepsPublic !== false
      };
      this.saveRecipes(list);
      return true;
    }
    return false;
  },

  deleteRecipe(id) {
    const list = this.getRecipes();
    const target = list.find(r => r.id === id);
    // 清理本地图片文件（封面+步骤图），防止 100MB 上限溢出
    if (target) imageUtil.removeImagesSync(imageUtil.collectRecipeImages(target));
    this.saveRecipes(list.filter(item => item.id !== id));
    
    // Also remove from cart if it's there
    this.removeFromCartCompletely(id);
  },

  // --- Cart APIs ---
  getCart() {
    this.init();
    return storage.get(STORAGE_KEYS.CART) || {};
  },

  saveCart(cart) {
    storage.set(STORAGE_KEYS.CART, cart);
  },

  addToCart(recipe) {
    const cart = this.getCart();
    if (cart[recipe.id]) {
      cart[recipe.id].quantity += 1;
    } else {
      cart[recipe.id] = {
        recipe: recipe,
        quantity: 1
      };
    }
    this.saveCart(cart);
    return cart;
  },

  removeFromCart(recipeId) {
    const cart = this.getCart();
    if (cart[recipeId]) {
      cart[recipeId].quantity -= 1;
      if (cart[recipeId].quantity <= 0) {
        delete cart[recipeId];
      }
    }
    this.saveCart(cart);
    return cart;
  },

  removeFromCartCompletely(recipeId) {
    const cart = this.getCart();
    if (cart[recipeId]) {
      delete cart[recipeId];
      this.saveCart(cart);
    }
    return cart;
  },

  clearCart() {
    storage.set(STORAGE_KEYS.CART, {});
    return {};
  },

  getCartCount() {
    const cart = this.getCart();
    let count = 0;
    Object.values(cart).forEach(item => {
      count += item.quantity;
    });
    return count;
  },

  getCartTotal() {
    const cart = this.getCart();
    let total = 0;
    Object.values(cart).forEach(item => {
      total += item.recipe.price * item.quantity;
    });
    return parseFloat(total.toFixed(2));
  },

  // --- Order APIs ---
  getOrders() {
    this.init();
    return storage.get(STORAGE_KEYS.ORDERS) || [];
  },

  saveOrders(orders) {
    storage.set(STORAGE_KEYS.ORDERS, orders);
  },

  deleteOrder(orderId) {
    this.saveOrders(this.getOrders().filter(o => o.id !== orderId));
  },

  createOrder(remark = '', isFromShare = false, sharerId = '') {
    const cart = this.getCart();
    const items = Object.values(cart);
    if (items.length === 0) return null;

    const orders = this.getOrders();
    const orderId = 'ORD' + Date.now() + Math.floor(Math.random() * 900 + 100);
    
    const newOrder = {
      id: orderId,
      createTime: this.formatTime(new Date()),
      items: items.map(item => ({
        recipeId: item.recipe.id,
        name: item.recipe.name,
        price: item.recipe.price,
        image: item.recipe.image,
        quantity: item.quantity
      })),
      totalAmount: this.getCartTotal(),
      remark: remark,
      status: 'pending', // pending: 待制作, done: 已完成
      isFromShare: isFromShare,
      sharerId: sharerId
    };

    orders.unshift(newOrder); // Add to beginning of array
    this.saveOrders(orders);
    this.clearCart();
    return newOrder;
  },

  // Helper date formatter
  formatTime(date) {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hour = date.getHours();
    const minute = date.getMinutes();
    const second = date.getSeconds();
    
    return (
      [year, month, day].map(n => n.toString().padStart(2, '0')).join('-') +
      ' ' +
      [hour, minute, second].map(n => n.toString().padStart(2, '0')).join(':')
    );
  }
};

module.exports = db;
