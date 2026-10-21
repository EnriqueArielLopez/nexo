param([string]$Destination=(Join-Path $env:LOCALAPPDATA 'Programs\NexoClientes'))
$ErrorActionPreference='Stop'
$source=Join-Path $PSScriptRoot 'release-v31\Nexo'
$archive=Join-Path $PSScriptRoot 'release-v31\Nexo-Windows-portable.zip'
$desktop=[Environment]::GetFolderPath('Desktop')
$dataRoot=Join-Path $env:LOCALAPPDATA 'NexoClientes\Datos'
if(Test-Path -LiteralPath $Destination){throw "Ya existe la instalación $Destination; no se sobrescribió."}
if(Test-Path -LiteralPath $dataRoot){throw "Ya existen datos $dataRoot; no se sobrescribieron."}
if(-not(Test-Path -LiteralPath (Join-Path $source 'Nexo.exe'))){throw 'Generar primero release-v31\Nexo.'}
if(Get-ChildItem -LiteralPath $source -Recurse -Attributes ReparsePoint){throw 'La distribución contiene enlaces externos.'}
$archiveRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot ('retirados\'+(Get-Date -Format 'yyyyMMdd-HHmmss'))))
if(-not $archiveRoot.StartsWith([IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'retirados'))+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Destino de archivo inválido.'}
$oldPaths=@('Nexo','Hotel Prospectos','Cerrar Nexo.lnk','Cerrar Hotel Prospectos.lnk','Hotel Prospectos.lnk','Nexo-para-compartir.zip') | ForEach-Object {Join-Path $desktop $_}
foreach($old in $oldPaths){if([IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($old)) -ne $desktop){throw 'Ruta anterior fuera del escritorio.'}}
# El ejecutable nuevo cierra la versión anterior por su API local.
$stop=Start-Process -FilePath (Join-Path $source 'Nexo.exe') -ArgumentList '--stop' -WindowStyle Hidden -PassThru -Wait
Start-Sleep -Seconds 2
New-Item -ItemType Directory -Path $Destination,$dataRoot,$archiveRoot | Out-Null
Copy-Item -Path (Join-Path $source '*') -Destination $Destination -Recurse
$previousData=Join-Path $desktop 'Nexo\Mis datos'
if(-not(Test-Path -LiteralPath (Join-Path $previousData 'prospectos.sqlite'))){$previousData=Join-Path $desktop 'Hotel Prospectos\data'}
if(Test-Path -LiteralPath (Join-Path $previousData 'prospectos.sqlite')){
 Get-ChildItem -LiteralPath $previousData -File | Where-Object {$_.Name -in @('prospectos.sqlite','prospectos.sqlite-wal','prospectos.sqlite-shm')} | ForEach-Object {Copy-Item -LiteralPath $_.FullName -Destination $dataRoot}
}
# Quitar únicamente la unión de dependencias antigua, sin recorrer ni borrar su destino.
$junction=Join-Path $desktop 'Hotel Prospectos\node_modules'
if(Test-Path -LiteralPath $junction){
 $item=Get-Item -LiteralPath $junction -Force
 if(($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -eq 0){throw 'node_modules antiguo no es una unión; revisar antes de archivar.'}
 [IO.Directory]::Delete($junction)
}
foreach($old in $oldPaths){if(Test-Path -LiteralPath $old){Move-Item -LiteralPath $old -Destination (Join-Path $archiveRoot ([IO.Path]::GetFileName($old)))}}
$sharePath=Join-Path $desktop 'Nexo-para-compartir.zip'
Copy-Item -LiteralPath $archive -Destination $sharePath
$shell=New-Object -ComObject WScript.Shell
$shortcut=$shell.CreateShortcut((Join-Path $desktop 'Nexo.lnk'))
$shortcut.TargetPath=Join-Path $Destination 'Nexo.exe'
$shortcut.Arguments=''
$shortcut.WorkingDirectory=$Destination
$shortcut.IconLocation=(Join-Path $Destination 'Nexo.exe')+',0'
$shortcut.Description='Nexo - Clientes'
$shortcut.Save()
Write-Output "Aplicación: $Destination"
Write-Output "Datos conservados: $dataRoot"
Write-Output "Versiones retiradas: $archiveRoot"
Write-Output "Para compartir: $sharePath"
