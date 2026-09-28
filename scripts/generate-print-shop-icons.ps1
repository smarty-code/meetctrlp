Add-Type -AssemblyName System.Drawing

$iconsDir = Join-Path $PSScriptRoot "..\apps\print-shop\src-tauri\icons"
New-Item -ItemType Directory -Force -Path $iconsDir | Out-Null

function New-BrandBitmap([int]$size) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear([System.Drawing.Color]::FromArgb(255, 88, 204, 2))
  $pad = [Math]::Max(2, [int]($size * 0.12))
  $radius = [Math]::Max(4, [int]($size * 0.18))
  $rect = New-Object System.Drawing.Rectangle $pad, $pad, ($size - 2 * $pad), ($size - 2 * $pad)
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $radius * 2
  $path.AddArc($rect.X, $rect.Y, $d, $d, 180, 90)
  $path.AddArc($rect.Right - $d, $rect.Y, $d, $d, 270, 90)
  $path.AddArc($rect.Right - $d, $rect.Bottom - $d, $d, $d, 0, 90)
  $path.AddArc($rect.X, $rect.Bottom - $d, $d, $d, 90, 90)
  $path.CloseFigure()
  $white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
  $g.FillPath($white, $path)
  $fontSize = [Math]::Max(8, [int]($size * 0.38))
  $font = New-Object System.Drawing.Font("Segoe UI", [float]$fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $format = New-Object System.Drawing.StringFormat
  $format.Alignment = [System.Drawing.StringAlignment]::Center
  $format.LineAlignment = [System.Drawing.StringAlignment]::Center
  $green = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 4, 44, 96))
  $g.DrawString("P", $font, $green, (New-Object System.Drawing.RectangleF 0, 0, $size, $size), $format)
  $g.Dispose()
  return $bmp
}

$bmp32 = New-BrandBitmap 32
$bmp32.Save((Join-Path $iconsDir "32x32.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$bmp128 = New-BrandBitmap 128
$bmp128.Save((Join-Path $iconsDir "128x128.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$bmp256 = New-BrandBitmap 256
$bmp256.Save((Join-Path $iconsDir "icon.png"), [System.Drawing.Imaging.ImageFormat]::Png)

$iconHandle = $bmp256.GetHicon()
$icon = [System.Drawing.Icon]::FromHandle($iconHandle)
$iconPath = Join-Path $iconsDir "icon.ico"
$fs = [System.IO.File]::Create($iconPath)
$icon.Save($fs)
$fs.Dispose()
$icon.Dispose()
$bmp32.Dispose()
$bmp128.Dispose()
$bmp256.Dispose()

Write-Host "Wrote icons to $iconsDir"
