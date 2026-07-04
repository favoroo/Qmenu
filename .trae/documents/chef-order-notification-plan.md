# Q菜单 - 厨师指定与订阅消息通知 实现方案

## 概述

在现有 Q菜单 小程序基础上，新增"指定厨师 + 订阅消息通知"能力，并将订单页拆分为双 Tab 视图（我的订单 / 厨房订单）。

**核心流程**：下单时从群组成员中指定一位厨师 → 下单成功后通过微信订阅消息通知厨师 → 厨师在"厨房订单"Tab 查看并完成制作 → 我的订单中可"提醒厨师"重新发送通知。

---

## 当前状态分析

### 现有架构
- 微信小程序 + 云开发（env: `cloud1-d1gh3024k4f7a4fa0`）
- `groups` 集合：`{ _id, name, ownerId, inviteCode, members[{openid, nickName, avatarUrl, role}], createdAt }`
- `orders` 集合：`{ id, groupId, createTime, items[], totalAmount, remark, status('pending'/'done'), isFromShare, sharerId, userName, userAvatar }` — **未存下单人 openid，无厨师字段**
- `users` 集合：`{ openid, nickName, avatarUrl, createdAt, updatedAt }`
- `cart` 集合：`{ groupId, items{} }`

### 关键文件
| 文件 | 作用 |
|---|---|
| `utils/db.js` | 存储适配层，`createOrder()` / `getOrders()` / `saveOrders()` 等 |
| `pages/order/index.js` | 订单列表页，当前展示群组全部订单，无分类 |
| `pages/order-confirm/index.js` | 下单确认页，`handlePlaceOrder()` 调用 `db.createOrder()` |
| `pages/kitchen/index.js` | 厨房浏览页，`goToConfirmOrder()` 跳转下单 |
| `cloudfunctions/getGroup/` | 获取群组信息（含成员列表） |
| `cloudfunctions/login/config.json` | 权限配置模板（`openapi: []`） |

### 微信订阅消息技术约束（已调研）
- **前端 API**：`wx.requestSubscribeMessage({ tmplIds })` — 必须在用户点击事件中**同步调用**，调用前不得有 `await`
- **后端 API**（云函数）：`cloud.openapi.subscribeMessage.send({ touser, templateId, page, data, miniprogramState })`
- **关键约束**：接收者（厨师）本人必须曾通过 `requestSubscribeMessage` 订阅过，下单人订阅无效
- **一次性订阅**：每次"允许" = 1 条发送配额；勾选"总是保持以上选择"后可静默累加
- **错误码 43101**：用户未订阅/已拒绝
- **云函数权限**：`config.json` 需声明 `"subscribeMessage.send"`
- **模板**：需在公众平台手动创建，字段类型有长度限制（`thing` ≤20字，`amount` 金额等）

---

## 设计决策

| 决策点 | 方案 |
|---|---|
| 订单分类 | 「我的订单」= 按 `userOpenid` 过滤当前用户下的单；「厨房订单」= 当前群组全部订单 |
| 数据模型 | `orders` 新增 `userOpenid`（下单人）、`chefId` / `chefName` / `chefAvatar`（厨师） |
| 厨师订阅机制 | 用户进入"厨房订单"Tab 时展示"开启提醒"横幅，点击触发 `requestSubscribeMessage` 累积配额 |
| 通知触发时机 | ①下单成功后自动调用 `notifyChef` 云函数；②"我的订单"中待制作订单提供"提醒厨师"按钮手动重发 |
| 厨师完成流程 | 极简：厨房订单 Tab 卡片"完成制作"按钮，无接单/拒单 |
| 通知失败处理 | `notifyChef` 返回 `sent:false` 时不抛错，前端友好提示"厨师未开启提醒" |
| 自做处理 | 厨师=自己时不发通知，提示"下单成功！正在制作" |

---

## 改动清单

### 新增文件（4个）
1. `cloudfunctions/notifyChef/config.json` — 声明 `subscribeMessage.send` 权限
2. `cloudfunctions/notifyChef/package.json` — 依赖 `wx-server-sdk`
3. `cloudfunctions/notifyChef/index.js` — 发送订阅消息给厨师
4. `utils/subscribe.js` — 模板ID管理、订阅请求封装、notifyChef 调用封装

### 修改文件（7个）
1. `utils/db.js` — `createOrder()` 增加 `chef` 参数，订单写入 4 个新字段
2. `pages/order-confirm/index.js` — 加载群成员、厨师选择、下单后通知
3. `pages/order-confirm/index.wxml` — 新增"指定厨师"选择器卡片
4. `pages/order-confirm/index.wxss` — 厨师选择器样式
5. `pages/order/index.js` — 双 Tab、订单过滤、订阅横幅、提醒厨师、完成制作
6. `pages/order/index.wxml` — Tab 栏、订阅横幅、厨师信息行、按 Tab 区分操作按钮
7. `pages/order/index.wxss` — Tab 栏、横幅、厨师行、提醒按钮样式

