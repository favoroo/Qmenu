# 分类管理页面优化：菜品展示 + 删除 + 跨分类拖拽

## 需求概述

1. **展示菜品**：每个分类下简略显示菜品（名称 + 价格）
2. **删除菜品**：可在此界面直接删除菜品
3. **跨分类拖拽**：长按菜品拖动到其他分类

**已确认方案：模式切换** — 添加「菜品管理」/「分类排序」顶部切换按钮。菜品管理模式（默认）展示分类卡片 + 菜品列表 + 拖拽移菜；分类排序模式保留现有 movable-area 拖拽排序不改动。

## 当前状态分析

### 涉及文件

| 文件 | 路径 | 修改程度 |
|------|------|----------|
| 逻辑 | `pages/category-manage/index.js` (163行) | 大改 — 新增模式切换 + 菜品加载 + 删除 + 拖拽 7 个方法 |
| 模板 | `pages/category-manage/index.wxml` (64行) | 大改 — 顶部 Tabs + 菜品管理 UI + wx:if 包裹排序模式 + 浮动元素 |
| 样式 | `pages/category-manage/index.wxss` (126行) | 追加 — Tabs、菜品卡片、菜品行、浮动元素、高亮样式 |
| 数据层 | `utils/db.js` (350行) | **无需修改** — `getRecipes`/`updateRecipe`/`deleteRecipe` 已就绪 |

### 数据模型（已有，无需改动）
- 菜品: `{ id, name, categoryId, price, image, desc, status, ... }`
- `db.updateRecipe({id, categoryId})` — 浅合并，仅传 id+categoryId 不丢字段
- `db.deleteRecipe(id)` — 删除菜品并同步清购物车
- `db.getRecipes()` — 返回所有菜品数组

## 技术方案

### 页面架构
```
container
├── 顶部模式切换 Tabs（新增）
├── wx:if mode==='dish' → 菜品管理模式（新增）
│   └── scroll-view
│       └── wx:for categoryCards → 分类卡片
│           ├── 分类标题（名称 + 菜品数 + 默认标签）
│           └── 菜品行列表（拖拽手柄 + 名称 + 价格 + 删除按钮）
├── wx:if mode==='sort' → 分类排序模式（保留现有 movable-area）
│   ├── 添加分类表单（保留）
│   └── movable-area 拖拽列表（保留）
└── 浮动拖拽元素（新增，position:fixed，仅拖拽时显示）
```

### 长按拖拽跨分类事件流
```
longpress → onRecipeLongPress（震动 + 记录菜品 + 预计算卡片位置）
touchmove → onRecipeTouchMove（catch拦截滚动 + 浮动跟随 + Y坐标命中判断高亮）
touchend  → onRecipeTouchEnd（重置拖拽态 + db.updateRecipe 移动 + loadData刷新）
```

**关键决策：**
- 用 `catchtouchmove`（非 bind）阻止 scroll-view 滚动，保证拖拽期间预计算的卡片视口坐标稳定有效
- 用 `wx.createSelectorQuery().selectAll('.dish-category-card').boundingClientRect()` 预计算所有分类卡片位置，touchmove 时仅做 Y 坐标比较
- 浮动元素 `position:fixed` + `pointer-events:none`（不拦截 touch 事件）+ `transform:translate(-50%,-120%)`（浮在手指上方避免遮挡）
- 删除按钮用 `catchtap` 阻止冒泡，避免误触拖拽

## 实施步骤

### 步骤 1：修改 index.js — data 字段

新增字段（保留所有现有字段）：
- `mode: 'dish'` — 当前模式
- `categoryCards: []` — 菜品管理模式的卡片数据 `[{ id, name, sort, isDefault, recipes: [...] }]`
- `draggingRecipe: null` — 正在拖拽的菜品对象
- `draggingFromCategoryId: ''` — 源分类 id
- `dragFloatX/Y: 0` — 浮动元素位置
- `dragHighlightId: ''` — 高亮目标分类 id
- `categoryRects: []` — 预计算卡片位置 `[{ id, top, bottom }]`

### 步骤 2：修改 index.js — 数据加载

- 新增 `loadData()` — 统一加载分类+菜品，组装 `categoryCards`（按 categoryId 过滤菜品归入各分类）
- `onShow` 改调 `loadData()`
- `handleAddCategory`、`handleDeleteCategory`、`onDragEnd` 中 `loadCategories()` 全部改调 `loadData()`
- 原 `loadCategories` 逻辑并入 `loadData`

