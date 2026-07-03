# 菜谱拖动排序与落点指示线

## 概述

在分类管理页"菜品管理"模式下，长按菜谱拖动时，不仅支持移到其他分类，还要支持在同一分类内拖动调整顺序，拖动时显示落点指示线提示精确插入位置。

## 当前状态分析

- `onRecipeLongPress` 查询 `.dish-category-card` 的 rects，仅做分类级命中
- `onRecipeTouchMove` 高亮目标分类卡片，无行级插入位置判断
- `onRecipeTouchEnd` 中拖到同分类直接 return（不处理重排），跨分类调用 `db.updateRecipe({ id, categoryId })` — 此方法有 bug，会重置 price/materials/steps 为空
- recipes 无 sort 字段，数组顺序即展示顺序
- `db.saveRecipes()` 可整体保存，适合重排场景

## 修改方案

### 1. `utils/db.js` — 修复 `updateRecipe` 字段覆盖 bug

**问题**：`updateRecipe({ id, categoryId })` 会把 `price` 重置为 0、`materials/steps` 重置为 `[]`，因为 `parseFloat(updated.price) || 0` 和 `updated.materials || []` 在属性缺失时覆盖原值。

**修复**：用 `!== undefined` 判断后再覆盖，未提供的字段保留原值：
```js
price: updated.price !== undefined ? (parseFloat(updated.price) || 0) : old.price,
hasMaterialStep: updated.hasMaterialStep !== undefined ? !!updated.hasMaterialStep : old.hasMaterialStep,
materials: updated.materials !== undefined ? updated.materials : old.materials,
materialsPublic: updated.materialsPublic !== undefined ? (updated.materialsPublic !== false) : old.materialsPublic,
steps: updated.steps !== undefined ? updated.steps : old.steps,
stepsPublic: updated.stepsPublic !== undefined ? (updated.stepsPublic !== false) : old.stepsPublic
```

### 2. `pages/category-manage/index.js` — 核心拖拽逻辑改造

**A) data 新增字段：**
- `draggingFromIndex` — 被拖菜在源分类中的原索引
- `dropInsertIndex` — 目标分类内的插入位置
- `dropIndicatorY` — 指示线视口 Y 坐标（fixed 定位用）
- `dishRowRects` — `[{ recipeId, categoryId, top, bottom, midY }]`

**B) `_queryCategoryRects` 改为 `_queryDragRects`：**

一次 `exec` 查询三类 rect：
- `.dish-category-card` → 分类卡片 rect（含 `contentTop` = header.bottom，即菜品列表起始 Y）
- `.dish-cat-header` → 用于计算 contentTop
- `.dish-row` → 菜品行 rect（含 `midY`）

`dishRowRects` 的映射：`selectAll` 按 DOM 顺序返回，与 `categoryCards` 的 `wx:for` 外层 + 内层展开顺序一一对应（空分类走 `wx:else` 不渲染 dish-row，不影响映射）。

**C) `onRecipeLongPress` 调整：**
- 记录 `draggingFromIndex`
- 调用 `_queryDragRects()` 替代 `_queryCategoryRects()`

**D) `onRecipeTouchMove` 两级命中：**
1. 第一级：Y 坐标命中目标分类（现有逻辑）
2. 第二级：在目标分类内逐行比较 `touchY` 与 `midY`：
   - `touchY < targetRows[i].midY` → 插到第 i 行之前，`indicatorY = targetRows[i].top`
   - 超过最后一行 midY → 插到末尾，`indicatorY = lastRow.bottom`
   - 空分类 → `insertIndex=0`，`indicatorY = contentTop`
- 仅在落点变化时才 setData 指示线字段（减少渲染开销）

**E) `onRecipeTouchEnd` 内存重排：**
1. 深拷贝 `categoryCards`
2. 从源分类移除被拖菜（`splice(fromIndex, 1)`）
3. 修正插入索引：同分类且 `fromIndex < dropInsertIndex` 时 `actualInsertIndex = dropInsertIndex - 1`
4. 同分类原位（`actualInsertIndex === fromIndex`）→ 直接 return，不保存
5. 插入目标分类（`splice(actualInsertIndex, 0, moved)`）
6. 映射回完整 recipes 数组：从 `db.getRecipes()` 取完整对象，按 `newCards` 顺序重组，`categoryId` 随目标卡片更新
7. 调用 `db.saveRecipes(newRecipes)` 整体保存（绕开 `updateRecipe` bug）
8. `loadData()` 刷新，toast 区分"已调整顺序"/"已移至分类"

### 3. `pages/category-manage/index.wxml` — 新增 fixed 指示线

在末尾与 `.drag-float` 同级新增：
```xml
<view class="drop-indicator-line"
  wx:if="{{draggingRecipe && dragHighlightId && dropIndicatorY > 0}}"
  style="top: {{dropIndicatorY}}px;"
></view>
```

**为什么用 fixed 而非 DOM 流占位线**：DOM 流指示线会撑高布局，导致后续行 `top/bottom` 偏移、预计算 rects 失效。fixed 定位不占文档流，拖动期间 `catchtouchmove` 阻止了 scroll-view 滚动，布局稳定，坐标可靠。

### 4. `pages/category-manage/index.wxss` — 指示线样式

主色横线 + 两端圆点，`pointer-events: none`，`z-index: 9998`（低于 `.drag-float` 的 9999）。

### 5. 提示文案更新

`dish-tip` 从"长按菜品可拖动到其他分类"改为"长按菜品可拖动排序或移动到其他分类"。

## 设计决策

| 决策 | 理由 |
|------|------|
| fixed 指示线而非 DOM 流占位线 | DOM 流会撑高布局导致预计算 rects 失效；fixed 不占文档流，坐标稳定 |
| 用 `saveRecipes` 整体保存而非 `updateRecipe` | 绕开 updateRecipe 字段覆盖 bug；重排需要改顺序而非单条更新 |
| 从 `db.getRecipes()` 取完整对象重组 | `categoryCards.recipes` 只有部分字段，直接保存会丢失 materials/steps/desc |
| midY 法判定插入位置 | 标准列表拖排算法，对行高不均也适用 |
| 一次 exec 查询三类 rect | 减少 API 调用次数；保证三类 rect 在同一帧快照 |

## 边界情况

| 场景 | 处理 |
|------|------|
| 拖到原分类原位置 | `actualInsertIndex === fromIndex` → return，不保存不 toast |
| 拖到空白区 | `dragHighlightId` 为空 → return |
| 拖到空分类 | `insertIndex=0`，指示线落在 contentTop |
| 同分类索引修正 | 移除源行后 `fromIndex < dropInsertIndex` 时 `actualInsertIndex - 1` |
| 跨分类移动 | 无需修正索引，categoryId 随目标卡片更新 |

## 验证步骤

1. 同分类内上下拖动 → 顺序变化，指示线跟随手指位置
2. 跨分类拖动 → 移动到目标分类的指定位置，指示线提示插入点
3. 拖到空分类 → 指示线显示在分类 header 下方
4. 拖到原位松手 → 无变化无 toast
5. 拖到空白区松手 → 无变化无 toast
6. 拖动后菜谱的 price/materials/steps/desc 等字段完整保留
7. 退出重进页面 → 排序持久化
8. kitchen 页菜谱列表顺序与分类管理页一致
9. kitchen 页"移动到分类"功能不再丢失菜谱数据（updateRecipe bug 修复后）
