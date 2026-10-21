# Nexo · Clientes — versión 2

Aplicación local para encontrar hoteles de habla hispana a partir del perfil
de Instagram del proveedor, preparar propuestas y mantener un historial de
contacto con espera mínima de dos meses calendario.

## Usar y compartir

- En esta PC: abrir **Nexo** desde el escritorio o `Nexo/Nexo.exe`.
- Para otra persona: enviar **Nexo-para-compartir.zip** del escritorio. Debe
  extraer el ZIP completo y abrir `Nexo.exe`, sin separar el ejecutable de
  `app` y `bin`. El ZIP limpio no contiene contactos ni credenciales.
- Requisitos: Windows 10/11 x64, .NET Framework 4.8 y navegador actualizado.
  Incluye Node 22.14. No requiere instalar Node, Python, Excel ni Codex.
- La investigación real necesita conexión a Internet y una API key de Claude
  con saldo y búsqueda web habilitada; una suscripción de claude.ai no la
  reemplaza. Cada persona configura su propia clave desde Ajustes.
- El ejecutable está compilado localmente y no tiene firma digital. Se probó
  extraído del ZIP en esta PC, no en otra computadora física.

## Flujo de trabajo

1. **Buscar clientes**: pegar el Instagram de quien ofrece los servicios,
   elegir países en el selector y buscar. El selector permite búsqueda por
   nombre, selección múltiple, América Latina y todos los países/territorios
   del catálogo en español. Los filtros opcionales permiten ciudad/zona,
   tipo de alojamiento y hasta 5, 12, 20 o 30 candidatos.
2. **Mi lista**: filtrar por nombre, ciudad, país o estado. Abrir una propuesta
   muestra el motivo, la fuente y el texto editable. Revisar el perfil y el
   idioma antes de preparar el contacto. “Copiar y abrir Instagram” prepara el
   texto y abre Instagram; el envío de un contacto nuevo se hace allí.
3. **Registrar**: después del envío, “Ya envié la propuesta” guarda historial,
   actualiza Excel y bloquea el recontacto por dos meses calendario. Para un
   resultado incierto, revisar Instagram y conciliar desde Historial.

Claude investiga la oferta del perfil de referencia y sus fuentes públicas;
si no puede determinar los servicios, pide completar el contexto opcional.
No extrae seguidores, no accede a perfiles privados ni inventa candidatos
como sustitución de una búsqueda fallida. Los resultados de IA se revisan.

El Excel tiene dos hojas: Hoteles e Historial, con estado, propuestas, fuentes,
fechas y tachado nativo de las filas contactadas. La copia maestra se guarda
en `Mis datos/Prospectos-hoteles.xlsx`, junto al ejecutable, más una instantánea
por día. Las copias descargadas anteriormente son instantáneas: volver a
descargar para actualizarlas. Editarlas no cambia el historial de Nexo.
Cerrar el maestro en Excel para permitir su actualización.

Los cupos iniciales 5/día y 50/mes son controles internos editables; no son
límites oficiales ni garantizan evitar restricciones. La demo tiene cupos
separados y nunca envía mensajes a Instagram. Los envíos externos a Nexo se
deben registrar manualmente para contar en el historial. La deduplicación usa
el username sin distinguir mayúsculas; cambios de username no se detectan de
forma fiable. “No volver a contactar” bloquea ese perfil hasta desmarcarlo.

## Conexiones y privacidad

La API de Instagram es opcional. Se conecta con un token oficial de Instagram
Login, cuenta profesional, app propia y permisos de Meta, incluida aprobación
cuando corresponda. No se implementa un OAuth alojado ni se pide la contraseña
de Instagram. La aplicación consulta hasta 50 conversaciones y 50 mensajes
por conversación; solo habilita API para destinatarios con un mensaje entrante
comprobado en las últimas 24 horas. No inicia mensajes en frío por API.

Cada envío requiere confirmación individual. Fallos de proveedor pausan el
envío; una respuesta incierta exige conciliación y nunca se reintenta sola.
La conexión oficial real no fue probada sin credenciales del titular.

Las claves de Claude y Meta se conservan solo en memoria hasta cerrar Nexo.
Claude recibe el perfil público, contexto, filtros, plantilla y usuarios a
excluir. Meta recibe el texto al confirmar un envío API. Solo escucha en
`127.0.0.1:18761`, valida Host/Origin y exige CSRF para mutaciones.
Sonido opcional generado localmente, sin archivos ni conexiones externas.
La tipografía Manrope está incluida con su licencia OFL; el runtime Node
incluye su licencia. No necesita descargar fuentes para mostrar la interfaz.

## Datos, cierre y respaldo

El historial operativo está en `Escritorio/Nexo/Mis datos/prospectos.sqlite`.
Usar **Ajustes > Cerrar Nexo**, el acceso Cerrar Nexo o la bandeja de Windows.
Cerrar solo la ventana deja el proceso en la bandeja. Para respaldar, cerrar
Nexo y copiar **Mis datos** completa. Para restaurar, preservar primero los
datos actuales y copiar el respaldo con Nexo cerrado. Si el escritorio está
en OneDrive, los datos pueden sincronizarse por ese servicio.

La instalación del 21/10/2026 preservó el historial de la primera versión.
La carpeta anterior `Hotel Prospectos` queda como respaldo; sus accesos del
escritorio se reemplazaron por Nexo y Cerrar Nexo. Los datos de desarrollo y
pruebas están separados. El ZIP para compartir permanece limpio.

## Desarrollo, distribución y validación

- Repo en branch `codex/hotel-prospectos`, sin remoto configurado.
- `npm test`: lógica, proveedores simulados, países/filtros, ZIP y Excel.
- `npm start`: servidor local. `PORT` y `HOTEL_DATA_DIR` permiten pruebas
  aisladas, sin cambiar la base operativa.
- `build-portable.ps1`: compila `build/Launcher.cs` con el compilador .NET de
  Windows; copia runtime, código y recursos y genera un ZIP limpio. Se niega
  a sobreescribir un destino existente. No ejecutarlo sobre datos de usuarios.
- `install-desktop.ps1`: instala la distribución de `release/Nexo`, preserva
  datos anteriores y crea los accesos y el ZIP del escritorio.
- La plantilla Excel `assets/base.xlsx` fue creada con `@oai/artifact-tool`.
  `export.mjs` y `stamp-xlsx.py` son herramientas de construcción de esa
  plantilla. El runtime portable solo usa `export-portable.mjs` y `zip.mjs`
  para completarla; no depende de esas herramientas ni de `node_modules`.
- `launch.ps1` y `stop.ps1` delegan la apertura y el cierre en Nexo.exe de la
  distribución portable; no buscan runtimes instalados en la computadora.

Validado en Local el 21/10/2026: 13 pruebas automatizadas; selector regional
y búsqueda de país desde pantalla; demo, propuesta y registro; ZIP limpio
extraído; ejecución con `bin/node.exe` incluido; descarga y lectura independiente
del Excel, tabla, paneles y tachado; cierre/reapertura con historial persistente;
instalación del escritorio con historial anterior conservado. Sin mensajes
reales, sin pruebas de Claude/Meta con credenciales reales y sin cambios de
Development, Producción ni infraestructura de Practical Solutions.

Referencia de interacción solicitada: https://landonorris.com/ (navegación
breve y transiciones). Diseño y recursos propios, sin copiar sus imágenes.
APIs: https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool
y https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api
