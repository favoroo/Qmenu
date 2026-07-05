# Logo 图片替换更新计划

## 一、现状分析

### 1.1 图片文件现状

| 文件 | 尺寸 | 大小 | 说明 |
|---|---|---|---|
| `assets/images/logo.jpg` | 1024 × 1024 | 235 KB | 新 logo 图片（用户提供，待处理） |
| `assets/images/logo.png` | 256 × 256 | 13 KB | 旧 logo 图片（待删除） |

### 1.2 代码引用现状

当前代码中仅 **1 处** 引用了 `logo.png`：

- **位置**：`pages/kitchen/index.js` 第 132 行
- **用途**：判断用户是否使用默认头像（兼容老用户，老版本曾用 logo.png 作默认头像）
- **代码**：
  ```js
  const isDefaultAvatar = userInfo && userInfo.avatarUrl && 
    (userInfo.avatarUrl.includes('default_avatar.png') || userInfo.avatarUrl.includes('logo.png'));
  ```

### 1.3 历史背景

此前因旧 logo 设计不佳，已实施"移除 Q 菜单 Logo 图片"方案：
- 登录页、空状态页等品牌展示位置的 logo 已移除，改用纯文字 + 简约装饰
- 默认头像已改用 `default_avatar.png`
- 仅保留头像判断逻辑中对 `logo.png` 的兼容检测

---

## 二、用户需求

1. **用新的 `logo.jpg` 替换旧的 `logo.png`** — 新 logo 作为项目的 logo 资源
2. **压缩处理** — 按小程序规范压缩图片、调整分辨率
3. **删除旧文件** — 移除旧的 `logo.png`

---

## 三、实施步骤

### 步骤 1：压缩处理新 logo.jpg

**工具**：macOS 内置 `sips` 命令

**处理参数**（与项目图片规范一致）：
- 质量：80
- 最大宽/高：1080px（当前 1024px 已符合要求，仅做质量压缩）

**操作**：
1. 备份原 logo.jpg
2. 使用 sips 压缩质量到 80
3. 验证输出文件尺寸和大小

---

### 步骤 2：更新代码引用

**文件**：`pages/kitchen/index.js`

**改动**：
- 在头像判断逻辑中，将 `logo.png` 的检测更新为同时检测 `logo.jpg` 和 `logo.png`（兼容历史数据）
- 确保新老用户的默认头像都能被正确识别

**修改前**：
```js
const isDefaultAvatar = userInfo && userInfo.avatarUrl && 
  (userInfo.avatarUrl.includes('default_avatar.png') || userInfo.avatarUrl.includes('logo.png'));
```

**修改后**：
```js
const isDefaultAvatar = userInfo && userInfo.avatarUrl && 
  (userInfo.avatarUrl.includes('default_avatar.png') || 
   userInfo.avatarUrl.includes('logo.png') || 
   userInfo.avatarUrl.includes('logo.jpg'));
```

---

### 步骤 3：删除旧的 logo.png

**文件**：`assets/images/logo.png`

**操作**：直接删除该文件

**风险**：低 — 代码中仅头像判断逻辑用到文件名匹配，不依赖文件实际存在；且已添加对 logo.jpg 的兼容

---

## 四、验证步骤

1. **图片验证**：确认压缩后的 logo.jpg 尺寸正常、文件大小合理
2. **代码验证**：检查 `pages/kitchen/index.js` 中头像判断逻辑是否正确更新
3. **文件验证**：确认 logo.png 已删除、logo.jpg 存在且可用
4. **功能验证**：
   - 编译小程序无报错
   - 新用户登录默认头像正常显示
   - 老用户（头像为 logo.png 的）仍能被正确识别为默认头像

---

## 五、注意事项

1. **静态资源 vs 运行时处理**：`utils/image.js` 中的压缩函数是运行时处理用户上传图片的，不适用于静态资源。静态资源使用 `sips` 命令行工具在开发阶段预处理。
2. **向后兼容**：保留对 `logo.png` 的文件名检测，确保老用户数据不受影响。
3. **小程序包大小**：新 logo 压缩后预计可减小到 50-100KB 范围，对小程序总包大小影响极小。
