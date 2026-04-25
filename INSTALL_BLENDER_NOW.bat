@echo off
echo ========================================
echo  BLENDER INSTALLATION FOR PROFESSIONAL
echo  AR GLASSES SYSTEM
echo ========================================
echo.

echo Step 1: Checking if Blender is already installed...
blender --version 2>nul
if %errorlevel% equ 0 (
    echo [SUCCESS] Blender is already installed!
    echo.
    blender --version
    echo.
    echo Press any key to test 3D generation...
    pause >nul
    goto TEST
)

echo [INFO] Blender not found. Installing now...
echo.

echo Step 2: Installing Blender using Windows Package Manager...
echo This will download ~354 MB and may take 5-10 minutes.
echo.

winget install --id BlenderFoundation.Blender --accept-package-agreements --accept-source-agreements

echo.
echo Step 3: Refreshing environment variables...
echo Please close this window and open a NEW terminal window.
echo Then run this script again to verify installation.
echo.
pause
exit

:TEST
echo ========================================
echo  TESTING BLENDER 3D GENERATION
echo ========================================
echo.

cd backend

echo Creating test 3D model...
blender --background --python scripts/glasses_parametric.py -- 140 20 145 test-install

if exist "output\test-install.glb" (
    echo.
    echo [SUCCESS] Blender is working perfectly!
    echo Test model created: backend\output\test-install.glb
    echo.
    echo ========================================
    echo  READY FOR PROFESSIONAL MODE!
    echo ========================================
    echo.
    echo Next steps:
    echo 1. Stop the test server (Ctrl+C in backend terminal)
    echo 2. Start professional server: node admin-workflow-server.mjs
    echo 3. Upload glasses and generate unique 3D models!
    echo.
) else (
    echo.
    echo [ERROR] Test model not created.
    echo Please check:
    echo 1. Blender is in PATH
    echo 2. Python script exists: backend\scripts\glasses_parametric.py
    echo 3. Output folder exists: backend\output\
    echo.
)

pause
