#!/bin/bash

echo "Starting MarkItDown in development mode..."
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Install server dependencies
echo "Installing server dependencies..."
cd server
npm install

# Start server in background
echo "Starting server on port 5296..."
npm run dev &
SERVER_PID=$!

# Go back to root
cd ..

# Install client dependencies
echo "Installing client dependencies..."
cd client
npm install

# Start client
echo "Starting client on port 3000..."
echo ""
echo "========================================"
echo "MarkItDown is running!"
echo "Open http://localhost:3000 in your browser"
echo "Press Ctrl+C to stop"
echo "========================================"
echo ""

# Start client (this will block)
npm run dev

# When client stops, kill server
kill $SERVER_PID
