# AGENT.md — Q 菜单项目指南

本文件供后续 AI Agent 与新开发者快速熟悉代码库并遵循统一开发规范。任何修改请同步更新本文件。

---

## 第一部分：项目简介与文件结构

### 1. 项目概述

- **项目名**：Q 菜单（仓库目录 `WeCt_Xcx`）
- **定位**：基于微信云开发的好友群组协作点菜 / 拼单小程序
- **AppID**：`wx5c7dd71f1fddceaf`
- **云开发环境**：`cloud1-d1gh3024k4f7a4fa0`
- **核心场景**：用户创建或加入「群组」（如家庭、朋友圈）→ 群组内共享菜谱库 → 浏览菜品加入购物车 → 下单并指派厨师 → 厨师完成后获得星级评分与排行榜

### 2. 技术栈

- 微信小程序原生开发（**无框架、无 TypeScript、无构建步骤**）
- 微信云开发：云数据库 + 云存储 + 云函数
- 云函数依赖 `wx-server-sdk ~2.6.3`
- 基础库 `libVersion: 2.30.0`
- App 配置 `style: "v2"`、`lazyCodeLoading: "requiredComponents"`

### 3. 目录结构

```
WeCt_Xcx/
├── app.js                     # 入口：云开发初始化 + 登录 + 预加载缓存
├── app.json                    # 页面注册 + TabBar + 全局窗口配置
├── app.wxss                    # 全局样式 + 设计系统 CSS 变量
├── project.config.json         # 项目配置 + 打包排除规则
├── project.private.config.json # 本地私有配置
├── sitemap.json                # 索引规则（allow *）
├── pages/                      # 页面目录（见下表）
├── utils/                     # 工具模块：db.js / image.js / subscribe.js
├── cloudfunctions/             # 云函数（见下表）
├── assets/                     # 静态资源
│   ├── images/                 # default_avatar / default_food / logo / icon_*.svg
│   └── tabbar/                 # TabBar 图标（kitchen / order / my 的 normal+active）
├── .trae/documents/            # 特性级方案文档（历史决策归档，不计入打包）
├── .agents/skills/             # 已安装的 CloudBase 技能包（不计入打包）
└── .workbuddy/memory/          # 每日工作记忆日志（YYYY-MM-DD.md）
```

> **注意**：项目 **没有** `components/` 目录，所有 UI 均在各页面内用原生组件直接编写。`discover` 页面已存在代码但未注册到 `app.json` 且被排除打包，疑似废弃 / 未上线，新增功能请勿依赖。

### 4. 页面清单

每个页面目录统一含 4 个文件：`index.js` / `index.json` / `index.wxml` / `index.wxss`。

| 页面 | 路径 | 角色 | 备注 |
|---|---|---|---|
| kitchen | `pages/kitchen/index` | TabBar 首页 | 菜谱浏览 / 购物车 / 随机选菜 / 群组切换 / 菜谱详情含步骤计时器 / 分享入口 |
| order | `pages/order/index` | TabBar | 3 Tab（厨房订单 / 我下的 / 我完成的）+ 厨师排行榜 + 订单评分 |
| my | `pages/my/index` | TabBar | 个人资料设置 |
| recipe-add | `pages/recipe-add/index` | 普通页 | 新增 / 编辑菜谱（含用料、步骤、图片） |
| crop-image | `pages/crop-image/index` | 普通页 | 图片裁剪 |
| category-manage | `pages/category-manage/index` | 普通页 | 分类管理（拖拽排序） |
| order-confirm | `pages/order-confirm/index` | 普通页 | 下单确认 / 选厨师 |
| login | `pages/login/index` | 普通页 | 微信头像昵称授权设置 |
| group | `pages/group/index` | 普通页 | 群组管理（群主 / 成员操作） |
| discover | `pages/discover/index` | **未注册 + 排除打包** | 状态模糊，疑似废弃，请勿依赖 |

### 5. 云函数清单

所有云函数位于 `cloudfunctions/<函数名>/`，含 `index.js` + `package.json`（依赖 `wx-server-sdk ~2.6.3`）；需要 OpenAPI 权限的额外含 `config.json`。

