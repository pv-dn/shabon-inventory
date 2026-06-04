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
if (-not $owner) {
    $remote = git remote get-url origin 2>$null
    if ($remote -match "github\.com[:/]([^/]+)/") { $owner = $Matches[1] }
}
if (-not $owner) { throw "GitHub login failed (run: gh auth login)" }

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
1. https://render.com → Sign in with GitHub
2. New + → Blueprint → リポジトリ $owner/$repoName
3. APP_PASSWORD = $password のみ入力（DBは自動）
4. Apply → 5〜15 分待つ
5. URL https://shabon-inventory.onrender.com + パスワードを共有

Repo: https://github.com/$owner/$repoName
"@
$info | Out-File (Join-Path $AppDir "deploy-password.txt") -Encoding utf8

Write-Host $info
Start-Process "https://neon.tech"
Start-Process "https://dashboard.render.com/blueprints"
