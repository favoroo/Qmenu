# 菜单管理界面功能增强优化方案

## 一、现有代码分析

### 1.1 当前功能
菜单管理页面位于 [pages/category-manage/index.js](file:///Users/a1/Documents/01Code/WeCt_Xcx/pages/category-manage/index.js)，目前支持：
- 添加分类、删除分类（默认分类不可删）
- 分类长按拖拽排序
- 菜品长按拖拽排序、拖拽移动到其他分类
- 删除菜品（带确认弹窗）
- 分组显示菜品，每个分类显示菜品数量

### 1.2 已有可复用模块
- 菜谱添加/编辑页面已存在：[pages/recipe-add/index.js](file:///Users/a1/Documents/01Code/WeCt_Xcx/pages/recipe-add/index.js)
  - 支持新建菜谱（onLoad 无 id 参数）
  - 支持编辑菜谱（onLoad 传入 id 参数）
  - 支持预选分类（onLoad 传入 categoryId 参数）
  - 功能完整：图片上传裁剪、名称、价格、描述、用料做法等
- 数据库层 [utils/db.js](file:///Users/a1/Documents/01Code/WeCt_Xcx/utils/db.js) 已提供 `addRecipe`、`updateRecipe`、`deleteRecipe` 等完整 CRUD 方法

### 1.3 当前缺失
- ❌ 菜品缩略图预览（数据层已有 image 字段，但界面未展示）
- ❌ 编辑菜品按钮（无法从管理页直接进入编辑）
- ❌ 新建菜品入口（管理页无法直接跳转到添加页）
- ❌ 分类内快速添加菜品按钮

---

## 二、优化目标

增强菜单管理界面的功能丰富度，实现：
1. **新建菜谱**：在管理页提供新建入口，支持全局新建和分类内快速新建
2. **预览图**：每个菜品行显示缩略图预览
3. **编辑按钮**：每个菜品行增加编辑按钮，点击跳转到编辑页
4. 保持现有拖拽排序、移动分类、删除等功能正常工作
5. 界面美观、交互流畅

---

## 三、修改文件清单

| 文件 | 修改类型 | 修改内容 |
|------|---------|---------|
| [pages/category-manage/index.wxml](file:///Users/a1/Documents/01Code/WeCt_Xcx/pages/category-manage/index.wxml) | 修改 | 调整菜品行布局，添加缩略图、编辑按钮；添加分类内"添加菜品"按钮；添加悬浮新建按钮 |
| [pages/category-manage/index.js](file:///Users/a1/Documents/01Code/WeCt_Xcx/pages/category-manage/index.js) | 修改 | 添加跳转到新建菜谱、编辑菜谱的事件处理函数；确保 loadData 返回完整 recipe 数据 |
| [pages/category-manage/index.wxss](file:///Users/a1/Documents/01Code/WeCt_Xcx/pages/category-manage/index.wxss) | 修改 | 新增缩略图样式、编辑按钮样式、分类内添加按钮样式、悬浮按钮样式；调整菜品行布局 |

---

## 四、详细实施步骤

### 步骤 1：修改 index.wxml 模板结构

#### 1.1 重构菜品行（dish-row）
- 在 `dish-grip`（拖拽把手）后面添加菜品缩略图 `<image>` 组件
- 菜品名称后面保持价格显示
- 价格后面依次添加"编辑"按钮和"删除"按钮
- 调整布局为：拖拽把手 → 缩略图 → 菜名（flex-1）→ 价格 → 编辑 → 删除

#### 1.2 在每个分类卡片底部添加"添加菜品"按钮
- 在分类的菜品列表后面、`dish-empty` 区域附近，添加一个"添加菜品到该分类"按钮
- 空分类时该按钮更明显，非空分类时作为底部操作

#### 1.3 添加页面右下角悬浮"新建菜品"按钮
- 使用 fixed 定位在页面右下角，蓝色圆形/圆角按钮，带 "+" 图标和"新建菜品"文字

### 步骤 2：修改 index.js 逻辑

#### 2.1 确认 loadData 返回完整数据
- 当前 loadData 映射 recipe 时已包含 `image: r.image`，无需额外修改，确保正确传递即可

#### 2.2 添加导航事件处理函数
- `handleAddRecipe()`：跳转到 `/pages/recipe-add/index`（全局新建）
- `handleAddRecipeToCategory(e)`：从 dataset 获取 catId，跳转到 `/pages/recipe-add/index?categoryId=xxx`（分类内新建，预选分类）
- `handleEditRecipe(e)`：从 dataset 获取 recipeId，跳转到 `/pages/recipe-add/index?id=xxx`（编辑模式）

### 步骤 3：修改 index.wxss 样式

#### 3.1 菜品缩略图样式
- 尺寸：100rpx × 100rpx（约 50px）
- 圆角：12rpx
- margin：左右适当间距
- 使用 `mode="aspectFill"` 裁剪填充
- 默认图 fallback 已在数据层处理（/assets/images/default_food.png）

#### 3.2 编辑按钮样式
- 尺寸、风格与删除按钮保持一致但颜色不同
- 删除按钮：红色（danger）
- 编辑按钮：蓝色（primary-light，主色调浅色背景 + 蓝色文字）
- 两个按钮并排，间距 12rpx

#### 3.3 分类内"添加菜品"按钮样式
- 位于分类卡片底部，宽度 100%
- 浅色背景、虚线边框或细实线
- 文字居中："+ 添加菜品到该分类"
- 点击态有反馈

#### 3.4 悬浮新建按钮样式
- fixed 定位，right: 40rpx，bottom: 120rpx（避开底部滚动区域）
- 蓝色渐变背景，白色文字和 "+" 图标
- 圆形胶囊形状，带阴影
- z-index 高于其他内容

#### 3.5 调整菜品行布局
- 适当调整 padding 和对齐方式，确保缩略图、文字、按钮对齐美观
- 菜名设置最大宽度，超长省略显示

---

## 五、风险与注意事项

1. **拖拽功能不受影响**：缩略图和按钮加在 dish-row 内部，拖拽事件绑定在 dish-row 上的 longpress 仍然有效；注意按钮点击要使用 `catchtap` 阻止冒泡，避免触发长按拖拽
2. **长按时按钮禁用问题**：无需特别处理，拖拽时整行 opacity 降低，拖拽浮层上只显示菜名和价格（保持现有 drag-float 逻辑）
3. **图片路径兼容**：db.js 中 image 字段要么是本地持久化路径，要么是 `/assets/images/default_food.png`，image 组件均能正常显示
4. **导航返回刷新**：recipe-add 页面保存成功后会 `navigateBack()`，而 category-manage 的 `onShow` 会调用 `loadData()`，因此新增/编辑后列表会自动刷新，无需额外处理

---

## 六、验证要点

完成后需验证：
1. ✅ 页面右下角悬浮"新建菜品"按钮可见，点击跳转到新建页
2. ✅ 每个分类底部有"添加菜品"按钮，点击跳转到新建页并预选对应分类
3. ✅ 每个菜品显示正确的缩略图（无图时显示默认食物图）
4. ✅ 每个菜品右侧有"编辑"按钮，点击跳转到对应菜谱的编辑页
5. ✅ 删除按钮仍正常工作，带确认弹窗
6. ✅ 长按拖拽排序、跨分类移动功能仍正常
7. ✅ 新建/编辑菜品后返回管理页，列表自动刷新显示最新数据
8. ✅ UI 整体美观协调，按钮不重叠、文字不溢出
