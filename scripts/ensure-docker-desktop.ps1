#Requires -Version 5.1

param(
    [ValidateRange(1, 600)]
    [int]$TimeoutSeconds = 120
)

$ErrorActionPreference = 'Stop'

function Test-DockerEngine {
    param([string]$DockerPath, [int]$WaitMilliseconds)

    # Bound each CLI call too: an unresponsive engine must not hang the task.
    $probe = New-Object System.Diagnostics.Process
    try {
        $probe.StartInfo.FileName = $DockerPath
        $probe.StartInfo.Arguments = 'info --format "{{.ServerVersion}}"'
        $probe.StartInfo.UseShellExecute = $false
        $probe.StartInfo.CreateNoWindow = $true
        $probe.StartInfo.RedirectStandardOutput = $true
        $probe.StartInfo.RedirectStandardError = $true
        $null = $probe.Start()
        # Drain both streams without cluttering the task terminal during startup.
        $probe.BeginOutputReadLine()
        $probe.BeginErrorReadLine()
        if (-not $probe.WaitForExit($WaitMilliseconds)) {
            $probe.Kill()
            return $false
        }
        return $probe.ExitCode -eq 0
    }
    finally {
        $probe.Dispose()
    }
}

try {
    $docker = Get-Command docker -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $docker) {
        throw 'Docker CLI was not found on PATH. Install Docker Desktop, then reopen VS Code so it picks up PATH changes.'
    }

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    if (Test-DockerEngine $docker.Source ([Math]::Min(5000, $TimeoutSeconds * 1000))) {
        Write-Host 'Docker engine is ready.'
        exit 0
    }

    if (-not (Get-Process -Name 'Docker Desktop' -ErrorAction SilentlyContinue)) {
        $desktopPaths = @(
            "$env:ProgramW6432\Docker\Docker\Docker Desktop.exe"
            "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe"
            "$env:LOCALAPPDATA\Programs\DockerDesktop\Docker Desktop.exe"
            "$env:LOCALAPPDATA\Docker\Docker Desktop.exe"
        )
        $desktop = $desktopPaths | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
        if (-not $desktop) {
            throw 'Docker engine is unavailable and Docker Desktop.exe was not found in the standard system or per-user install locations. Install or open Docker Desktop manually, then retry.'
        }
        Write-Host "Starting Docker Desktop: $desktop"
        try {
            Start-Process -FilePath $desktop -ErrorAction Stop
        }
        catch {
            throw "Could not launch Docker Desktop: $($_.Exception.Message). Open Docker Desktop manually, then retry."
        }
    }

    Write-Host "Waiting for Docker engine readiness (up to $TimeoutSeconds seconds)..."
    while ((Get-Date) -lt $deadline) {
        $remainingMilliseconds = [int][Math]::Ceiling(($deadline - (Get-Date)).TotalMilliseconds)
        if ($remainingMilliseconds -le 0) { break }
        if (Test-DockerEngine $docker.Source ([Math]::Min(5000, $remainingMilliseconds))) {
            Write-Host 'Docker engine is ready.'
            exit 0
        }
        $remainingMilliseconds = [int][Math]::Ceiling(($deadline - (Get-Date)).TotalMilliseconds)
        if ($remainingMilliseconds -gt 0) {
            Start-Sleep -Milliseconds ([Math]::Min(2000, $remainingMilliseconds))
        }
    }
    throw "Docker engine did not become ready within $TimeoutSeconds seconds. Open Docker Desktop, check its startup errors and the active Docker context (docker context show), then retry."
}
catch {
    [Console]::Error.WriteLine("Docker preflight failed: $($_.Exception.Message)")
    exit 1
}
