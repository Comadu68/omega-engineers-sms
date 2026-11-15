@echo off
title Omega Engineers - Dev Testing
cd /d "%~dp0"
echo ========================================================
echo  OMEGA ENGINEERS SERVICE STATION - DEV ENVIRONMENT
echo ========================================================
echo [INFO] Starting Vite dev server and Electron desktop window...
npm run dev
pause
