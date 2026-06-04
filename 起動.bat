@echo off
chcp 65001 >nul
cd /d "%~dp0"
title しゃぼん玉在庫管理

if not exist ".venv\Scripts\python.exe" (
    echo 初回は「インストール.bat」を実行してください。
    pause
    exit /b 1
)

echo しゃぼん玉せっけん 在庫管理を起動しています...

REM 以前の起動プロセスが残っていれば終了
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5050" ^| findstr "LISTENING"') do (
  taskkill /PID %%a /F >nul 2>&1
)

".venv\Scripts\python.exe" run.py
pause
