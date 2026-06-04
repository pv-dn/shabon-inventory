# GitHub + Render deploy (requires: gh auth login)
$AppDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $AppDir

$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

gh auth status 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "GitHub login required. Browser will open..."
    gh auth login -h github.com -p https -w
}

$repoName = "shabon-inventory"
$owner = (gh api user -q .login 2>$null)
if (-not $owner) { throw "GitHub login failed" }

Write-Host "Creating GitHub repo: $owner/$repoName"
gh repo create $repoName --public --source=. --remote=origin --push 2>$null
if ($LASTEXITCODE -ne 0) {
    git remote remove origin 2>$null
    gh repo create $repoName --public --source=. --remote=origin --push
}

$password = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 14 | ForEach-Object { [char]$_ })
$info = @"
Render deploy next steps
======================
1. https://neon.tech → New Project → Connection string (postgresql://...) をコピー
2. https://render.com → Sign in with GitHub
3. New + → Blueprint → リポジトリ $owner/$repoName
4. 環境変数:
   APP_PASSWORD = $password
   DATABASE_URL = (Neon の接続文字列)
5. Apply → 5〜15 分待つ
6. 画面上部の URL + パスワードを店舗に共有

Repo: https://github.com/$owner/$repoName
"@
$info | Out-File (Join-Path $AppDir "deploy-password.txt") -Encoding utf8

Write-Host $info
Start-Process "https://neon.tech"
Start-Process "https://dashboard.render.com/blueprints"
