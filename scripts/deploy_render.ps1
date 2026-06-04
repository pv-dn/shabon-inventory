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
1. Open https://render.com and sign in with GitHub
2. New + > Blueprint
3. Select repository: $owner/$repoName
4. Set environment variable APP_PASSWORD = $password
5. Apply and wait for deploy (~10 min)
6. Share the Render URL + password with stores

Password saved here: deploy-password.txt
"@
$info | Out-File (Join-Path $AppDir "deploy-password.txt") -Encoding utf8
$password | Out-File (Join-Path $AppDir "deploy-password.txt") -Encoding utf8 -NoNewline
Add-Content (Join-Path $AppDir "deploy-password.txt") "`n`nRepo: https://github.com/$owner/$repoName"

Write-Host $info
Start-Process "https://dashboard.render.com/blueprints"
