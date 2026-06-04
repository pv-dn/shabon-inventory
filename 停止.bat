@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 在庫管理アプリを停止しています...
set FOUND=0
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5050" ^| findstr "LISTENING"') do (
  taskkill /PID %%a /F >nul 2>&1
  set FOUND=1
  echo 停止しました (PID %%a)
)
if "%FOUND%"=="0" echo 起動中のプロセスはありませんでした。
timeout /t 2 >nul