### 步骤 3：修改 index.js — 新增方法

- `switchMode(e)` — 模式切换，切到 sort 时重新测量行高
- `handleDeleteRecipe(e)` — wx.showModal 二次确认 + `db.deleteRecipe` + `loadData`
- `onRecipeLongPress(e)` — 震动 + 记录拖拽菜品 + 初始位置 + 调 `_queryCategoryRects`
- `_queryCategoryRects()` — SelectorQuery 查询所有 `.dish-category-card` 位置存入 `categoryRects`
- `onRecipeTouchMove(e)` — 更新浮动位置 + Y 坐标命中判断高亮（仅 hitId 变化时 setData）
- `onRecipeTouchEnd(e)` — 重置拖拽态 + 若合法目标则 `db.updateRecipe({id, categoryId})` + `loadData` + Toast

### 步骤 4：修改 index.wxml — 页面结构

- 顶部新增 `.mode-tabs`（两个 `.mode-tab`，`{{mode === 'dish' ? 'active' : ''}}`）
- `wx:if="{{mode === 'dish'}}"` 菜品管理模式：
  - 提示文字「长按菜品可拖动到其他分类」
  - `scroll-view` 内 `wx:for="{{categoryCards}}"` 渲染分类卡片
  - 卡片含分类标题（名称+数量badge+默认标签）+ 菜品行列表
  - 菜品行：拖拽手柄 + 名称 + 价格 + 删除按钮，绑定 `bindlongpress` + `catchtouchmove` + `catchtouchend`
  - 空分类显示「该分类暂无菜品」
- `wx:if="{{mode === 'sort'}}"` 分类排序模式：原样保留添加表单 + movable-area
- 浮动元素 `.drag-float`：`wx:if="{{draggingRecipe}}"`，`style="left:{{dragFloatX}}px;top:{{dragFloatY}}px"`，显示菜品名+价格

### 步骤 5：修改 index.wxss — 追加样式

保留所有现有样式，文件末尾追加：
- `.mode-tabs` / `.mode-tab` / `.mode-tab.active` — Tabs 切换栏
- `.dish-scroll` — scroll-view 高度 `calc(100vh - 220rpx)`
- `.dish-category-card` / `.drop-target` — 分类卡片 + 拖拽落点高亮（主色边框+浅绿背景）
- `.dish-cat-header` / `.dish-cat-name` / `.dish-count-badge` — 分类标题
- `.dish-row` / `.dish-row.dragging` — 菜品行 + 被拖半透明占位
- `.dish-grip` / `.dish-grip-bar` — 三条横线拖拽手柄
- `.dish-name` / `.dish-price` / `.dish-delete-btn` — 菜品名/价格/删除按钮
- `.dish-empty` — 空分类提示
- `.drag-float` — 浮动拖拽元素（fixed + 主色背景 + 阴影 + pointer-events:none）

## 边界情况处理

| 场景 | 处理方式 |
|------|----------|
| 拖到原分类 | touchend 直接 return，不调用 db |
| 拖到空白区 | dragHighlightId 为空，菜品留原位 |
| 分类下无菜品 | 显示「该分类暂无菜品」占位 |
| 长按误触删除按钮 | 删除按钮 catchtap 阻止冒泡，longpress 需 ~350ms 静止 |
| 模式切换时拖拽中 | catch 拦截使 tab 不可点，自然避免 |
| catchtouchmove 阻止滚动 | 菜品行间空隙、卡片标题区仍可滚动；属拖拽交互通用折中 |

## 验证步骤

1. 进入页面默认显示菜品管理模式，各分类下显示菜品列表（名称+价格）
2. 点击「分类排序」tab → 切换到拖拽排序模式，原 movable-area 功能正常
3. 点击「菜品管理」tab → 切回，菜品列表正常
4. 点击菜品删除按钮 → 确认弹窗 → 确认后菜品消失
5. 长按菜品 → 震动 + 浮动元素出现跟随手指
6. 拖动到其他分类 → 目标卡片高亮 → 松手 → 菜品移至目标分类 + Toast 提示
7. 拖动到原分类 → 无变化
8. 拖动到空白区 → 菜品留原位
9. 空分类显示「该分类暂无菜品」
10. 退出页面再进入 → 数据保持一致
