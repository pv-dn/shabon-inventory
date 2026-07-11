# Seed products.json into shabon-only Supabase project
# Usage:
#   $env:VITE_SUPABASE_URL = "https://xxxx.supabase.co"
#   $env:VITE_SUPABASE_ANON_KEY = "..."
#   powershell -File scripts\seed_supabase.ps1

$ErrorActionPreference = "Stop"
$AppDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $AppDir

$url = [string]$env:VITE_SUPABASE_URL
$key = [string]$env:VITE_SUPABASE_ANON_KEY
$url = $url.Trim().TrimEnd("/")
$key = $key.Trim()

if (-not $url -or -not $key) {
    throw "Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY first"
}

$jsonPath = Join-Path $AppDir "data\products.json"
$items = Get-Content $jsonPath -Raw -Encoding UTF8 | ConvertFrom-Json
Write-Host ("Seeding {0} products to {1} ..." -f $items.Count, $url)

$headers = @{
    apikey = $key
    Authorization = "Bearer $key"
    "Content-Type" = "application/json"
    Prefer = "resolution=merge-duplicates,return=minimal"
}

$batch = New-Object System.Collections.Generic.List[object]
foreach ($it in $items) {
    $cat = [string]$it.category
    if (-not $cat) { $cat = "other" }
    $catJson = '["' + $cat + '"]'
    $batch.Add([ordered]@{
        code         = [string]$it.code
        name         = [string]$it.name
        spec         = [string]$it.spec
        case_qty     = [string]$it.case_qty
        retail_price = $it.retail_price
        member_price = $it.member_price
        quantity     = 0
        min_stock    = 0
        note         = ""
        category     = $catJson
        updated_at   = (Get-Date -Format "yyyy-MM-ddTHH:mm:ss")
    }) | Out-Null
}

$chunkSize = 50
for ($i = 0; $i -lt $batch.Count; $i += $chunkSize) {
    $end = [Math]::Min($i + $chunkSize - 1, $batch.Count - 1)
    $chunk = @()
    for ($j = $i; $j -le $end; $j++) { $chunk += $batch[$j] }
    $body = ($chunk | ConvertTo-Json -Depth 6 -Compress)
    if ($chunk.Count -eq 1) { $body = "[$body]" }
    $endpoint = "$url/rest/v1/products?on_conflict=code"
    Invoke-RestMethod -Method Post -Uri $endpoint -Headers $headers -Body ([System.Text.Encoding]::UTF8.GetBytes($body)) -ContentType "application/json; charset=utf-8" | Out-Null
    Write-Host ("  uploaded {0}-{1}" -f ($i + 1), ($end + 1))
}

Write-Host "Done."
