[CmdletBinding(SupportsShouldProcess, ConfirmImpact = 'High')]
param([switch]$Force, [ValidateRange(1, 65535)][int]$Port = 8081)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'tools/NodeEnv.ps1')
$root = [IO.Path]::GetFullPath($PSScriptRoot)
$base = [IO.Path]::GetFullPath((Join-Path $root 'vendor/juice-shop'))
$database = [IO.Path]::GetFullPath((Join-Path $base 'data/juiceshop.sqlite'))
$runtime = [IO.Path]::GetFullPath((Join-Path $base 'data/lab-runtime.json'))
$uploads = [IO.Path]::GetFullPath((Join-Path $base 'uploads'))
$prefix = $root.TrimEnd([char[]]@([IO.Path]::DirectorySeparatorChar, [IO.Path]::AltDirectorySeparatorChar)) + [IO.Path]::DirectorySeparatorChar
foreach ($path in @($base, $database, $runtime, $uploads)) {
  if (-not $path.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) { throw 'Refusing to reset files outside the application directory.' }
}
if (Test-StellarPickPort -Port $Port) { throw "The lab is still listening on port $Port. Stop it with Ctrl+C before resetting." }
$lockFile = Join-Path $base 'data/lab.lock'
if (Test-Path -LiteralPath $lockFile -PathType Leaf) {
  $lockPid = 0
  $lockPort = 0
  try {
    $lock = Get-Content -LiteralPath $lockFile -Raw | ConvertFrom-Json
    $lockPid = [int]$lock.pid
    $lockPort = [int]$lock.port
  } catch { $lockPid = 0; $lockPort = 0 }
  if ($lockPid -gt 0 -and (Get-Process -Id $lockPid -ErrorAction SilentlyContinue)) {
    throw "The lab is still running (PID $lockPid, port $lockPort). Stop it with Ctrl+C before resetting."
  }
  Remove-Item -LiteralPath $lockFile -Force -ErrorAction SilentlyContinue
}
if ($Force) { $ConfirmPreference = 'None' }
if (-not $PSCmdlet.ShouldProcess($base, 'Delete the SQLite database, lab runtime state, and uploaded files')) { return }
Get-ChildItem -LiteralPath (Split-Path -Parent $database) -Filter 'juiceshop.sqlite*' -File -ErrorAction SilentlyContinue | Remove-Item -Force
foreach ($file in @($runtime, $runtime + '.tmp')) { if (Test-Path -LiteralPath $file -PathType Leaf) { Remove-Item -LiteralPath $file -Force } }
if (Test-Path -LiteralPath $uploads -PathType Container) { Get-ChildItem -LiteralPath $uploads -Force | Remove-Item -Recurse -Force }
Write-Host 'Reset complete. Start the application to recreate the database and demo seed data.' -ForegroundColor Green
