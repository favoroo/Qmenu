# 分类管理页面改造：移除排序权重数字 + 长按拖动排序

## 需求概述

1. **移除排序权重数字输入框**：添加分类表单中不再显示 "排序" 数字输入框（红箭头指向的那个 `10`），新增分类自动排在列表末尾。
2. **替换箭头排序为长按拖动排序**：分类列表移除上下箭头按钮和排序权重数字标识，改为长按拖动排序交互（类似 iOS 长按列表重排）。

## 当前状态分析

### 涉及文件

| 文件 | 路径 | 行数 | 说明 |
|------|------|------|------|
| 模板 | `pages/category-manage/index.wxml` | 66 | 含排序输入框 (13-20行)、排序权重标识 (35行)、上下箭头 (41-51行) |
| 样式 | `pages/category-manage/index.wxss` | 168 | 含 `.sort-input`、`.cat-sort-badge`、`.sorter-btn` 及箭头伪元素 |
| 逻辑 | `pages/category-manage/index.js` | 134 | 含 `newCatSort: '10'`、`onSortInput`、`moveUp`、`moveDown` |
| 数据层 | `utils/db.js` | 350 | `addCategory(name, sort=10)` 已支持传入 sort，**无需修改** |

### 数据模型（保持不变）
```js
{ id: 'cat_default', name: '默认分类', sort: 1 }
```
`getCategories()` 按 `sort` 升序排列，`saveCategories(list)` 整体覆盖保存。

## 技术方案

**选择 `movable-area` + `movable-view`**（微信小程序官方组件），原因：
- 分类数量有限（通常个位数），不需要 `scroll-view` 嵌套
- 官方组件兼容性好，代码量少于自定义 touch 事件方案
- 项目基础库 `2.30.0` 完全支持

## 实施步骤

### 步骤 1：修改 JS 逻辑 (`pages/category-manage/index.js`)

#### 1.1 修改 data 初始状态
- 移除 `newCatSort: '10'`
- 新增 `dragList: []`（拖拽视图数据，附加 y 坐标）、`moveId: null`（正在拖动的项索引）、`itemHeight: 0`（每项高度 px）

#### 1.2 删除 `onSortInput` 方法（第 25-27 行）

#### 1.3 修改 `handleAddCategory`
- 排序权重改为自动计算：`sortNum = max(list.map(c => c.sort || 0)) + 1`
- 重置表单时不再重置 `newCatSort`

#### 1.4 删除 `moveUp` 和 `moveDown` 方法（第 94-133 行）

#### 1.5 新增拖拽排序方法
- `initDragList()` — 根据 `categories` 和 `itemHeight` 初始化每项的 y 坐标
- `onDragChange(e)` — 拖动中记录 `moveId` 和当前 y 坐标
- `onDragEnd()` — 拖动结束后按 y 坐标排序，重新分配 sort 值 (1, 2, 3...)，保存到 DB
  - **关键**：拖动距离 < 5px 视为点击，不执行排序（避免与删除按钮 tap 冲突）
- `onReady()` — 通过 `wx.createSelectorQuery` 获取 `.category-row` 高度

#### 1.6 修改 `loadCategories`
- 加载数据后调用 `this.initDragList()` 初始化拖拽坐标

### 步骤 2：修改 WXML 模板 (`pages/category-manage/index.wxml`)

#### 2.1 移除排序输入框
- 删除第 13-20 行的 `<input class="form-input sort-input" .../>`

#### 2.2 替换列表结构
- 将 `<view class="categories-list">` 替换为 `<movable-area class="categories-drag-area">`
- 每个 `<view class="category-row">` 替换为 `<movable-view>`，设置 `direction="vertical"`、`damping="40"`
- 用 `bindchange="onDragChange"` + `bindtouchend="onDragEnd"` 监听拖动
- 被拖动项通过 `z-index` 提升层级

#### 2.3 视觉调整
- 移除排序权重数字标识 `<text class="cat-sort-badge">{{item.sort || 0}}</text>`
- 移除上下箭头按钮
- 新增拖拽手柄图标（三条横线 ≡），放在分类名左侧作为视觉提示
- 将 "排序权重越小越靠前" 提示文字改为 "长按拖动可调整顺序"
- 删除按钮保留，使用 `catchtap="handleDeleteCategory"` 阻止冒泡

### 步骤 3：修改 WXSS 样式 (`pages/category-manage/index.wxss`)

#### 3.1 删除旧样式
- `.sort-input`（第 30-35 行）
- `.cat-sort-badge`（第 69-79 行）
- `.sorter-btn` 及全部箭头相关伪元素（第 101-144 行）

#### 3.2 新增拖拽样式
- `.categories-drag-area` — 拖拽容器，`position: relative; overflow: hidden`
- `.category-row` — 适配 `movable-view` 绝对定位
- `.drag-handle` / `.drag-handle-bar` — 三条横线拖拽手柄

## 边界情况处理

| 场景 | 处理方式 |
|------|----------|
| 点击 vs 拖动区分 | `onDragEnd` 中判断拖动距离 < 5px 则不执行排序 |
| 删除按钮点击被拖动吞掉 | 使用 `catchtap` 阻止冒泡；若仍失效，备选方案为弹窗删除 |
| `itemHeight` 未获取到 | `initDragList` 在 `itemHeight > 0 && categories.length > 0` 时才执行 |
| 列表为空 | `movable-area` 高度设为 0，不渲染内容 |
| 默认分类拖动 | 允许拖动重排（仅删除按钮禁用） |
| 分类名折行导致高度不一致 | 当前统一 `itemHeight` 足够；若未来支持长名称需改为动态计算 |

## 验证步骤

1. 添加分类（不填权重）→ 新分类出现在列表末尾，sort 值为 max+1
2. 长按拖动分类项到新位置 → 松手后列表顺序更新，sort 值重新分配
3. 轻触（不拖动）→ 不触发排序
4. 点击删除按钮 → 非默认分类正常删除，默认分类按钮禁用
5. 退出页面再进入 → 排序保持
6. 拖拽手柄三条横线视觉清晰可见
