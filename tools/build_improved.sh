#!/bin/bash

# Build script for improved K380 configuration tool

echo "Building improved K380 configuration tool..."

# Check if hidapi is installed
if ! command -v pkg-config >/dev/null 2>&1; then
    echo "pkg-config not found. Installing via homebrew..."
    brew install pkg-config
fi

if ! pkg-config --exists hidapi; then
    echo "hidapi not found. Installing via homebrew..."
    brew install hidapi
fi

# Build the improved version
cc -g k380_conf_improved.c -o k380_improved /opt/homebrew/lib/libhidapi.dylib

if [ $? -eq 0 ]; then
    echo "Build successful!"
    echo "Usage examples:"
    echo "  sudo ./k380_improved -f on     # Enable F-keys once"
    echo "  sudo ./k380_improved -m on     # Monitor and maintain F-keys enabled"
    echo "  sudo ./k380_improved -h        # Show help"
else
    echo "Build failed!"
    exit 1
fi 