$ErrorActionPreference = 'Stop'
$appRoot = $PSScriptRoot
$appUrl = 'http://127.0.0.1:18761'
try {
    $ready = $false
    try { $health = Invoke-RestMethod "$appUrl/api/health" -TimeoutSec 2; $ready = $health.app -eq 'hotel-prospectos' } catch { }
    if (-not $ready) {
        $nodeExe = (Get-Command node.exe -ErrorAction SilentlyContinue).Source
        if (-not $nodeExe) { $nodeExe = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' }
        if (-not (Test-Path -LiteralPath $nodeExe)) { throw 'Se necesita Node.js 22.13 o posterior.' }
        New-Item -ItemType Directory -Path (Join-Path $appRoot 'data') -Force | Out-Null
        $serverFile = Join-Path $appRoot 'server.mjs'
        $process = Start-Process -FilePath $nodeExe -ArgumentList @('--disable-warning=ExperimentalWarning', ('"' + $serverFile + '"')) -WorkingDirectory $appRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $appRoot 'data\servidor.log') -RedirectStandardError (Join-Path $appRoot 'data\errores.log') -PassThru
        $process.Id | Set-Content -LiteralPath (Join-Path $appRoot 'data\server.pid')
        for ($attempt = 0; $attempt -lt 30; $attempt++) {
            Start-Sleep -Milliseconds 300
            try { $health = Invoke-RestMethod "$appUrl/api/health" -TimeoutSec 1; if ($health.app -eq 'hotel-prospectos') { $ready = $true; break } } catch { }
            if ($process.HasExited) { break }
        }
        if (-not $ready) { throw 'No se pudo iniciar Hotel Prospectos. Revisá data\errores.log o si el puerto 18761 está ocupado.' }
    }
    $edgeExe = Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe'
    if (Test-Path -LiteralPath $edgeExe) { Start-Process -FilePath $edgeExe -ArgumentList @("--app=$appUrl", '--window-size=1280,900') }
    else { Start-Process $appUrl }
} catch {
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, 'Hotel Prospectos') | Out-Null
}