### 手动配置
- 公众平台创建订阅消息模板，回填模板 ID 到 `utils/subscribe.js` 和 `cloudfunctions/notifyChef/index.js`

---

## 详细实现

### 1. 数据模型变更 — `orders` 集合新增字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `userOpenid` | string | 下单人 openid（"我的订单"过滤用） |
| `chefId` | string | 厨师 openid；为空或=下单人时表示自做，不发通知 |
| `chefName` | string | 厨师昵称 |
| `chefAvatar` | string | 厨师头像 URL |

历史订单无这些字段，前端做兼容：`chefName` 缺失时不显示厨师行；`userOpenid` 缺失时回退用 `_openid` 过滤。

### 2. 新增云函数 `cloudfunctions/notifyChef/`

**config.json**：
```json
{
  "permissions": {
    "openapi": ["subscribeMessage.send"]
  }
}
```

**package.json**：依赖 `wx-server-sdk: ~2.6.3`

**index.js 逻辑**：
- 入参：`{ orderId, chefId, dishes, amount, ordererName, remark, createTime }`
- 菜品摘要拼成字符串并 `.slice(0, 20)`（`thing` 类型限制）
- 调用 `cloud.openapi.subscribeMessage.send({ touser: chefId, templateId, page: 'pages/order/index?tab=kitchen', miniprogramState, data })`
- 捕获 `errCode === 43101`，返回 `{ success: true, sent: false, errCode, errMsg }` — **不抛错**
- 成功返回 `{ success: true, sent: true }`
- best-effort 更新订单 `lastNotifyStatus` 字段便于排查

> `data` 中的 key（如 `thing1/amount2/...`）须与公众平台模板关键词一一对应，实际部署时按模板调整。

### 3. 新增工具模块 `utils/subscribe.js`

```js
const CHEF_NOTIFY_TMPL_ID = '填入实际模板ID'

// 请求厨师订阅（必须在 tap 事件中同步调用，前置不得 await）
function requestChefSubscribe() {
  return new Promise((resolve) => {
    wx.requestSubscribeMessage({
      tmplIds: [CHEF_NOTIFY_TMPL_ID],
      success(res) {
        const state = res[CHEF_NOTIFY_TMPL_ID]
        if (state === 'accept') {
          wx.setStorageSync('chefNotifySubscribedAt', Date.now())
        }
        resolve({ state, accepted: state === 'accept' })
      },
      fail(err) { resolve({ state: 'fail', accepted: false, err }) }
    })
  })
}

// 调用云函数通知厨师
function callNotifyChef(order) {
  return wx.cloud.callFunction({
    name: 'notifyChef',
    data: {
      orderId: order.id,
      chefId: order.chefId,
      chefName: order.chefName,
      dishes: (order.items || []).map(i => `${i.name}x${i.quantity}`).join('，'),
      amount: order.totalAmount,
      ordererName: order.userName,
      remark: order.remark,
      createTime: order.createTime
    }
  }).then(res => res.result || { success: false, sent: false })
}

module.exports = { CHEF_NOTIFY_TMPL_ID, requestChefSubscribe, callNotifyChef }
```

### 4. 数据层改造 `utils/db.js`

`createOrder` 签名扩展：`createOrder(remark, isFromShare, sharerId, chef = null)`

新增逻辑：
- 从 `chef` 参数提取 `chefId` / `chefName` / `chefAvatar`
- 从 `userInfo` 提取 `userOpenid`
- 写入 `newOrder` 对象的 4 个新字段
- `getOrders()` / `saveOrders()` / `deleteOrder()` 无需改动

### 5. 订单确认页改造 `pages/order-confirm/`

**index.js**：
- data 新增 `members: []`、`selectedChef: null`
- `onLoad` 中调用 `getGroup` 云函数加载群组成员，默认选中自己
- 新增 `onSelectChef(e)` — 点击成员设置 `selectedChef`
- `handlePlaceOrder` 改为 `async`：
  1. 调用 `db.createOrder(remark, isFromShare, sharerName, chef)`
  2. 若 `chef.openid !== me.openid`，调用 `subscribe.callNotifyChef(order)`
  3. 根据 `sent` 结果显示不同 toast（"已通知厨师" / "厨师未开启提醒"）
  4. 自做时直接提示"下单成功！正在制作"

**index.wxml**：在备注卡片前插入"指定厨师"卡片
- 横向滚动的成员头像列表
- 选中态高亮（`--primary-color` 边框 + `--primary-light` 背景）
- 底部提示文案"默认由自己制作；选择其他成员将发送订阅消息提醒对方"

**index.wxss**：厨师选择器样式，复用设计变量

### 6. 订单列表页改造 `pages/order/index/`

