# Nexo · Clientes 3.9

Buscá negocios para tu oferta, revisá sus perfiles y prepará propuestas. Los envíos
trabajan en segundo plano para que puedas seguir usando la computadora.

## Descargar y empezar (Windows)

1. Abrí la [última versión](https://github.com/EnriqueArielLopez/nexo/releases/latest)
   y descargá **Nexo-Windows-portable.zip**.
2. Extraé todo el ZIP en una carpeta fija y abrí **Nexo.exe**.
3. Creá tu cuenta local. Para buscar, completá tu Instagram, oferta y filtros.
4. Para enviar por Instagram, seguí **Conectar mi Chrome** dentro de Nexo.
   Cada persona conecta su propio Chrome e Instagram. Para email, configurá su
   propia casilla en Ajustes.

Windows 10/11 x64, Edge e Internet; Chrome para enviar por navegador. El paquete
incluye Node y sus licencias. No necesitás instalar Node, Python, Excel ni Claude.
El ejecutable aún no tiene firma digital. El archivo `.sha256` permite comprobar
la descarga con `Get-FileHash -Algorithm SHA256`.

## Qué cambia

- **Búsqueda rápida:** 20 candidatos por defecto, con objetivos de 50/100 y alcance
  ampliado opcionales. La lectura de perfiles durante la búsqueda es optativa.
  Los candidatos rápidos quedan **para revisar**: no se afirma que sean inactivos.
- **Nueva búsqueda, lista limpia:** archiva pendientes anteriores por defecto.
  Conserva enviados, bajas, programados y destinatarios de tandas en curso. Se
  puede desactivar o restaurar lo archivado desde Más.
- **Chrome minimizado:** envío con progreso, detener/reanudar y recuperación de
  tandas tras reiniciar. Se muestra al pedir login o ante un problema que necesita
  revisión. Hay que mantener Chrome abierto; podés trabajar en otras ventanas.
- **Email en segundo plano:** iniciar una tanda ya no deja esperando el botón
  durante todos los envíos. Progreso y controles visibles desde cualquier paso.
- **Interfaz más ágil:** 50 filas por página, menos trabajo repetido en SQLite,
  botones con estado de carga y actualización de filas solo cuando cambian. Los
  borradores del editor se conservan mientras llega el estado nuevo.
- **Nexo en la bandeja:** cerrar la ventana con la X de Windows deja los trabajos
  activos. Para salir del programa, usá Cerrar Nexo o el menú junto al reloj.

La búsqueda pública depende del índice, la red y sus verificaciones humanas; no
se garantiza un número de resultados ni un tiempo fijo. No se resuelven CAPTCHA.
Se mantienen revisión de destinatarios/textos, cupos, bajas, control de duplicados
y pausa ante envíos inciertos. La API oficial de Instagram sigue siendo opcional
con sus requisitos propios; ver [INSTAGRAM-OFICIAL.md](INSTAGRAM-OFICIAL.md).

## Actualizar y compartir

Descargá un respaldo desde Mi espacio y cerrá Nexo desde la bandeja. Extraé la
versión nueva en otra carpeta y abrí su Nexo.exe. Los datos de la instalación
Windows se conservan en `%LOCALAPPDATA%\NexoClientes\Datos`.
Después, **recargá la extensión de Nexo** en `chrome://extensions` para que use
el código actualizado. No instales una segunda copia de la extensión.

Compartí el ZIP de Releases; nunca tu carpeta Datos o la extensión ya configurada.
Cada persona crea su cuenta local y sus conexiones. No hay sincronización en nube:
la PC debe seguir encendida. [EMPEZA-ACA.txt](EMPEZA-ACA.txt) contiene la guía completa.

## Desarrollar y verificar

Node >=22.13, recomendado 24 LTS. Sin dependencias npm externas:

```powershell
npm test
$env:PORT='18779'
$env:HOTEL_DATA_DIR=Join-Path (Get-Location) 'qa/datos-aislados'
npm start
```

La UI queda en `http://127.0.0.1:18779`. `HOTEL_DATA_DIR` aísla los datos del
servidor; `NEXO_DATA_DIR` sirve para QA del ejecutable. El puerto normal es 18761;
la extensión distribuida usa ese puerto. No usar datos/credenciales reales en QA.

Para compilar un portable nuevo (el destino no debe existir):

```powershell
powershell -File build-portable.ps1 -OutputDirectory dist/Nexo
```

Se puede elegir otro runtime con `-NodePath` y su licencia con `-NodeLicensePath`.
El ZIP no incluye bases, cuentas, sesiones, tokens, perfiles ni archivos de QA.
La [plantilla de CI para Windows](docs/validate-workflow.example.yml) ejecuta las
pruebas y construye el portable. Está preparada para copiarla a
`.github/workflows/validate.yml` desde una sesión con permiso `workflow`; el acceso
actual permite publicar código y releases, pero no activar workflows.

Nexo es independiente del catálogo de aplicaciones de Practical Solutions. No
se instala en sus servidores Development/Producción. La validación del escritorio
se hace en Local y con un portable aislado; no equivale a probar esos ambientes.

[Validación y límites de 3.9](docs/VALIDACION-3.9.md) ·
[Arquitectura y operación](docs/ARQUITECTURA.md) ·
[Historial anterior](docs/HISTORIAL-3.8.md)
