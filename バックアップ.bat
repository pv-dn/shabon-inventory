@echo off
chcp 65001 >nul
cd /d "%~dp0"
set BACKUP_DIR=%~dp0backups
set STAMP=%date:~0,4%%date:~5,2%%date:~8,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set STAMP=%STAMP: =0%
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"
set OUT=%BACKUP_DIR%\backup_%STAMP%

echo バックアップ中...
mkdir "%OUT%" 2>nul
xcopy /E /I /Y "%~dp0data" "%OUT%\data" >nul
if exist "%~dp0config.json" copy /Y "%~dp0config.json" "%OUT%\" >nul
echo 完了: %OUT%
explorer "%OUT%"
pause
