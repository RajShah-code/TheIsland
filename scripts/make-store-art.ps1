# Draws the Microsoft Store listing art (not packaged) into docs/store-art: the white pill on dark,
# like the app icon, with the product name. 2:3 poster art 1440x2160 and 1:1 box art 2160x2160.
# Run: powershell -ExecutionPolicy Bypass -File scripts/make-store-art.ps1
Add-Type -AssemblyName System.Drawing

$out = Join-Path $PSScriptRoot '..\docs\store-art'
New-Item -ItemType Directory -Force $out | Out-Null

function RoundRect([float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = 2 * $r
  $p.AddArc($x, $y, $d, $d, 180, 90)
  $p.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $p.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $p.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $p.CloseFigure()
  $p
}

# The pill is half the image width; the name sits below it, the tagline below that.
function Draw([string]$name, [int]$w, [int]$h, [float]$pillY, [float]$nameY) {
  $bmp = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.TextRenderingHint = 'AntiAliasGridFit'
  $g.Clear([System.Drawing.Color]::FromArgb(17, 17, 17))

  $pw = $w * 0.5
  $ph = $pw * 0.377
  $pill = RoundRect (($w - $pw) / 2) ($h * $pillY - $ph / 2) $pw $ph ($ph / 2)
  $g.FillPath((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(245, 245, 245))), $pill)

  $center = New-Object System.Drawing.StringFormat
  $center.Alignment = 'Center'
  $title = New-Object System.Drawing.Font 'Segoe UI Semibold', ($w * 0.105), ([System.Drawing.GraphicsUnit]::Pixel)
  $tag = New-Object System.Drawing.Font 'Segoe UI', ($w * 0.036), ([System.Drawing.GraphicsUnit]::Pixel)
  $white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(245, 245, 245))
  $grey = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(150, 150, 150))
  $g.DrawString('TheIsland', $title, $white, (New-Object System.Drawing.RectangleF 0, ($h * $nameY), $w, ($w * 0.2)), $center)
  $g.DrawString('A dynamic island for Windows 11', $tag, $grey, (New-Object System.Drawing.RectangleF 0, ($h * $nameY + $w * 0.15), $w, ($w * 0.08)), $center)

  $file = Join-Path $out $name
  $bmp.Save($file, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
  $file
}

Draw 'poster-2x3-1440x2160.png' 1440 2160 0.40 0.50
Draw 'box-1x1-2160x2160.png' 2160 2160 0.36 0.52
