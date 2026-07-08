const imageUtil = require('./image.js');

// 内存缓存
let cloudCache = {
  categories: [],
  recipes: [],
  orders: [],
  ratings: [],
  cart: {},
  cartDocId: '' // 缓存购物车文档 _id，避免每次操作都查询
};

let currentGroupId = '';
let _dataVersion = 0; // 云端数据版本号，每次 initCloudData 成功后递增，用于页面检测数据刷新

// 本地缓存键常量
const CACHE_PREFIX = 'cloudData_';
const CACHE_VERSION = 2; // 缓存版本，升级时自动失效旧缓存（避免过期临时URL导致403）
const LAST_GROUP_KEY = 'lastGroupId';
const GROUPS_LIST_KEY = 'cachedGroupsList';

const DEFAULT_CATEGORIES = [
  { id: 'cat_default', name: '默认分类', sort: 1 },
  { id: 'cat_signature', name: '招牌菜', sort: 2 },
  { id: 'cat_meat', name: '肉类', sort: 3 },
  { id: 'cat_vegetable', name: '蔬菜', sort: 4 },
  { id: 'cat_soup', name: '汤类', sort: 5 }
];

const DEFAULT_RECIPES = [
  {
    id: 'rec_001',
    name: '椒麻鸡',
    categoryId: 'cat_signature',
    price: 48,
    image: '/assets/images/default_food.jpg',
    desc: '地道椒麻鸡，皮脆肉嫩，麻辣爽口，香气扑鼻！',
    status: 1,
    deliciousRating: 5,
    difficultyRating: 4,
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
    image: '/assets/images/hongshaorou_v2.jpg',
    desc: '肥而不腻，入口即化，经典的家常美味。',
    status: 1,
    deliciousRating: 5,
    difficultyRating: 3,
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
    image: '/assets/images/tomato_egg_soup_v2.jpg',
    desc: '清淡解腻，营养丰富，经典汤品。',
    status: 1,
    deliciousRating: 4,
    difficultyRating: 1,
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
  },
  {
    id: 'rec_004',
    name: '回锅肉',
    categoryId: 'cat_meat',
    price: 38,
    image: '/assets/images/huiguorou_v2.jpg',
    desc: '川菜经典，肥而不腻，色泽红亮，咸鲜微辣。',
    status: 1,
    deliciousRating: 5,
    difficultyRating: 3,
    hasMaterialStep: true,
    materialsPublic: true,
    materials: [
      { name: '优质五花肉', weight: '400g' },
      { name: '蒜苗', weight: '100g' },
      { name: '郫县豆瓣酱', weight: '1勺' },
      { name: '豆豉', weight: '10粒' },
      { name: '生姜', weight: '1块' },
      { name: '大蒜', weight: '3瓣' },
      { name: '料酒', weight: '1勺' },
      { name: '生抽', weight: '1勺' },
      { name: '白糖', weight: '半茶匙' }
    ],
    stepsPublic: true,
    steps: [
      { image: '', desc: '五花肉冷水下锅，加入姜片、料酒，大火烧开后转小火煮至筷子能穿透（约20分钟），捞出晾凉切薄片。', timer: 20 },
      { image: '', desc: '蒜苗斜切段，姜葱切片，准备好豆瓣酱和豆豉。', timer: 3 },
      { image: '', desc: '锅中放少许油，下入肉片，中小火煸炒至肉片卷曲呈“灯盏窝”状，多余的油脂盛出。', timer: 8 },
      { image: '', desc: '拨开肉片，下入豆瓣酱、豆豉、姜葱片炒出红油和香味，再将肉片混合翻炒。', timer: 3 },
      { image: '', desc: '倒入蒜苗段，调入生抽和少许白糖，大火快速翻炒至蒜苗断生即可出锅。', timer: 3 }
    ]
  },
  {
    id: 'rec_005',
    name: '蒜蓉西兰花',
    categoryId: 'cat_vegetable',
    price: 16,
    image: '/assets/images/garlic_broccoli_v2.jpg',
    desc: '清爽可口，蒜香浓郁，营养健康的素菜。',
    status: 1,
    deliciousRating: 4,
    difficultyRating: 2,
    hasMaterialStep: true,
    materialsPublic: true,
    materials: [
      { name: '西兰花', weight: '1个' },
      { name: '大蒜', weight: '1头' },
      { name: '盐', weight: '1茶匙' },
      { name: '鸡精', weight: '半茶匙' },
      { name: '水淀粉', weight: '2勺' },
      { name: '食用油', weight: '2勺' }
    ],
    stepsPublic: true,
    steps: [
      { image: '', desc: '西兰花切成小朵，用盐水浸泡10分钟后洗净。大蒜剁成蒜蓉。', timer: 10 },
      { image: '', desc: '锅中烧开水，加入少许盐 and 几滴油，下入西兰花焯水1分钟，捞出过凉水控干。', timer: 2 },
      { image: '', desc: '锅中放油烧热，下入一半蒜蓉爆香。', timer: 1 },
      { image: '', desc: '倒入西兰花，大火快速翻炒均匀，加入盐、鸡精调味。', timer: 2 },
      { image: '', desc: '倒入剩下的一半蒜蓉，淋入水淀粉勾薄芡，翻炒均匀即可出锅。', timer: 2 }
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
      // 缓存版本校验：版本不匹配时拒绝使用旧缓存（旧缓存可能含过期的临时https URL）
      if (cached && cached.categories && cached._v === CACHE_VERSION) {
        cloudCache.categories = cached.categories;
        cloudCache.recipes = cached.recipes || [];
        cloudCache.orders = cached.orders || [];
        cloudCache.ratings = cached.ratings || [];
        cloudCache.cart = cached.cart || {};
        cloudCache.cartDocId = ''; // 重置，由 _fetchCart 或 _ensureCartDocId 重新获取
        currentGroupId = groupId;
        return true;
      }
      // 版本不匹配或缓存无效，清除旧缓存
      if (cached && cached._v !== CACHE_VERSION) {
        wx.removeStorageSync(CACHE_PREFIX + groupId);
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
        _v: CACHE_VERSION,
        categories: cloudCache.categories,
        recipes: cloudCache.recipes,
        orders: cloudCache.orders,
        ratings: cloudCache.ratings,
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

  /**
   * 获取云端数据版本号（每次 initCloudData 成功后递增）
   * 页面保存上次渲染版本号，通过比较版本号判断云端数据是否已刷新
   */
  getDataVersion() {
    return _dataVersion;
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
      cloudCache.ratings = [];
      cloudCache.cart = {};
      cloudCache.cartDocId = '';
      return;
    }

    const gid = currentGroupId;
    try {
      const dbInstance = wx.cloud.database();

      // 5 个独立查询并行执行（原串行 → 并行）
      const [categories, recipes, orders, ratings, cart] = await Promise.all([
        this._fetchCategories(dbInstance, gid),
        this._fetchRecipes(dbInstance, gid),
        this._fetchOrders(dbInstance, gid),
        this._fetchRatings(dbInstance, gid),
        this._fetchCart(dbInstance, gid)
      ]);

      cloudCache.categories = categories;
      cloudCache.recipes = recipes;
      cloudCache.orders = orders;
      cloudCache.ratings = ratings;
      cloudCache.cart = cart;

      // 递增数据版本号，通知页面数据已从云端刷新
      _dataVersion++;

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
      // 通过分类集合判断是否为全新群组
      // 如果分类已存在，说明群组已初始化过，用户可能删除了所有菜谱，不应自动恢复
      const catRes = await dbInstance.collection('categories').where({ groupId: gid }).get();
      if (catRes.data.length === 0) {
        // 真正的新群组：创建全部默认菜谱
        for (let rec of DEFAULT_RECIPES) {
          const res = await dbInstance.collection('recipes').add({
            data: {
              id: rec.id,
              groupId: gid,
              name: rec.name,
              categoryId: rec.categoryId,
              price: rec.price,
              image: rec.image,
              desc: rec.desc,
              status: rec.status,
              deliciousRating: rec.deliciousRating || 0,
              difficultyRating: rec.difficultyRating || 0,
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
      // else: 群组已存在但菜谱为空，说明用户清空了所有菜谱，保持为空
    } else {
      // 增量同步：更新已有默认菜谱的图片及分类属性（仅同步仍存在的系统菜谱，不恢复已删除的）
      for (let rec of recipes) {
        if (rec.creatorId === 'system') {
          const matchDefault = DEFAULT_RECIPES.find(dr => dr.id === rec.id || dr.name === rec.name);
          if (matchDefault) {
            let needsUpdate = false;
            let updateFields = {};
            if (rec.image !== matchDefault.image) {
              needsUpdate = true;
              updateFields.image = matchDefault.image;
              rec.image = matchDefault.image;
            }
            if (rec.categoryId !== matchDefault.categoryId) {
              needsUpdate = true;
              updateFields.categoryId = matchDefault.categoryId;
              rec.categoryId = matchDefault.categoryId;
            }
            if (needsUpdate) {
              try {
                await dbInstance.collection('recipes').doc(rec._id).update({
                  data: updateFields
                });
              } catch (e) {
                console.error('[db] 同步默认菜谱属性失败', rec.name, e);
              }
            }
          }
        }
      }
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

  async _fetchRatings(dbInstance, gid) {
    try {
      let rateRes = await dbInstance.collection('ratings')
        .where({ groupId: gid })
        .orderBy('createTimeMs', 'desc')
        .get();
      return rateRes.data;
    } catch (e) {
      // ratings 集合可能尚未创建，首次访问会报错，降级为空数组
      console.warn('[db] _fetchRatings failed', e);
      return [];
    }
  },

  async _fetchCart(dbInstance, gid) {
    let cartRes = await dbInstance.collection('cart').where({ groupId: gid }).limit(1).get();
    if (cartRes.data.length > 0) {
      cloudCache.cartDocId = cartRes.data[0]._id;
      return cartRes.data[0].items || {};
    } else {
      const addRes = await dbInstance.collection('cart').add({
        data: {
          groupId: gid,
          items: {}
        }
      });
      cloudCache.cartDocId = addRes._id;
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

  /**
   * 图片解析完成后的回调（保留接口兼容性，不再修改cloudCache）
   * 解析后的 https URL 存储在 image.js 自身的缓存中（带TTL），页面 data 中也保存
   * cloudCache 始终保持云端原始数据（cloud:// URL），避免临时URL被持久化导致403
   * @param {Object[]} resolvedRecipes - 已解析图片URL的菜谱数组（已不再使用）
   */
  updateRecipeImagesInCache(resolvedRecipes) {
    // 不再修改 cloudCache，避免 https 临时URL被写入内存后又被其他save操作持久化
    // image.js 内部已有 TTL 缓存机制，页面直接使用 getCachedUrlOrEmpty + 异步解析即可
  },

  /**
   * 图片解析完成后的回调（保留接口兼容性，不再修改cloudCache）
   * @param {Object[]} resolvedOrders - 已解析图片URL的订单数组（已不再使用）
   */
  updateOrderImagesInCache(resolvedOrders) {
    // 不再修改 cloudCache，避免 https 临时URL被写入内存后又被其他save操作持久化
  },

  async addRecipe(recipe) {
    if (!currentGroupId) return null;
    const list = this.getRecipes();
    const userInfo = wx.getStorageSync('userInfo') || {};
    const newRecipe = {
      id: 'rec_' + Date.now() + Math.random().toString(36).substr(2, 5),
      groupId: currentGroupId,
      name: recipe.name,
      categoryId: recipe.categoryId || 'cat_default',
      price: recipe.price !== undefined && recipe.price !== null && recipe.price !== '' ? (isNaN(parseFloat(recipe.price)) ? 0 : parseFloat(recipe.price)) : 0,
      image: recipe.image || '/assets/images/default_food.jpg',
      desc: recipe.desc || '',
      status: 1,
      deliciousRating: recipe.deliciousRating || 0,
      difficultyRating: recipe.difficultyRating || 0,
      hasMaterialStep: !!recipe.hasMaterialStep,
      materials: recipe.materials || [],
      materialsPublic: recipe.materialsPublic !== false,
      steps: recipe.steps || [],
      stepsPublic: recipe.stepsPublic !== false,
      creatorId: userInfo.openid || 'unknown',
      creatorName: userInfo.nickName || '匿名用户'
    };
    list.push(newRecipe);
    this.saveToLocalCache(currentGroupId);

    try {
      const dbInstance = wx.cloud.database();
      const res = await dbInstance.collection('recipes').add({
        data: newRecipe
      });
      newRecipe._id = res.id;
      return newRecipe;
    } catch (err) {
      console.error('[db] addRecipe 云端写入失败', err);
      // 回滚本地缓存
      cloudCache.recipes = list.filter(r => r.id !== newRecipe.id);
      this.saveToLocalCache(currentGroupId);
      throw err;
    }
  },

  async updateRecipe(updated) {
    const list = this.getRecipes();
    const index = list.findIndex(r => r.id === updated.id);
    if (index > -1) {
      const old = list[index];
      const newRec = {
        ...old,
        ...updated,
        price: updated.price !== undefined && updated.price !== null && updated.price !== '' ? (isNaN(parseFloat(updated.price)) ? 0 : parseFloat(updated.price)) : old.price,
        hasMaterialStep: updated.hasMaterialStep !== undefined ? !!updated.hasMaterialStep : old.hasMaterialStep,
        materials: updated.materials !== undefined ? updated.materials : old.materials,
        materialsPublic: updated.materialsPublic !== undefined ? (updated.materialsPublic !== false) : old.materialsPublic,
        steps: updated.steps !== undefined ? updated.steps : old.steps,
        stepsPublic: updated.stepsPublic !== undefined ? (updated.stepsPublic !== false) : old.stepsPublic,
        deliciousRating: updated.deliciousRating !== undefined ? (updated.deliciousRating || 0) : (old.deliciousRating || 0),
        difficultyRating: updated.difficultyRating !== undefined ? (updated.difficultyRating || 0) : (old.difficultyRating || 0)
      };
      list[index] = newRec;

      if (newRec._id) {
        const dbInstance = wx.cloud.database();
        const { _id, _openid, ...updateData } = newRec;
        try {
          await dbInstance.collection('recipes').doc(_id).update({
            data: updateData
          });
        } catch (err) {
          console.error('[db] updateRecipe 云端更新失败', err);
          throw err;
        }
      }
      this.saveToLocalCache(currentGroupId);
      return true;
    }
    return false;
  },

  async deleteRecipe(id) {
    const list = this.getRecipes();
    const target = list.find(r => r.id === id);
    if (target) {
      const imagePaths = imageUtil.collectRecipeImages(target);
      if (target._id) {
        const dbInstance = wx.cloud.database();
        try {
          await dbInstance.collection('recipes').doc(target._id).remove();
        } catch (err) {
          console.error('[db] deleteRecipe 云端删除失败', err);
          throw err;
        }
      }
      // 文档删除成功后,再删图片(失败记录到 orphan_images,不抛错)
      await imageUtil.removeImagesAsync(imagePaths);
    }
    cloudCache.recipes = list.filter(item => item.id !== id);
    this.removeFromCartCompletely(id);
    this.saveToLocalCache(currentGroupId);
  },

  async deleteRecipes(ids) {
    if (!ids || ids.length === 0) return;
    const list = this.getRecipes();
    const targets = list.filter(r => ids.includes(r.id));
    if (targets.length === 0) return;

    // 收集所有关联图片
    let allImagePaths = [];
    targets.forEach(target => {
      const paths = imageUtil.collectRecipeImages(target);
      if (paths && paths.length > 0) {
        allImagePaths = allImagePaths.concat(paths);
      }
    });

    const dbInstance = wx.cloud.database();

    // 批量在云端数据库中删除文档
    const removePromises = targets.map(target => {
      if (target._id) {
        return dbInstance.collection('recipes').doc(target._id).remove()
          .catch(err => {
            console.error('[db] deleteRecipes 批量项云端删除失败', target.name, err);
          });
      }
      return Promise.resolve();
    });

    await Promise.all(removePromises);

    // 删除关联的图片文件
    if (allImagePaths.length > 0) {
      await imageUtil.removeImagesAsync(allImagePaths);
    }

    // 更新内存缓存
    cloudCache.recipes = list.filter(item => !ids.includes(item.id));

    // 同步从购物车中彻底清理
    ids.forEach(id => {
      this.removeFromCartCompletely(id);
    });

    this.saveToLocalCache(currentGroupId);
  },

  // --- Cart APIs ---
  getCart() {
    return cloudCache.cart || {};
  },

  // 懒加载获取购物车文档 _id（不存在则创建）
  async _ensureCartDocId(dbInstance) {
    if (cloudCache.cartDocId) return cloudCache.cartDocId;
    const gid = currentGroupId;
    if (!gid) return null;
    const cartRes = await dbInstance.collection('cart').where({ groupId: gid }).limit(1).get();
    if (cartRes.data.length > 0) {
      cloudCache.cartDocId = cartRes.data[0]._id;
    } else {
      const addRes = await dbInstance.collection('cart').add({
        data: { groupId: gid, items: {} }
      });
      cloudCache.cartDocId = addRes._id;
    }
    return cloudCache.cartDocId;
  },

  // 增量更新单个菜品字段（并发安全：不同 recipeId 互不影响）
  _persistCartItem(recipeId, item) {
    if (!currentGroupId) return;
    const dbInstance = wx.cloud.database();
    this._ensureCartDocId(dbInstance).then(docId => {
      if (!docId) return;
      dbInstance.collection('cart').doc(docId).update({
        data: { [`items.${recipeId}`]: item }
      }).catch(err => console.error('[db] 购物车增量更新失败', err));
    }).catch(err => console.error('[db] 获取购物车文档失败', err));
  },

  // 删除单个菜品字段（并发安全）
  _removeCartItem(recipeId) {
    if (!currentGroupId) return;
    const dbInstance = wx.cloud.database();
    const _ = dbInstance.command;
    this._ensureCartDocId(dbInstance).then(docId => {
      if (!docId) return;
      dbInstance.collection('cart').doc(docId).update({
        data: { [`items.${recipeId}`]: _.remove() }
      }).catch(err => console.error('[db] 购物车字段删除失败', err));
    }).catch(err => console.error('[db] 获取购物车文档失败', err));
  },

  // 全量覆盖购物车（用于清空、再来一单等批量替换场景）
  saveCart(cart) {
    if (!currentGroupId) return;
    cloudCache.cart = cart;
    this.saveToLocalCache(currentGroupId);
    const dbInstance = wx.cloud.database();
    this._ensureCartDocId(dbInstance).then(docId => {
      if (!docId) return;
      dbInstance.collection('cart').doc(docId).update({
        data: { items: cart }
      }).catch(err => console.error('[db] 购物车全量更新失败', err));
    }).catch(err => console.error('[db] 获取购物车文档失败', err));
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
    cloudCache.cart = cart;
    this.saveToLocalCache(currentGroupId);
    // 增量更新：仅写入该菜品字段，避免并发覆盖其他好友的添加
    this._persistCartItem(recipe.id, cart[recipe.id]);
    return cart;
  },

  removeFromCart(recipeId) {
    const cart = this.getCart();
    if (cart[recipeId]) {
      cart[recipeId].quantity -= 1;
      if (cart[recipeId].quantity <= 0) {
        delete cart[recipeId];
        cloudCache.cart = cart;
        this.saveToLocalCache(currentGroupId);
        // 数量归零，删除该菜品字段
        this._removeCartItem(recipeId);
      } else {
        cloudCache.cart = cart;
        this.saveToLocalCache(currentGroupId);
        // 数量递减，增量更新该菜品字段
        this._persistCartItem(recipeId, cart[recipeId]);
      }
    }
    return cart;
  },

  removeFromCartCompletely(recipeId) {
    const cart = this.getCart();
    if (cart[recipeId]) {
      delete cart[recipeId];
      cloudCache.cart = cart;
      this.saveToLocalCache(currentGroupId);
      this._removeCartItem(recipeId);
    }
    return cart;
  },

  clearCart() {
    cloudCache.cart = {};
    this.saveToLocalCache(currentGroupId);
    // 清空购物车：全量覆盖 items 为空对象
    if (!currentGroupId) return {};
    const dbInstance = wx.cloud.database();
    this._ensureCartDocId(dbInstance).then(docId => {
      if (!docId) return;
      dbInstance.collection('cart').doc(docId).update({
        data: { items: {} }
      }).catch(err => console.error('[db] 购物车清空失败', err));
    }).catch(err => console.error('[db] 获取购物车文档失败', err));
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

  async deleteOrder(orderId) {
    const orders = this.getOrders();
    const target = orders.find(o => o.id === orderId);
    if (target && target._id) {
      const dbInstance = wx.cloud.database();
      try {
        await dbInstance.collection('orders').doc(target._id).remove();
        // 同步清理该订单的 ratings
        await dbInstance.collection('ratings').where({ orderId: target.id }).remove();
      } catch (err) {
        console.error('[db] deleteOrder 云端删除失败', err);
      }
    }
    cloudCache.orders = orders.filter(o => o.id !== orderId);
    cloudCache.ratings = (cloudCache.ratings || []).filter(r => r.orderId !== orderId);
    this.saveToLocalCache(currentGroupId);
  },

  async createOrder(remark = '', isFromShare = false, sharerId = '', chef = null) {
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

    try {
      const dbInstance = wx.cloud.database();
      const res = await dbInstance.collection('orders').add({
        data: newOrder
      });
      newOrder._id = res.id;
    } catch (err) {
      console.error('[db] createOrder 云端写入失败', err);
      // 回滚本地缓存
      cloudCache.orders = orders.filter(o => o.id !== newOrder.id);
      this.saveToLocalCache(currentGroupId);
      throw err;
    }

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
  },

  // --- Rating APIs ---
  getRatings() {
    return cloudCache.ratings || [];
  },

  // 检查订单是否已被当前用户评分过；传入 myOpenid 时严格判定
  getOrderRating(orderId, myOpenid) {
    const ratings = this.getRatings();
    if (myOpenid) {
      return ratings.find(r => r.orderId === orderId && r.raterId === myOpenid) || null;
    }
    return ratings.find(r => r.orderId === orderId) || null;
  },

  // 新增评分；同一订单同一评分者只允许一次
  async addRating(rating) {
    if (!currentGroupId) return null;
    if (!rating || !rating.orderId || !rating.chefId || !rating.stars) return null;
    if (rating.stars < 1 || rating.stars > 10) return null;

    const stars = parseInt(rating.stars);
    const userInfo = wx.getStorageSync('userInfo') || { nickName: '吃货', avatarUrl: '/assets/images/default_avatar.png' };

    // 幂等校验：当前用户对同一订单只能评分一次
    const existing = this.getOrderRating(rating.orderId, userInfo.openid || '');
    if (existing) {
      return existing;
    }

    const now = Date.now();
    const newRating = {
      id: 'rate_' + now + Math.random().toString(36).substr(2, 5),
      groupId: currentGroupId,
      orderId: rating.orderId,
      chefId: rating.chefId,
      chefName: rating.chefName || '',
      chefAvatar: rating.chefAvatar || '',
      raterId: userInfo.openid || '',
      raterName: userInfo.nickName || '匿名用户',
      raterAvatar: userInfo.avatarUrl || '',
      stars: stars,
      createTime: this.formatTime(new Date(now)),
      createTimeMs: now
    };

    cloudCache.ratings.unshift(newRating);
    this.saveToLocalCache(currentGroupId);

    try {
      const dbInstance = wx.cloud.database();
      const res = await dbInstance.collection('ratings').add({
        data: newRating
      });
      newRating._id = res.id;
      return newRating;
    } catch (err) {
      console.error('[db] addRating 云端写入失败', err);
      // 回滚本地缓存
      cloudCache.ratings = cloudCache.ratings.filter(r => r.id !== newRating.id);
      this.saveToLocalCache(currentGroupId);
      throw err;
    }
  },

  // 计算厨师星级排名；period: 'month' | 'year' | 'all'
  getChefRanking(period) {
    const ratings = this.getRatings();
    if (ratings.length === 0) return [];

    const now = Date.now();
    let sinceMs = 0;
    if (period === 'month') {
      // 最近一个月（30 天）
      sinceMs = now - 30 * 24 * 3600 * 1000;
    } else if (period === 'year') {
      // 最近一年（365 天）
      sinceMs = now - 365 * 24 * 3600 * 1000;
    }

    const filtered = sinceMs > 0
      ? ratings.filter(r => (r.createTimeMs || 0) >= sinceMs)
      : ratings;

    // 按厨师聚合
    const map = {};
    filtered.forEach(r => {
      if (!map[r.chefId]) {
        map[r.chefId] = {
          chefId: r.chefId,
          chefName: r.chefName || '神秘厨师',
          chefAvatar: r.chefAvatar || '/assets/images/default_avatar.png',
          totalStars: 0,
          ratingCount: 0,
          lastRatingMs: 0
        };
      }
      const entry = map[r.chefId];
      entry.totalStars += (r.stars || 0);
      entry.ratingCount += 1;
      // 取最新评分时间戳对应的厨师信息（昵称/头像可能变更）
      if ((r.createTimeMs || 0) > entry.lastRatingMs) {
        entry.lastRatingMs = r.createTimeMs || 0;
        entry.chefName = r.chefName || entry.chefName;
        entry.chefAvatar = r.chefAvatar || entry.chefAvatar;
      }
    });

    const list = Object.values(map).map(e => ({
      ...e,
      avgStars: e.ratingCount > 0 ? +(e.totalStars / e.ratingCount).toFixed(1) : 0
    }));

    // 总星数降序，次按平均星数降序
    list.sort((a, b) => {
      if (b.totalStars !== a.totalStars) return b.totalStars - a.totalStars;
      return b.avgStars - a.avgStars;
    });

    return list;
  }
};

module.exports = db;
