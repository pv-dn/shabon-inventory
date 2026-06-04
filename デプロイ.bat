@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Deploy

echo.
echo ========================================
echo   Deploy - Choose method
echo ========================================
echo.
echo   [1] Render (recommended) - fixed URL for all stores
echo       Requires GitHub login (browser opens)
echo.
echo   [2] Quick URL (Cloudflare) - works now, PC must stay on
echo.
echo   [3] Local only (already installed)
echo.
set /p CHOICE=Select 1-3:

if "%CHOICE%"=="1" goto render
if "%CHOICE%"=="2" goto tunnel
if "%CHOICE%"=="3" goto local
goto end

:render
if not exist ".venv\Scripts\python.exe" call "%~dp0インストール.bat"
git init 2>nul
git add -A
git commit -m "Deploy shabon inventory app" 2>nul
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\deploy_render.ps1"
goto end

:tunnel
if not exist ".venv\Scripts\python.exe" call "%~dp0インストール.bat"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\deploy_cloudflare.ps1"
goto end

:local
call "%~dp0起動.bat"
goto end

:end
pause
