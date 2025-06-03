#!/bin/bash

# K380 Function Keys Manager Startup Script

echo "Starting K380 Function Keys Manager..."

# Check if Node.js is available
if ! command -v node >/dev/null 2>&1; then
    echo "Error: Node.js is not installed or not in PATH"
    echo "Please install Node.js using: brew install node"
    exit 1
fi

# Check if npm dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Check if the improved C binary exists
if [ ! -f "k380_improved" ]; then
    echo "Building improved K380 tool..."
    ./build_improved.sh
fi

# Start the Electron app
echo "Launching GUI application..."
npm start 