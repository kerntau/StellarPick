[CmdletBinding(SupportsShouldProcess, ConfirmImpact = 'High')]
param([switch]$Force)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$base = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'vendor/juice-shop'))
$database = [IO.Path]::GetFullPath((Join-Path $base 'data/juiceshop.sqlite'))
$runtime = [IO.Path]::GetFullPath((Join-Path $base 'data/lab-runtime.json'))
$uploads = [IO.Path]::GetFullPath((Join-Path $base 'uploads'))
if ($base -ne [IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'vendor/juice-shop'))) { throw 'Refusing to reset files outside the application directory.' }
if (-not $Force -and -not $PSCmdlet.ShouldProcess($base, 'Delete the SQLite database, lab runtime state, and uploaded files')) { return }
Get-ChildItem -LiteralPath (Split-Path -Parent $database) -Filter 'juiceshop.sqlite*' -File -ErrorAction SilentlyContinue | Remove-Item -Force
foreach ($file in @($runtime, $runtime + '.tmp')) { if (Test-Path -LiteralPath $file -PathType Leaf) { Remove-Item -LiteralPath $file -Force } }
if (Test-Path -LiteralPath $uploads -PathType Container) { Get-ChildItem -LiteralPath $uploads -Force | Remove-Item -Recurse -Force }
Write-Host 'Reset complete. Start the application to recreate the database and demo seed data.' -ForegroundColor Green
