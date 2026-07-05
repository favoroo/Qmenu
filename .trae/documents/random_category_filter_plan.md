# "随机吃什么"分类筛选优化方案

## 一、项目调研结论

### 现有实现分析
- **功能位置**：[index.js](file:///Users/a1/Documents/01Code/WeCt_Xcx/pages/kitchen/index.js) 第377-533行，[index.wxml](file:///Users/a1/Documents/01Code/WeCt_Xcx/pages/kitchen/index.wxml) 第191-232行，[index.wxss](file:///Users/a1/Documents/01Code/WeCt_Xcx/pages/kitchen/index.wxss) 第573-792行
- **当前逻辑**：点击🎲浮动按钮 → 弹出随机选择弹窗 → 可选1-4个菜品数量 → 点击"帮我选"从**所有启用状态的菜谱**（`status === 1`）中随机抽取
- **数据结构**：
  - `categories[]`: `{ id, name, ... }` - 菜谱分类列表
  - `recipes[]`: `{ id, name, categoryId, status, image, price, ... }` - 菜谱列表，通过 `categoryId` 关联分类

### 优化目标
在随机弹窗中增加分类筛选功能，用户可以选择从哪些分类中随机抽取菜品，默认选中所有分类。

---

## 二、需要修改的文件

| 文件 | 修改内容 |
|------|---------|
| `pages/kitchen/index.js` | 添加分类筛选状态数据、处理函数、修改随机逻辑 |
| `pages/kitchen/index.wxml` | 在随机弹窗中添加分类多选UI区域 |
| `pages/kitchen/index.wxss` | 添加分类选择标签的样式 |

---

## 三、具体修改步骤

### 步骤1：修改 JS 逻辑 (pages/kitchen/index.js)

1. **在 data 中新增状态变量**：
   - `randomSelectedCategoryIds`: `[]` - 存储用户选中的分类ID列表

2. **修改 `openRandomModal()` 方法**：
   - 打开弹窗时，默认将所有分类ID放入 `randomSelectedCategoryIds`（全选）
   - 仅从选中分类的启用菜谱中判断是否有可用菜品

3. **新增 `toggleRandomCategory(e)` 方法**：
   - 切换单个分类的选中/取消选中状态
   - 处理分类ID数组的增删

4. **新增 `toggleAllRandomCategories()` 方法**：
   - 一键全选/取消全选所有分类
   - 至少保留一个分类选中（避免无菜品可选）

5. **修改 `startRandomRoll()` 方法**：
   - 从 `activeRecipes` 中根据 `randomSelectedCategoryIds` 过滤出符合分类条件的菜谱
   - 使用过滤后的菜谱池进行随机抽取
   - 如果选中分类下没有菜谱，给出提示

6. **新增辅助函数 `getRandomPool()`**：
   - 统一获取当前选中分类下的启用菜谱池
   - 供 `openRandomModal` 和 `startRandomRoll` 共用

### 步骤2：修改 WXML 模板 (pages/kitchen/index.wxml)

在随机弹窗中"选择菜数"区域之后、滚动动画区域之前，添加分类筛选区域：

1. **分类筛选标题行**：
   - 标签："选择分类："
   - 右侧"全选/取消全选"按钮，根据当前选中状态动态切换文字

2. **分类标签多选区域**：
   - 使用 flex-wrap 横向排列所有分类标签
   - 选中态：蓝色背景、白色文字（与现有 selector-option.active 风格一致）
   - 未选中态：浅灰背景、灰色文字
   - 每个标签点击触发 `toggleRandomCategory`
   - 标签样式为圆角胶囊形

3. **显示当前选中分类下的菜品数量**：
   - 如："共 X 个菜品可选"，方便用户了解选择范围

### 步骤3：修改 WXSS 样式 (pages/kitchen/index.wxss)

1. 新增分类筛选区域的容器样式
2. 新增分类标签（chip）的基础样式、选中样式
3. 新增"全选"按钮的样式
4. 新增菜品数量提示文字的样式
5. 调整弹窗内各区块的间距，保持视觉协调性

---

## 四、依赖与注意事项

- **无新增依赖**：使用现有项目的样式变量（`--primary-color`、`--text-main`、`--bg-light` 等）
- **默认行为不变**：弹窗打开时默认全选所有分类，与现有体验保持一致
- **边界处理**：
  - 用户取消所有分类时，自动回退到至少保留1个（或提示必须选一个）
  - 选中分类下没有启用菜品时，"帮我选"按钮置灰并提示
  - 分类列表可能为空的情况（虽然实际使用中分类很少为空）
- **滚动中的锁定**：分类选择在滚动动画进行中（`isRolling === true`）时不可操作
- **关闭弹窗重置**：关闭弹窗时分类选择状态保持（下次打开记住上次选择），还是重置为全选？→ 建议**重置为全选**，符合"随机"的直觉，减少用户决策负担

---

## 五、风险与处理

| 风险 | 处理方式 |
|------|---------|
| 分类过多导致标签区域过高，挤压动画区域 | 标签区域设置 `max-height` + `scroll-y`，过多时可滚动 |
| 选中分类下菜品数量少于要抽取的数量 | 自动按实际可用数量抽取，不报错；按钮文字动态调整 |
| 分类名称过长导致标签溢出 | 使用 `text-ellipsis` 或设置最大宽度 |
