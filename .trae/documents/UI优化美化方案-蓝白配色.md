# Q 菜单 UI 优化美化方案 — 蓝白配色现代化改造

## 概述

将"Q 菜单"微信小程序从绿色配色升级为蓝白配色，整体走向简约现代化风格，并增加精心编排的动效。设计遵循 frontend-design 技能的"克制与精确"原则：一种主色 + 一种互补强调色，通过阴影层次、交错入场动效、留白节奏建立高级感。

## 设计方向与配色方案

### 设计基调：克制的"海港蓝白"（Coastal Blue & White）

选用现代钴蓝 `#2563EB` 作为主色，保留珊瑚色 `#E07A5F` 作为价格强调色。蓝（冷）与珊瑚（暖）形成互补张力，对食物场景更"开胃"。

### 新色值清单（写入 CSS 变量）

| 变量 | 旧值（绿） | 新值（蓝） | 用途 |
|---|---|---|---|
| `--primary-color` | `#2D5A43` | `#2563EB` | 主色：按钮、激活态、图标 |
| `--primary-dark` | `#1E3F2D` | `#1D4ED8` | 按压/悬停加深态 |
| `--primary-light` | `#F0F5F2` | `#EFF6FF` | 极浅蓝底（大面积背景区块） |
| `--primary-soft`（新增） | — | `#DBEAFE` | 徽标/标签底色 |
| `--primary-tint`（新增） | — | `rgba(37,99,235,0.08)` | hover/active 微透底 |
| `--btn-shadow` | `rgba(45,90,67,0.12)` | `0 8rpx 20rpx rgba(37,99,235,0.22)` | 蓝色调按钮阴影 |
| `--card-shadow` | `rgba(0,0,0,0.02)` | `0 8rpx 30rpx rgba(15,23,42,0.04), 0 2rpx 8rpx rgba(37,99,235,0.04)` | 蓝调分层卡片阴影 |
| `--dock-bg`（新增） | — | `#0F1B3D` | 深海蓝购物车栏底 |

保留不变：`--danger-color:#E07A5F`、`--warning-color:#F4A261`、`--text-main/sub/light`、`--bg-light:#F8FAFC`、`--border-color:#E2E8F0`。

## 当前状态分析

- 全局样式 `app.wxss` 定义了绿色 CSS 变量体系，各页面通过 `var()` 引用
- 但 `pages/group/index.wxss`、`pages/login/index.wxss`、`pages/crop-image/index.wxss` 等存在大量硬编码绿色值 `#2D5A43`，未走变量
- 各页面 WXSS 中散布 `rgba(45, 90, 67, ...)` 硬编码绿色阴影/边框
- WXML 内联色 `color="#2D5A43"` 出现在 my、order、recipe-add、order-confirm 等页
- JS 中 `wx.showModal` 的 `confirmColor: '#2D5A43'` 共 4 处
- `app.json` tabBar `selectedColor` 为绿色
- `assets/tabbar/*_active.png` 图标为绿色，需重新着色
- 现有动画：slide-up、scale-in、fade-in、pulse-timer、rotate，基础已有

## 提议变更

### 1. `app.wxss` — 全局变量与基础样式

- **替换 4 主变量 + btn-shadow** 为蓝值；新增 `--primary-soft`、`--primary-tint`、`--dock-bg`
- **`page` 背景色** `#f7f7f7` → `#F8FAFC`，与 `--bg-light` 统一
- **字体栈精炼**：前置 `SF Pro Display`/`SF Pro Text`，标题加 `letter-spacing:-0.02em`
- **`.btn-primary`** 加 135° 蓝渐变 `linear-gradient(135deg, #2563EB 0%, #1D4ED8 100%)`；`:active` 由 `opacity:0.95` 升级为 `transform: scale(0.97)`
- **`.btn-secondary`** 底色用 `--primary-light`、文字 `--primary-color`
- **`.card`** 阴影/边框蓝调化，边框改 `rgba(37,99,235,0.06)`
- **新增动效 keyframes**：`stagger-rise`、`pop-in`、`badge-pop`、`float-soft`

### 2. `app.json` — 配置

- `tabBar.selectedColor`: `#2D5A43` → `#2563EB`

### 3. 动效系统设计

遵循"一次精心编排的页面加载胜过零散微交互"原则：

