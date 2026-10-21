$ErrorActionPreference='Stop'
$exe=Join-Path $PSScriptRoot 'release\Nexo\Nexo.exe'
if(-not(Test-Path -LiteralPath $exe)){throw 'No se encontro la distribucion portable de Nexo.'}
Start-Process -FilePath $exe -ArgumentList '--stop' -WindowStyle Hidden -Wait
