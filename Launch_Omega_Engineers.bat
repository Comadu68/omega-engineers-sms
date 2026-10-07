@echo off
title Omega Engineers Service Station
cd /d "%~dp0"

set "EXE_PATH=D:\Omega_Engineers_Desktop_App_Antigravity_Pack\release\win-unpacked\Omega Engineers Service Station.exe"

if exist "%EXE_PATH%" (
    start "" "%EXE_PATH%"
) else if exist "%~dp0release\win-unpacked\Omega Engineers Service Station.exe" (
    start "" "%~dp0release\win-unpacked\Omega Engineers Service Station.exe"
) else (
    echo [INFO] Starting application via npm development server...
    cmd /c npm run dev
)
exit
