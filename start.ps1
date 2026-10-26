[CmdletBinding()]
param([ValidateRange(1, 65535)][int]$Port = 8081, [switch]$SkipBuild, [switch]$Force)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'tools/NodeEnv.ps1')
$node = Initialize-StellarPickNode
$base = Join-Path $PSScriptRoot 'vendor/juice-shop'
if (-not (Test-Path -LiteralPath (Join-Path $base 'node_modules') -PathType Container)) { throw 'Application dependencies are missing. Run .\deploy.ps1 first.' }
if (-not $SkipBuild) {
  & (Join-Path $PSScriptRoot 'deploy.ps1') -Port $Port -SkipInstall
  if ($LASTEXITCODE -ne 0) { throw "Build failed with exit code $LASTEXITCODE." }
}
foreach ($artifact in @('build/app.js', 'frontend/dist/frontend/index.html')) {
  if (-not (Test-Path -LiteralPath (Join-Path $base $artifact) -PathType Leaf)) { throw "Build artifact '$artifact' is missing. Run .\start.ps1 without -SkipBuild." }
}
if (Test-StellarPickPort -Port $Port) { throw "TCP port $Port is already in use. Stop that service or choose another port with -Port. Do not start a second process against the same database." }
$lockFile = Join-Path $base 'data/lab.lock'
if ($Force -and (Test-Path -LiteralPath $lockFile -PathType Leaf)) {
  Remove-Item -LiteralPath $lockFile -Force -ErrorAction SilentlyContinue
}
if (Test-Path -LiteralPath $lockFile -PathType Leaf) {
  $lockPid = 0
  $lockPort = 0
  $lockStarted = $null
  try {
    $lock = Get-Content -LiteralPath $lockFile -Raw | ConvertFrom-Json
    $lockPid = [int]$lock.pid
    $lockPort = [int]$lock.port
    $lockStarted = [datetime]$lock.startedAt
  } catch { $lockPid = 0; $lockPort = 0; $lockStarted = $null }
  $alive = $false
  if ($lockPid -gt 0) {
    $process = Get-Process -Id $lockPid -ErrorAction SilentlyContinue
    if ($null -ne $process) {
      try {
        # A reused PID starts after the lock was written; treat it as stale.
        $alive = $null -eq $lockStarted -or $process.StartTime -le $lockStarted.AddMinutes(1)
      } catch { $alive = $true }
    }
  }
  if ($alive) {
    throw "Another StellarPick instance (PID $lockPid, port $lockPort) is already running. Stop it, or run .\start.ps1 -Force to clear a stale lock."
  }
  Remove-Item -LiteralPath $lockFile -Force -ErrorAction SilentlyContinue
}
New-Item -ItemType Directory -Path (Split-Path -Parent $lockFile) -Force | Out-Null
function New-StellarPickLock {
  param([Parameter(Mandatory)][string]$Path, [Parameter(Mandatory)][int]$Port)
  $json = ConvertTo-Json @{ pid = $PID; port = $Port; startedAt = (Get-Date).ToString('o') }
  $stream = [IO.File]::Open($Path, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
  try {
    $writer = New-Object System.IO.StreamWriter($stream, [Text.Encoding]::ASCII)
    try { $writer.Write($json) } finally { $writer.Dispose() }
  } finally { $stream.Dispose() }
}
$env:NODE_ENV = 'stellarpick'
$env:HOST = '127.0.0.1'
$env:PORT = [string]$Port
# The service overwrites this provisional lock with its own Node PID.
$env:STELLARPICK_LOCK_FILE = $lockFile
$lockWritten = $false
$pushed = $false
try {
  try {
    New-StellarPickLock -Path $lockFile -Port $Port
  } catch [System.IO.IOException] {
    throw "Another StellarPick instance is starting or running. If it is stale, run .\start.ps1 -Force."
  }
  $lockWritten = $true
  Write-Host "Starting StellarPick at http://127.0.0.1:$Port (local demonstration only)" -ForegroundColor Green
  Push-Location -LiteralPath $base
  $pushed = $true
  & $node 'build/app.js'
  if ($LASTEXITCODE -ne 0) { throw "StellarPick exited with code $LASTEXITCODE." }
} finally {
  if ($pushed) { Pop-Location }
  if ($lockWritten) { Remove-Item -LiteralPath $lockFile -Force -ErrorAction SilentlyContinue }
}
