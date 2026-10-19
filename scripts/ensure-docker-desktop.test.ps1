#Requires -Version 5.1

param([string]$Scenario)

$ErrorActionPreference = 'Stop'
$helper = Join-Path $PSScriptRoot 'ensure-docker-desktop.ps1'

if ($Scenario) {
    # Each scenario runs the actual helper in a child PowerShell process. All
    # external operations and the clock are stubbed; no Docker state is changed.
    $global:mockNow = [datetime]'2026-01-01T00:00:00Z'
    $global:mockProbes = 0
    function Get-Command {
        if ($Scenario -ne 'missing-cli') { [pscustomobject]@{ Source = 'stub-docker.exe' } }
        if ($Scenario -eq 'multiple-cli-matches') { [pscustomobject]@{ Source = 'extensionless-docker' } }
    }
    function Get-Date { $global:mockNow }
    function Start-Sleep {
        param($Milliseconds)
        $global:mockNow = $global:mockNow.AddMilliseconds($Milliseconds)
    }
    function Get-Process {
        if ($Scenario -in @('initializing', 'timeout', 'hung-probe')) { [pscustomobject]@{ Id = 123 } }
    }
    function Test-Path {
        param($LiteralPath, $PathType)
        switch ($Scenario) {
            'cold-system' { return $LiteralPath -eq "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe" }
            'cold-user-programs' { return $LiteralPath -eq "$env:LOCALAPPDATA\Programs\DockerDesktop\Docker Desktop.exe" }
            'cold-user-local' { return $LiteralPath -eq "$env:LOCALAPPDATA\Docker\Docker Desktop.exe" }
            'launch-failure' { return $true }
            default { return $false }
        }
    }
    function Start-Process {
        param($FilePath)
        Write-Host "MOCK launch: $FilePath"
        if ($Scenario -eq 'launch-failure') { throw 'stub launch denied' }
    }
    function New-Object {
        param($TypeName)
        if ($TypeName -ne 'System.Diagnostics.Process') { throw "Unexpected type: $TypeName" }
        $process = [pscustomobject]@{
            StartInfo = [pscustomobject]@{
                FileName = ''; Arguments = ''; UseShellExecute = $true
                CreateNoWindow = $false; RedirectStandardOutput = $false; RedirectStandardError = $false
            }
            ExitCode = 1
        }
        $process | Add-Member ScriptMethod Start {
            if ($this.StartInfo.FileName -ne 'stub-docker.exe' -or
                $this.StartInfo.Arguments -ne 'info --format "{{.ServerVersion}}"') {
                throw 'Unexpected readiness command'
            }
            $global:mockProbes++
            Write-Host "MOCK probe: $global:mockProbes"
            $this.ExitCode = if ($Scenario -in @('ready', 'multiple-cli-matches') -or
                ($Scenario -in @('cold-system', 'cold-user-programs', 'cold-user-local', 'initializing') -and $global:mockProbes -ge 3)) { 0 } else { 1 }
            return $true
        }
        $process | Add-Member ScriptMethod BeginOutputReadLine {}
        $process | Add-Member ScriptMethod BeginErrorReadLine {}
        $process | Add-Member ScriptMethod WaitForExit {
            param($Milliseconds)
            if ($Milliseconds -le 0 -or $Milliseconds -gt 5000) { throw 'Invalid probe deadline' }
            if ($Scenario -eq 'hung-probe') {
                $global:mockNow = $global:mockNow.AddMilliseconds($Milliseconds)
                return $false
            }
            return $true
        }
        $process | Add-Member ScriptMethod Kill { Write-Host 'MOCK kill probe' }
        $process | Add-Member ScriptMethod Dispose {}
        return $process
    }
    & $helper -TimeoutSeconds 8
    exit $LASTEXITCODE
}

$cases = @(
    @{ Name = 'ready'; Code = 0; Match = 'Docker engine is ready'; Probes = 1; Launches = 0 }
    @{ Name = 'multiple-cli-matches'; Code = 0; Match = 'Docker engine is ready'; Probes = 1; Launches = 0 }
    @{ Name = 'cold-system'; Code = 0; Match = [regex]::Escape("$env:ProgramFiles\Docker\Docker\Docker Desktop.exe"); Probes = 3; Launches = 1 }
    @{ Name = 'cold-user-programs'; Code = 0; Match = [regex]::Escape("$env:LOCALAPPDATA\Programs\DockerDesktop\Docker Desktop.exe"); Probes = 3; Launches = 1 }
    @{ Name = 'cold-user-local'; Code = 0; Match = [regex]::Escape("$env:LOCALAPPDATA\Docker\Docker Desktop.exe"); Probes = 3; Launches = 1 }
    @{ Name = 'initializing'; Code = 0; Match = 'Waiting for Docker engine readiness'; Probes = 3; Launches = 0 }
    @{ Name = 'missing-cli'; Code = 1; Match = 'Docker CLI was not found on PATH'; Probes = 0; Launches = 0 }
    @{ Name = 'missing-desktop'; Code = 1; Match = 'Docker Desktop.exe was not found'; Probes = 1; Launches = 0 }
    @{ Name = 'launch-failure'; Code = 1; Match = 'Could not launch Docker Desktop: stub launch denied'; Probes = 1; Launches = 1 }
    @{ Name = 'timeout'; Code = 1; Match = 'did not become ready within 8 seconds'; Probes = 5; Launches = 0 }
    @{ Name = 'hung-probe'; Code = 1; Match = 'did not become ready within 8 seconds'; Probes = 2; Launches = 0 }
)