| 云函数 | config.json | 功能 |
|---|---|---|
| `login` | `permissions.openapi: []` | 按 OPENID 查 / 建 users 记录，返回 `{success, openid, userInfo, isNewUser?}` |
| `notifyChef` | `subscribeMessage.send` | 推送购物清单提醒订阅消息（5 字段），更新订单 `lastNotifyStatus` |
| `createGroup` | 无 | 创建群组，生成 6 位邀请码（去重），owner 自动入群 |
| `joinGroup` | 无 | 按邀请码入群，上限 20 人 |
| `getGroup` | 无 | 传 groupId 返回单群组；不传返回用户所有群组 |
| `leaveGroup` | 无 | 成员自退（群主不可退） |
| `disbandGroup` | 无 | 群主解散，级联删除 categories / recipes / orders / cart |
| `removeMember` | 无 | 群主移除成员 |
| `transferOwner` | 无 | 群主转让，批量切换 owner / member 角色 |
| `regenerateInviteCode` | 无 | 重新生成邀请码 |
| `updateGroupName` | 无 | 群主改群名 |
| `updateUser` | 无 | 更新 nickName / avatarUrl |

### 6. 数据库集合

| 集合 | 说明 | id 前缀 |
|---|---|---|
| `categories` | 菜品分类 | `cat_` |
| `recipes` | 菜谱（含用料 / 步骤 / 图片） | `rec_` |
| `orders` | 订单（订单号 `ORD+时间戳+随机`） | `ORD` |
| `ratings` | 订单评分（幂等：同订单同评分者仅一次） | `rate_` |
| `cart` | 购物车（按群组隔离，字段级更新 `items.${recipeId}`） | — |
| `users` | 用户信息（nickName / avatarUrl / openid） | — |
| `groups` | 群组（ownerId / members / inviteCode） | — |

字段命名一律 camelCase（如 `createTime`、`createTimeMs`、`groupId`、`categoryId`、`chefId`、`chefName`、`chefAvatar`、`deliciousRating`）。

### 7. 核心数据流

**冷启动首屏瞬时渲染**：
```
app.js onLaunch
  → wx.cloud.init()
  → db.getLastGroupId()            // 读本地缓存
  → db.loadFromLocalCache(groupId) // 同步填充内存 cloudCache
  → 首屏渲染（不 await 任何网络）

页面 onShow
  → await app.globalData.loginPromise  // 确保 openid 就绪
  → 阶段1：读 db 内存缓存瞬时渲染
  → 阶段2：db.initCloudData(groupId)   // Promise.all 并行拉取 5 集合
  → 差异检测 → setData 刷新
```

**三层缓存**：内存 `cloudCache` → 本地存储（`wx.setStorageSync`，键前缀 `cloudData_`）→ 云数据库。写操作走乐观更新 + 回滚（详见规范第 3 条）。

**登录模式**：`app.login()` 的 Promise 挂在 `globalData.loginPromise`，各页面 `onLoad` / `onShow` 中 `await` 确保 openid 就绪；`userInfo` 同时缓存到 `wx.setStorageSync('userInfo')`。

### 8. 打包排除说明

`project.config.json` 的 `packOptions.ignore` 已排除：`.git`、`.agents`、`.trae`、`.uploads`、`cloudfunctions`、`README.md`、`skills-lock.json`、`pages/discover`、discover 的 tabbar 图标。

> **本 AGENT.md 默认会被打入小程序包**。如需排除，请将 `AGENT.md` 加入 `project.config.json` 的 `packOptions.ignore`。

---

## 第二部分：开发规范约定

### 1. 命名规范

| 对象 | 规范 | 示例 |
|---|---|---|
| JS 变量 / 函数 / 方法 | camelCase | `activeCategoryId`、`getChefRanking` |
| 数据库集合名 | 小写复数 | `categories`、`recipes`、`orders` |
| 数据库字段 | camelCase | `createTime`、`chefId` |
| 页面目录 | kebab-case | `category-manage`、`recipe-add`、`order-confirm` |
| 页面内文件 | 统一 `index.*` | `index.js` / `index.json` / `index.wxml` / `index.wxss` |
| 私有方法 / 内部状态 | 下划线前缀 | `_fetchCart`、`_scrollThrottleTimer` |
| 业务 id 前缀 | 按集合分类 | `cat_` / `rec_` / `rate_` / `ORD`（订单号） |

