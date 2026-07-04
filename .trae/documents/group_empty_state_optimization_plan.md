# 群组空状态界面优化计划

## 需求概述
优化"我的群组"页面在没有任何群组时的界面布局：
- 将"新建群组"区域移到上方，"输入邀请码加入群组"移到下方
- 提升"新建群组"的视觉优先级

## 代码研究结论

### 涉及文件
- [pages/group/index.wxml](file:///Users/a1/Documents/01Code/WeCt_Xcx/pages/group/index.wxml) - 页面结构（第5-21行是空状态区域）
- [pages/group/index.wxss](file:///Users/a1/Documents/01Code/WeCt_Xcx/pages/group/index.wxss) - 页面样式
- [app.wxss](file:///Users/a1/Documents/01Code/WeCt_Xcx/app.wxss) - 全局按钮样式定义

### 当前布局结构（空状态）
```
1. 邀请码输入框 + "加入群组"按钮（btn-primary 蓝色主按钮）
2. "或者"分隔线
3. 群组名称输入框 + "新建群组"按钮（btn-secondary 浅蓝次按钮）
```

### 全局按钮样式
- `.btn-primary`：蓝色渐变背景 + 阴影，视觉权重高（主按钮）
- `.btn-secondary`：浅蓝背景无阴影，视觉权重低（次按钮）

## 修改步骤

### 1. 调整 wxml 中空状态区域的顺序（pages/group/index.wxml 第10-20行）
将两个 `input-row` 的顺序交换：
- 上方：新建群组（群组名称输入框 + 按钮）
- 下方：加入群组（邀请码输入框 + 按钮）

### 2. 交换按钮样式类，提升新建群组优先级
- "新建群组"按钮：从 `btn-secondary` 改为 `btn-primary`（蓝色主按钮）
- "加入群组"按钮：从 `btn-primary` 改为 `btn-secondary`（浅蓝次按钮）

### 3. 调整分隔线与描述文案
- 描述文字保持不变："您可以自己创建一个菜单群组，或者输入好友的邀请码加入已有群组。"
- 分隔线"或者"保留在两个区域之间，逻辑自然（先创建，或者加入）

## 风险与注意事项
- 仅修改空状态（`groupsList.length === 0`）区域，不影响"有群组时"的紧凑操作区布局
- 不修改 JS 逻辑，仅调整视图层顺序和样式类名
- 按钮尺寸、圆角等样式由页面 wxss 中的 `.join-btn, .create-btn` 统一控制，无需单独调整
