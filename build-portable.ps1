param([string]$OutputDirectory=(Join-Path $PSScriptRoot 'dist\Nexo'))
$ErrorActionPreference='Stop'
$outputFull=[IO.Path]::GetFullPath($OutputDirectory)
if (Test-Path -LiteralPath $outputFull) { throw "El destino ya existe: $outputFull. Elegí otra carpeta para no sobrescribir datos." }
$appFolder=Join-Path $outputFull 'app'
$binFolder=Join-Path $outputFull 'bin'
New-Item -ItemType Directory -Path $appFolder,$binFolder | Out-Null
foreach($name in @('server.mjs','core.mjs','geography.mjs','providers.mjs','export-portable.mjs','zip.mjs','package.json','auth.mjs','automation.mjs','imports.mjs','research.mjs','vault.mjs','qualification.mjs','assistant.mjs','campaign.mjs','web-discovery.mjs','browser-search.mjs','prospecting.mjs','website-prospects.mjs','templates.mjs','batches.mjs','instagram-connection.mjs','instagram-test.mjs','instagram-batch.mjs','mcp.mjs','conectar-claude.mjs','mailer.mjs','scheduler.mjs')) { Copy-Item -LiteralPath (Join-Path $PSScriptRoot $name) -Destination $appFolder }
if(Test-Path -LiteralPath (Join-Path $PSScriptRoot 'instagram-public-config.json')){Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'instagram-public-config.json') -Destination $appFolder}
$instagramServiceFolder=Join-Path $outputFull 'servicio-instagram'
New-Item -ItemType Directory -Path $instagramServiceFolder | Out-Null
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'instagram-oauth-service.mjs') -Destination $instagramServiceFolder
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'INSTAGRAM-OFICIAL.md') -Destination (Join-Path $instagramServiceFolder 'ACTIVAR-INSTAGRAM.md')
New-Item -ItemType Directory -Path (Join-Path $appFolder 'public'),(Join-Path $appFolder 'assets') | Out-Null
foreach($name in @('nexo.html','nexo.js','nexo.css')) { Copy-Item -LiteralPath (Join-Path $PSScriptRoot "public\$name") -Destination (Join-Path $appFolder 'public') }
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'public\fonts') -Destination (Join-Path $appFolder 'public') -Recurse
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'assets\base.xlsx') -Destination (Join-Path $appFolder 'assets')
$nodeBinary=(Get-Command node.exe).Source
Copy-Item -LiteralPath $nodeBinary -Destination (Join-Path $binFolder 'node.exe')
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'assets\NODE-LICENSE.txt') -Destination (Join-Path $binFolder 'LICENSE.txt')
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'EMPEZA-ACA.txt') -Destination $outputFull
Set-Content -LiteralPath (Join-Path $outputFull 'Conectar-con-Claude.cmd') -Value '@echo off
"%~dp0bin\node.exe" "%~dp0app\conectar-claude.mjs"
pause'
Add-Type -AssemblyName System.Drawing
$bitmap=New-Object System.Drawing.Bitmap 64,64
$graphics=[Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode=[Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.Clear([Drawing.Color]::FromArgb(120,85,232))
$iconFont=New-Object Drawing.Font 'Segoe UI',40,([Drawing.FontStyle]::Bold)
$brush=New-Object Drawing.SolidBrush ([Drawing.Color]::White)
$graphics.DrawString('n',$iconFont,$brush,6,-7)
$icon=[Drawing.Icon]::FromHandle($bitmap.GetHicon())
$iconPath=Join-Path $PSScriptRoot 'build\nexo.ico'
$stream=[IO.File]::Create($iconPath)
$icon.Save($stream);$stream.Dispose();$graphics.Dispose();$bitmap.Dispose();$brush.Dispose();$iconFont.Dispose()
$compiler=Join-Path $env:SystemRoot 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
& $compiler /nologo /target:winexe /platform:x64 /reference:System.Windows.Forms.dll /reference:System.Drawing.dll /reference:System.Web.Extensions.dll "/win32icon:$iconPath" "/out:$(Join-Path $outputFull 'Nexo.exe')" (Join-Path $PSScriptRoot 'build\Launcher.cs')
if($LASTEXITCODE -ne 0){throw 'Falló la compilación del ejecutable.'}
$zipPath=Join-Path ([IO.Path]::GetDirectoryName($outputFull)) 'Nexo-Windows-portable.zip'
if(Test-Path -LiteralPath $zipPath){throw 'Ya existe el ZIP de salida.'}
Compress-Archive -LiteralPath $outputFull -DestinationPath $zipPath -CompressionLevel Optimal
Write-Output "Carpeta portable: $outputFull"
Write-Output "Para compartir: $zipPath"
