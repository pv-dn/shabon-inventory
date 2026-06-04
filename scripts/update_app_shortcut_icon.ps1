# Align Chrome PWA shortcuts with assets\app.ico (same as desktop "しゃぼん玉在庫管理")
$AppDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$IconPath = Join-Path $AppDir "assets\app.ico"

if (-not (Test-Path $IconPath)) {
    throw "Icon not found: $IconPath"
}

$AppIds = @(
    "digebgfookljicninngkljgfjpdlddkb",
    "nmifmcdiakgnkjajmhjnmnabjiaoacpi"
)

$WshShell = New-Object -ComObject WScript.Shell
$WebAppsRoot = Join-Path $env:LOCALAPPDATA "Google\Chrome\User Data\Default\Web Applications"
$updated = 0

function Update-ShortcutIcon {
    param([string]$ShortcutPath)
    if (-not (Test-Path $ShortcutPath)) { return }
    $sc = $WshShell.CreateShortcut($ShortcutPath)
    $sc.IconLocation = "$IconPath,0"
    $sc.Save()
    $script:updated++
}

foreach ($appId in $AppIds) {
    $folder = Join-Path $WebAppsRoot ("_crx_{0}" -f $appId)
    if (-not (Test-Path $folder)) { continue }

    Get-ChildItem $folder -Filter "*.ico" -ErrorAction SilentlyContinue | ForEach-Object {
        Copy-Item -Path $IconPath -Destination $_.FullName -Force
        Write-Host "ICO: $($_.FullName)"
    }

    Get-ChildItem $folder -Filter "*.lnk" -ErrorAction SilentlyContinue | ForEach-Object {
        Update-ShortcutIcon $_.FullName
        Write-Host "LNK: $($_.FullName)"
    }
}

$Desktop = [Environment]::GetFolderPath("Desktop")
Get-ChildItem $Desktop -Filter "*.lnk" -ErrorAction SilentlyContinue | ForEach-Object {
    $sc = $WshShell.CreateShortcut($_.FullName)
    $isShabonApp = $false
    foreach ($appId in $AppIds) {
        if ($sc.Arguments -like "*$appId*") { $isShabonApp = $true; break }
    }
    if ($sc.Arguments -like "*shabon-inventory*") { $isShabonApp = $true }
    if (-not $isShabonApp) { return }
    Update-ShortcutIcon $_.FullName
    Write-Host "Desktop: $($_.FullName)"
}

Write-Host ""
Write-Host "Done. Updated $updated shortcut(s) to use $IconPath"