| 场景 | 实现方式 |
|---|---|
| 厨房菜谱卡片入场 | `stagger-rise .5s` + nth-child 交错延迟，JS 门控 `animReady` 避免搜索抖动 |
| 订单卡片入场 | 同上，`.order-card.stagger` 交错 |
| 我的页菜单项 | `.menu-item` 交错淡入上移 |
| 购物车角标 | 数量变化时 `badge-pop .4s`（JS 配合 `badgeBump` 布尔） |
| 浮动"吃什么"按钮 | 持续 `float-soft 3s infinite ease-in-out` |
| Tab 指示条 | `transition: all .3s cubic-bezier(.25,1,.5,1)` |
| 弹窗 | 现有 `scale-in`/`slide-up` 保留，缓动统一 |
| 按钮 :active | 统一 `transform: scale(.96)` + 阴影收窄 |

### 4. 排版与空间优化

- 统一圆角语言：卡片 24rpx、按钮 48rpx（胶囊）、徽标 12rpx、输入框 16rpx
- 字重梯度：标题 700/800、副标题 600、正文 500、辅助 400；`bold` 改显式 `font-weight:600`
- 字距：大标题（38rpx+）加 `letter-spacing:-0.02em`
- 留白节奏：菜谱卡片间距 `border-bottom` 改为 `margin-bottom:20rpx` + 去边线
- 阴影蓝调化：所有 `rgba(0,0,0,...)` 软阴影替换为 `rgba(15,23,42,...)` 或 `rgba(37,99,235,...)`

### 5. 逐文件改动清单

#### `pages/kitchen/index.wxss`（8 处硬编码绿）
- 行 277 浮动随机按钮边框 `rgba(45,90,67,0.15)` → `rgba(37,99,235,0.18)`
- 行 419 btn-share-invite :active `rgba(45,90,67,0.15)` → `var(--primary-tint)`
- 行 627 rolling-box 边框 `rgba(45,90,67,0.1)` → `rgba(37,99,235,0.12)`
- 行 1043 timeline-node 阴影 → `rgba(37,99,235,0.25)`
- 行 1078/1085 timer-btn 边框/阴影 → 蓝调
- 行 1350 current-badge 底 → `var(--primary-soft)`
- 行 307 `.bottom-dock-container` 底色 `rgba(26,32,44,0.96)` → `var(--dock-bg)`（#0F1B3D）
- 行 331 `.cart-icon-bg` border `#1a202c` → `#0F1B3D`
- `.recipe-card` 去 `border-bottom`，改 `margin-bottom:20rpx`；加 stagger 入场
- `.floating-random-btn` 加 `animation: float-soft 3s infinite ease-in-out`
- `.cart-badge` 加 badge-pop 触发类
- `.recipe-image` 加 `transition: transform .3s`，:active `scale(1.03)`

#### `pages/order/index.wxss`（5 处硬编码绿）
- 行 48 subscribe-banner 边框 → `rgba(37,99,235,0.18)`
- 行 143 pending 徽标边框 → `rgba(37,99,235,0.22)`
- 行 368 `.mine-to-cook` 背景 `#fcfdfb` → `#F5F8FF`
- timeline 绿色阴影 → 蓝调（同 kitchen）
- `.tab-item.active::after` 加 transition
- `.order-card` 加 stagger 入场
- `.order-item:active` 背景 → `var(--primary-tint)`

#### `pages/my/index.wxss`
- `.profile-header` 加 135° 蓝渐变背景 `linear-gradient(180deg, #EFF6FF 0%, #FFFFFF 100%)`
- `.profile-avatar` 边框加蓝光环 `box-shadow: 0 0 0 6rpx rgba(37,99,235,0.08)`
- `.menu-item` 加 stagger 入场
- `.arrow-right` :active 加 `translateX(4rpx)`

#### `pages/recipe-add/index.wxss`（2 处硬编码绿）
- 行 263/357 `rgba(45,90,67,0.2)` → `rgba(37,99,235,0.22)`
- `.image-uploader` 虚线边优化
- `.btn-submit` 加蓝渐变

#### `pages/login/index.wxss`（2 处硬编码绿）
- 行 35 `.title color:#2D5A43` → `var(--primary-color)`
- 行 87 `.btn-submit` → 蓝渐变
- `.login-card` 加 `pop-in` 入场动画
- `.logo` 加 `float-soft` 浮动

#### `pages/group/index.wxss`（10 处硬编码绿 + Google Material 色，重灾区）
- 行 103/137/143/144/202/249/263/264/276/283/305 全部 `#2D5A43` → `var(--primary-color)`
- 统一 Google Material 残留色：`#E6F4EA`/`#137333`（owner 绿）→ `var(--primary-soft)`/`var(--primary-color)`；`#E8F0FE`/`#1A73E8`（member 蓝）→ `#DBEAFE`/`#1D4ED8`
- `.group-card` 加 stagger 入场
- `.copy-btn` :active 加 `var(--primary-tint)` 底

