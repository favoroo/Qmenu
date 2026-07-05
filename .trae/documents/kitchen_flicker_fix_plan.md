# 厨房板块切换闪烁问题修复方案

## 问题描述
从其他板块切换到厨房板块时，厨房板块的内容过几秒会闪一下。

## 根本原因分析

通过分析 [pages/kitchen/index.js](file:///Users/a1/Documents/01Code/WeCt_Xcx/pages/kitchen/index.js) 的 `onShow` 生命周期和数据加载流程，发现以下三个导致闪烁的原因：

### 原因1：animReady 入场动画每次 onShow 都重放（主要原因）
**位置：** [index.js 第111-112行](file:///Users/a1/Documents/01Code/WeCt_Xcx/pages/kitchen/index.js#L111-L112)
```javascript
this.setData({ animReady: false });
setTimeout(() => this.setData({ animReady: true }), 50);
```
每次切换到厨房页面（onShow 触发），都会重置 `animReady` 为 false，50ms 后再设为 true，导致菜谱卡片的 stagger 入场动画重新播放，视觉上就是"闪一下"。

**WXML 对应：** [index.wxml 第78行](file:///Users/a1/Documents/01Code/WeCt_Xcx/pages/kitchen/index.wxml#L78-L78)
```xml
<view class="recipe-card flex-row {{animReady ? 'stagger' : ''}}" ...>
```

### 原因2：本地缓存 → 云端数据的二次渲染
**位置：** [index.js 第94-116行 onShow](file:///Users/a1/Documents/01Code/WeCt_Xcx/pages/kitchen/index.js#L94-L116)
- 阶段1：从本地缓存瞬时渲染（第96-102行）
- 阶段2：几秒后云端数据返回，再次调用 `loadData()` 渲染（第105-106行 → loadGroupsList → 第186行 loadData）

如果云端数据和本地缓存有差异（排序、字段等），就会导致内容跳动/闪烁。

### 原因3：loadGroupsList 中多次 setData 导致多次渲染
**位置：** [index.js 第143-187行 loadGroupsList](file:///Users/a1/Documents/01Code/WeCt_Xcx/pages/kitchen/index.js#L143-L187)
函数内有 3 次 setData 调用 + 1 次 loadData（内部又有 setData），多次数据更新可能产生视觉跳动。

## 修复方案

### 修改文件
- `pages/kitchen/index.js`

### 修改步骤

#### 步骤1：移除 onShow 中的 animReady 重置逻辑
- 只有在**首次加载**（没有缓存数据时）才播放入场动画
- 从其他 tab 切换回来时，数据已存在，不应该重放动画
- 增加标志位 `hasShownBefore` 来判断是否首次渲染

#### 步骤2：云端数据刷新时做差异比较，避免无意义的 setData
- 在 `loadGroupsList` 中，云端数据返回后，先与当前数据对比
- 如果数据完全一致，不调用 setData，避免不必要的重渲染
- 重点对比 recipes 和 categories 的内容

#### 步骤3：合并 loadGroupsList 中的多次 setData
- 将 groupsList、currentGroup、isAdmin、loading 等数据合并到一次 setData 中
- 减少渲染次数

### 具体代码修改思路

1. **新增 data 字段：** `hasRendered: false` - 标记是否已完成首次渲染
2. **修改 onShow：**
   - 移除 `animReady` 的重置逻辑（第111-112行）
   - 仅在 `hasRendered === false` 时设置 `animReady = true`
3. **修改 loadGroupsList：**
   - 合并多次 setData 为一次
   - 云端数据更新后，对比本地缓存数据，有变化才重新 loadData
4. **修改 loadData：**
   - 增加数据差异检测，数据相同则不 setData

## 风险评估
- **低风险**：主要是优化渲染逻辑，不改变业务功能
- 需要验证首次进入页面时动画仍然正常播放
- 需要验证群组切换时数据正确更新
