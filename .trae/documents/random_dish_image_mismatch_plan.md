# 修复"吃什么"随机菜品图片与名称不匹配问题

## 问题描述
用户反馈"吃什么"随机菜品功能中，有时候显示的菜品图片和名称对不上。

## 根因分析

经过代码审查发现两个潜在问题：

### 问题1：组件复用导致图片缓存/加载问题（主要原因）

在 [index.wxml](file:///Users/a1/Documents/01Code/WeCt_Xcx/pages/kitchen/index.wxml#L239-L242) 中，随机菜品滚动列表使用 `wx:key="index"`：

```xml
<view class="rolling-item" wx:for="{{rollingRecipes}}" wx:key="index">
  <image src="{{item.image}}"></image>
  <view>{{item.name}}</view>
</view>
```

使用 `index` 作为 key 时，小程序会复用相同 index 的组件。在快速滚动切换菜品时，image 组件的 src 频繁变化，但由于：
- 图片加载是异步的
- 组件复用可能导致旧图片还没来得及更新
- 新图片加载失败时可能保留旧图片显示（而非显示默认图）

导致文字（同步更新了，但图片还停留在上一个菜品，出现"图文错位"。

### 问题2：随机洗牌算法不规范

在 [index.js](file:///Users/a1/Documents/01Code/WeCt_Xcx/pages/kitchen/index.js#L672) 中使用 `sort(() => 0.5 - Math.random())` 进行随机排序：

```javascript
const tempShuffled = [...pool].sort(() => 0.5 - Math.random());
```

这种方法不是真正均匀的洗牌算法（Fisher-Yates 才是标准），虽然不会直接导致图文不匹配，但会导致随机分布不均匀。

## 修复方案

### 修改文件
- `pages/kitchen/index.js`
- `pages/kitchen/index.wxml`

### 修改步骤

#### 步骤1：添加 Fisher-Yates 洗牌工具函数

在 `index.js` 中添加标准的 Fisher-Yates 洗牌算法，替代 `sort(() => 0.5 - Math.random())`。

#### 步骤2：给 rollingRecipes 元素添加唯一标识

在构建 rollingRecipes 时，将菜品的 `id` 也包含进去，使每个滚动项有唯一标识。

#### 步骤3：修改 WXML 中的 wx:key

将 `wx:key="index"` 改为 `wx:key="id"`（或其他唯一标识），强制小程序在菜品变化时创建新组件而非复用旧组件，从根本上避免图片缓存导致的图文错位。

#### 步骤4：给 image 组件添加错误兜底

为随机弹窗中的 image 添加 `binderror` 事件，图片加载失败时显式设置为默认图片，避免显示旧图。

## 预期效果

- 随机菜品的图片和名称始终匹配
- 随机分布更均匀
- 图片加载失败时有明确的默认图显示
