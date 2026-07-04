# 移除 Q 菜单 Logo 图片方案

## Summary

移除小程序中所有作为品牌展示的 Q 菜单 logo 图片（`assets/images/logo.png`），改用简约文字或图标替代；对于用作默认头像/占位图的场景，替换为已有的 `default_avatar.png`。目标是去掉用户认为"丑"的 Q 字母+厨师帽 logo 图形，同时保持各页面的视觉完整性和功能正常。

## Current State Analysis

### Logo 图片现状

`/assets/images/logo.png` 是 Q 菜单的品牌 logo，设计为绿色 Q 字母轮廓 + 顶部厨师帽 + 右下侧绿叶装饰，下方配有"Q菜单"三个绿色汉字。

### 使用场景分布

共在 **7 个文件** 中使用，分为两类：

#### 一、品牌展示类（用户所说的"Q菜单图片"，主要视觉展示）

| 页面/文件 | 位置 | 用途 | 视觉权重 |
|---|---|---|---|
| `pages/login/index.wxml` | 登录页顶部 | 品牌 logo，配合"欢迎使用 Q 菜单"标题 | 高 |
| `pages/kitchen/index.wxml` | 空群组状态插图 | 未加入群组时的占位插图 | 中 |
| `pages/group/index.wxml` | 无群组空状态插图 | 不在任何群组时的占位插图 | 中 |

#### 二、默认占位图类（功能性 fallback，非品牌展示）

| 页面/文件 | 位置 | 用途 |
|---|---|---|
| `pages/order/index.wxml` | 厨师头像 | 厨师没有头像时的默认 fallback |
| `pages/order-confirm/index.wxml` | 成员头像 | 成员没有头像时的默认 fallback |
| `utils/db.js` | 默认用户信息 | 新用户默认头像 |
| `pages/kitchen/index.js` | 分享卡片 | 微信分享时的图片 |
| `pages/kitchen/index.js` | 头像判断逻辑 | 判断是否为默认头像的条件 |

## Proposed Changes

### 原则

- **品牌展示类**：彻底移除 logo 图片，改用纯文字标题 + 简约装饰，保持页面美观
- **默认占位图类**：替换为 `default_avatar.png`，功能保持不变
- 不删除 `logo.png` 文件本身（留作备份，避免引用遗漏导致图片加载失败）

---

### 修改 1：登录页移除 logo

**文件**：`pages/login/index.wxml`、`pages/login/index.wxss`

**改动**：
- 移除 `<image class="logo" src="/assets/images/logo.png">` 标签
- 保留"欢迎使用 Q 菜单"文字标题，增大字号、优化排版，让文字标题成为视觉焦点
- 调整 `.logo-area` 的内边距和布局，去掉图片后整体更紧凑

**为什么**：登录页是 logo 最显眼的位置，也是用户主要觉得"丑"的地方。用纯文字标题替代既保持品牌识别，又去掉了图形 logo。

---

### 修改 2：厨房页空群组状态移除 logo

**文件**：`pages/kitchen/index.wxml`、`pages/kitchen/index.wxss`

**改动**：
- 移除 `<image class="empty-group-illustration" src="/assets/images/logo.png">` 标签
- 替换为一个简约的图标（使用微信内置 icon 组件，type 用 "info" 或 "waiting"），或直接去掉图片让文字区域更突出
- 调整空状态容器的间距和文字排版

**为什么**：空状态页面的 logo 是次要展示位置，移除后用图标或纯文字替代即可满足引导需求。

---

### 修改 3：群组管理页空状态移除 logo

**文件**：`pages/group/index.wxml`、`pages/group/index.wxss`

**改动**：
- 移除 `<image class="illustration" src="/assets/images/logo.png">` 标签
- 替换为简约图标或纯文字排版，与厨房页空状态风格保持一致
- 调整 `.no-group-box` 的内边距

**为什么**：与厨房页空状态同理，保持设计风格统一。

---

### 修改 4：订单页厨师默认头像替换

**文件**：`pages/order/index.wxml`

**改动**：
- 将 `{{item.chefAvatar || '/assets/images/logo.png'}}` 改为 `{{item.chefAvatar || '/assets/images/default_avatar.png'}}`

**为什么**：厨师头像的 fallback 不应使用品牌 logo，用默认头像更合理。

---

### 修改 5：订单确认页成员默认头像替换

**文件**：`pages/order-confirm/index.wxml`

**改动**：
- 将 `{{m.avatarUrl || '/assets/images/logo.png'}}` 改为 `{{m.avatarUrl || '/assets/images/default_avatar.png'}}`

**为什么**：同上，成员头像用默认头像更合理。

---

### 修改 6：默认用户头像替换

**文件**：`utils/db.js`

**改动**：
- 第 467 行左右，将默认用户信息中的 `avatarUrl: '/assets/images/logo.png'` 改为 `avatarUrl: '/assets/images/default_avatar.png'`

**为什么**：新用户默认头像应该使用通用的默认头像，而不是品牌 logo。

---

### 修改 7：分享卡片图片处理

**文件**：`pages/kitchen/index.js`

**改动**：
- 第 628 行左右的 `imageUrl: '/assets/images/logo.png'`，改为空字符串 `''` 或使用默认菜品图
- 第 105 行的头像判断逻辑 `userInfo.avatarUrl.includes('logo.png')`，改为 `userInfo.avatarUrl.includes('default_avatar.png')`

**为什么**：分享卡片不再使用 logo 图片；头像判断逻辑需要同步更新。

## Assumptions & Decisions

1. **保留 logo.png 文件**：不删除源文件，只修改引用。这样如果后续需要恢复或有遗漏引用，不会导致图片 404。
2. **品牌展示类用纯文字替代**：不生成新的替代图片，用现有文字 + 微信内置 icon 组件实现，减少资源依赖。
3. **默认占位图类用 default_avatar.png**：项目中已有默认头像图片，直接复用即可。
4. **"Q 菜单"文字保留**：移除的是图形 logo，品牌名称文字仍然保留在各页面标题中。

## Verification Steps

1. 编译小程序，确认无报错
2. 进入登录页：确认顶部没有 logo 图片，"欢迎使用 Q 菜单"文字显示正常，布局美观
3. 进入厨房页（未加入群组时）：确认空状态没有 logo 图片，引导文字显示正常
4. 进入群组管理页（无群组时）：确认空状态没有 logo 图片，引导文字显示正常
5. 进入订单页：确认厨师头像 fallback 显示为默认头像而非 logo
6. 下单并进入订单确认页：确认成员头像 fallback 显示为默认头像
7. 新用户登录（清除缓存）：确认默认头像为 default_avatar.png
8. 测试微信分享：确认分享卡片正常显示，无报错
9. 检查所有页面没有图片加载失败的情况（控制台无 404 报错）
