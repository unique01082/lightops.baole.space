param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('x64', 'arm64')]
  [string]$Architecture
)

$ErrorActionPreference = 'Stop'
$FfmpegVersion = '8.1'
$JpegTurboVersion = '3.2.0'
$ExifToolVersion = '13.59'
$RootDir = Split-Path -Parent $PSScriptRoot
$OutputDir = Join-Path $RootDir 'src-tauri/resources/bin'
$BuildDir = Join-Path $env:RUNNER_TEMP "lightops-sidecars-$Architecture"

Remove-Item $BuildDir -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item $OutputDir -Recurse -Force -ErrorAction SilentlyContinue
New-Item $BuildDir -ItemType Directory | Out-Null
New-Item $OutputDir -ItemType Directory | Out-Null

$FfmpegAssetArchitecture = if ($Architecture -eq 'x64') { 'win64' } else { 'winarm64' }
$FfmpegAsset = "ffmpeg-n$FfmpegVersion-latest-$FfmpegAssetArchitecture-lgpl-$FfmpegVersion.zip"
$FfmpegArchive = Join-Path $BuildDir $FfmpegAsset
Invoke-WebRequest "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/$FfmpegAsset" -OutFile $FfmpegArchive
$ExpectedChecksum = if ($Architecture -eq 'x64') {
  'b48d1f513a728a0e5ad8f51d91a0f508fe50f0a4f8de3bd3874cc5628cca5140'
} else {
  '6290d3ca4d4ef3c96bd7febedd91c61eb6a48ce3d2e14e0e0a5bfeda869b7f97'
}
$ActualChecksum = (Get-FileHash $FfmpegArchive -Algorithm SHA256).Hash.ToLowerInvariant()
if ($ActualChecksum -ne $ExpectedChecksum) { throw "FFmpeg checksum mismatch for $FfmpegAsset" }
Expand-Archive $FfmpegArchive (Join-Path $BuildDir 'ffmpeg')
$Ffmpeg = Get-ChildItem (Join-Path $BuildDir 'ffmpeg') -Filter ffmpeg.exe -Recurse | Select-Object -First 1
if (-not $Ffmpeg) { throw 'ffmpeg.exe was not found in the vendor archive' }
Copy-Item $Ffmpeg.FullName (Join-Path $OutputDir 'ffmpeg.exe')

$JpegArchitecture = if ($Architecture -eq 'x64') { 'x64' } else { 'arm64' }
$JpegInstaller = Join-Path $BuildDir "libjpeg-turbo-$JpegTurboVersion-vc-$JpegArchitecture.exe"
Invoke-WebRequest "https://github.com/libjpeg-turbo/libjpeg-turbo/releases/download/$JpegTurboVersion/libjpeg-turbo-$JpegTurboVersion-vc-$JpegArchitecture.exe" -OutFile $JpegInstaller
& 7z x $JpegInstaller "-o$(Join-Path $BuildDir 'jpeg')" -y | Out-Null
$JpegTran = Get-ChildItem (Join-Path $BuildDir 'jpeg') -Filter jpegtran.exe -Recurse | Select-Object -First 1
if (-not $JpegTran) { throw 'jpegtran.exe was not found in the vendor installer' }
Copy-Item $JpegTran.FullName (Join-Path $OutputDir 'jpegtran.exe')

$ExifArchive = Join-Path $BuildDir "exiftool-$ExifToolVersion.zip"
Invoke-WebRequest "https://sourceforge.net/projects/exiftool/files/exiftool-$($ExifToolVersion)_64.zip/download" -OutFile $ExifArchive
Expand-Archive $ExifArchive (Join-Path $BuildDir 'exiftool')
$ExifTool = Get-ChildItem (Join-Path $BuildDir 'exiftool') -Filter 'exiftool*.exe' -Recurse | Select-Object -First 1
if (-not $ExifTool) { throw 'exiftool.exe was not found in the vendor archive' }
Copy-Item $ExifTool.FullName (Join-Path $OutputDir 'exiftool.exe')
$ExifToolFiles = Get-ChildItem (Join-Path $BuildDir 'exiftool') -Directory -Filter 'exiftool*_files' -Recurse | Select-Object -First 1
if ($ExifToolFiles) { Copy-Item $ExifToolFiles.FullName (Join-Path $OutputDir $ExifToolFiles.Name) -Recurse }
