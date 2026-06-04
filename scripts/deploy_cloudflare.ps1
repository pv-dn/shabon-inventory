# Quick tunnel: public URL without GitHub (PC must stay on)
$AppDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $AppDir

$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

$cf = Get-Command cloudflared -ErrorAction SilentlyContinue
if (-not $cf) {
    Write-Host "Installing cloudflared..."
    winget install --id Cloudflare.cloudflared -e --accept-source-agreements --accept-package-agreements
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
}

Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Get-NetTCPConnection -LocalPort 5050 -ErrorAction SilentlyContinue | ForEach-Object {
    Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
}

$password = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 12 | ForEach-Object { [char]$_ })
$env:APP_PASSWORD = $password
$env:HOST = "127.0.0.1"
$env:PORT = "5050"
$env:OPEN_BROWSER = "false"

$py = Join-Path $AppDir ".venv\Scripts\python.exe"
if (-not (Test-Path $py)) { throw "Run install.bat first" }

Write-Host "Starting app..."
Start-Process -FilePath $py -ArgumentList "run.py" -WorkingDirectory $AppDir -WindowStyle Minimized
Start-Sleep -Seconds 4

$logFile = Join-Path $AppDir "tunnel.log"
if (Test-Path $logFile) { Remove-Item $logFile }
Write-Host "Starting Cloudflare tunnel..."
Start-Process -FilePath "cloudflared" -ArgumentList "tunnel --url http://127.0.0.1:5050" -WorkingDirectory $AppDir -RedirectStandardOutput $logFile -RedirectStandardError "tunnel-err.log" -WindowStyle Minimized

Start-Sleep -Seconds 12
$log = ""
if (Test-Path $logFile) { $log = Get-Content $logFile -Raw }
if (Test-Path (Join-Path $AppDir "tunnel-err.log")) { $log += Get-Content (Join-Path $AppDir "tunnel-err.log") -Raw }

$url = "（tunnel.log を確認）"
if ($log -match 'https://[a-z0-9-]+\.trycloudflare\.com') { $url = $Matches[0] }

$infoPath = Join-Path $AppDir "公開URL.txt"
@"
しゃぼん玉在庫管理 - 公開情報
============================
URL:      $url
Password: $password

※ このPCを起動したままにしてください
※ 固定URLが必要なら Render デプロイ（デプロイ.bat → 1）を使ってください
"@ | Out-File $infoPath -Encoding utf8

Write-Host ""
Get-Content $infoPath
Start-Process notepad $infoPath
