# 滚动条与加号按钮重叠优化方案

## 问题分析

从截图可以看到，厨房页面（kitchen）右侧菜品列表的滚动条与菜品卡片右侧的加号按钮（+）发生了视觉重叠，影响用户体验和界面美观度。

### 根本原因

1. 右侧菜品列表 `.recipe-list` 是一个 `scroll-view`，其左右内边距为 `padding: 0 20rpx`
2. 加号按钮（`.plus-btn`）位于菜品卡片的最右侧，紧贴 scroll-view 右边缘
3. 当内容超出可滚动时，scroll-view 的滚动条会显示在最右侧边缘，与加号按钮位置重叠

### 涉及文件

- [pages/kitchen/index.wxss](file:///Users/a1/Documents/01Code/WeCt_Xcx/pages/kitchen/index.wxss) - 厨房页面样式
- [pages/kitchen/index.wxml](file:///Users/a1/Documents/01Code/WeCt_Xcx/pages/kitchen/index.wxml) - 厨房页面结构（仅需确认，无需修改）

## 优化方案

### 方案概述

采用「增加右侧内边距 + 微调布局」的方案，为滚动条预留足够的显示空间，同时保持整体布局的视觉平衡。

### 具体修改步骤

#### 步骤 1：调整 .recipe-list 的右侧内边距

**文件**: `pages/kitchen/index.wxss`

将 `.recipe-list` 的 `padding` 从 `0 20rpx` 调整为 `0 20rpx 0 20rpx`，并额外增加右侧空间给滚动条：
- 右侧 padding 增加到约 28~32rpx，为滚动条预留 8~12rpx 的空间
- 保持左侧 padding 为 20rpx（或也略微调整以保持视觉平衡）

#### 步骤 2：确认浮动按钮位置不受影响

**文件**: `pages/kitchen/index.wxss`

检查 `.floating-random-btn`（随机选菜按钮）的位置，确保其与滚动条不重叠：
- 当前 `right: 32rpx`，应该不受影响
- 如果有重叠风险，可微调其位置

#### 步骤 3：验证其他滚动区域

检查页面中其他可能有同样问题的 scroll-view：
- 左侧分类栏 `.category-sidebar` - 左侧无按钮，影响较小
- 购物车弹窗 `.cart-items-scroll` - 弹窗内滚动，影响较小

## 预期效果

1. 滚动条与加号按钮不再重叠，视觉清晰
2. 整体布局保持协调，左右边距视觉平衡
3. 不影响现有功能和交互
4. 在不同设备上表现一致

## 风险与注意事项

1. **边距不对称风险**：如果只增加右侧 padding，可能导致左右视觉不平衡。可考虑同时微调左侧或接受轻微不对称（因为滚动条本身是动态出现的）

2. **内容宽度变化**：增加右侧 padding 会略微减少内容可用宽度，但影响极小（约 10rpx 左右）

3. **兼容性**：scroll-view 的滚动条宽度在不同平台可能略有差异，预留空间要足够

## 验证方法

1. 在微信开发者工具中预览厨房页面
2. 滚动菜品列表，观察滚动条与加号按钮的位置关系
3. 在不同尺寸的模拟器上测试（iPhone SE、iPhone 14 Pro 等）
4. 确认购物车弹窗、分类侧边栏等其他滚动区域正常
