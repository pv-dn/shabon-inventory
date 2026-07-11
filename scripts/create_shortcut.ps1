# しゃぼん玉在庫管理 — デスクトップショートカット（本番URL）
# 他アプリのショートカットは変更しない

$ErrorActionPreference = "Stop"
$AppDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$IconPath = Join-Path $AppDir "assets\app.ico"
$LauncherBat = Join-Path $AppDir "open-cloud.bat"
$Desktop = [Environment]::GetFolderPath("Desktop")

$ShortcutName = -join (
    [char]0x3057, [char]0x3083, [char]0x307C, [char]0x3093,
    [char]0x7389, [char]0x5728, [char]0x5eab, [char]0x7BA1, [char]0x7406
) + ".lnk"
$ShortcutPath = Join-Path $Desktop $ShortcutName

$url = "https://pv-dn.github.io/shabon-inventory/"

@"
@echo off
chcp 65001 >nul
start "" "$url"
"@ | Set-Content -Path $LauncherBat -Encoding ASCII

if (-not (Test-Path $IconPath)) {
    $py = Join-Path $AppDir "scripts\make_icon.py"
    if (Test-Path $py) {
        & python $py
    }
}
if (-not (Test-Path $IconPath)) {
    throw "Icon not found: $IconPath"
}

$WshShell = New-Object -ComObject WScript.Shell

# Primary shortcut
if (Test-Path $ShortcutPath) { Remove-Item $ShortcutPath -Force }
$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = $LauncherBat
$Shortcut.WorkingDirectory = $AppDir
$Shortcut.IconLocation = "$IconPath,0"
$Shortcut.Description = "Shabon inventory (cloud)"
$Shortcut.Save()

# Also retarget any other Shabon-related shortcuts on Desktop
Get-ChildItem $Desktop -Filter "*.lnk" | ForEach-Object {
    $n = $_.Name
    if ($n -match [char]0x3057 + [char]0x3083 + [char]0x307C -or $n -match [char]0x30B7 + [char]0x30E3 + [char]0x30DC) {
        $s = $WshShell.CreateShortcut($_.FullName)
        $s.TargetPath = $LauncherBat
        $s.WorkingDirectory = $AppDir
        $s.IconLocation = "$IconPath,0"
        $s.Description = "Shabon inventory (cloud)"
        $s.Save()
    }
}

Write-Host "OK: $ShortcutPath"
Write-Host "URL: $url"
