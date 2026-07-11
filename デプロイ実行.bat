@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Deploy to GitHub + Fly.io

echo.
echo ========================================
echo   Cloud deploy (GitHub + Fly.io + Neon)
echo ========================================
echo.
echo   1) Browser may open for GitHub / Fly login
echo   2) Neon DATABASE_URL が必要です
echo   3) 完了後 URL: https://shabon-inventory.fly.dev
echo.
pause

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\deploy_fly.ps1"
pause
