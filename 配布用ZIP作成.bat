@echo off
chcp 65001 >nul
cd /d "%~dp0"
set OUT=%~dp0..\shabon-inventory-app-配布版.zip
set STAGE=%TEMP%\shabon-inventory-stage

echo 配布用 ZIP を作成しています...
if exist "%STAGE%" rmdir /S /Q "%STAGE%"
mkdir "%STAGE%"

for %%F in (
  app.py run.py config.py config.json database.py import_excel.py requirements.txt
  README.md インストール.bat 起動.bat 停止.bat バックアップ.bat
  デスクトップにショートカット作成.bat
) do if exist "%%F" copy /Y "%%F" "%STAGE%\" >nul

for %%D in (data static templates scripts assets) do (
  if exist "%%D" xcopy /E /I /Y "%%D" "%STAGE%\%%D" >nul
)

powershell -NoProfile -Command "Compress-Archive -Path '%STAGE%\*' -DestinationPath '%OUT%' -Force"
rmdir /S /Q "%STAGE%"

if exist "%OUT%" (
  echo 作成完了: %OUT%
  explorer /select,"%OUT%"
) else (
  echo 作成に失敗しました
)
pause
