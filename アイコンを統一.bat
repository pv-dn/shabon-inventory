@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo アイコンを生成・同期しています...
python scripts\make_icon.py
if errorlevel 1 (
  echo 失敗しました。Python と logo_1.png を確認してください。
  pause
  exit /b 1
)

echo.
echo Chromeアプリとデスクトップのアイコンを統一しています...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\update_app_shortcut_icon.ps1"

echo.
echo 完了。「しゃぼん玉在庫管理」と同じアイコンに揃えました。
echo デスクトップのアイコンが変わらない場合は、F5 で更新するか PC を再起動してください。
pause
