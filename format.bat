@echo off
echo Formatting Frontend...
cd fe
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
)
call npm run format
cd ..

echo.
echo Formatting Backend...
cd be
call gradlew.bat spotlessApply
cd ..

echo.
echo Done! All code has been formatted.
