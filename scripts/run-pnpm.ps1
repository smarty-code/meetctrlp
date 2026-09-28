# Runs pnpm with Node/pnpm/dotnet/cargo on PATH (for stale terminals and VS Code tasks).
$ErrorActionPreference = "Stop"

function Prepend-SessionPath([string]$dir) {
  if ([string]::IsNullOrWhiteSpace($dir) -or -not (Test-Path -LiteralPath $dir)) {
    return
  }

  $current = $env:Path
  $parts = $current.Split(";") | Where-Object { $_ }
  if ($parts | Where-Object { $_.Equals($dir, [System.StringComparison]::OrdinalIgnoreCase) }) {
    return
  }

  $env:Path = "$dir;$current"
}

$pnpmHome = [Environment]::GetEnvironmentVariable("PNPM_HOME", "User")
if ([string]::IsNullOrWhiteSpace($pnpmHome)) {
  $pnpmHome = Join-Path $env:LOCALAPPDATA "pnpm"
}

Prepend-SessionPath (Join-Path $env:USERPROFILE ".cargo\bin")
Prepend-SessionPath "C:\Program Files\dotnet"
Prepend-SessionPath "C:\Program Files\nodejs"
Prepend-SessionPath $pnpmHome
Prepend-SessionPath (Join-Path $pnpmHome "bin")

$pnpmCmd = Join-Path $pnpmHome "pnpm.CMD"
if (-not (Test-Path -LiteralPath $pnpmCmd)) {
  $pnpmCmd = "pnpm"
}

& $pnpmCmd @args
exit $LASTEXITCODE