**index.js**：
- data 新增：`activeTab: 'mine'`、`myOpenid: ''`、`filteredOrders: []`、`showSubscribeBanner: false`
- `loadOrders` 增强：取出 `myOpenid`，调用 `applyTabFilter()`
- 新增 `applyTabFilter()` — `mine` 按 `userOpenid/_openid` 过滤；`kitchen` 显示全部
- 新增 `onTabChange(e)` — 切换 Tab、重新过滤、控制横幅显隐（7天阈值）
- 新增 `onTapSubscribe()` — **同步调用** `requestChefSubscribe()`，成功后隐藏横幅
- 新增 `remindChef(e)` — 从订单取 `chefId`，调用 `callNotifyChef`，根据结果 toast
- `completeOrder` / `reorder` / `deleteOrder` / `viewRecipeDetail` 逻辑保留

**index.wxml**：
- 顶部 Tab 栏（我的订单 / 厨房订单）
- 厨房 Tab 订阅引导横幅（`wx:if="{{activeTab==='kitchen' && showSubscribeBanner}}"`）
- 订单列表 `wx:for` 数据源从 `orders` 改为 `filteredOrders`
- 每张卡片新增"厨师信息行"（`wx:if="{{item.chefName}}"`）
- 厨房 Tab 中"待我制作"的订单高亮（`chefId===myOpenid && status==='pending'`）
- 操作按钮按 Tab 区分：
  - 我的订单：删除 + 提醒厨师(pending) / 再来一单(done)
  - 厨房订单：完成制作(pending) / 再来一单(done)
- 空状态文案按 Tab 区分

**index.wxss**：
- `.tab-bar` / `.tab-item.active` — 顶部 Tab，主色指示条
- `.subscribe-banner` / `.btn-subscribe` — `--primary-light` 背景
- `.chef-row` / `.chef-row-tag` — 厨师信息行
- `.order-card.mine-to-cook` — 待我制作高亮
- `.btn-action-remind` — 提醒按钮，参照次级按钮风格

**index.json**：标题改为"订单"

### 7. 订阅消息模板配置（部署前手动操作）

1. 登录公众平台 → 功能 → 订阅消息 → 公共模板库
2. 检索"新订单提醒"类模板，选用含：菜品明细(thing)、订单金额(amount)、下单人(thing/name)、下单时间(time/date)、备注(thing) 的模板
3. 添加到"我的模板"，记录**模板 ID** 和**关键词 key**
4. 填入 `utils/subscribe.js` 的 `CHEF_NOTIFY_TMPL_ID` 和 `cloudfunctions/notifyChef/index.js` 的 `TEMPLATE_ID`
5. 将云函数 `data` 的 key 调整为与模板一致

---

## 验证步骤

### 部署前置
1. 上传部署 `notifyChef` 云函数（云端安装依赖）
2. 公众平台创建订阅消息模板并回填模板 ID
3. `miniprogramState` 开发期设为 `developer`，上线切 `formal`

### 功能验证（两个测试号 A、B 加入同一群组）

| # | 场景 | 预期 |
|---|---|---|
| 1 | A 进入厨房订单 Tab → 点"开启提醒" | 弹出订阅授权，允许后横幅消失 |
| 2 | A 进入订单确认页 | 成员列表加载，默认选中自己 |
| 3 | A 选 B 为厨师并下单 | 订单写入新字段；B 已订阅则收到订阅消息 |
| 4 | A 在我的订单点"提醒厨师" | 再次发送通知；B 未订阅则提示"厨师未开启提醒" |
| 5 | B 点订阅消息跳转 | 落到厨房 Tab，该订单高亮"待我制作" |
| 6 | B 在厨房 Tab 点"完成制作" | 状态变 done，高亮消失 |
| 7 | A 切我的订单 | 仅显示自己下的单 |
| 8 | 历史订单展示 | 不报错；我的订单用 `_openid` 回退过滤；厨师行不显示 |
| 9 | 指定自己为厨师下单 | 不发通知，提示"下单成功！正在制作" |
| 10 | B 未订阅时 A 下单指定 B | 订单成功，A 收到"厨师未开启提醒"提示 |

### 数据库检查
- `orders` 集合确认新订单含 `userOpenid`、`chefId`、`chefName`、`chefAvatar` 字段
- `notifyChef` 云函数日志确认 `subscribeMessage.send` 返回 `errCode:0`

---

## 注意事项

1. **配额累积**：厨师每收 1 条消息消耗 1 配额。引导厨师在厨房 Tab 多次点击"开启提醒"累积配额；勾选"总是保持以上选择"后静默累加
2. **requestSubscribeMessage 调用约束**：必须由点击直接触发，前置不得 await。`onTapSubscribe` 确保同步调用；`handlePlaceOrder` 中的 `callNotifyChef` 是云函数调用，不受此约束
3. **模板字段长度**：`thing` ≤20字，菜品摘要/备注需截断；`notifyChef` 已做 `.slice(0,20)`
4. **miniprogramState**：开发版 `developer`、体验版 `trial`、正式版 `formal`，上线必须切 `formal`
5. **通知不阻塞下单**：`notifyChef` 失败不影响订单创建，仅 toast 提示
6. **历史数据兼容**：老订单无新字段，`wx:if` 守卫 + `_openid` 回退过滤
