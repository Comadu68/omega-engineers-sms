@echo off
title Omega Engineers - Dev Testing
cd /d "%~dp0"

set "PATH=C:\Program Files\nodejs;C:\Program Files (x86)\nodejs;%PATH%"

echo ========================================================
echo  OMEGA ENGINEERS SERVICE STATION - DEV ENVIRONMENT
echo ========================================================
echo [INFO] Starting Vite dev server and Electron desktop window...
call npm run dev
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Dev server stopped with code: %ERRORLEVEL%
)
pause
