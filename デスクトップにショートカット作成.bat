@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo アイコンを作成しています...
python scripts\make_icon.py
if errorlevel 1 (
  echo アイコン作成に失敗しました。
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\create_shortcut.ps1"

echo.
echo デスクトップに「しゃぼん玉在庫管理」のショートカットを作成しました。
echo このショートカットから起動してください。
pause
