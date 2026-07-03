# 长按菜谱增加"移动到分类"功能

## 概述

在厨房页面的长按菜谱卡片菜单中，新增"移动到分类"选项，允许管理员将菜谱移动到其他分类。交互流程：长按 -> ActionSheet（编辑菜谱 / 移动到分类）-> 分类选择弹窗 -> 选择目标分类 -> 二次确认 -> 更新数据 -> 刷新列表。

## 当前状态分析

- 长按事件 `onRecipeLongPress` 已存在于 `pages/kitchen/index.js` 第312行，当前只弹出 `['编辑菜谱']` 选项
- 数据层 `db.js` 已有 `updateRecipe({ id, categoryId })` 方法，使用展开运算符合并，只传 id 和 categoryId 不会影响其他字段
- `data` 中已有 `categories` 数组和 `isAdmin` 标识
- 项目中已有自定义 Modal 弹窗模式（随机选菜、菜谱详情），新建弹窗应保持风格一致

## 修改方案

### 1. `pages/kitchen/index.js`

**A) data 新增字段（第36行 `formattedTimeLeft` 之后）：**
```js
showMoveCategoryModal: false,
movingRecipe: null,
```

**B) 修改 `onRecipeLongPress` 方法（第312-331行）：**
- `itemList` 从 `['编辑菜谱']` 改为 `['编辑菜谱', '移动到分类']`
- `tapIndex === 1` 时设置 `movingRecipe` 并打开分类选择弹窗

**C) 新增3个方法（放在 `onRecipeLongPress` 之后）：**
- `closeMoveCategoryModal()` — 关闭弹窗并清空 `movingRecipe`
- `onMoveCategorySelect(e)` — 处理分类选择：
  - 若选当前分类，toast 提示"已在该分类中"后关闭
  - 否则弹出 `wx.showModal` 二次确认
  - 确认后调用 `db.updateRecipe({ id, categoryId })` → `loadData()` 刷新

### 2. `pages/kitchen/index.wxml`

在菜谱详情弹窗（第7部分）之后、`</view>` 闭合标签之前，新增：

```xml
<!-- 8. Move to Category Modal -->
<view class="modal-overlay" wx:if="{{showMoveCategoryModal}}" bindtap="closeMoveCategoryModal"></view>
<view class="move-category-modal-card" wx:if="{{showMoveCategoryModal}}">
  <view class="modal-close" bindtap="closeMoveCategoryModal">×</view>
  <view class="modal-title">移动到分类</view>
  <block wx:if="{{movingRecipe}}">
    <view class="move-recipe-hint flex-row align-center">
      <image class="move-recipe-image" src="{{movingRecipe.image || '/assets/images/default_food.png'}}" mode="aspectFill"></image>
      <text class="move-recipe-name">{{movingRecipe.name}}</text>
    </view>
  </block>
  <scroll-view class="move-category-list" scroll-y>
    <view
      class="move-category-item {{movingRecipe && movingRecipe.categoryId === item.id ? 'current' : ''}}"
      wx:for="{{categories}}"
      wx:key="id"
      bindtap="onMoveCategorySelect"
      data-id="{{item.id}}"
    >
      <text class="move-category-name">{{item.name}}</text>
      <text class="move-category-current-badge" wx:if="{{movingRecipe && movingRecipe.categoryId === item.id}}">当前</text>
    </view>
  </scroll-view>
</view>
```

### 3. `pages/kitchen/index.wxss`

在文件末尾追加移动分类弹窗样式，包括：
- `.move-category-modal-card` — 居中卡片弹窗（与随机选菜弹窗风格一致）
- `.move-recipe-hint` — 顶部菜谱缩略信息区（小图+名称）
- `.move-category-list` — 分类列表容器
- `.move-category-item` / `.move-category-item.current` — 分类项样式，当前分类高亮
- `.move-category-current-badge` — "当前"标记
- `@keyframes scale-in` + `.scale-in` — 弹窗缩放进入动画（项目中尚无此动画定义）

## 设计决策

| 决策 | 理由 |
|------|------|
| 自定义弹窗而非 `wx.showActionSheet` 选分类 | 可展示菜谱上下文、高亮当前分类、自定义样式，与项目已有弹窗风格一致 |
| 二次确认 `wx.showModal` | 移动分类不可逆（虽可再次移动），防止误触 |
| 使用 `loadData()` 而非局部更新 | 确保 categories 和 recipes 都从 db 重新加载，数据一致性更好 |
| 不修改 `db.js` | `updateRecipe` 展开合并机制安全，只传 `{id, categoryId}` 不影响其余字段 |

## 验证步骤

1. 长按菜谱卡片 -> ActionSheet 显示"编辑菜谱"和"移动到分类"
2. 点击"移动到分类" -> 弹窗显示菜谱名称和所有分类列表
3. 当前分类高亮且带"当前"标记
4. 选择当前分类 -> toast"已在该分类中"
5. 选择其他分类 -> 确认弹窗 -> 确认后菜谱从原分类消失、目标分类中出现
6. 移动后菜谱详情中的分类标签也正确更新
7. 非管理员模式下长按无反应
