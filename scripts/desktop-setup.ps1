# Installs the Windows toolchains needed to build the print shop desktop app.
$ErrorActionPreference = "Stop"

function Test-Command($name) {
  return [bool](Get-Command $name -ErrorAction SilentlyContinue)
}

function Install-WingetPackage($id, $override) {
  Write-Host "Installing $id"
  if ($override) {
    winget install --id $id --accept-package-agreements --accept-source-agreements --disable-interactivity --override $override
  } else {
    winget install --id $id --accept-package-agreements --accept-source-agreements --disable-interactivity
  }
}

if (-not (Test-Command "dotnet")) {
  Install-WingetPackage "Microsoft.DotNet.SDK.8" $null
} else {
  Write-Host "dotnet already installed: $(dotnet --version)"
}

if (-not (Test-Command "rustc") -or -not (Test-Command "cargo")) {
  Install-WingetPackage "Rustlang.Rustup" $null
} else {
  Write-Host "rustc already installed: $(rustc --version)"
}

$vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
$hasMsvc = $false
if (Test-Path $vswhere) {
  $hasMsvc = [bool](& $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath)
}
if (-not $hasMsvc) {
  Install-WingetPackage "Microsoft.VisualStudio.2022.BuildTools" "--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
} else {
  Write-Host "MSVC build tools already installed"
}

& (Join-Path $PSScriptRoot "ensure-windows-dev-path.ps1")

Write-Host "Desktop toolchain setup finished. Restart Cursor or open a new terminal, then run pnpm desktop:dev"
