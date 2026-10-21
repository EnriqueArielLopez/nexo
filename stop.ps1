$ErrorActionPreference = 'Stop'
$pidFile = Join-Path $PSScriptRoot 'data\server.pid'
if (Test-Path -LiteralPath $pidFile) {
    $appProcessId = [int](Get-Content -LiteralPath $pidFile)
    $appProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $appProcessId" -ErrorAction SilentlyContinue
    $expectedServer = Join-Path $PSScriptRoot 'server.mjs'
    if ($appProcess -and $appProcess.Name -eq 'node.exe' -and $appProcess.CommandLine.Contains($expectedServer)) {
        Stop-Process -Id $appProcessId
        Remove-Item -LiteralPath $pidFile -Force
    }
}
