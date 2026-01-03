@echo off
echo Checking Frontend formatting...
cd fe
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
)
call npm run format:check
if %errorlevel% neq 0 (
    echo Frontend formatting check failed!
    cd ..
    exit /b 1
)
cd ..

echo.
echo Checking Backend formatting...
cd be
call gradlew.bat spotlessCheck
if %errorlevel% neq 0 (
    echo Backend formatting check failed!
    cd ..
    exit /b 1
)
cd ..

echo.
echo All formatting checks passed!
