# Baut das Download-Paket dist\SHS-Game-v<version>.zip (nur die Spieldateien).
# Aufruf:  powershell -ExecutionPolicy Bypass -File tools\paket.ps1
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

$versionJs = Get-Content (Join-Path $root 'js\version.js') -Raw
if ($versionJs -notmatch "VERSION\s*=\s*'([^']+)'") { throw 'Version in js\version.js nicht gefunden.' }
$version = $Matches[1]

$dist = Join-Path $root 'dist'
$stage = Join-Path $dist "SHS-Game-v$version"
$zip = Join-Path $dist "SHS-Game-v$version.zip"

if (Test-Path $stage) { Remove-Item -Recurse -Force $stage }
if (Test-Path $zip) { Remove-Item -Force $zip }
New-Item -ItemType Directory -Force $stage | Out-Null

Copy-Item (Join-Path $root 'index.html') $stage
Copy-Item (Join-Path $root 'impressum.html') $stage
Copy-Item (Join-Path $root 'datenschutz.html') $stage
Copy-Item (Join-Path $root 'css') $stage -Recurse
Copy-Item (Join-Path $root 'js') $stage -Recurse

@"
SHS - Spürhundesport (Version $version)
=======================================

Spielen:  index.html doppelklicken (öffnet sich im Browser).
Es wird keine Installation, kein Server und kein Internet benötigt.

Der Spielstand wird im Browser gespeichert. Zum Sichern oder zum Umzug auf
einen anderen Rechner im Spiel "Spielstand exportieren" nutzen und die
JSON-Datei dort wieder importieren. Vor einem Update ebenfalls exportieren.
"@ | Set-Content -Encoding utf8 (Join-Path $stage 'LIESMICH.txt')

# Eigene ZIP-Erstellung statt Compress-Archive: PowerShell 5.1 schreibt sonst Backslashes in die Pfade.
Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem
$archiv = [System.IO.Compression.ZipFile]::Open($zip, 'Create')
try {
  Get-ChildItem $stage -Recurse -File | ForEach-Object {
    $name = $_.FullName.Substring($stage.Length + 1).Replace('\', '/')
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archiv, $_.FullName, $name) | Out-Null
  }
} finally { $archiv.Dispose() }
Remove-Item -Recurse -Force $stage
Write-Host "Paket erstellt: $zip"
