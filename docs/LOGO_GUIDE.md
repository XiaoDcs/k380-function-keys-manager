# Logo 配置指南

本文档详细说明如何为 K380 Function Keys Manager 配置和修改应用图标。

## 📁 图标文件结构

```
assets/
├── icons/
│   ├── icon.icns          # macOS 应用图标（推荐 1024x1024）
│   ├── icon.ico           # Windows 应用图标
│   ├── icon.png           # 通用图标 (512x512 或 1024x1024)
│   ├── tray/
│   │   ├── tray.png       # 托盘图标 (16x16, 22x22)
│   │   ├── tray@2x.png    # 高分辨率托盘图标 (32x32, 44x44)
│   │   └── tray-dark.png  # 深色模式托盘图标
│   └── install/
│       ├── background.png # DMG 安装背景
│       └── volume-icon.icns # DMG 卷图标
```

## 🎨 图标规格要求

### 应用主图标
- **格式**: PNG, ICNS (macOS), ICO (Windows)
- **尺寸**: 1024x1024 像素（推荐）
- **其他尺寸**: 16, 32, 48, 64, 128, 256, 512, 1024
- **背景**: 透明或白色
- **设计**: 简洁、现代、可识别

### 托盘图标
- **格式**: PNG
- **尺寸**: 16x16, 22x22 (普通), 32x32, 44x44 (高分辨率)
- **颜色**: 单色或简单双色
- **风格**: 符合 macOS 设计规范
- **注意**: 需要适配浅色和深色模式

## ⚙️ 配置方法

### 1. 应用图标配置

在 `package.json` 的 build 配置中添加：

```json
{
  "build": {
    "mac": {
      "icon": "assets/icons/icon.icns"
    },
    "win": {
      "icon": "assets/icons/icon.ico"
    },
    "linux": {
      "icon": "assets/icons/icon.png"
    }
  }
}
```

### 2. 托盘图标配置

在 `src/main.js` 中修改 `createTray()` 方法：

```javascript
createTray() {
  const iconPath = this.getTrayIconPath();
  const trayIcon = nativeImage.createFromPath(iconPath);
  
  // 设置模板图像（自动适配深浅模式）
  trayIcon.setTemplateImage(true);
  
  this.tray = new Tray(trayIcon);
  this.tray.setToolTip('K380 Function Keys Manager');
}

getTrayIconPath() {
  const isDarkMode = systemPreferences.isDarkMode();
  const iconName = isDarkMode ? 'tray-dark.png' : 'tray.png';
  
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'assets', 'icons', 'tray', iconName);
  } else {
    return path.join(__dirname, '..', 'assets', 'icons', 'tray', iconName);
  }
}
```

### 3. DMG 安装背景配置

在 `package.json` 中配置 DMG 样式：

```json
{
  "build": {
    "dmg": {
      "title": "K380 Function Keys Manager",
      "icon": "assets/icons/volume-icon.icns",
      "background": "assets/icons/install/background.png",
      "window": {
        "width": 540,
        "height": 380
      },
      "contents": [
        {
          "x": 130,
          "y": 220
        },
        {
          "x": 410,
          "y": 220,
          "type": "link", 
          "path": "/Applications"
        }
      ]
    }
  }
}
```

## 🛠️ 制作工具和资源

### 图标制作工具
- **macOS**: SF Symbols, Sketch, Figma
- **在线工具**: Canva, IconKitchen, AppIcon.co
- **专业工具**: Adobe Illustrator, Photoshop

### 图标格式转换
```bash
# PNG 转 ICNS (macOS)
iconutil -c icns icon.iconset

# 批量生成不同尺寸
sips -z 16 16 icon.png --out icon-16.png
sips -z 32 32 icon.png --out icon-32.png
# ... 其他尺寸
```

### 推荐图标资源
- [SF Symbols](https://developer.apple.com/sf-symbols/) - Apple 官方图标库
- [Feather Icons](https://feathericons.com/) - 轻量级图标
- [Heroicons](https://heroicons.com/) - 现代化图标
- [Tabler Icons](https://tabler-icons.io/) - 免费开源图标

## 📂 当前放置位置

**您的 Logo 文件应该放在这些位置：**

### 主应用图标
```
assets/icons/icon.icns        # 放置您的主图标（1024x1024）
assets/icons/icon.png         # PNG 版本作为备用
```

### 托盘图标  
```
assets/icons/tray/tray.png    # 浅色模式托盘图标 (22x22)
assets/icons/tray/tray@2x.png # 高分辨率版本 (44x44)
assets/icons/tray/tray-dark.png # 深色模式托盘图标
```

### 安装包图标
```
assets/icons/install/background.png    # DMG 背景图 (540x380)
assets/icons/volume-icon.icns          # DMG 卷图标
```

## 🔄 应用新图标的步骤

1. **准备图标文件**
   ```bash
   # 将您的图标文件放入对应目录
   cp your-logo.png assets/icons/icon.png
   cp your-tray-icon.png assets/icons/tray/tray.png
   ```

2. **更新 package.json 配置**
   ```bash
   # 在 build.mac 中添加 icon 字段
   "icon": "assets/icons/icon.icns"
   ```

3. **重新构建应用**
   ```bash
   npm run build
   ```

4. **测试图标显示**
   - 检查应用图标是否正确显示
   - 测试托盘图标在不同主题下的效果
   - 验证 DMG 安装包的视觉效果

## 🎯 设计建议

### 应用图标设计
- **主题**: 键盘、功能键、无线连接
- **颜色**: 与 Logitech 品牌色调协调
- **风格**: 现代扁平化设计
- **识别性**: 在小尺寸下依然清晰可辨

### 托盘图标设计
- **简洁**: 单色线条图标
- **清晰**: 在 16x16 像素下仍可识别
- **一致**: 与 macOS 原生图标风格统一
- **适配**: 支持浅色和深色模式

## 📞 获取帮助

如果您在配置图标时遇到问题：

1. 检查文件路径是否正确
2. 确认图标文件格式和尺寸
3. 重新构建应用测试效果
4. 查看 `docs/BUILD_GUIDE.md` 中的构建说明

---

**提示**: 建议先准备一个 1024x1024 的高质量 PNG 图标，然后使用在线工具生成其他格式和尺寸的版本。 