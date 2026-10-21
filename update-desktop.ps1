param([string]$Source=(Join-Path $PSScriptRoot 'release-v32\Nexo'))
$ErrorActionPreference='Stop'
$programRoot=[IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'Programs'))
$destination=[IO.Path]::GetFullPath((Join-Path $programRoot 'NexoClientes'))
$dataRoot=[IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'NexoClientes\Datos'))
$backupRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'retirados'))
$backup=Join-Path $backupRoot ('actualizacion-'+(Get-Date -Format 'yyyyMMdd-HHmmss'))
$stage=$destination+'-nueva-'+[Guid]::NewGuid().ToString('N')
if([IO.Path]::GetDirectoryName($destination) -ne $programRoot -or -not $stage.StartsWith($programRoot+'\',[StringComparison]::OrdinalIgnoreCase) -or -not $backup.StartsWith($backupRoot+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Ruta de actualización inválida.'}
if(-not(Test-Path -LiteralPath (Join-Path $Source 'Nexo.exe'))){throw 'Falta compilar la distribución nueva.'}
if(-not(Test-Path -LiteralPath (Join-Path $destination 'Nexo.exe'))){throw 'No existe la instalación anterior; usar install-desktop.ps1.'}
foreach($folder in @($Source,$destination,$dataRoot)){
 if(Test-Path -LiteralPath $folder){if((Get-Item -LiteralPath $folder -Force).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'No se actualizan destinos que sean enlaces.'};if(Get-ChildItem -LiteralPath $folder -Recurse -Attributes ReparsePoint){throw 'Se encontró un enlace dentro del destino; revisar antes de actualizar.'}}
}
New-Item -ItemType Directory -Path $stage,$backup | Out-Null
Copy-Item -Path (Join-Path $Source '*') -Destination $stage -Recurse
Start-Process -FilePath (Join-Path $Source 'Nexo.exe') -ArgumentList '--stop' -WindowStyle Hidden -Wait
Start-Sleep -Seconds 3
$stillRunning=$false
try{Invoke-RestMethod 'http://127.0.0.1:18761/api/health' -TimeoutSec 2 | Out-Null;$stillRunning=$true}catch{}
if($stillRunning){throw 'Nexo no se cerró; no se modificaron sus archivos actuales.'}
if(Test-Path -LiteralPath $dataRoot){Copy-Item -LiteralPath $dataRoot -Destination (Join-Path $backup 'Datos') -Recurse}
Move-Item -LiteralPath $destination -Destination (Join-Path $backup 'Programa')
try{Move-Item -LiteralPath $stage -Destination $destination}catch{Move-Item -LiteralPath (Join-Path $backup 'Programa') -Destination $destination;throw}
$desktop=[Environment]::GetFolderPath('Desktop')
$share=Join-Path $desktop 'Nexo-para-compartir.zip'
if(Test-Path -LiteralPath $share){Move-Item -LiteralPath $share -Destination (Join-Path $backup 'Distribucion-anterior.zip')}
Copy-Item -LiteralPath (Join-Path (Split-Path $Source -Parent) 'Nexo-Windows-portable.zip') -Destination $share
Write-Output "Actualizacion: $destination"
Write-Output "Respaldo anterior: $backup"
Write-Output 'Datos y acceso del escritorio conservados.'
Start-Process -FilePath (Join-Path $destination 'Nexo.exe') -WindowStyle Hidden
