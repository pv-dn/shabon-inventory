$AppDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $AppDir

$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue)) {
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
if (Test-Path $logFile) { Remove-Item $logFile -Force }
Write-Host "Starting Cloudflare tunnel..."
Start-Process -FilePath "cloudflared" -ArgumentList "tunnel --url http://127.0.0.1:5050" -WorkingDirectory $AppDir -RedirectStandardOutput $logFile -RedirectStandardError (Join-Path $AppDir "tunnel-err.log") -WindowStyle Minimized

Start-Sleep -Seconds 12
$log = ""
if (Test-Path $logFile) { $log += Get-Content $logFile -Raw }
$errLog = Join-Path $AppDir "tunnel-err.log"
if (Test-Path $errLog) { $log += Get-Content $errLog -Raw }

$url = "check tunnel.log"
if ($log -match 'https://[a-z0-9-]+\.trycloudflare\.com') { $url = $Matches[0] }

$infoPath = Join-Path $AppDir "publish-url.txt"
"URL: $url" | Out-File $infoPath -Encoding utf8
"Password: $password" | Add-Content $infoPath -Encoding utf8

Write-Host ""
Write-Host "URL: $url"
Write-Host "Password: $password"
Write-Host "Saved: $infoPath"
