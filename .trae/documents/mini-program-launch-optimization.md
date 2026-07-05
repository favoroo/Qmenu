# 「Q 菜单」小程序上架前优化计划

## 概述

针对小程序即将在小范围好友中上架使用的场景，对代码库进行全面审查后，识别出一批影响 Beta 体验的问题。本计划按优先级聚焦**真正影响好友间使用的阻塞项**与**高性价比的快速优化**，不做过度工程化重构。

---

## 现状分析

### 项目架构
- 原生微信小程序 + 微信云开发（CloudBase）
- 云环境：`cloud1-d1gh3024k4f7a4fa0`，AppID：`wx5c7dd71f1fddceaf`
- 9 个页面，11 个云函数，3 个工具模块（db.js / image.js / subscribe.js）
- 三层缓存：内存 cloudCache → 本地 wx.getStorageSync → 云端数据库
- 核心场景：群组拼单（共享购物车）+ 厨师订阅消息通知

### 核心问题归类
1. **订阅消息推送达不到**：notifyChef 推送的是开发版小程序，好友点击通知打不开
2. **拼单场景数据丢失**：共享购物车整体覆盖式写入，好友同时点单会互相覆盖
3. **登录信息泄露**：默认昵称暴露 openid 后 4 位
4. **写入无错误反馈**：关键操作 fire-and-forget，失败时用户无感知
5. **下拉刷新不刷新云端**：好友新增菜品本机拉不到
6. **数据库权限未配置**：客户端直写，存在越权风险

---

## 提议的修改

### P0 - 上架前必须修复（4 项）

