@echo off
echo ========================================
echo Downloading Test 3D Model
echo ========================================
echo.

cd backend\local_models

echo Downloading Duck.glb from Khronos glTF samples...
echo.

powershell -Command "Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Duck/glTF-Binary/Duck.glb' -OutFile 'Duck.glb'"

if exist Duck.glb (
    echo.
    echo ========================================
    echo SUCCESS! Model downloaded!
    echo ========================================
    echo.
    echo File: backend\local_models\Duck.glb
    echo Size: 
    dir Duck.glb | findstr Duck.glb
    echo.
    echo Now refresh your browser and try uploading images!
    echo The Duck model should appear in the viewer.
    echo.
) else (
    echo.
    echo ========================================
    echo FAILED to download model
    echo ========================================
    echo.
    echo Please download manually from:
    echo https://github.com/KhronosGroup/glTF-Sample-Models
    echo.
    echo Save any .glb file to: backend\local_models\
    echo.
)

pause
