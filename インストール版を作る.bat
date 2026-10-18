@echo off
chcp 65001 >nul
cd /d "%~dp0frontend"
title しゃぼん玉在庫 — インストール版を作成

echo.
echo ========================================
echo   インストール版（Windows）を作成します
echo ========================================
echo.
echo   完成後: frontend\release\ShabonInventorySetup-*.exe
echo   ダブルクリックでPCにインストールできます
echo.

call npm install
if errorlevel 1 (
  echo npm install に失敗しました
  pause
  exit /b 1
)

call npm run electron:build
if errorlevel 1 (
  echo ビルドに失敗しました
  pause
  exit /b 1
)

echo.
echo 完了しました。release フォルダを開きます。
start "" "%~dp0frontend\release"
pause
