@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Deploy to GitHub + Render

echo.
echo ========================================
echo   Cloud deploy (GitHub + Render + Neon)
echo ========================================
echo.
echo   1) Browser opens for GitHub login
echo   2) Enter the 8-digit code shown below
echo   3) After login, code uploads to GitHub
echo   4) Neon and Render dashboards open
echo.
pause

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\deploy_now.ps1"
pause