### 2. 页面结构规范

以 `pages/kitchen/index.js` 为模板：

```js
const db = require('../../utils/db.js');
const app = getApp();
Page({
  data: { /* 状态字段，内部状态用 _ 前缀 */ },
  async onLoad(options) { /* 启用分享菜单、await loginPromise、处理深链接 */ },
  async onShow() { /* 阶段1瞬时渲染本地缓存 → 阶段2后台刷新云端 */ },
  async loadData() { /* 读 db 缓存 → 差异检测 → setData */ },
  // 事件处理 onXxx（onAddCart、onSearchInput）
  // 导航 goXxx（goRecipeAdd、goToOrders）
  // 私有 _xxx（_updateActiveCategoryByScroll、_hasDataChanged）
  onShareAppMessage() { /* 群组邀请分享 */ },
  onHide/onUnload() { /* 清理定时器 */ }
});
```

### 3. 数据访问规范（硬约束）

- **所有数据库读写必须经 `utils/db.js` 适配器**，禁止页面直接调用 `wx.cloud.database()`。
- **所有查询必须按 `currentGroupId` 过滤**（群组隔离硬约束）。
- **写操作必须遵循乐观更新 + 回滚模式**：
  1. 先写本地 `cloudCache`（如 `cloudCache.recipes.unshift(newRecipe)`）
  2. 调用 `saveToLocalCache(groupId)` 落盘
  3. `await db.collection(...).add()` 写云端
  4. 失败时回滚本地缓存（如 `cloudCache.recipes = cloudCache.recipes.filter(r => r.id !== newRecipe.id)`）并 `throw err` 向上抛
- **购物车并发安全**：用 `items.${recipeId}` 字段级 `update`，**禁止全量覆盖**（避免覆盖其他成员的并发添加）。
- **删除菜谱 / 编辑图片 / 重置缓存必须清理对应云存储文件**（详见图片处理规范）。

### 4. 图片处理规范（硬约束）

- **图片压缩、保存、删除必须经 `utils/image.js`**。
- **压缩参数**：`quality=80`，`maxWidth/maxHeight=1080`。
- **存储路径**：`recipes/时间戳-随机.ext`（云存储，`storageMode: 'cloud'`）。
- **删除菜谱前**必须调用 `imageUtil.collectRecipeImages(recipe)` 收集封面 + 步骤图，再 `removeImagesSync` 批量清理云存储。
- **禁止误删** `/assets/`、`cloud://`、`http(s)://` 路径（用 `isManagedLocalFile` / `isTempPath` 守卫）。
- 历史遗留的本地持久化路径 `USER_DATA_PATH/recipe_imgs` 仅作降级方案，新代码统一走云存储。

### 5. 订阅消息规范（硬约束）

- **模板 ID 与请求逻辑集中在 `utils/subscribe.js`**，禁止在页面硬编码模板 ID。
- **模板必含字段**：菜品明细(thing)、订单金额(amount)、下单人(thing/name)、下单时间(time/date)、备注(thing)。
- `notifyChef` 云函数的 `config.json` 必须声明 `permissions.openapi: ["subscribeMessage.send"]`。
- 调用 `cloud.openapi.subscribeMessage.send` 遇 **43101 错误**（用户未订阅）时，返回 `sent: false` **而非抛异常**。
- **下单后必须自动调用 `callNotifyChef(order)`** 通知厨师，订单数据需含 `userOpenid`、`chefId`、`chefName`、`chefAvatar`。

### 6. 云函数规范

```js
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })  // 动态当前环境
const db = cloud.database()

exports.main = async (event, context) => {
  const { OPENID } = cloud.getWXContext()       // 鉴权
  try {
    // 1. 参数校验（OPENID、业务参数）
    // 2. 权限校验（如 group.ownerId === OPENID）
    // 3. 业务逻辑
    return { success: true, /* ...data */ }
  } catch (err) {
    return { success: false, errMsg: err.message || err }
  }
}
```

