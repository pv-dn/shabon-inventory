$AppDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$IconPath = Join-Path $AppDir "assets\app.ico"
$TargetBat = Join-Path $AppDir "起動.bat"
$Desktop = [Environment]::GetFolderPath("Desktop")
$ShortcutName = -join (
    [char]0x3057, [char]0x3083, [char]0x307C, [char]0x3093,
    [char]0x7389, [char]0x5728, [char]0x5eab, [char]0x7BA1, [char]0x7406
) + ".lnk"
$ShortcutPath = Join-Path $Desktop $ShortcutName

if (-not (Test-Path $IconPath)) {
    throw "Icon not found: $IconPath"
}

$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = $TargetBat
$Shortcut.WorkingDirectory = $AppDir
$Shortcut.IconLocation = "$IconPath,0"
$Shortcut.Save()

Write-Host "OK: $ShortcutPath"
