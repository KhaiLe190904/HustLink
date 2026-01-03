#!/bin/bash

set -e

echo "Checking Frontend formatting..."
cd fe
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi
npm run format:check
cd ..

echo ""
echo "Checking Backend formatting..."
cd be && ./gradlew spotlessCheck && cd ..

echo ""
echo "All formatting checks passed!"