- `package.json` 仅依赖 `wx-server-sdk ~2.6.3`。
- 需要 OpenAPI 的函数必须有 `config.json` 声明 `permissions.openapi`。
- **错误信息用中文**。
- **群主操作**（解散 / 转让 / 移除 / 改名 / 重生成邀请码）必须先校验 `group.ownerId === OPENID`。
- 邀请码生成共用 `genInviteCode()`（6 位大写字母 + 数字），并通过 `while` 循环查重保证唯一。

### 7. 订单规范（硬约束）

- 订单数据必含字段：`userOpenid`、`chefId`、`chefName`、`chefAvatar`。
- 订单页必须实现 **双 Tab**（我的订单 / 厨房订单），分别过滤与操作按钮。
- `createOrder(remark, isFromShare, sharerId, chef)` 必须传 `chef` 参数（含 `chefId`、`chefName`、`chefAvatar`）。
- 订单号格式：`ORD+时间戳+随机`。

### 8. 注释规范

| 场景 | 语言 | 示例 |
|---|---|---|
| 业务 / 领域逻辑 | 中文 | `// 阶段1：瞬时渲染本地缓存（不 await 任何网络）` |
| 区块分隔 | 英文 | `// --- Cart Actions ---`、`// --- Recipe APIs ---` |
| JSDoc | 英文 | `@param`、`@returns` |
| 云函数错误信息 | 中文 | `'未登录'`、`'只有群主才能转让群主'` |

### 9. 错误处理规范

- **页面层**：`try/catch` + `console.error('[模块] 操作失败', err)` + `wx.showToast({title:'...', icon:'none'})`；关键操作用 `wx.showModal` 二次确认。
- **降级策略**：云端失败时读本地缓存；集合不存在时降级空数组。
- **云函数**：统一返回 `{success: boolean, errMsg?: string, ...data}`。

### 10. UI / 设计系统规范

- **主题**：「海港蓝白」，CSS 变量定义在 `app.wxss` 的 `page` 选择器。
- **主色**：`--primary-color: #2563EB`；按压加深 `--primary-dark: #1D4ED8`；浅底 `--primary-light: #EFF6FF`。
- **文本三级**：`--text-main: #1A1F2C` / `--text-sub: #5E6978` / `--text-light: #94A3B8`。
- **强调色**：`--danger-color: #E07A5F`（珊瑚色，价格强调）；`--dock-bg: #0F1B3D`（深海蓝，购物车栏）。
- **单位**：全 `rpx`。
- **字体栈**：SF Pro 优先，含 PingFang SC。
- **复用工具类**：`.flex-row` / `.flex-col` / `.flex-1` / `.card` / `.btn-primary`（135° 蓝渐变 + scale(0.97) 按压）/ `.btn-secondary` / `.text-ellipsis`。
- **动效 keyframes**：`stagger-rise`、`pop-in`、`badge-pop`、`float-soft`。
- `wx.showModal` 的 `confirmColor` 应使用主题色 `#2563EB`（**已知遗留：11 处硬编码颜色值**，新增代码避免）。

### 11. 历史决策归档

- 重大特性方案文档放 `.trae/documents/<特性名>.md`（如 `群组管理功能实现方案.md`、`首屏加载优化方案.md`、`recipe-rating-system.md`）。
- 每日工作记忆放 `.workbuddy/memory/YYYY-MM-DD.md`。
- 项目级长期约定见 `.trae-cn/memory/projects/-Users-a1-Documents-01Code-WeCt-Xcx/project_memory.md`（如可访问）。

---

## 已知遗留问题（供后续改进参考）

1. **`discover` 页面状态模糊**：已存在代码但未注册到 `app.json` 且被排除打包，疑似废弃 / 未上线，建议明确标注或删除。
2. **`confirmColor` 硬编码**：11 处 JS 中硬编码颜色值（`#2563EB` / `#E07A5F` / `#EF4444` / `#ff4d4f`），分布于 order / recipe-add / discover / my / group / kitchen / category-manage，应统一常量化。
3. **`db.js` 单文件过大**：868 行承担缓存 + CRUD + 聚合，职责过重，可考虑按集合拆分（如 `db/cart.js`、`db/recipe.js`）。
4. **无自定义组件抽象**：所有 UI 写在各页面 WXML / WXSS 中，存在样式重复（卡片、按钮、空状态），后续可考虑抽取 `recipe-card`、`cart-bar`、`empty-state` 等自定义组件。
