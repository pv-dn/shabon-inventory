@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Shabon Inventory Install

echo.
echo ========================================
echo   Shabon Inventory - Setup
echo ========================================
echo.

python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found.
    echo Install Python 3.10+ from https://www.python.org/downloads/
    echo Check "Add python.exe to PATH" during install.
    pause
    exit /b 1
)

echo [1/5] Creating virtual environment...
if not exist ".venv\Scripts\python.exe" (
    python -m venv .venv
    if errorlevel 1 (
        echo [ERROR] Failed to create venv.
        pause
        exit /b 1
    )
)

set PY=%~dp0.venv\Scripts\python.exe
set PIP=%~dp0.venv\Scripts\pip.exe

echo [2/5] Installing packages...
"%PIP%" install -r requirements.txt
if errorlevel 1 (
    echo [ERROR] pip install failed.
    pause
    exit /b 1
)

echo [3/5] Initializing database...
"%PY%" -c "from database import init_db, sync_products_from_json; init_db(); sync_products_from_json()"

echo [4/5] Importing Excel if available...
"%PY%" import_excel.py
if not errorlevel 1 (
    "%PY%" -c "from database import sync_products_from_json; sync_products_from_json()"
)

echo [5/5] Creating icon and shortcut...
"%PY%" scripts\make_icon.py
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\create_shortcut.ps1"

echo.
echo ========================================
echo   Setup complete!
echo ========================================
echo.
echo   Start: Desktop shortcut or "起動.bat"
echo   Data:  %~dp0data\
echo.
pause
