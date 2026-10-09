#Requires -Version 5.1

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$version = '24.21.0'
$archiveHash = '158f7685b44de51f6c0df1d153526cbcd3e1bc739a8dfc607721cef75de9e541'
$repoRoot = Split-Path -Parent $PSScriptRoot
$installDirectory = Join-Path $repoRoot '.tools\node'
$executable = Join-Path $installDirectory 'node.exe'

if ([System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture.ToString() -ne 'X64') {
    throw 'This installer supports Windows x64 only. Install Node.js 24 LTS on other platforms.'
}

if (Test-Path -LiteralPath $executable) {
    $installedVersion = & $executable --version
    if ($LASTEXITCODE -eq 0 -and $installedVersion.Trim() -eq "v$version") {
        Write-Host "Node.js $version is already installed at $installDirectory"
        return
    }
}

$temporaryDirectory = Join-Path ([System.IO.Path]::GetTempPath()) ("dndharness-node-" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $temporaryDirectory | Out-Null

try {
    $archive = Join-Path $temporaryDirectory 'node.zip'
    Invoke-WebRequest -Uri "https://nodejs.org/dist/v$version/node-v$version-win-x64.zip" -OutFile $archive -UseBasicParsing
    if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash -ne $archiveHash) {
        throw 'Node.js archive checksum mismatch. Nothing was installed.'
    }

    Expand-Archive -LiteralPath $archive -DestinationPath $temporaryDirectory
    $extractedDirectory = Join-Path $temporaryDirectory "node-v$version-win-x64"
    $downloadedVersion = & (Join-Path $extractedDirectory 'node.exe') --version
    if ($LASTEXITCODE -ne 0 -or $downloadedVersion.Trim() -ne "v$version") {
        throw 'Downloaded Node.js failed version verification.'
    }

    New-Item -ItemType Directory -Path $installDirectory -Force | Out-Null
    Copy-Item -Path (Join-Path $extractedDirectory '*') -Destination $installDirectory -Recurse -Force
    Write-Host "Installed Node.js $version (including npm) at $installDirectory"
    Write-Host 'Open a new VS Code terminal to use the repo-local tools.'
}
finally {
    Remove-Item -LiteralPath $temporaryDirectory -Recurse -Force
}
