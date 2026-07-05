# 修复厨房分类向上跳转失败问题

## 问题分析

**现象**：点击左侧分类标题，向下跳转正常，向上跳转不工作。

**根因**：`.category-title-header` 设置了 `position: sticky; top: 0;`。当用户向下滚动后，上方分类标题被"粘"在视口顶部。此时通过 `scroll-into-view` 向上跳转时，小程序引擎可能将该元素的视觉位置（sticky 后位于顶部）误判为"已在顶部"，导致不触发滚动或滚动位置错误。

**当前实现回顾**：
- [index.wxml L74](file:///Users/a1/Documents/01Code/WeCt_Xcx/pages/kitchen/index.wxml#L74)：使用 `scroll-into-view="{{scrollIntoViewId}}"`
- [index.js L349-365](file:///Users/a1/Documents/01Code/WeCt_Xcx/pages/kitchen/index.js#L349-L365)：`selectCategory()` 设置 `scrollIntoViewId = 'cat-${categoryId}'`
- [index.wxss L136-145](file:///Users/a1/Documents/01Code/WeCt_Xcx/pages/kitchen/index.wxss#L136-L145)：`.category-title-header` 有 `position: sticky; top: 0;`

## 修复方案

**核心思路**：放弃 `scroll-into-view`，改用 `scroll-top` + `createSelectorQuery` 手动计算目标滚动位置。此方案完全绕过 sticky 干扰，向上向下均可靠工作。

### 修改 1：index.js — data 字段调整

**文件**：[pages/kitchen/index.js](file:///Users/a1/Documents/01Code/WeCt_Xcx/pages/kitchen/index.js)

- 移除 `scrollIntoViewId` 字段
- 新增 `scrollTop: 0` 字段（绑定到 scroll-view 的 scroll-top 属性）
- 新增 `recipeScrollTop: 0` 字段（记录 scroll-view 实时滚动位置，不触发渲染）

```javascript
// data 变更：
scrollIntoViewId: '',  →  删除
// 新增：
scrollTop: 0,
recipeScrollTop: 0,
```

### 修改 2：index.js — 改造 selectCategory()

**文件**：[pages/kitchen/index.js](file:///Users/a1/Documents/01Code/WeCt_Xcx/pages/kitchen/index.js#L349-L365)

将原来的 `scrollIntoViewId` 设置改为通过 `createSelectorQuery` 计算目标位置后设置 `scrollTop`：

```javascript
selectCategory(e) {
  const categoryId = e.currentTarget.dataset.id;
  const activeCategory = this.data.categories.find(c => c.id === categoryId);
  const activeCategoryName = activeCategory ? activeCategory.name : '默认分类';

  this.setData({
    activeCategoryId: categoryId,
    activeCategoryName,
    _isClickScrolling: true
  });

  // 查询目标元素相对于 scroll-view 的位置
  const query = wx.createSelectorQuery().in(this);
  query.select(`#cat-${categoryId}`).boundingClientRect();
  query.select('.recipe-list').boundingClientRect();
  query.exec((res) => {
    if (!res || !res[0] || !res[1]) {
      this.setData({ _isClickScrolling: false });
      return;
    }
    const targetRect = res[0];
    const listRect = res[1];
    // 计算目标元素相对于 scroll-view 可视区域顶部的偏移
    const offset = targetRect.top - listRect.top;
    // 目标 scrollTop = 当前 scrollTop + 偏移
    const targetScrollTop = this.data.recipeScrollTop + offset;

    // 设置 scrollTop，先设为偏移 1px 的值再设为目标值，确保重复点击同一分类也能触发
    this.setData({
      scrollTop: targetScrollTop + 1
    }, () => {
      this.setData({
        scrollTop: targetScrollTop
      });
    });

    setTimeout(() => {
      this.setData({ _isClickScrolling: false });
    }, 500);
  });
}
```

**为什么这样可靠**：
1. `boundingClientRect()` 获取的是元素在视口中的实际位置，不受 sticky 影响（sticky 元素被粘住时，其 boundingClientRect 返回的是粘住后的视觉位置，但因为我们同时查询 scroll-view 的位置做差，差值仍然正确反映偏移）
2. `recipeScrollTop` 记录了用户手动滚动时的实时位置，确保计算基准准确
3. 先 `+1` 再设目标值的技巧解决"相同值不触发"问题

### 修改 3：index.js — onRecipeScroll() 记录实时滚动位置

**文件**：[pages/kitchen/index.js](file:///Users/a1/Documents/01Code/WeCt_Xcx/pages/kitchen/index.js#L367-L378)

在滚动监听中新增 `recipeScrollTop` 更新：

```javascript
onRecipeScroll(e) {
  // 记录当前 scroll-view 的实际滚动位置（不触发渲染，仅存储）
  this.data.recipeScrollTop = e.detail.scrollTop;

  if (this.data._isClickScrolling) return;

  if (this.data._scrollThrottleTimer) {
    clearTimeout(this.data._scrollThrottleTimer);
  }
  this.data._scrollThrottleTimer = setTimeout(() => {
    this._updateActiveCategoryByScroll();
  }, 100);
}
```

**注意**：`recipeScrollTop` 直接赋值给 `this.data` 而不用 `setData`，避免频繁渲染。

### 修改 4：index.wxml — 替换 scroll-into-view 为 scroll-top

**文件**：[pages/kitchen/index.wxml](file:///Users/a1/Documents/01Code/WeCt_Xcx/pages/kitchen/index.wxml#L74)

```xml
<!-- 修改前 -->
<scroll-view class="recipe-list flex-1" scroll-y scroll-with-animation scroll-into-view="{{scrollIntoViewId}}" bindscroll="onRecipeScroll">

<!-- 修改后 -->
<scroll-view class="recipe-list flex-1" scroll-y scroll-with-animation scroll-top="{{scrollTop}}" bindscroll="onRecipeScroll">
```

### 修改 5：index.wxss — 移除 sticky 定位

**文件**：[pages/kitchen/index.wxss](file:///Users/a1/Documents/01Code/WeCt_Xcx/pages/kitchen/index.wxss#L136-L145)

```css
/* 修改前 */
.category-title-header {
  font-size: 28rpx;
  font-weight: bold;
  color: var(--text-main);
  padding: 24rpx 0 12rpx 0;
  position: sticky;
  top: 0;
  background-color: #ffffff;
  z-index: 2;
}

/* 修改后 */
.category-title-header {
  font-size: 28rpx;
  font-weight: bold;
  color: var(--text-main);
  padding: 24rpx 0 12rpx 0;
}
```

移除 sticky 确保 `boundingClientRect()` 返回元素在文档流中的真实位置，避免计算偏差。

## 验证步骤

1. **向下跳转**：点击左侧靠下的分类，右侧应平滑滚动到对应分类标题
2. **向上跳转**：点击左侧靠上的分类，右侧应平滑向上滚动到对应分类标题
3. **重复点击同一分类**：连续点击同一分类，应能重新滚动（不卡住）
4. **滚动联动**：手动上下滚动右侧列表，左侧分类高亮应同步变化
5. **搜索后跳转**：输入搜索词后，点击分类仍能正常跳转
6. **加购功能**：加购按钮、数量调整等不受影响
