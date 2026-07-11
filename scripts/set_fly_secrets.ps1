# Fly.io secrets 設定ヘルパー
# Neon の Connection string を用意してから実行してください。
#
# 使い方:
#   powershell -File scripts\set_fly_secrets.ps1
# または環境変数 DATABASE_URL をセットしてから実行

$AppDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $AppDir

$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
    [System.Environment]::GetEnvironmentVariable("Path", "User")

if (-not (Get-Command flyctl -ErrorAction SilentlyContinue)) {
    Write-Host "flyctl がありません。https://fly.io/docs/hands-on/install-flyctl/ からインストールしてください。"
    Write-Host "または: powershell -Command `"iwr https://fly.io/install.ps1 -useb | iex`""
    exit 1
}

$appName = "shabon-inventory"
$appPassword = "haizi814"

flyctl auth whoami 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Fly.io にログインします..."
    flyctl auth login
}

$neonUrl = $env:DATABASE_URL
if (-not $neonUrl) {
    Write-Host ""
    Write-Host "Neon (https://neon.tech) の Connection string を貼り付けてください。"
    Write-Host "例: postgresql://user:pass@ep-xxxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
    $neonUrl = Read-Host "DATABASE_URL"
}
if (-not $neonUrl) {
    throw "DATABASE_URL が空です"
}

$secretKey = [guid]::NewGuid().ToString("N") + [guid]::NewGuid().ToString("N")
Write-Host "Setting secrets on $appName ..."
flyctl secrets set "APP_PASSWORD=$appPassword" "SECRET_KEY=$secretKey" "DATABASE_URL=$neonUrl" -a $appName

Write-Host ""
Write-Host "完了。次に: flyctl deploy -a $appName --remote-only"
Write-Host "ログインパスワード: $appPassword"
