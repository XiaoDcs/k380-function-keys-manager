#!/bin/bash

echo "=== K380 Function Keys Manager - 快速测试 ==="
echo ""

# 检测当前状态
echo "🔍 检测当前状态..."
echo ""

# 1. 检查K380连接
echo "1. 检查 K380 连接状态..."
if system_profiler SPBluetoothDataType -json 2>/dev/null | grep -q "Keyboard K380"; then
    echo "✅ K380 设备已连接"
else
    echo "❌ K380 设备未连接"
    echo "   请确保 K380 已配对并连接"
fi
echo ""

# 2. 检查二进制文件
echo "2. 检查可执行文件..."
if [ -f "./k380_improved" ]; then
    echo "✅ k380_improved 存在"
else
    echo "❌ k380_improved 不存在，正在构建..."
    ./build_improved.sh
fi
echo ""

# 3. 测试权限
echo "3. 测试权限状态..."
if [ -f "./test_hid" ]; then
    HID_TEST=$(./test_hid 2>&1)
    if echo "$HID_TEST" | grep -q "Successfully opened K380"; then
        echo "✅ HID 权限正常"
    elif echo "$HID_TEST" | grep -q "privilege violation"; then
        echo "⚠️  权限问题检测到"
        echo "   需要在系统设置中添加输入监控权限"
    else
        echo "ℹ️  权限状态: 需要进一步检查"
    fi
else
    echo "⚠️  test_hid 不存在，无法测试权限"
fi
echo ""

# 4. 显示改进功能
echo "🚀 新功能亮点："
echo ""
echo "密码管理改进："
echo "  • 密码缓存 5 分钟，减少重复输入"
echo "  • 密码错误时自动清除缓存"
echo "  • 应用退出时安全清理缓存"
echo ""
echo "开机自启动修复："
echo "  • 开发模式：友好提示需要构建正式版本"
echo "  • 正式版本：完整支持开机自启动功能"
echo ""
echo "用户体验提升："
echo "  • 更好的错误提示和处理"
echo "  • 开发模式和正式版本明确区分"
echo "  • 构建指南和说明文档"
echo ""

# 5. 提供下一步建议
echo "📋 下一步建议："
echo ""
if [ -f "./node_modules/electron/dist/Electron.app/Contents/MacOS/Electron" ]; then
    echo "当前运行在开发模式："
    echo ""
    echo "立即测试改进功能："
    echo "  npm start"
    echo ""
    echo "构建正式版本（推荐）："
    echo "  npm run build"
    echo "  # 然后安装 dist 目录中的 .dmg 文件"
    echo ""
    echo "📖 详细构建指南："
    echo "  cat BUILD_GUIDE.md"
else
    echo "立即测试："
    echo "  npm start"
fi
echo ""

echo "=== 测试完成 ===" 