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

echo [1/6] Creating virtual environment...
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

echo [2/6] Installing packages...
"%PIP%" install -r requirements.txt
if errorlevel 1 (
    echo [ERROR] pip install failed.
    pause
    exit /b 1
)

echo [3/6] Initializing database...
"%PY%" -c "from database import init_db, sync_products_from_json; init_db(); sync_products_from_json()"

echo [4/6] Importing Excel if available...
"%PY%" import_excel.py
if not errorlevel 1 (
    "%PY%" -c "from database import sync_products_from_json; sync_products_from_json()"
)

echo [5/6] Building React UI...
where npm >nul 2>&1
if errorlevel 1 (
    echo [WARN] Node.js not found - UI build skipped.
    echo Install Node.js LTS from https://nodejs.org/ then run:
    echo   cd frontend ^& npm install ^& npm run build
) else (
    pushd frontend
    call npm ci
    if errorlevel 1 call npm install
    call npm run build
    popd
    if errorlevel 1 (
        echo [ERROR] Frontend build failed.
        pause
        exit /b 1
    )
)

echo [6/6] Creating icon and shortcut...
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
