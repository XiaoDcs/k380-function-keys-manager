#!/bin/bash

# K380 Manager 权限检查和修复脚本

echo "🔍 K380 Manager 权限诊断工具"
echo "================================"

# 检查K380蓝牙连接
echo ""
echo "1️⃣ 检查 K380 蓝牙连接状态..."
K380_BLUETOOTH=$(system_profiler SPBluetoothDataType | grep -i "Keyboard K380")
if [[ -n "$K380_BLUETOOTH" ]]; then
    echo "✅ K380 蓝牙已连接"
    echo "   设备信息: $K380_BLUETOOTH"
else
    echo "❌ K380 蓝牙未连接"
    echo "   请确保K380已配对并连接"
    exit 1
fi

# 检查HID权限
echo ""
echo "2️⃣ 检查 HID 设备访问权限..."
HID_TEST=$(sudo ./test_hid 2>/dev/null | grep -E "(Successfully opened K380|not permitted)")
if [[ $HID_TEST == *"Successfully opened K380"* ]]; then
    echo "✅ HID 权限正常"
else
    echo "❌ HID 权限被拒绝"
    echo "   错误: $HID_TEST"
fi

# 检查Electron应用路径
echo ""
echo "3️⃣ 检查 Electron 应用路径..."
ELECTRON_PATH="$(pwd)/node_modules/electron/dist/Electron.app"
if [[ -d "$ELECTRON_PATH" ]]; then
    echo "✅ Electron 应用路径存在"
    echo "   路径: $ELECTRON_PATH"
else
    echo "❌ Electron 应用路径不存在"
    echo "   请运行: npm install"
fi

# 权限设置指导
echo ""
echo "🔧 权限设置步骤:"
echo "================================"
echo "1. 打开 '系统偏好设置' → '安全性与隐私' → '隐私'"
echo "2. 在左侧选择 '输入监控'"
echo "3. 点击左下角锁图标，输入管理员密码"
echo "4. 点击 '+' 按钮，添加以下应用:"
echo "   $ELECTRON_PATH"
echo "5. 确保应用已勾选"
echo "6. 重启应用: npm start"

# macOS版本检查
echo ""
echo "4️⃣ macOS 版本信息..."
MACOS_VERSION=$(sw_vers -productVersion)
echo "   版本: $MACOS_VERSION"

if [[ $(echo "$MACOS_VERSION" | cut -d. -f1) -ge 13 ]]; then
    echo "   💡 注意: macOS 13+ 用户请在 '系统设置' → '隐私与安全性' → '输入监控' 中设置"
else
    echo "   💡 路径: '系统偏好设置' → '安全性与隐私' → '隐私' → '输入监控'"
fi

echo ""
echo "📋 诊断完成！"
echo "如果权限设置正确但仍有问题，请尝试重启系统。" 