# 厨房板块分类滚动交互优化计划

## 一、现状分析

当前厨房页面采用"分类过滤"模式：
- 左侧分类侧边栏：点击分类后，右侧**仅显示该分类**下的菜谱
- 右侧菜谱列表：根据 `activeCategoryId` 过滤显示单个分类内容
- 核心过滤逻辑在 `filterRecipes()` 函数中，通过 `r.categoryId === activeCategoryId` 进行筛选

涉及文件：
- [index.js](file:///Users/a1/Documents/01Code/WeCt_Xcx/pages/kitchen/index.js) — 页面逻辑
- [index.wxml](file:///Users/a1/Documents/01Code/WeCt_Xcx/pages/kitchen/index.wxml) — 页面结构
- [index.wxss](file:///Users/a1/Documents/01Code/WeCt_Xcx/pages/kitchen/index.wxss) — 页面样式

## 二、优化目标

改为"锚点跳转"模式（类似外卖APP菜单交互）：
1. **右侧列表展示所有分类的菜谱**，按分类分组排列
2. **左侧分类点击后**，右侧滚动到对应分类的位置
3. **右侧滚动时**，左侧自动高亮当前可见的分类（双向联动）

## 三、具体修改方案

### 3.1 数据层改造 (index.js)

**新增数据字段：**
- `groupedRecipes`: 按分类分组的菜谱数组，结构为 `[{ categoryId, categoryName, recipes: [...] }, ...]`
- `scrollIntoViewId`: 右侧 scroll-view 要滚动到的锚点 id
- 保留 `activeCategoryId` 用于左侧高亮显示

**修改 `loadData()` 函数：**
- 新增 `buildGroupedRecipes()` 方法，将所有菜谱按 `categoryId` 分组
- 每个分类组包含：分类信息 + 该分类下的菜谱列表（status=1）
- 分类顺序与左侧 `categories` 保持一致

**修改 `filterRecipes()` 函数：**
- 搜索时：在所有菜谱中搜索，匹配的菜谱仍然按分类分组展示
- 无搜索时：直接展示全部分组数据
- 移除按 `activeCategoryId` 过滤的逻辑

**改造 `selectCategory()` 函数：**
- 不再触发过滤，而是设置 `scrollIntoViewId` 为对应分类的锚点 id
- 保持 `activeCategoryId` 更新以高亮左侧

**新增右侧滚动监听 `onRecipeScroll()`：**
- 监听右侧 scroll-view 的滚动事件
- 通过 `wx.createSelectorQuery()` 获取各分类标题的位置
- 判断当前哪个分类在可视区域顶部，更新 `activeCategoryId` 实现左侧联动高亮
- 需要做节流处理，避免频繁计算

### 3.2 结构层改造 (index.wxml)

**右侧 scroll-view 修改：**
- 添加 `scroll-into-view="{{scrollIntoViewId}}"` 属性
- 添加 `bindscroll="onRecipeScroll"` 监听滚动
- 启用 `scroll-with-animation` 平滑滚动

**菜谱列表结构改造：**
- 将单个分类标题 + 菜谱列表的结构
- 改为 `wx:for` 遍历 `groupedRecipes`，每个分类组包含：
  - 分类标题（带 id 作为锚点，如 `cat-{{item.categoryId}}`）
  - 该分类下的菜谱卡片列表

**空状态调整：**
- 从"该分类下没有菜谱"改为"暂无菜谱"

**底部"添加菜谱"按钮：**
- 移到所有分组之后，保持在列表最底部

### 3.3 样式层改造 (index.wxss)

- 调整 `.category-title-header` 样式，增加吸顶效果（可选，sticky positioning）
- 确保每个分类组之间有适当的间距区分
- 左侧分类高亮样式保持不变

### 3.4 其他受影响的功能点

**搜索功能：**
- 搜索框输入后，仍然过滤菜谱，但按分组形式展示
- 搜索结果中，空的分类组可以隐藏不显示

**添加菜谱页面跳转：**
- `goRecipeAdd()` 当前传入 `activeCategoryId`，逻辑可保持不变

**随机选菜（Panda 按钮）：**
- 随机选菜逻辑不受影响，仍然从所有菜谱池中选择

**管理功能（长按移动分类等）：**
- 菜谱卡片的长按菜单、编辑、移动等功能不受影响

## 四、实施步骤

1. **数据层改造**：在 `index.js` 中新增 `buildGroupedRecipes()` 方法，修改 `loadData()` 和 `filterRecipes()`
2. **左侧点击跳转**：改造 `selectCategory()`，使用 `scroll-into-view` 实现锚点滚动
3. **WXML 结构改造**：将右侧列表改为分组渲染，添加锚点 id
4. **右侧滚动联动**：实现 `onRecipeScroll()` 监听和分类高亮计算
5. **搜索适配**：确保搜索状态下分组展示正常
6. **样式微调**：调整分类标题样式和间距
7. **测试验证**：验证分类跳转、滚动联动、搜索、加购等功能正常

## 五、风险与注意事项

1. **滚动联动性能**：滚动事件触发频繁，需节流（建议 100ms 间隔），避免卡顿
2. **锚点计算精度**：小程序中 `createSelectorQuery` 获取元素位置可能有延迟，需在数据渲染完成后再计算
3. **搜索状态下的滚动联动**：搜索结果分类数量变化时，锚点映射需要重新计算
4. **空分类处理**：无菜谱的分类是否显示？建议显示分类标题 + "暂无菜品"提示，保持左侧分类完整性
5. **兼容性**：`scroll-into-view` 在各版本小程序中支持良好，但需测试确认
