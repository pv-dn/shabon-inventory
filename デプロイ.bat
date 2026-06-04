@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Fixed URL Deploy (Render)

echo.
echo ========================================
echo   Fixed URL deploy (NO PC server)
echo ========================================
echo.
echo   Your PC does NOT need to stay on.
echo   App runs on Render cloud 24/7.
echo.
echo   Open guide: 固定URLで公開する手順.md
echo.
start "" "%~dp0固定URLで公開する手順.md"
echo.
echo   [1] Auto upload to GitHub (needs GitHub login in browser)
echo   [2] Open Render dashboard
echo   [3] Open Neon (free database)
echo   [Q] Quit
echo.
set /p CHOICE=Select:

if /i "%CHOICE%"=="1" goto github
if /i "%CHOICE%"=="2" goto render
if /i "%CHOICE%"=="3" goto neon
goto end

:github
if not exist ".venv\Scripts\python.exe" call "%~dp0インストール.bat"
git add -A
git commit -m "React UI and cloud deploy config" 2>nul
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\deploy_render.ps1"
goto end

:render
start https://dashboard.render.com/blueprints
goto end

:neon
start https://neon.tech
goto end

:end
pause
