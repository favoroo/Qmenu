# 分类管理页面空白问题修复计划

## 摘要

分类管理页面（`pages/category-manage/`）点击进入后显示完全空白，仅有顶部导航栏的"分类管理"标题，页面内容区域完全不可见。经过代码分析，最可能的原因是 `placeholder-class` 引用了未定义的 CSS 类，在 `style: v2` 和 `lazyCodeLoading` 配置的共同作用下触发了渲染异常。

## 当前状态分析

### 已确认的事实

1. **页面文件完整存在**：`pages/category-manage/` 目录下四个文件（index.wxml、index.js、index.json、index.wxss）均存在且内容完整
2. **页面已正确注册**：`app.json` 的 pages 数组中包含 `"pages/category-manage/index"`
3. **跳转路径正确**：厨房页面的 `goCategoryManage()` 方法通过 `wx.navigateTo` 跳转到 `/pages/category-manage/index`
4. **WXML 模板结构完整**：包含"添加新分类"表单卡片和"分类列表"卡片
5. **JS 逻辑完整**：数据加载、增删改查、排序等功能均已实现
6. **全局样式正常**：`app.wxss` 中定义了所有 CSS 变量和通用类（`.card`、`.btn-primary`、`.form-input` 等），厨房页面使用相同的变量和类且显示正常

### 关键发现的问题

| 问题 | 位置 | 影响程度 |
|------|------|----------|
| `placeholder-class="input-placeholder"` 引用未定义的 CSS 类 | index.wxml 第 11 行、第 19 行 | 高 |
| 排序 input 使用内联 style 属性 | index.wxml 第 20 行 | 中 |
| `lazyCodeLoading: "requiredComponents"` 可能与非 tabBar 页面有兼容性问题 | app.json 第 45 行 | 中 |

## 根因推测

最可能的根因：**`placeholder-class` 指向不存在的 CSS 类**，在 `"style": "v2"` 模式和 `lazyCodeLoading` 配置的共同作用下，触发了 input 组件的渲染异常，进而导致整个页面内容无法渲染。

对比验证：正常工作的 `recipe-add` 页面也使用了 `placeholder-class="input-placeholder"`，但它在自己的 WXSS 中定义了 `.input-placeholder` 类；而分类管理页面的 WXSS 中缺少这个类定义。

## 拟议的修改

### 修改 1：补充缺失的 `.input-placeholder` 样式类

**文件**：`pages/category-manage/index.wxss`

**修改内容**：在文件末尾添加 `.input-placeholder` 类定义：

```css
/* Input Placeholder */
.input-placeholder {
  color: var(--text-light);
  font-size: 26rpx;
}
```

**原因**：修复 `placeholder-class` 指向不存在类的问题，消除 input 组件的渲染异常风险。与 `recipe-add` 页面保持样式一致性。

---

### 修改 2：将内联 style 迁移到 WXSS 类中

**文件**：`pages/category-manage/index.wxml` 和 `pages/category-manage/index.wxss`

**WXML 修改**：移除第二个 input 的内联 `style` 属性

修改前：
```xml
<input 
  class="form-input sort-input" 
  type="number" 
  placeholder="排序" 
  value="{{newCatSort}}" 
  bindinput="onSortInput"
  placeholder-class="input-placeholder"
  style="width: 120rpx; margin-left: 16rpx; text-align: center;"
/>
```

修改后：
```xml
<input 
  class="form-input sort-input" 
  type="number" 
  placeholder="排序" 
  value="{{newCatSort}}" 
  bindinput="onSortInput"
  placeholder-class="input-placeholder"
/>
```

**WXSS 修改**：在 `.sort-input` 类中补充宽度、左边距和文字居中样式：

```css
.sort-input {
  height: 80rpx !important;
  width: 120rpx;
  margin-left: 16rpx;
  text-align: center;
}
```

**原因**：消除内联 style 可能带来的 WXML 解析风险，同时保持样式一致性和可维护性。

---

### 修改 3（备用）：临时移除 `lazyCodeLoading` 配置

**文件**：`app.json`

**修改内容**：如果前两项修改后问题仍然存在，临时移除 `"lazyCodeLoading": "requiredComponents"` 配置行以排查是否为懒加载兼容性问题。

**注意**：这只是诊断步骤。如果确认是懒加载导致的问题，可根据实际影响决定是否永久移除该配置（对当前小程序的包体积影响很小，因为自定义组件数量不多）。

## 假设与决策

1. **假设**：`placeholder-class` 引用未定义类是导致页面空白的主要原因
2. **决策**：优先修复最可能的问题（样式类缺失 + 内联样式），逐步验证
3. **决策**：不直接修改 `app.json` 的 `lazyCodeLoading` 配置，仅作为备用排查方案
4. **假设**：页面 JS 逻辑和数据层（db.js）没有问题，因为厨房页面使用相同的 db.js 且正常工作

## 验证步骤

### 验证 1：基础修复验证

1. 完成修改 1 和修改 2 后，在微信开发者工具中点击"编译"按钮重新编译项目
2. 进入厨房页面，点击左侧底部的"分类管理"按钮
3. 观察页面是否正常显示以下内容：
   - "添加新分类"卡片（包含分类名称输入框、排序输入框、添加按钮）
   - "分类列表"卡片（包含默认分类、招牌私房菜、滋补汤羹等分类项）
4. 测试添加分类功能：输入分类名称和排序，点击"添加"，验证新分类是否出现在列表中
5. 测试删除功能：点击某个分类的"删除"按钮，验证是否弹出确认框并正确删除
6. 测试排序功能：点击上下箭头，验证分类顺序是否变化

### 验证 2：备用方案验证（如验证 1 不通过）

1. 在微信开发者工具中，点击菜单栏 `工具` → `清除缓存` → `全部清除`
2. 重新编译项目，再次进入分类管理页面验证
3. 如仍有问题，临时移除 `app.json` 中的 `lazyCodeLoading` 配置，重新编译验证

### 验证 3：回归测试

1. 确认厨房页面正常显示和工作
2. 确认菜谱添加页面正常显示和工作
3. 确认其他页面（订单、我的）不受影响
