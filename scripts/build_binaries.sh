#!/bin/bash

# K380 Function Keys Manager - 二进制构建脚本
# 用于构建 k380_improved 和 test_hid 二进制文件

set -e  # 遇到错误立即退出

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

# 项目根目录
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BIN_DIR="$PROJECT_ROOT/bin"
SRC_DIR="$PROJECT_ROOT/tools"

print_info "K380 Function Keys Manager - Binary Build Script"
print_info "Project root: $PROJECT_ROOT"

# 创建 bin 目录
mkdir -p "$BIN_DIR"

# 检查编译工具
print_info "Checking build tools..."

if ! command -v gcc &> /dev/null; then
    print_error "GCC not found. Please install Xcode command line tools:"
    print_error "xcode-select --install"
    exit 1
fi

if ! command -v pkg-config &> /dev/null; then
    print_warning "pkg-config not found. Installing via Homebrew..."
    brew install pkg-config || {
        print_error "Failed to install pkg-config"
        exit 1
    }
fi

# 检查 hidapi
print_info "Checking hidapi dependency..."
if ! pkg-config --exists hidapi; then
    print_warning "hidapi not found. Installing via Homebrew..."
    brew install hidapi || {
        print_error "Failed to install hidapi"
        exit 1
    }
fi

# 获取 hidapi 编译参数
HIDAPI_CFLAGS=$(pkg-config --cflags hidapi)
HIDAPI_LIBS=$(pkg-config --libs --static hidapi)

print_info "HIDAPI_CFLAGS: $HIDAPI_CFLAGS"
print_info "HIDAPI_LIBS: $HIDAPI_LIBS"

# 构建 k380_improved
print_info "Building k380_improved..."

if [ -f "$SRC_DIR/k380_conf_improved.c" ]; then
    gcc -o "$BIN_DIR/k380_improved" \
        "$SRC_DIR/k380_conf_improved.c" \
        $HIDAPI_CFLAGS $HIDAPI_LIBS \
        -framework IOKit -framework CoreFoundation
    
    if [ $? -eq 0 ]; then
        print_success "k380_improved built successfully"
        chmod +x "$BIN_DIR/k380_improved"
        
        # 检查依赖
        print_info "Checking dependencies for k380_improved:"
        otool -L "$BIN_DIR/k380_improved" || true
    else
        print_error "Failed to build k380_improved"
        exit 1
    fi
else
    print_error "Source file not found: $SRC_DIR/k380_conf_improved.c"
    exit 1
fi

# 构建 test_hid
print_info "Building test_hid..."

if [ -f "$SRC_DIR/test_hid.c" ]; then
    gcc -o "$BIN_DIR/test_hid" \
        "$SRC_DIR/test_hid.c" \
        $HIDAPI_CFLAGS $HIDAPI_LIBS \
        -framework IOKit -framework CoreFoundation
    
    if [ $? -eq 0 ]; then
        print_success "test_hid built successfully"
        chmod +x "$BIN_DIR/test_hid"
        
        # 检查依赖
        print_info "Checking dependencies for test_hid:"
        otool -L "$BIN_DIR/test_hid" || true
    else
        print_error "Failed to build test_hid"
        exit 1
    fi
else
    print_error "Source file not found: $SRC_DIR/test_hid.c"
    exit 1
fi

# 验证构建结果
print_info "Verifying build results..."

for binary in "k380_improved" "test_hid"; do
    if [ -x "$BIN_DIR/$binary" ]; then
        print_success "$binary: Built and executable"
        file "$BIN_DIR/$binary"
    else
        print_error "$binary: Build failed or not executable"
        exit 1
    fi
done

# 处理动态库依赖
print_info "Fixing dynamic library dependencies..."

# 获取hidapi库路径
HIDAPI_LIB_PATH=$(pkg-config --variable=libdir hidapi)/libhidapi.0.dylib

if [ -f "$HIDAPI_LIB_PATH" ]; then
    print_info "Found hidapi library at: $HIDAPI_LIB_PATH"
    
    # 复制hidapi库到bin目录
    cp "$HIDAPI_LIB_PATH" "$BIN_DIR/"
    
    # 修改二进制文件的库路径引用
    for binary in "k380_improved" "test_hid"; do
        print_info "Updating library paths for $binary..."
        
        # 获取当前的hidapi库路径（实际链接的路径）
        CURRENT_HIDAPI_PATH=$(otool -L "$BIN_DIR/$binary" | grep hidapi | awk '{print $1}' | tr -d '\t')
        
        if [ -n "$CURRENT_HIDAPI_PATH" ]; then
            print_info "Current hidapi path: $CURRENT_HIDAPI_PATH"
            
            # 修改hidapi库的引用路径为相对路径
            install_name_tool -change "$CURRENT_HIDAPI_PATH" "@executable_path/libhidapi.0.dylib" "$BIN_DIR/$binary"
            
            # 验证修改结果
            print_info "Updated dependencies for $binary:"
            otool -L "$BIN_DIR/$binary" | grep -E "(hidapi|@executable_path)" || echo "No hidapi reference found"
        else
            print_warning "No hidapi reference found in $binary"
        fi
    done
    
    print_success "Library dependencies fixed!"
else
    print_warning "hidapi library not found at expected location, dynamic linking may fail in packaged app"
fi

# 显示文件信息
print_info "Build summary:"
ls -la "$BIN_DIR"

print_success "All binaries built successfully!"
print_info "You can now run 'npm run build' to build the Electron application." 