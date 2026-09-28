# Ensures Node, pnpm, .NET, and Rust toolchains are on the user PATH (idempotent).
$ErrorActionPreference = "Stop"

function Get-NormalizedPathEntries([string]$pathValue) {
  if ([string]::IsNullOrWhiteSpace($pathValue)) {
    return @()
  }

  return $pathValue.Split(";") | ForEach-Object { $_.Trim() } | Where-Object { $_ }
}

function Add-UserPathEntry([string]$entry) {
  if ([string]::IsNullOrWhiteSpace($entry)) {
    return
  }

  $expanded = [Environment]::ExpandEnvironmentVariables($entry)
  if (-not (Test-Path -LiteralPath $expanded -PathType Container -ErrorAction SilentlyContinue) -and
      -not (Test-Path -LiteralPath $expanded -PathType Leaf -ErrorAction SilentlyContinue)) {
    return
  }

  $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
  $parts = Get-NormalizedPathEntries $userPath
  $exists = $parts | Where-Object { $_.Equals($expanded, [System.StringComparison]::OrdinalIgnoreCase) }
  if ($exists) {
    return
  }

  $next = if ($parts.Count -gt 0) { "$expanded;$userPath" } else { $expanded }
  [Environment]::SetEnvironmentVariable("Path", $next, "User")
  Write-Host "Added to user PATH: $expanded"
}

$pnpmHome = [Environment]::GetEnvironmentVariable("PNPM_HOME", "User")
if ([string]::IsNullOrWhiteSpace($pnpmHome)) {
  $pnpmHome = Join-Path $env:LOCALAPPDATA "pnpm"
  [Environment]::SetEnvironmentVariable("PNPM_HOME", $pnpmHome, "User")
  Write-Host "Set PNPM_HOME=$pnpmHome"
}

$entries = @(
  "C:\Program Files\nodejs"
  "$pnpmHome"
  "$pnpmHome\bin"
  "C:\Program Files\dotnet"
  (Join-Path $env:USERPROFILE ".cargo\bin")
)

foreach ($entry in $entries) {
  Add-UserPathEntry $entry
}

$nodeExe = "C:\Program Files\nodejs\node.exe"
if (Test-Path -LiteralPath $nodeExe) {
  $corepack = "C:\Program Files\nodejs\corepack.cmd"
  if (Test-Path -LiteralPath $corepack) {
    & $corepack enable | Out-Null
    & $corepack prepare pnpm@11.27.0 --activate | Out-Null
    Write-Host "Corepack pnpm 11.27.0 activated"
  }
}

Write-Host "Windows dev PATH is configured. Restart Cursor or open a new terminal for changes to apply."
