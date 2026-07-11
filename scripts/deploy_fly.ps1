# GitHub push + Fly.io deploy
# 事前: flyctl auth login / Neon の DATABASE_URL
$AppDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $AppDir

$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
    [System.Environment]::GetEnvironmentVariable("Path", "User")

function Ensure-Command($name) {
    if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
        throw "$name が見つかりません。インストールしてから再実行してください。"
    }
}

Ensure-Command gh
Ensure-Command flyctl

gh auth status 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "GitHub login required. Browser will open..."
    gh auth login -h github.com -p https -w
}

$repoName = "shabon-inventory"
$owner = (gh api user -q .login 2>$null)
if (-not $owner) {
    $remote = git remote get-url origin 2>$null
    if ($remote -match "github\.com[:/]([^/]+)/") { $owner = $Matches[1] }
}
if (-not $owner) { throw "GitHub login failed (run: gh auth login)" }

Write-Host "Pushing to GitHub: $owner/$repoName"
gh repo create $repoName --public --source=. --remote=origin --push 2>$null
if ($LASTEXITCODE -ne 0) {
    git add -A
    git commit -m "Fly.io deploy config" 2>$null
    git push -u origin HEAD 2>$null
    if ($LASTEXITCODE -ne 0) {
        git remote remove origin 2>$null
        gh repo create $repoName --public --source=. --remote=origin --push
    }
}

flyctl auth whoami 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Fly.io login required. Browser will open..."
    flyctl auth login
}

$appName = "shabon-inventory"
$apps = flyctl apps list --json 2>$null | ConvertFrom-Json
$exists = $false
if ($apps) {
    $exists = @($apps | Where-Object { $_.Name -eq $appName }).Count -gt 0
}
if (-not $exists) {
    Write-Host "Creating Fly app: $appName (region nrt)"
    flyctl apps create $appName --org personal 2>$null
    if ($LASTEXITCODE -ne 0) {
        flyctl launch --name $appName --region nrt --no-deploy --copy-config --yes
    }
}

$passwordFile = Join-Path $AppDir "deploy-password.txt"
$appPassword = "haizi814"
if (Test-Path $passwordFile) {
    $raw = Get-Content $passwordFile -Raw -Encoding utf8
    if ($raw -match "パスワード:\s*(\S+)") { $appPassword = $Matches[1].Trim() }
}

Write-Host ""
Write-Host "=== Secrets（Neon の DATABASE_URL が必要）==="
Write-Host "1. https://neon.tech で Connection string をコピー"
Write-Host "2. 下のコマンドを実行（YOUR_NEON_URL を貼り付け）"
Write-Host ""
Write-Host "flyctl secrets set APP_PASSWORD=$appPassword SECRET_KEY=$(New-Guid) DATABASE_URL=`"YOUR_NEON_URL`""
Write-Host ""

$neonUrl = $env:DATABASE_URL
if (-not $neonUrl) {
    $neonUrl = Read-Host "Neon DATABASE_URL（postgresql://...）を貼り付け（Enterでスキップ）"
}
if ($neonUrl) {
    $secretKey = [guid]::NewGuid().ToString("N")
    flyctl secrets set "APP_PASSWORD=$appPassword" "SECRET_KEY=$secretKey" "DATABASE_URL=$neonUrl" -a $appName
}

Write-Host "Deploying to Fly.io..."
flyctl deploy -a $appName --remote-only

$url = "https://$appName.fly.dev"
$info = @"
Fly.io deploy
=============
URL: $url
パスワード: $appPassword

GitHub: https://github.com/$owner/$repoName
Fly dashboard: https://fly.io/apps/$appName

※ Render の旧URLは停止してOK（データ移行後）
"@
$info | Out-File (Join-Path $AppDir "deploy-password.txt") -Encoding utf8
$info | Out-File (Join-Path $AppDir "アプリのURL.txt") -Encoding utf8
$info | Out-File (Join-Path $AppDir "publish-url.txt") -Encoding utf8

Write-Host $info
Start-Process $url
Start-Process "https://fly.io/apps/$appName"