#### 1. 修复 notifyChef 推送版本状态
- **文件**：[cloudfunctions/notifyChef/index.js](file:///Users/a1/Documents/01Code/WeCt_Xcx/cloudfunctions/notifyChef/index.js#L34)
- **问题**：`miniprogramState: 'developer'` 推送开发版，非开发者好友点击通知无法打开
- **修改**：改为 `'formal'`（正式版上架后使用）。Beta 测试期间若用体验版可暂用 `'trial'`，但正式上线前必须改回 `'formal'`
- **同步**：部署该云函数到云端

#### 2. 修复共享购物车并发覆盖问题
- **文件**：[utils/db.js](file:///Users/a1/Documents/01Code/WeCt_Xcx/utils/db.js#L450-L462) `saveCart` 方法
- **问题**：`saveCart` 整体覆盖 cart 文档。A 读 cart → B 读 cart → A 写入 → B 写入覆盖 A，A 添加的菜品丢失。这正是"好友拼单"核心场景
- **修改方案**：改为增量更新模式
  - cart 文档结构保持 `items: { [recipeId]: { recipe, quantity } }`
  - `saveCart` 改为按 recipeId 用 `db.command.set()` 增量更新单个菜品的数量
  - `removeFromCart` / `clearCart` 用 `db.command.remove()` 删除对应字段
  - 同时保留本地缓存同步逻辑
- **影响方法**：`saveCart`、`addToCart`、`removeFromCart`、`clearCart`

#### 3. 移除默认昵称中的 openid 暴露
- **文件**：[cloudfunctions/login/index.js](file:///Users/a1/Documents/01Code/WeCt_Xcx/cloudfunctions/login/index.js#L34)
- **问题**：`吃货_${openid.substring(openid.length-4)}` 暴露 openid 后 4 位（敏感信息）
- **修改**：改用随机 4 位数字或字符，例如 `吃货_${Math.floor(1000 + Math.random() * 9000)}`
- **同步**：部署 login 云函数

#### 4. 配置数据库安全规则（控制台操作，非代码）
- **位置**：微信云开发控制台 → 数据库 → 各集合 → 权限设置
- **建议规则**：
  - `users`：仅创建者可读写
  - `groups`：所有用户可读（需通过 inviteCode 加入），仅创建者可改
  - `categories` / `recipes` / `orders` / `cart`：群组成员可读写（用安全规则基于 groupId 校验）
- **说明**：小范围好友测试阶段，至少要避免"所有用户可读写"的默认敞口。最简方案是配置为"仅创建者可读写"，群组共享数据通过云函数中转。但为了不大幅改动代码，先采用合理的集合级权限

---

### P1 - 强烈建议修复（5 项）

#### 5. 修复订单页 isAdmin 默认值
- **文件**：[pages/order/index.js](file:///Users/a1/Documents/01Code/WeCt_Xcx/pages/order/index.js#L18)
- **问题**：`isAdmin: true`，loadOrders 完成前非管理员会短暂看到管理 UI
- **修改**：改为 `false`

#### 6. 关键写入操作改为 await + 错误处理
- **文件**：[utils/db.js](file:///Users/a1/Documents/01Code/WeCt_Xcx/utils/db.js) 多处
- **范围**：`createOrder`（L593）、`addRecipe`（L390）、`updateRecipe`（L420）、`deleteRecipe`（L437）
- **修改**：返回 Promise，调用方 `await` 后再进行后续操作（如 Toast 提示、跳转）。失败时 `wx.showToast` 提示"保存失败，请重试"
- **不改动**：`saveCart`、`saveOrders` 等高频小操作（已在 P0 中处理 cart）

#### 7. 修复下单与通知时序问题
- **文件**：[pages/order-confirm/index.js](file:///Users/a1/Documents/01Code/WeCt_Xcx/pages/order-confirm/index.js#L105-L114)
- **问题**：`createOrder` 未 await 就调用 `callNotifyChef`，notifyChef 云函数内通过 orderId 查订单时可能查不到，导致通知状态无法记录
- **修改**：`await db.createOrder(...)` 后再调用 `subscribe.callNotifyChef(order)`

#### 8. 修复下拉刷新不拉取云端
- **文件**：[pages/kitchen/index.js](file:///Users/a1/Documents/01Code/WeCt_Xcx/pages/kitchen/index.js#L233-L241)
- **问题**：`onPullDownRefresh` 只读内存缓存，好友新增菜品本机拉不到
- **修改**：调用 `db.initCloudData(currentGroupId)` 后再 `loadData()`，最后 `wx.stopPullDownRefresh()`

#### 9. 切换群组 Loading 加 mask
- **文件**：[pages/kitchen/index.js](file:///Users/a1/Documents/01Code/WeCt_Xcx/pages/kitchen/index.js#L220-L223)
- **问题**：`wx.showLoading` 未加 `mask: true`，用户在切换中可继续点击 UI 导致数据不一致
- **修改**：`wx.showLoading({ title: '切换中...', mask: true })`

---

### P2 - 可选优化（可延后到测试期间迭代）

以下项目不阻塞上架，可在 Beta 测试期间根据反馈处理：

- 删除 `pages/discover/` 死代码（已从打包排除）
- 更新 README 与实际云开发架构一致
- 移除 `console.log`（保留 `console.error`）
- 统一各云函数 `wx-server-sdk` 版本
- 上线后开启 `project.config.json` 的 `urlCheck`
- "再来一单"时提示已下架菜品名称
- 解散群组时清理云存储图片
- my 页面增加清缓存/退出登录/版本信息

---

## 假设与决策

### 假设
1. 用户已注册微信小程序账号并有正式 AppID（`wx5c7dd71f1fddceaf`）
2. 订阅消息模板已配置完成（template ID 已硬编码在 `utils/subscribe.js:7`）
3. 11 个云函数已部署过，本次修改后需重新部署 notifyChef 和 login 两个
4. Beta 测试规模：好友约 3-10 人，1-3 个群组

### 关键决策
1. **不做大规模云函数迁移**：P0 #4 采用控制台安全规则配置而非把所有写操作迁移到云函数。后者工程量大，超出"小范围好友测试"所需。后续若扩大用户规模再考虑
2. **cart 并发用数据库指令解决**：不引入事务（云开发事务限制较多），改用 `db.command.set()` 按字段增量更新即可解决 90% 的并发场景
3. **miniprogramState 用 'formal'**：用户已准备好上架，正式版上架后用 formal。若上架前先做体验版测试，可短暂用 trial，但正式上架当天必须改 formal
4. **不补全 UnionID/手机号授权**：小范围好友测试无需这些，避免增加授权摩擦

---

## 验证步骤

### 部署后验证（上架前）
1. **云函数部署**：重新部署 `notifyChef` 和 `login` 两个云函数
2. **安全规则**：在云开发控制台确认各集合权限已配置，不再是"所有用户可读写"
3. **正式版预览**：用正式版预览模式（非开发版）让一位好友下单，确认能收到订阅消息且点击可打开订单页

### 功能验证（核心场景）
1. **拼单并发**：两位好友同时在同一群组添加不同菜品 → 检查购物车两份菜品都存在，无丢失
2. **下单通知**：吃货下单 → 厨师收到订阅消息 → 点击进入订单页 → 看到"全部订单"tab 下有新订单
3. **下拉刷新**：好友 A 新增菜品 → 好友 B 下拉刷新 → 能看到 A 新增的菜品
4. **失败提示**：断网状态下保存菜谱 → 应看到"保存失败"Toast，而非"成功"
5. **默认昵称**：新用户首次登录 → 昵称为"吃货_XXXX"（随机数字），不含 openid
6. **群组切换**：切换群组时 Loading 遮罩，期间点击 UI 无响应

### 回归验证
1. 添加/编辑/删除菜谱正常
2. 图片上传与裁剪正常
3. 购物车增删改查正常
4. 订单创建、完成、再来一单正常
5. 群组创建、加入、退出、解散正常
6. 分类拖拽排序正常

---

## 实施顺序建议

1. P0 #3 改 login 默认昵称（最简单，1 行代码 + 部署）
2. P0 #1 改 notifyChef miniprogramState（1 行代码 + 部署）
3. P1 #5 改 isAdmin 默认值（1 行代码）
4. P1 #8 下拉刷新拉云端（小改动）
5. P1 #9 Loading 加 mask（1 行代码）
6. P1 #7 下单 await 时序修复（小改动）
7. P1 #6 关键写入 await + 错误处理（中等改动）
8. P0 #2 购物车并发修复（核心改动，需仔细测试）
9. P0 #4 控制台配置安全规则（手动操作）
