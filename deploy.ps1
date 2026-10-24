[CmdletBinding()]
param([ValidateRange(1, 65535)][int]$Port = 8081, [switch]$SkipInstall, [switch]$SkipBuild, [switch]$IncludeTests, [switch]$Start)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
. (Join-Path $PSScriptRoot 'tools/NodeEnv.ps1')
$null = Initialize-StellarPickNode
$base = Join-Path $PSScriptRoot 'vendor/juice-shop'
$frontend = Join-Path $base 'frontend'
$tests = Join-Path $PSScriptRoot 'tools/e2e'
if (-not $SkipInstall) {
  Write-Host 'Installing application dependencies (upstream postinstall is disabled)...'
  Invoke-StellarPickCommand -FilePath 'npm' -ArgumentList @('install', '--ignore-scripts') -WorkingDirectory $base
  Invoke-StellarPickCommand -FilePath 'npm' -ArgumentList @('install', '--ignore-scripts') -WorkingDirectory $frontend
  Write-Host 'Building native SQLite dependency...'
  Invoke-StellarPickCommand -FilePath 'npm' -ArgumentList @('rebuild', 'sqlite3') -WorkingDirectory $base
  if ($IncludeTests) { Invoke-StellarPickCommand -FilePath 'npm' -ArgumentList @('ci') -WorkingDirectory $tests }
}
foreach ($directory in @($base, $frontend)) {
  if (-not (Test-Path -LiteralPath (Join-Path $directory 'node_modules') -PathType Container)) { throw "Dependencies are missing in '$directory'. Run .\deploy.ps1 without -SkipInstall." }
}
if (-not $SkipBuild) {
  Write-Host 'Building frontend and server...'
  Invoke-StellarPickCommand -FilePath 'npm' -ArgumentList @('run', 'build') -WorkingDirectory $frontend
  Invoke-StellarPickCommand -FilePath 'npm' -ArgumentList @('run', 'build:server') -WorkingDirectory $base
}
foreach ($artifact in @('build/app.js', 'frontend/dist/frontend/index.html')) {
  if (-not (Test-Path -LiteralPath (Join-Path $base $artifact) -PathType Leaf)) { throw "Build artifact '$artifact' is missing. Run .\deploy.ps1 without -SkipBuild." }
}
Write-Host 'Deployment preparation complete.' -ForegroundColor Green
if ($Start) {
  & (Join-Path $PSScriptRoot 'start.ps1') -Port $Port -SkipBuild
  if ($LASTEXITCODE -ne 0) { throw "Startup failed with exit code $LASTEXITCODE." }
} else { Write-Host "Start the local-only lab with: .\start.ps1 -Port $Port" }
