# GitHub push only (legacy Render helper)
# 本番デプロイは scripts\deploy_fly.ps1 を使ってください。

$AppDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $AppDir

Write-Host "本番は Fly.io です。deploy_fly.ps1 に切り替えてください。"
Write-Host "Running: scripts\deploy_fly.ps1"
powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $AppDir "scripts\deploy_fly.ps1")
