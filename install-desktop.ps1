param([string]$Destination = (Join-Path ([Environment]::GetFolderPath('Desktop')) 'Hotel Prospectos'))
$ErrorActionPreference = 'Stop'
if (Test-Path -LiteralPath $Destination) { throw "La carpeta ya existe: $Destination. No se sobrescribió ningún dato." }
$runtimeModules = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules'
$runtimePython = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
if (-not (Test-Path -LiteralPath (Join-Path $runtimeModules '@oai\artifact-tool'))) { throw 'No se encontraron las bibliotecas de Excel instaladas con Codex.' }
if (-not (Test-Path -LiteralPath $runtimePython)) { throw 'No se encontró Python de Codex para el formato del Excel.' }
New-Item -ItemType Directory -Path $Destination | Out-Null
foreach ($name in @('server.mjs','core.mjs','providers.mjs','export.mjs','stamp-xlsx.py','package.json','launch.ps1','stop.ps1','README.md')) {
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot $name) -Destination $Destination
}
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'public') -Destination $Destination -Recurse
New-Item -ItemType Junction -Path (Join-Path $Destination 'node_modules') -Target $runtimeModules | Out-Null
$shell = New-Object -ComObject WScript.Shell
$desktopPath = [Environment]::GetFolderPath('Desktop')
foreach ($item in @(@('Hotel Prospectos.lnk','launch.ps1'),@('Cerrar Hotel Prospectos.lnk','stop.ps1'))) {
    $shortcut = $shell.CreateShortcut((Join-Path $desktopPath $item[0]))
    $shortcut.TargetPath = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
    $shortcut.Arguments = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + (Join-Path $Destination $item[1]) + '"'
    $shortcut.WorkingDirectory = $Destination
    $shortcut.WindowStyle = 7
    $shortcut.Description = 'Hotel Prospectos · aplicación local'
    $shortcut.Save()
}
Write-Output "Instalada en: $Destination"
