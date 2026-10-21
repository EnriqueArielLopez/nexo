param([string]$Destination=(Join-Path ([Environment]::GetFolderPath('Desktop')) 'Nexo'))
$ErrorActionPreference='Stop'
$source=Join-Path $PSScriptRoot 'release\Nexo'
$archive=Join-Path $PSScriptRoot 'release\Nexo-Windows-portable.zip'
if(Test-Path -LiteralPath $Destination){throw "La carpeta ya existe: $Destination. No se sobrescribio ningun dato."}
if(-not(Test-Path -LiteralPath (Join-Path $source 'Nexo.exe'))){throw 'Primero se debe generar la version portable en release\Nexo.'}
if(Get-ChildItem -LiteralPath $source -Recurse -Attributes ReparsePoint){throw 'La distribucion contiene enlaces externos; no se instalo.'}
$desktop=[Environment]::GetFolderPath('Desktop')
$previous=Join-Path $desktop 'Hotel Prospectos'
$previousStop=Join-Path $previous 'stop.ps1'
if(Test-Path -LiteralPath $previousStop){& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $previousStop}
Copy-Item -LiteralPath $source -Destination $Destination -Recurse
$oldData=Join-Path $previous 'data'
$newData=Join-Path $Destination 'Mis datos'
if(Test-Path -LiteralPath (Join-Path $oldData 'prospectos.sqlite')){
 New-Item -ItemType Directory -Path $newData | Out-Null
 Get-ChildItem -LiteralPath $oldData -File | Where-Object {$_.Name -in @('prospectos.sqlite','prospectos.sqlite-wal','prospectos.sqlite-shm') -or $_.Extension -eq '.xlsx'} | ForEach-Object {Copy-Item -LiteralPath $_.FullName -Destination $newData}
}
$sharePath=Join-Path $desktop 'Nexo-para-compartir.zip'
if(Test-Path -LiteralPath $sharePath){throw 'Ya existe el ZIP para compartir; no se sobrescribio.'}
Copy-Item -LiteralPath $archive -Destination $sharePath
$shell=New-Object -ComObject WScript.Shell
foreach($item in @(@('Nexo.lnk','Hotel Prospectos.lnk',''),@('Cerrar Nexo.lnk','Cerrar Hotel Prospectos.lnk','--stop'))){
 $newLink=Join-Path $desktop $item[0]
 $oldLink=Join-Path $desktop $item[1]
 if((Test-Path -LiteralPath $oldLink) -and -not(Test-Path -LiteralPath $newLink)){
  $oldShortcut=$shell.CreateShortcut($oldLink)
  if($oldShortcut.Arguments.Contains('Hotel Prospectos')){Move-Item -LiteralPath $oldLink -Destination $newLink}
 }
 $shortcut=$shell.CreateShortcut($newLink)
 $shortcut.TargetPath=Join-Path $Destination 'Nexo.exe'
 $shortcut.Arguments=$item[2]
 $shortcut.WorkingDirectory=$Destination
 $shortcut.IconLocation=(Join-Path $Destination 'Nexo.exe')+',0'
 $shortcut.Description='Nexo - tu proximo cliente'
 $shortcut.WindowStyle=1
 $shortcut.Save()
}
Write-Output "Instalacion: $Destination"
Write-Output "ZIP limpio para compartir: $sharePath"
Write-Output 'El historial anterior se conservo; la carpeta anterior queda como respaldo.'
