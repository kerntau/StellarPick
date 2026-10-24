# Resolves portable Node.js or a compatible system installation.
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
function Initialize-StellarPickNode {
  $minimumVersion = [version]'22.22.3'
  $portableDirectory = Join-Path $PSScriptRoot 'node22'
  $portableNode = Join-Path $portableDirectory 'node.exe'
  if (Test-Path -LiteralPath $portableNode -PathType Leaf) {
    $node = $portableNode
    $env:PATH = $portableDirectory + [IO.Path]::PathSeparator + $env:PATH
  } else {
    $command = Get-Command node -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($null -eq $command) { throw 'Install Node.js 22.22.3 or newer, or place a portable distribution in tools/node22.' }
    $node = $command.Source
  }
  $rawVersion = (& $node --version).Trim()
  if ($LASTEXITCODE -ne 0 -or $rawVersion -notmatch '^v(\d+\.\d+\.\d+)$') { throw "Unable to determine the Node.js version from '$node'." }
  if ([version]$Matches[1] -lt $minimumVersion) { throw "Node.js $rawVersion is unsupported. Use Node.js $minimumVersion or newer." }
  if ($null -eq (Get-Command npm -CommandType Application -ErrorAction SilentlyContinue)) { throw "npm was not found next to '$node' or on PATH." }
  Write-Host "Using Node.js $rawVersion ($node)"
  return $node
}
function Invoke-StellarPickCommand {
  param([Parameter(Mandatory)][string]$FilePath, [Parameter(Mandatory)][string[]]$ArgumentList, [Parameter(Mandatory)][string]$WorkingDirectory)
  Push-Location -LiteralPath $WorkingDirectory
  try {
    Write-Host "> $FilePath $($ArgumentList -join ' ')"
    & $FilePath @ArgumentList
    if ($LASTEXITCODE -ne 0) { throw "Command failed with exit code $LASTEXITCODE." }
  } finally { Pop-Location }
}
function Test-StellarPickPort {
  param([Parameter(Mandatory)][int]$Port)
  $listener = [Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners() | Where-Object { $_.Port -eq $Port } | Select-Object -First 1
  return $null -ne $listener
}
