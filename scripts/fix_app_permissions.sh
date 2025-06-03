#!/bin/bash

# K380 Function Keys Manager - 应用权限修复脚本
# 用于解决打包后应用的 macOS 安全限制问题

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印函数
print_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

print_info "K380 Function Keys Manager - 应用权限修复脚本"

# 查找应用路径
APP_NAME="K380 Function Keys Manager.app"
POSSIBLE_PATHS=(
    "/Applications/$APP_NAME"
    "$HOME/Applications/$APP_NAME"
    "$HOME/Desktop/$APP_NAME"
    "$HOME/Downloads/$APP_NAME"
)

APP_PATH=""
for path in "${POSSIBLE_PATHS[@]}"; do
    if [ -d "$path" ]; then
        APP_PATH="$path"
        break
    fi
done

if [ -z "$APP_PATH" ]; then
    print_error "找不到 K380 Function Keys Manager.app"
    print_info "请确保应用已安装到以下位置之一："
    for path in "${POSSIBLE_PATHS[@]}"; do
        echo "  - $path"
    done
    exit 1
fi

print_success "找到应用: $APP_PATH"

# 清除隔离属性
print_info "清除应用的隔离属性..."
if xattr -dr com.apple.quarantine "$APP_PATH" 2>/dev/null; then
    print_success "隔离属性已清除"
else
    print_info "没有发现隔离属性"
fi

# 进行 ad-hoc 签名
print_info "进行临时代码签名..."
if codesign --force --deep --sign - "$APP_PATH" 2>/dev/null; then
    print_success "代码签名完成"
else
    print_warning "代码签名失败，但应用仍可能正常工作"
fi

# 修复二进制文件权限
BIN_DIR="$APP_PATH/Contents/Resources/bin"
if [ -d "$BIN_DIR" ]; then
    print_info "修复二进制文件权限..."
    
    for binary in "k380" "k380_improved" "test_hid"; do
        binary_path="$BIN_DIR/$binary"
        if [ -f "$binary_path" ]; then
            chmod +x "$binary_path"
            codesign --force --sign - "$binary_path" 2>/dev/null || true
            print_success "已修复: $binary"
        fi
    done
    
    # 修复动态库
    dylib_path="$BIN_DIR/libhidapi.0.dylib"
    if [ -f "$dylib_path" ]; then
        chmod 644 "$dylib_path"
        codesign --force --sign - "$dylib_path" 2>/dev/null || true
        print_success "已修复: libhidapi.0.dylib"
    fi
else
    print_warning "未找到 bin 目录: $BIN_DIR"
fi

print_success "权限修复完成！"

print_info "接下来请执行以下步骤："
echo "1. 打开'系统设置' → '隐私与安全性' → '输入监控'"
echo "2. 添加应用: $APP_PATH"
echo "3. 确保应用已勾选"
echo "4. 完全退出并重启 K380 Function Keys Manager"

print_info "如果问题持续存在，请尝试重启系统" 