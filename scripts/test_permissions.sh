#!/bin/bash

echo "=== K380 权限诊断工具 ==="
echo ""

# 1. 检查K380设备连接状态
echo "1. 检查蓝牙连接状态..."
BLUETOOTH_OUTPUT=$(system_profiler SPBluetoothDataType -json 2>/dev/null)
if echo "$BLUETOOTH_OUTPUT" | grep -q "Keyboard K380"; then
    echo "✅ K380 设备已通过蓝牙连接"
    K380_ADDRESS=$(echo "$BLUETOOTH_OUTPUT" | grep -A 5 "Keyboard K380" | grep "device_address" | cut -d'"' -f4)
    echo "   地址: $K380_ADDRESS"
else
    echo "❌ 未检测到 K380 蓝牙连接"
    echo "   请确保 K380 已配对并连接"
fi
echo ""

# 2. 检查可执行文件
echo "2. 检查可执行文件..."
if [ -f "./k380_improved" ]; then
    echo "✅ k380_improved 可执行文件存在"
else
    echo "❌ k380_improved 文件不存在"
    echo "   请运行: ./build_improved.sh"
fi

if [ -f "./test_hid" ]; then
    echo "✅ test_hid 可执行文件存在"
else
    echo "❌ test_hid 文件不存在" 
    echo "   请运行: cc test_hid.c -o test_hid /opt/homebrew/lib/libhidapi.dylib"
fi
echo ""

# 3. 测试 HID 设备访问权限
echo "3. 测试 HID 设备访问权限..."
if [ -f "./test_hid" ]; then
    echo "尝试直接访问 HID 设备..."
    HID_OUTPUT=$(./test_hid 2>&1)
    
    if echo "$HID_OUTPUT" | grep -q "Successfully opened K380"; then
        echo "✅ HID 设备访问成功！"
        echo "   权限设置正确"
    elif echo "$HID_OUTPUT" | grep -q "not permitted"; then
        echo "❌ HID 设备访问被拒绝"
        echo "   需要添加输入监控权限"
        echo ""
        echo "解决方案："
        echo "1. 打开 系统设置 → 隐私与安全性 → 输入监控"
        echo "2. 添加应用: /Users/brarylai/Documents/code/plugin/k380-function-keys-conf/node_modules/electron/dist/Electron.app"
        echo "3. 重启应用"
    elif echo "$HID_OUTPUT" | grep -q "FOUND K380"; then
        echo "⚠️  检测到 K380 设备但无法打开"
        echo "   可能的原因: 权限问题或设备占用"
    else
        echo "❌ 未检测到 K380 设备"
        echo "   请确保设备已连接"
    fi
    
    echo ""
    echo "详细输出:"
    echo "$HID_OUTPUT"
else
    echo "❌ 无法测试，test_hid 文件不存在"
fi
echo ""

# 4. 检查系统信息
echo "4. 系统信息..."
echo "macOS 版本: $(sw_vers -productVersion)"
echo "处理器架构: $(uname -m)"
echo ""

# 5. 权限建议
echo "5. 权限设置指南..."
echo "如果遇到权限问题，请按以下步骤操作："
echo ""
echo "步骤 1: 打开系统设置"
MACOS_VERSION=$(sw_vers -productVersion | cut -d. -f1)
if [ "$MACOS_VERSION" -ge 13 ]; then
    echo "  → 系统设置 → 隐私与安全性 → 输入监控"
else
    echo "  → 系统偏好设置 → 安全性与隐私 → 隐私 → 输入监控"
fi
echo ""
echo "步骤 2: 添加 Electron.app"
echo "  路径: $(pwd)/node_modules/electron/dist/Electron.app"
echo ""
echo "步骤 3: 重启应用"
echo "  完全退出应用后重新启动"
echo ""
echo "步骤 4: 如果仍有问题，重启系统"
echo "  macOS 有时需要重启才能生效输入监控权限"
echo ""

echo "=== 诊断完成 ===" 