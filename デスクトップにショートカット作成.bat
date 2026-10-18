@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo デスクトップに「しゃぼん玉在庫管理」ショートカットを作成します...
echo 開き先: https://pv-dn.github.io/shabon-inventory/

if not exist "assets\app.ico" (
  echo アイコンを作成しています...
  python scripts\make_icon.py
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\create_shortcut.ps1"
if errorlevel 1 (
  echo 作成に失敗しました。
  pause
  exit /b 1
)

echo.
echo 完了しました。デスクトップの「しゃぼん玉在庫管理」から開けます。
echo パスワード: haizi812
pause
