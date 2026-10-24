[CmdletBinding()]
param([ValidateRange(1, 65535)][int]$Port = 8081, [switch]$SkipBuild)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
. (Join-Path $PSScriptRoot 'tools/NodeEnv.ps1')
$node = Initialize-StellarPickNode
$base = Join-Path $PSScriptRoot 'vendor/juice-shop'
if (-not (Test-Path -LiteralPath (Join-Path $base 'node_modules') -PathType Container)) { throw 'Application dependencies are missing. Run .\deploy.ps1 first.' }
if (-not $SkipBuild) {
  & (Join-Path $PSScriptRoot 'deploy.ps1') -Port $Port -SkipInstall
  if ($LASTEXITCODE -ne 0) { throw "Build failed with exit code $LASTEXITCODE." }
}
if (Test-StellarPickPort -Port $Port) { throw "TCP port $Port is already in use. Stop that service or choose another port with -Port. Do not start a second process against the same database." }
$env:NODE_ENV = 'stellarpick'
$env:HOST = '127.0.0.1'
$env:PORT = [string]$Port
Write-Host "Starting StellarPick at http://127.0.0.1:$Port (local demonstration only)" -ForegroundColor Green
Push-Location -LiteralPath $base
try {
  & $node 'build/app.js'
  if ($LASTEXITCODE -ne 0) { throw "StellarPick exited with code $LASTEXITCODE." }
} finally { Pop-Location }
