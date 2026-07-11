# Render Postgres → Neon へのデータ移行メモ用スクリプト
# 実際の dump/restore は接続文字列が手元にあるときに実行します。
#
# 前提:
#   - PostgreSQL クライアント (pg_dump / psql) が入っていること
#   - 環境変数 RENDER_DATABASE_URL / NEON_DATABASE_URL をセット
#
# 例:
#   $env:RENDER_DATABASE_URL = "postgresql://..."
#   $env:NEON_DATABASE_URL = "postgresql://..."
#   powershell -File scripts\migrate_db_to_neon.ps1

$ErrorActionPreference = "Stop"
$AppDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$dumpFile = Join-Path $AppDir "backups\render-dump.sql"

if (-not $env:RENDER_DATABASE_URL) { throw "RENDER_DATABASE_URL をセットしてください" }
if (-not $env:NEON_DATABASE_URL) { throw "NEON_DATABASE_URL をセットしてください" }

New-Item -ItemType Directory -Force -Path (Join-Path $AppDir "backups") | Out-Null

Write-Host "Dumping Render DB..."
& pg_dump $env:RENDER_DATABASE_URL --no-owner --no-acl -f $dumpFile
if ($LASTEXITCODE -ne 0) { throw "pg_dump failed" }

Write-Host "Restoring into Neon..."
& psql $env:NEON_DATABASE_URL -f $dumpFile
if ($LASTEXITCODE -ne 0) { throw "psql restore failed" }

Write-Host "Done: $dumpFile"
Write-Host "次: scripts\set_fly_secrets.ps1 で Neon URL を Fly に登録 → flyctl deploy"
