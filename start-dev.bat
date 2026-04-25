@echo off
echo Starting AI Glasses Development Environment...
echo.

echo Starting Backend Server...
start "Backend Server" cmd /k "cd backend && node server.mjs"

timeout /t 3 /nobreak > nul

echo Starting Frontend Server...
start "Frontend Server" cmd /k "cd frontend && npm run dev"

echo.
echo ========================================
echo Development servers are starting...
echo ========================================
echo Backend:  http://localhost:5000
echo Frontend: http://localhost:5173
echo Admin:    http://localhost:5173/admin.html
echo ========================================
echo.
echo Press any key to stop all servers...
pause > nul

taskkill /FI "WindowTitle eq Backend Server*" /T /F
taskkill /FI "WindowTitle eq Frontend Server*" /T /F
