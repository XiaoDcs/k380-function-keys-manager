# 📁 K380 Function Keys Manager - 项目结构

## 🏗️ 项目目录结构

```
k380-function-keys-conf/
├── 📂 src/                     # 应用源代码
│   ├── main.js                 # 主进程 (Electron)
│   ├── renderer.html           # 渲染进程 HTML
│   └── renderer.js             # 渲染进程 JS
│
├── 📂 bin/                     # 二进制可执行文件
│   ├── k380                    # 原始 K380 配置程序
│   ├── k380_improved          # 改进版 K380 配置程序
│   ├── test_hid               # HID 权限测试程序
│   └── *.dSYM/                # 调试符号文件
│
├── 📂 tools/                   # 工具和脚本
│   ├── *.c                     # C 源代码文件
│   ├── build_improved.sh       # 构建脚本
│   ├── test_permissions.sh     # 权限测试脚本
│   ├── fix_permissions.sh      # 权限修复脚本
│   └── quick_test.sh          # 快速测试脚本
│
├── 📂 docs/                    # 文档
│   ├── README.md              # 项目说明
│   ├── BUILD_GUIDE.md         # 构建指南
│   ├── FIXES_SUMMARY.md       # 修复总结
│   ├── INSTALL_AND_TEST.md    # 安装测试指南
│   └── PROJECT_STRUCTURE.md   # 本文件
│
├── 📂 build/                   # 构建配置
│   └── entitlements.mac.plist # macOS 权限配置
│
├── 📂 scripts/                 # 构建脚本
│   └── afterPack.js           # 打包后处理脚本
│
├── 📂 assets/                  # 资源文件
│   └── (图标等资源文件)
│
├── 📂 node_modules/            # Node.js 依赖 (gitignore)
├── 📂 dist/                    # 构建输出 (gitignore)
│
├── package.json                # 项目配置
├── package-lock.json          # 依赖锁定文件
├── .gitignore                 # Git 忽略规则
├── LICENSE                    # 开源协议
└── hidapi.h                   # HID API 头文件
```

## 📋 文件功能说明

### 🎯 核心应用文件

#### `src/main.js`
- **功能**: Electron 主进程，应用核心逻辑
- **特性**:
  - 系统托盘管理
  - K380 蓝牙连接检测
  - 权限检查和设置指导
  - 密码缓存管理 (可配置时间)
  - 开机自启动管理
  - 自动化设置应用

#### `src/renderer.html` & `src/renderer.js`
- **功能**: 应用主窗口界面
- **特性**:
  - 现代化的 Apple 设计风格
  - 实时状态显示
  - 设置面板

### 🔧 工具和脚本

#### `tools/k380_improved.c`
- **功能**: 改进版 K380 配置程序
- **改进**:
  - 更好的错误处理
  - 监控模式支持
  - 信号处理

#### `tools/test_hid.c`
- **功能**: HID 设备权限测试
- **用途**: 检测系统权限设置状态

#### `tools/build_improved.sh`
- **功能**: 编译二进制文件
- **支持**: Apple Silicon 和 Intel

#### `tools/test_permissions.sh`
- **功能**: 完整的权限诊断
- **检查项目**:
  - 蓝牙连接状态
  - HID 设备访问权限
  - 二进制文件完整性

### 📚 文档系统

#### `docs/BUILD_GUIDE.md`
- 详细的构建说明
- 开发版 vs 正式版对比
- 常见问题解答

#### `docs/FIXES_SUMMARY.md`
- 问题修复总结
- 技术实现细节
- 验证方法

#### `docs/INSTALL_AND_TEST.md`
- 安装步骤指导
- 功能测试清单
- 故障排除指南

## 🔄 工作流程

### 开发模式
```bash
# 安装依赖
npm install

# 构建二进制文件
npm run build-binaries

# 启动开发版本
npm start

# 运行测试
npm test

# 权限修复
npm run permissions
```

### 生产构建
```bash
# 完整构建 (包含二进制文件)
npm run build

# 仅打包 (不重新编译二进制)
npm run pack
```

## 🎯 关键特性

### ✅ 已解决的问题
1. **密码缓存**: 可配置缓存时间 (1分钟 - 永不过期)
2. **开机自启动**: 开发/生产模式智能检测
3. **权限检测**: 启动时自动检查并指导用户
4. **路径问题**: 智能路径解析 (开发/打包环境)
5. **窗口管理**: 可配置启动时是否显示窗口
6. **错误处理**: 更友好的错误信息和处理

### 🚀 新增功能
1. **智能权限检测**: 启动时自动检查权限状态
2. **密码缓存配置**: 5个时间选项 + 永不过期
3. **窗口显示设置**: 用户可选择启动时是否显示窗口
4. **构建自动化**: 一键构建包含所有依赖
5. **完整诊断**: 全面的系统状态检查工具

## 🔐 安全特性

- **密码安全**: 使用 spawn 避免密码泄露
- **权限最小化**: 仅请求必要的系统权限
- **缓存清理**: 应用退出时自动清理敏感数据
- **错误隔离**: 权限错误不影响其他功能

## 📊 性能优化

- **智能监控**: 仅在需要时启动蓝牙监控
- **缓存机制**: 减少重复的权限检查
- **资源管理**: 及时清理不用的资源
- **路径优化**: 打包环境下使用优化的路径解析 