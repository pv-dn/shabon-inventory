# One-shot: GitHub push + Fly.io deploy (run after gh / flyctl auth login)
$ErrorActionPreference = "Stop"
$AppDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $AppDir

$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
    [System.Environment]::GetEnvironmentVariable("Path", "User") + ";" +
    "$env:USERPROFILE\.fly\bin"

gh auth status 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "=== GitHub login ===" -ForegroundColor Cyan
    Write-Host "Browser opens. Enter the code shown below at https://github.com/login/device"
    Write-Host ""
    gh auth login -h github.com -p https -w
}

& (Join-Path $AppDir "scripts\deploy_fly.ps1")
