# K380 Function Keys Manager

<div align="center">

一个专为罗技 K380 蓝牙键盘设计的 Fn 键行为管理工具，让您轻松控制 F1-F12 键的默认行为。

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![macOS](https://img.shields.io/badge/macOS-supported-green.svg)]()
[![Electron](https://img.shields.io/badge/Electron-latest-blue.svg)]()

[功能特性](#-功能特性) • [安装使用](#-安装使用) • [开发指南](#-开发指南) • [常见问题](#-常见问题)

</div>

## 📋 项目介绍

K380 Function Keys Manager 是一个现代化的 macOS 应用程序，专门解决罗技 K380 蓝牙键盘的 Fn 键使用体验问题。通过这个工具，您可以：

- **🎯 自由切换** F1-F12 键的默认行为（媒体功能 ↔ 标准功能键）
- **🔄 实时生效** 设置立即应用，无需重新连接键盘
- **⚡ 自动化管理** 蓝牙连接检测与自动应用设置
- **🛡️ 安全便捷** 智能密码缓存，减少重复输入

## ✨ 功能特性

### 🎛️ 核心功能
- **Fn 键行为切换**：在媒体键和标准功能键之间自由切换
- **实时连接检测**：自动检测 K380 蓝牙连接状态
- **智能自动应用**：设备连接时自动应用预设配置

### 🔧 系统集成
- **系统托盘集成**：最小化到托盘，右键快速操作
- **开机自启动**：支持 macOS 开机自启动（正式版本）
- **GUI 界面**：现代化的多标签页设置界面

### 💡 智能特性
- **密码缓存机制**：
  - 🕐 可配置缓存时间（1分钟 - 永不过期）
  - 🔐 持久化加密存储（可选）
  - 🚨 错误时自动清除缓存
- **权限智能检测**：自动检测并指导权限设置
- **双重图标显示**：支持 Dock 图标和托盘图标的独立控制

### 🎨 用户体验
- **多语言界面**：完整的中文本地化
- **响应式设计**：适配不同屏幕尺寸
- **实时反馈**：操作状态实时显示
- **键盘快捷键**：支持 Cmd+1/2/3/4 快速切换标签页

## 🚀 安装使用

### 方式一：下载发布版本（推荐）

1. 前往 [Releases 页面](https://github.com/XiaoDcs/k380-function-keys-manager/releases)
2. 下载最新版本的 `.dmg` 文件
3. 双击安装，拖拽到 Applications 文件夹
4. 首次启动按照权限设置指南操作

### 方式二：从源码构建

```bash
# 克隆仓库
git clone https://github.com/XiaoDcs/k380-function-keys-manager.git
cd k380-function-keys-manager

# 安装依赖
npm install

# 构建二进制文件
chmod +x scripts/build_binaries.sh
./scripts/build_binaries.sh

# 构建应用（开发模式）
npm run dev

# 或构建正式版本
npm run build
```

### 🔐 权限设置

首次使用需要授予输入监控权限：

#### 基本设置步骤

1. 打开 `系统设置` → `隐私与安全性` → `输入监控`
2. 点击 `+` 添加应用
3. 选择已安装的 `K380 Function Keys Manager.app`
4. 确保应用已勾选
5. 重启应用生效

#### 📦 打包版本特别说明

如果使用从 Releases 下载的打包版本，可能需要额外的安全设置：

**第一次运行时：**
1. 右键点击应用，选择"打开"而不是双击
2. 在安全提示中点击"打开"
3. 如果提示"无法验证开发者"，到`系统设置` → `隐私与安全性`中点击"仍要打开"

**如果遇到 "K380 not found" 错误：**

运行权限修复脚本：
```bash
# 下载并运行权限修复脚本
curl -O https://raw.githubusercontent.com/XiaoDcs/k380-function-keys-manager/main/scripts/fix_app_permissions.sh
chmod +x fix_app_permissions.sh
./fix_app_permissions.sh
```

或手动执行以下命令：
```bash
# 清除隔离属性
sudo xattr -dr com.apple.quarantine "/Applications/K380 Function Keys Manager.app"

# 重新签名应用
sudo codesign --force --deep --sign - "/Applications/K380 Function Keys Manager.app"
```

#### 🔍 权限问题诊断

应用内置了权限检查工具：
1. 打开应用 → `工具` 标签页
2. 点击 `检查权限` 按钮
3. 根据检查结果进行相应操作

**常见权限状态：**
- ✅ **权限正常** - 可以直接使用所有功能
- ⚠️ **需要密码** - 功能正常，使用时需要输入管理员密码
- ❌ **权限缺失** - 需要在系统设置中添加权限
- ⚠️ **设备未找到** - 检查 K380 蓝牙连接状态

#### 🚨 故障排除

**问题：设置后仍显示权限错误**
- 完全退出应用并重新启动
- 尝试重启系统
- 在权限列表中删除应用后重新添加

**问题：K380 已连接但提示设备未找到**  
- 检查是否有其他应用占用 K380
- 尝试断开并重新连接 K380
- 重启蓝牙服务：`sudo pkill bluetoothd`

**问题：打包版本无法运行**
- 运行上述权限修复脚本
- 确保从可信来源下载应用
- 检查 macOS 版本兼容性（需要 10.15+）

> **提示**：应用会自动检测权限状态并提供详细的设置指导

## 🎯 使用指南

### 基本操作

1. **快速切换**：点击托盘图标，选择"启用 Fn 键直接访问"
2. **GUI 操作**：双击托盘图标打开设置界面
3. **自动化**：启用"自动应用设置"，连接时自动配置

### 界面说明

- **主要功能**：连接状态、Fn 键切换、立即应用
- **设置**：开机自启动、窗口显示、自动应用、密码缓存
- **工具**：权限检查、系统设置快捷方式
- **关于**：版本信息、项目链接

### 密码缓存配置

支持多种缓存策略：
- **1分钟**：适合安全敏感环境
- **5分钟**：推荐的平衡选择
- **15-30分钟**：适合频繁使用
- **永不过期**：最大便利性
- **持久化存储**：重启后保持缓存（加密存储）

## 🛠️ 开发指南

### 开发环境

```bash
# 依赖要求
node >= 16.0.0
npm >= 8.0.0
macOS >= 10.15

# 安装开发依赖
npm install

# 启动开发服务器
npm run dev

# 调试模式
npm run debug
```

### 项目结构

```
k380-function-keys-manager/
├── src/                    # 源代码
│   ├── main.js            # Electron 主进程
│   ├── renderer.js        # 渲染进程
│   └── renderer.html      # UI 界面
├── bin/                   # 二进制可执行文件
│   ├── k380_improved      # K380 控制程序
│   └── test_hid          # 权限测试程序
├── scripts/              # 构建脚本
├── assets/               # 静态资源
├── docs/                # 文档
└── build/               # 构建配置
```

### 构建流程

```bash
# 1. 构建二进制文件
./scripts/build_binaries.sh

# 2. 构建 Electron 应用
npm run build

# 3. 输出到 dist/ 目录
ls dist/
```

### API 文档

主要类和方法：

- `K380Manager`: 核心管理类
  - `executeK380Command(mode)`: 执行 K380 命令
  - `checkK380Connection()`: 检查连接状态
  - `updatePasswordCache(password)`: 更新密码缓存

详细文档请参考 [开发文档](docs/)

## 🔧 技术架构

### 核心技术栈
- **Electron**: 跨平台桌面应用框架
- **Node.js**: 后端逻辑和系统调用
- **HID API**: 低级硬件接口访问
- **Auto Launch**: macOS 开机自启动集成

### 关键组件
- **蓝牙监控**: 实时检测 K380 连接状态
- **权限管理**: HID 访问权限检测和指导
- **密码缓存**: 安全的管理员密码缓存机制
- **设置持久化**: 基于 Electron Store 的配置管理

## 📚 常见问题

### Q: 为什么需要管理员权限？
A: 修改 K380 的硬件设置需要访问 HID 设备，这需要系统级权限。

### Q: 密码缓存安全吗？
A: 是的。密码使用 AES-256-CBC 加密存储，并且会定期清理和过期。

### Q: 支持其他罗技键盘吗？
A: 目前专门为 K380 优化，其他型号可能需要适配。

### Q: 开发模式下开机自启动失败？
A: 这是正常现象。请构建正式版本来使用开机自启动功能。

### Q: 如何完全卸载？
A: 删除应用，并清理 `~/Library/Preferences/` 中的配置文件。

更多问题请查看 [FAQ 文档](docs/FAQ.md) 或提交 Issue。

## 🤝 贡献指南

欢迎贡献代码！请遵循以下步骤：

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

### 代码规范
- 使用 ESLint 进行代码检查
- 遵循 JavaScript Standard Style
- 提交信息使用英文，格式清晰

## 📄 开源协议

本项目基于 GPL-3.0 协议开源。详情请参阅 [LICENSE](LICENSE) 文件。

## 🙏 致谢

- 罗技官方提供的硬件规格文档
- Electron 社区的优秀工具和插件
- 所有贡献者和用户的反馈

## 📞 联系支持

- **Issues**: [GitHub Issues](https://github.com/XiaoDcs/k380-function-keys-manager/issues)
- **Discussions**: [GitHub Discussions](https://github.com/XiaoDcs/k380-function-keys-manager/discussions)
- **Email**: [your-email@example.com](mailto:your-email@example.com)

---

<div align="center">

**如果这个项目对您有帮助，请考虑给个 ⭐️ Star！**

Made with ❤️ for K380 users

</div> 