#### `pages/category-manage/index.wxss`（4 处硬编码绿 rgba）
- 行 101/107/248/262 `rgba(45,90,67,...)` → `rgba(37,99,235,...)`
- `.drag-float` 加 `pop-in`

#### `pages/order-confirm/index.wxss`（2 处硬编码绿）
- 行 25/179 `rgba(45,90,67,...)` → `rgba(37,99,235,...)`
- `.chef-item` 加 transition + :active `scale(.98)`
- `.btn-submit-order` 加蓝渐变
- `.dish-item` 加 stagger 入场

#### `pages/crop-image/index.wxss`（1 处硬编码绿）
- 行 119 `.btn-confirm` `#2D5A43` → `#2563EB`（或蓝渐变）

#### WXML 内联色（8 处）
- `pages/my/index.wxml` 行 19、27：`color="#2D5A43"` → `#2563EB`
- `pages/order/index.wxml` 行 68：同上
- `pages/recipe-add/index.wxml` 行 74、89、135（`<switch color>`）：同上
- `pages/order-confirm/index.wxml` 行 5：同上

#### JS 内 `confirmColor`（4 处）
- `pages/order/index.js`、`pages/kitchen/index.js`（2 处）、`pages/group/index.js`：`confirmColor: '#2D5A43'` → `'#2563EB'`

#### 入场动效 JS 门控（kitchen / order / my 三页）
- 各页 `onLoad` 末尾加 `setTimeout(() => this.setData({ animReady: true }), 50)`
- 对应 WXML 列表项 class 追加 `{{animReady ? 'stagger' : ''}}`
- WXSS 写 `.recipe-card.stagger{ animation: stagger-rise .5s cubic-bezier(.25,1,.5,1) backwards; }` + nth-child 延迟
- 购物车角标 bump：kitchen `onAddCart` 后 `setData({badgeBump:true})`，300ms 后置 false

### 6. 资源处理（重要）

`assets/tabbar/` 下 `kitchen_active.png`、`order_active.png`、`my_active.png` 三个选中态图标若为绿色，改 tabBar selectedColor 不会改变图标颜色，会出现"蓝字 + 绿图标"撕裂。必须将这三张 PNG 重新着色为 `#2563EB`。

处理方式：用 Node + `sharp`/`jimp` 做像素替换（`#2D5A43`→`#2563EB` 容差替换），normal 灰色态不变。

`assets/images/logo.png` 若含绿色品牌色，建议同步转蓝（非阻塞，可二期）。

## 假设与决策

- **主色选择**：`#2563EB`（现代钴蓝）而非更浅的 `#3B82F6`，保证白字对比度达标 WCAG AA
- **保留珊瑚价格色**：`--danger-color:#E07A5F` 不改，蓝珊瑚互补让食物更开胃
- **深海蓝 dock**：购物车栏用 `#0F1B3D` 而非纯黑，与主色蓝调统一
- **动效门控**：用 JS `animReady` 标志控制入场动效，避免搜索/筛选时连环重播
- **字体策略**：微信小程序无法加载 Web 字体，通过系统栈 + 字重/字距打磨
- **tabBar 图标**：必须重新着色 PNG，否则视觉撕裂

## 验证步骤

1. **全局预览**：编译后逐页截图，确认无残留绿色（搜索 `2D5A43`/`45, 90, 67` 应为 0 命中）
2. **配色一致性**：开发者工具检查 `page` 计算样式，确认 `--primary-color` 为 `#2563EB`
3. **tabBar 检查**：切换三个 tab，确认选中文字为蓝、图标为蓝（验证 PNG 已重着色）
4. **动效检查**：
   - 厨房页首次加载菜谱卡片应交错上移入场；切换分类再触发；搜索时不重播
   - 点击加号加购，购物车角标应有 pop 弹跳
   - 浮动"吃什么"按钮应有持续轻浮
   - 弹窗进出缓动顺滑
5. **深色 dock 对比**：确认蓝圆图标在 `#0F1B3D` 深底上清晰可辨
6. **真机预览**（iOS + Android）：确认 `backdrop-filter` 降级正常
7. **功能回归**：加购、下单、随机选菜、分类拖拽、群组操作、菜谱增删改、图片裁剪、定时器
8. **无障碍**：主色按钮文字对比度 ≥ 4.5:1

## 实施顺序

1. 先改 `app.wxss` 变量 + `app.json`（全局生效，立即可见主色调切换）
2. 处理 tabBar PNG 资源（否则 tab 撕裂）
3. 按页面清理硬编码绿色：group（最重）→ kitchen → order → login → recipe-add → order-confirm → category-manage → crop-image
4. WXML 内联色 + JS confirmColor 替换
5. 叠加动效（stagger/float/badge-pop）与 JS 门控
6. 全量回归验证
