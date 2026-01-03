#!/bin/bash

echo "Formatting Frontend..."
cd fe
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi
npm run format
cd ..

echo ""
echo "Formatting Backend..."
cd be && ./gradlew spotlessApply && cd ..

echo ""
echo "Done! All code has been formatted."
