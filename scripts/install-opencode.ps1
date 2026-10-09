#Requires -Version 5.1

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$version = '1.18.33'
$archiveHash = 'cc827fda2e32502373c5de25a4b78471766b99881d12a441ae5b9fcff39c5780'
$url = "https://github.com/anomalyco/opencode/releases/download/v$version/opencode-windows-x64.zip"
$repoRoot = Split-Path -Parent $PSScriptRoot
$installDirectory = Join-Path $repoRoot '.tools\opencode'
$executable = Join-Path $installDirectory 'opencode.exe'

if ([System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture.ToString() -ne 'X64') {
    throw 'This installer supports Windows x64 only.'
}

if (Test-Path -LiteralPath $executable) {
    $installedVersion = & $executable --version
    if ($LASTEXITCODE -ne 0) {
        throw "The existing OpenCode executable failed with exit code $LASTEXITCODE."
    }
    if ($installedVersion.Trim() -eq $version) {
        Write-Host "OpenCode $version is already installed at $executable"
        return
    }
}

$temporaryDirectory = Join-Path ([System.IO.Path]::GetTempPath()) ("dndharness-opencode-" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $temporaryDirectory | Out-Null

try {
    $archive = Join-Path $temporaryDirectory 'opencode.zip'
    Write-Host "Downloading OpenCode $version..."
    Invoke-WebRequest -Uri $url -OutFile $archive -UseBasicParsing

    if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash -ne $archiveHash) {
        throw 'OpenCode archive checksum mismatch. Nothing was installed.'
    }

    $extractedDirectory = Join-Path $temporaryDirectory 'extracted'
    Expand-Archive -LiteralPath $archive -DestinationPath $extractedDirectory
    $downloadedExecutable = Join-Path $extractedDirectory 'opencode.exe'
    if (-not (Test-Path -LiteralPath $downloadedExecutable)) {
        throw 'The OpenCode archive does not contain opencode.exe.'
    }

    $downloadedVersion = & $downloadedExecutable --version
    if ($LASTEXITCODE -ne 0 -or $downloadedVersion.Trim() -ne $version) {
        throw 'The downloaded OpenCode executable failed version verification.'
    }

    New-Item -ItemType Directory -Path $installDirectory -Force | Out-Null
    Copy-Item -LiteralPath $downloadedExecutable -Destination $executable -Force
    Write-Host "Installed OpenCode $version at $executable"
    Write-Host 'Open a new VS Code terminal in this workspace to use the local copy.'
}
finally {
    Remove-Item -LiteralPath $temporaryDirectory -Recurse -Force
}
