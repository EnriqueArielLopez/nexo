$ErrorActionPreference='Stop'
$exe=Join-Path $PSScriptRoot 'release\Nexo\Nexo.exe'
if(-not(Test-Path -LiteralPath $exe)){throw 'Genera la distribucion portable antes de abrir Nexo.'}
Start-Process -FilePath $exe -WindowStyle Hidden