$repoRoot = Split-Path -Parent $PSScriptRoot
$tasks = (Get-Content -Raw (Join-Path $repoRoot '.vscode/tasks.json') | ConvertFrom-Json).tasks
$taskContracts = @(
    @{ Label = 'Application: Start'; Args = @('compose', 'up', '-d', '--wait'); Starts = $true; Panel = 'shared' }
    @{ Label = 'Application: Rebuild and start'; Args = @('compose', 'up', '--build', '-d', '--wait'); Starts = $true; Panel = 'shared' }
    @{ Label = 'Application: Stop'; Args = @('compose', 'stop'); Starts = $false; Panel = 'shared' }
    @{ Label = 'Application: Status'; Args = @('compose', 'ps', '--all'); Starts = $false; Panel = 'shared' }
    @{ Label = 'Application: Logs'; Args = @('compose', 'logs', '-f', 'web', 'api'); Starts = $false; Panel = 'dedicated' }
)
foreach ($contract in $taskContracts) {
    $label = $contract.Label
    $matches = @($tasks | Where-Object label -eq $label)
    if ($matches.Count -ne 1) { throw "Expected exactly one task: $label" }
    $task = $matches[0]
    $expected = [ordered]@{
        label = $label
        type = 'process'
        command = 'docker'
        args = $contract.Args
        options = [ordered]@{ cwd = '${workspaceFolder}' }
        problemMatcher = @()
        presentation = [ordered]@{ reveal = 'always'; panel = $contract.Panel }
    }
    if ($contract.Starts) { $expected['dependsOn'] = 'Application: Ensure Docker ready' }
    if (@($task.PSObject.Properties).Count -ne $expected.Count) {
        throw "Unexpected task properties: $label"
    }
    foreach ($property in $expected.Keys) {
        if (($task.$property | ConvertTo-Json -Depth 10 -Compress) -cne
            ($expected[$property] | ConvertTo-Json -Depth 10 -Compress)) {
            throw "Unexpected task property ${property}: $label"
        }
    }
    Write-Host "PASS task configuration: $label"
}
$preflight = $tasks | Where-Object label -eq 'Application: Ensure Docker ready'
if ($tasks.Count -ne 6 -or $preflight.type -ne 'process' -or $preflight.command -ne 'docker' -or
    ($preflight.args -join '|') -ne 'info' -or $preflight.windows.command -ne 'powershell.exe' -or
    ($preflight.windows.args -join '|') -ne '-NoProfile|-ExecutionPolicy|Bypass|-File|${workspaceFolder}/scripts/ensure-docker-desktop.ps1' -or
    $preflight.options.cwd -ne '${workspaceFolder}' -or $preflight.problemMatcher.Count -ne 0) {
    throw 'Unexpected shared prerequisite configuration'
}
Write-Host 'PASS task configuration: shared platform-specific prerequisite'

foreach ($file in @($helper, $PSCommandPath)) {
    $tokens = $null
    $parseErrors = $null
    $null = [System.Management.Automation.Language.Parser]::ParseFile($file, [ref]$tokens, [ref]$parseErrors)
    if ($parseErrors.Count) { throw ($parseErrors | Out-String) }
    Write-Host "PASS PowerShell parse: $file"
}

foreach ($case in $cases) {
    # Native stderr is captured with stdout so expected failures can be asserted.
    $ErrorActionPreference = 'Continue'
    $output = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $PSCommandPath -Scenario $case.Name 2>&1 | Out-String
    $code = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    $probes = [regex]::Matches($output, 'MOCK probe:').Count
    $launches = [regex]::Matches($output, 'MOCK launch:').Count
    if ($code -ne $case.Code -or $output -notmatch $case.Match -or
        $probes -ne $case.Probes -or $launches -ne $case.Launches -or
        ($case.Name -eq 'hung-probe' -and [regex]::Matches($output, 'MOCK kill probe').Count -ne 2)) {
        throw "FAIL $($case.Name): exit=$code probes=$probes launches=$launches`n$output"
    }
    Write-Host "PASS $($case.Name): exit=$code probes=$probes launches=$launches"
}
Write-Host "$($cases.Count) mocked scenarios passed. No real Docker or Desktop operations performed."
