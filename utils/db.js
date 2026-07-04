const imageUtil = require('./image.js');

// 内存缓存
let cloudCache = {
  categories: [],
  recipes: [],
  orders: [],
  cart: {}
};

let currentGroupId = '';

// 本地缓存键常量
const CACHE_PREFIX = 'cloudData_';
const LAST_GROUP_KEY = 'lastGroupId';
const GROUPS_LIST_KEY = 'cachedGroupsList';

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
      { image: '', desc: '将鲜花椒、小米辣、大蒜剁碎放入碗中。锅中烧热花椒油，趁热淋在碎料上激发出香味，再加入生抽、少许盐、糖、鸡精 and 两勺煮鸡的原汤拌匀。', timer: 3 },
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
  // 从云端加载所有数据并缓存
  setCurrentGroupId(groupId) {
    currentGroupId = groupId;
  },

  getCurrentGroupId() {
    return currentGroupId;
  },

  // --- 本地缓存层（同步，用于首屏瞬时渲染）---
  loadFromLocalCache(groupId) {
    if (!groupId) return false;
    try {
      const cached = wx.getStorageSync(CACHE_PREFIX + groupId);
      if (cached && cached.categories) {
        cloudCache.categories = cached.categories;
        cloudCache.recipes = cached.recipes || [];
        cloudCache.orders = cached.orders || [];
        cloudCache.cart = cached.cart || {};
        currentGroupId = groupId;
        return true;
      }
    } catch (e) {
      console.warn('[db] loadFromLocalCache failed', e);
    }
    return false;
  },

  saveToLocalCache(groupId) {
    if (!groupId) return;
    try {
      wx.setStorageSync(CACHE_PREFIX + groupId, {
        categories: cloudCache.categories,
        recipes: cloudCache.recipes,
        orders: cloudCache.orders,
        cart: cloudCache.cart,
        updatedAt: Date.now()
      });
    } catch (e) {
      console.warn('[db] saveToLocalCache failed', e);
    }
  },

  setLastGroupId(groupId) {
    if (groupId) {
      try { wx.setStorageSync(LAST_GROUP_KEY, groupId); } catch (e) {}
    }
  },

  getLastGroupId() {
    try { return wx.getStorageSync(LAST_GROUP_KEY) || ''; } catch (e) { return ''; }
  },

  cacheGroupsList(groups) {
    try { wx.setStorageSync(GROUPS_LIST_KEY, groups); } catch (e) {}
  },

  getCachedGroupsList() {
    try { return wx.getStorageSync(GROUPS_LIST_KEY) || []; } catch (e) { return []; }
  },

  // 从云端加载所有数据并缓存 (支持 groupId 隔离，并行查询)
  async initCloudData(groupId) {
    if (groupId) {
      currentGroupId = groupId;
    }

    if (!currentGroupId) {
      cloudCache.categories = [];
      cloudCache.recipes = [];
      cloudCache.orders = [];
      cloudCache.cart = {};
      return;
    }

    const gid = currentGroupId;
    try {
      const dbInstance = wx.cloud.database();

      // 4 个独立查询并行执行（原串行 → 并行）
      const [categories, recipes, orders, cart] = await Promise.all([
        this._fetchCategories(dbInstance, gid),
        this._fetchRecipes(dbInstance, gid),
        this._fetchOrders(dbInstance, gid),
        this._fetchCart(dbInstance, gid)
      ]);

      cloudCache.categories = categories;
      cloudCache.recipes = recipes;
      cloudCache.orders = orders;
      cloudCache.cart = cart;

      // 落盘本地缓存，供下次冷启动瞬时渲染
      this.saveToLocalCache(gid);
    } catch (err) {
      console.error('初始化云端数据失败', err);
      // 云端失败时降级读本地缓存，保证可用性
      this.loadFromLocalCache(gid);
    }
  },

  async _fetchCategories(dbInstance, gid) {
    let catRes = await dbInstance.collection('categories').where({ groupId: gid }).get();
    let categories = catRes.data;
    if (categories.length === 0) {
      for (let cat of DEFAULT_CATEGORIES) {
        const res = await dbInstance.collection('categories').add({
          data: {
            id: cat.id,
            groupId: gid,
            name: cat.name,
            sort: cat.sort
          }
        });
        cat._id = res.id;
      }
      categories = DEFAULT_CATEGORIES.map(c => ({ ...c, groupId: gid }));
    }
    return categories;
  },

  async _fetchRecipes(dbInstance, gid) {
    let recRes = await dbInstance.collection('recipes').where({ groupId: gid }).get();
    let recipes = recRes.data;
    if (recipes.length === 0) {
      for (let rec of DEFAULT_RECIPES) {
        const res = await dbInstance.collection('recipes').add({
          data: {
            id: rec.id,
            groupId: gid,
            categoryId: rec.categoryId,
            price: rec.price,
            image: rec.image,
            desc: rec.desc,
            status: rec.status,
            hasMaterialStep: rec.hasMaterialStep,
            materials: rec.materials,
            materialsPublic: rec.materialsPublic,
            steps: rec.steps,
            stepsPublic: rec.stepsPublic,
            creatorId: 'system',
            creatorName: '系统'
          }
        });
        rec._id = res.id;
      }
      recipes = DEFAULT_RECIPES.map(r => ({ ...r, groupId: gid, creatorId: 'system', creatorName: '系统' }));
    }
    return recipes;
  },

  async _fetchOrders(dbInstance, gid) {
    let ordRes = await dbInstance.collection('orders')
      .where({ groupId: gid })
      .orderBy('createTime', 'desc')
      .get();
    return ordRes.data;
  },

  async _fetchCart(dbInstance, gid) {
    let cartRes = await dbInstance.collection('cart').where({ groupId: gid }).limit(1).get();
    if (cartRes.data.length > 0) {
      return cartRes.data[0].items || {};
    } else {
      await dbInstance.collection('cart').add({
        data: {
          groupId: gid,
          items: {}
        }
      });
      return {};
    }
  },

  // --- Category APIs ---
  getCategories() {
    return cloudCache.categories.sort((a, b) => (a.sort || 0) - (b.sort || 0));
  },

  saveCategories(categories) {
    cloudCache.categories = categories;
    this.saveToLocalCache(currentGroupId);
    const dbInstance = wx.cloud.database();
    categories.forEach(async (cat) => {
      if (cat._id) {
        await dbInstance.collection('categories').doc(cat._id).update({
          data: { name: cat.name, sort: cat.sort }
        });
      }
    });
  },

  addCategory(name, sort = 10) {
    if (!currentGroupId) return null;
    const list = this.getCategories();
    const newCat = {
      id: 'cat_' + Date.now() + Math.random().toString(36).substr(2, 5),
      groupId: currentGroupId,
      name,
      sort: parseInt(sort) || 10
    };
    list.push(newCat);
    
    const dbInstance = wx.cloud.database();
    dbInstance.collection('categories').add({
      data: newCat
    }).then(res => {
      newCat._id = res.id;
    });

    this.saveToLocalCache(currentGroupId);
    return newCat;
  },

  deleteCategory(catId) {
    let list = this.getCategories();
    const target = list.find(item => item.id === catId);
    list = list.filter(item => item.id !== catId);
    cloudCache.categories = list;

    if (target && target._id) {
      const dbInstance = wx.cloud.database();
      dbInstance.collection('categories').doc(target._id).remove();
    }

    const recipes = this.getRecipes();
    recipes.forEach(r => {
      if (r.categoryId === catId) {
        r.categoryId = 'cat_default';
        if (r._id) {
          const dbInstance = wx.cloud.database();
          dbInstance.collection('recipes').doc(r._id).update({
            data: { categoryId: 'cat_default' }
          });
        }
      }
    });

    this.saveToLocalCache(currentGroupId);
  },

  // --- Recipe APIs ---
  getRecipes() {
    return cloudCache.recipes || [];
  },

  saveRecipes(recipes) {
    cloudCache.recipes = recipes;
    this.saveToLocalCache(currentGroupId);
  },

  addRecipe(recipe) {
    if (!currentGroupId) return null;
    const list = this.getRecipes();
    const userInfo = wx.getStorageSync('userInfo') || {};
    const newRecipe = {
      id: 'rec_' + Date.now() + Math.random().toString(36).substr(2, 5),
      groupId: currentGroupId,
      name: recipe.name,
      categoryId: recipe.categoryId || 'cat_default',
      price: parseFloat(recipe.price) || 0,
      image: recipe.image || '/assets/images/default_food.png',
      desc: recipe.desc || '',
      status: 1,
      hasMaterialStep: !!recipe.hasMaterialStep,
      materials: recipe.materials || [],
      materialsPublic: recipe.materialsPublic !== false,
      steps: recipe.steps || [],
      stepsPublic: recipe.stepsPublic !== false,
      creatorId: userInfo.openid || 'unknown',
      creatorName: userInfo.nickName || '匿名用户'
    };
    list.push(newRecipe);

    const dbInstance = wx.cloud.database();
    dbInstance.collection('recipes').add({
      data: newRecipe
    }).then(res => {
      newRecipe._id = res.id;
    });

    this.saveToLocalCache(currentGroupId);
    return newRecipe;
  },

  updateRecipe(updated) {
    const list = this.getRecipes();
    const index = list.findIndex(r => r.id === updated.id);
    if (index > -1) {
      const old = list[index];
      const newRec = {
        ...old,
        ...updated,
        price: updated.price !== undefined ? (parseFloat(updated.price) || 0) : old.price,
        hasMaterialStep: updated.hasMaterialStep !== undefined ? !!updated.hasMaterialStep : old.hasMaterialStep,
        materials: updated.materials !== undefined ? updated.materials : old.materials,
        materialsPublic: updated.materialsPublic !== undefined ? (updated.materialsPublic !== false) : old.materialsPublic,
        steps: updated.steps !== undefined ? updated.steps : old.steps,
        stepsPublic: updated.stepsPublic !== undefined ? (updated.stepsPublic !== false) : old.stepsPublic
      };
      list[index] = newRec;

      if (newRec._id) {
        const dbInstance = wx.cloud.database();
        const { _id, _openid, ...updateData } = newRec;
        dbInstance.collection('recipes').doc(_id).update({
          data: updateData
        });
      }
      this.saveToLocalCache(currentGroupId);
      return true;
    }
    return false;
  },

  deleteRecipe(id) {
    const list = this.getRecipes();
    const target = list.find(r => r.id === id);
    if (target) {
      imageUtil.removeImagesSync(imageUtil.collectRecipeImages(target));
      if (target._id) {
        const dbInstance = wx.cloud.database();
        dbInstance.collection('recipes').doc(target._id).remove();
      }
    }
    cloudCache.recipes = list.filter(item => item.id !== id);
    this.removeFromCartCompletely(id);
    this.saveToLocalCache(currentGroupId);
  },

  // --- Cart APIs ---
  getCart() {
    return cloudCache.cart || {};
  },

  saveCart(cart) {
    if (!currentGroupId) return;
    cloudCache.cart = cart;
    this.saveToLocalCache(currentGroupId);
    const dbInstance = wx.cloud.database();
    dbInstance.collection('cart').where({ groupId: currentGroupId }).get().then(res => {
      if (res.data.length > 0) {
        dbInstance.collection('cart').doc(res.data[0]._id).update({
          data: { items: cart }
        });
      }
    });
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
    this.saveCart({});
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
    return cloudCache.orders || [];
  },

  saveOrders(orders) {
    cloudCache.orders = orders;
    this.saveToLocalCache(currentGroupId);
    const dbInstance = wx.cloud.database();
    orders.forEach(async (ord) => {
      if (ord._id) {
        await dbInstance.collection('orders').doc(ord._id).update({
          data: { status: ord.status }
        });
      }
    });
  },

  deleteOrder(orderId) {
    const orders = this.getOrders();
    const target = orders.find(o => o.id === orderId);
    if (target && target._id) {
      const dbInstance = wx.cloud.database();
      dbInstance.collection('orders').doc(target._id).remove();
    }
    cloudCache.orders = orders.filter(o => o.id !== orderId);
    this.saveToLocalCache(currentGroupId);
  },

  createOrder(remark = '', isFromShare = false, sharerId = '', chef = null) {
    if (!currentGroupId) return null;
    const cart = this.getCart();
    const items = Object.values(cart);
    if (items.length === 0) return null;

    const orders = this.getOrders();
    const orderId = 'ORD' + Date.now() + Math.floor(Math.random() * 900 + 100);
    const userInfo = wx.getStorageSync('userInfo') || { nickName: '吃货', avatarUrl: '/assets/images/default_avatar.png' };

    const chefId = chef ? chef.openid : '';
    const chefName = chef ? chef.nickName : '';
    const chefAvatar = chef ? chef.avatarUrl : '';

    const newOrder = {
      id: orderId,
      groupId: currentGroupId,
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
      status: 'pending',
      isFromShare: isFromShare,
      sharerId: sharerId,
      userName: userInfo.nickName,
      userAvatar: userInfo.avatarUrl,
      userOpenid: userInfo.openid || '',
      chefId: chefId,
      chefName: chefName,
      chefAvatar: chefAvatar
    };

    orders.unshift(newOrder);
    cloudCache.orders = orders;

    const dbInstance = wx.cloud.database();
    dbInstance.collection('orders').add({
      data: newOrder
    }).then(res => {
      newOrder._id = res.id;
    });

    this.clearCart();
    this.saveToLocalCache(currentGroupId);
    return newOrder;
  },

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
