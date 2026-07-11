@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Shabon inventory — Supabase + GitHub Pages

echo.
echo ========================================
echo   Deploy (Supabase + GitHub Pages)
echo   Render / Fly は使いません
echo ========================================
echo.
echo   Open guide: Supabase公開の手順.md
echo.
start "" "%~dp0Supabase公開の手順.md"
echo.
echo   [1] Open Supabase dashboard (NEW project for shabon only)
echo   [2] Open GitHub repo
echo   [3] Seed products.json (needs env vars)
echo   [Q] Quit
echo.
set /p CHOICE=Select:

if /i "%CHOICE%"=="1" goto supabase
if /i "%CHOICE%"=="2" goto github
if /i "%CHOICE%"=="3" goto seed
goto end

:supabase
start https://supabase.com/dashboard
goto end

:github
start https://github.com/pv-dn/shabon-inventory
goto end

:seed
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\seed_supabase.ps1"
goto end

:end
pause
