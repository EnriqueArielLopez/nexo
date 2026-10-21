# Hotel Prospectos

Microaplicación local para investigar hoteles hispanohablantes a partir del
perfil de Instagram del proveedor de servicios, preparar propuestas y llevar
un historial de contacto con Excel. Creada y validada en Local el 21/10/2026.
Es independiente de las aplicaciones de Practical Solutions; no modifica sus
servidores, Docker, base central, Login ni rutas públicas.

## Abrir y usar

1. Abrir **Hotel Prospectos** desde el escritorio. Se abre una ventana de Edge
   con la aplicación local, en `http://127.0.0.1:18761`.
2. En Conexiones ingresar una **API key de Anthropic**, con saldo y Web search
   habilitado en Claude Console. Una suscripción de claude.ai no incluye esta
   API. La conexión ejecuta una llamada mínima y las búsquedas tienen costo.
3. Pegar el perfil de Instagram **de quien ofrece los servicios**. Claude
   investiga su oferta con fuentes públicas y busca hasta 12 hoteles en la
   región. Si no consigue evidencia suficiente del perfil, completar el
   contexto opcional. No hay extracción de seguidores ni acceso privado.
4. Abrir la fuente de cada candidato, verificar que sea un hotel con español,
   editar su propuesta y marcar la casilla de revisión. Una sugerencia de IA
   no equivale a una verificación humana.
5. Para un contacto nuevo: copiar el texto, abrir Instagram, enviar manualmente
   y presionar **Ya envié: registrar**. Solo confirmar después del envío real.
6. Descargar el Excel. La copia maestra `data/Prospectos-hoteles.xlsx` y una
   instantánea `data/Prospectos-AAAA-MM-DD.xlsx` se regeneran tras cambios y
   envíos. La hoja Hoteles muestra contactos tachados, último envío, próxima
   fecha y fuentes; Historial conserva las propuestas y confirmaciones.
   Cerrar el archivo maestro en Excel para permitir su actualización. Los
   Excel ya descargados en otra carpeta son instantáneas: volver a descargar
   para actualizarlos. Editar un Excel no cambia el historial de la aplicación.
7. El siguiente día y mes se calculan automáticamente con horario argentino.
   Los cupos iniciales de 5/día y 50/mes son un presupuesto interno editable,
   no límites oficiales ni garantía contra bloqueos. La demo tiene cupos
   separados y nunca envía a Instagram.
8. El acceso **Cerrar Hotel Prospectos** detiene el proceso y borra las
   credenciales de memoria. Cerrar solo la ventana de Edge deja el proceso
   local funcionando. No se instala tarea programada ni arranque automático.

## Conexión oficial de Instagram

Esta versión permite conexión con **token oficial** de Instagram Login;
no pide tu contraseña ni automatiza el inicio de sesión. Requiere cuenta
profesional, una app propia de Meta, token válido, permisos de lectura y
mensajería (`instagram_business_basic`, `instagram_business_manage_messages`)
y, según el uso, aprobación de Meta. No incluye un servicio OAuth publicado:
sin app/token de Meta no se pueden activar los envíos API.

Después de conectar: presionar **Actualizar conversaciones habilitadas**. Se
consultan hasta 50 conversaciones y 50 mensajes por conversación; solo un
mensaje entrante comprobado desde el destinatario en las últimas 24 horas
habilita el botón API. No se inicia una conversación en frío desde la API.
Los contactos omitidos por la paginación quedan sin habilitar.

Cada envío API exige revisión individual y recibe confirmación de Instagram
antes de marcarse enviado. Errores pausan los envíos. Si una llamada se corta
sin confirmación, se bloquea ese contacto como incierto y se debe verificar
en Instagram para conciliarlo. No hay reintentos automáticos. Al reconectar
se puede levantar la pausa después de resolver el problema en Meta.

La espera mínima de dos meses calendario se aplica a envíos manuales y API,
con deduplicación por usuario de Instagram sin distinguir mayúsculas. Ejemplo:
31 de diciembre → 28 de febrero. Un cambio de username en Instagram no es
detectable de forma fiable por esta versión. **No contactar** bloquea hasta
desmarcar esa casilla. Los cambios se conservan en SQLite entre sesiones.
Los envíos hechos fuera de la app deben registrarse manualmente para contar.

Fuentes oficiales de las integraciones:
- https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool
- https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api
- https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login

## Datos y respaldo

La instalación del escritorio guarda su historial en su propia carpeta `data`.
Es la copia operativa; la carpeta de desarrollo tiene datos separados. No borrar
`prospectos.sqlite`. Para respaldar, cerrar la aplicación con su acceso de
cierre y copiar la carpeta `data` completa a una ubicación de respaldo. Para
restaurar, con la aplicación cerrada, preservar primero los datos actuales y
copiar el respaldo. Si el escritorio está en OneDrive, esos datos también
pueden sincronizarse por OneDrive. Las claves y tokens se mantienen solo en
memoria del servidor, nunca en SQLite, Excel, Git ni almacenamiento del navegador.

Solo escucha en loopback, valida Host/Origin y exige token CSRF en mutaciones.
Claude recibe el perfil público de referencia, región, contexto, plantilla y
usuarios que se quieren excluir; Meta recibe el texto únicamente al confirmar
un envío API. Fuentes externas y resultados de IA requieren revisión.

## Desarrollo local

Node.js >=22.13, SQLite nativo; generación de Excel con `@oai/artifact-tool`
del runtime de Codex. `node_modules` es una junction al runtime instalado y
el tachado nativo usa Python estándar del mismo runtime. No modificar esos
runtimes. Si Codex los reemplaza, recrear la junction apuntando al runtime
vigente; no borrar recursivamente una junction junto con su destino.

`npm test` ejecuta pruebas de lógica, persistencia y proveedores simulados.
`npm start` inicia el servidor. `install-desktop.ps1` crea una instalación
nueva y dos accesos; se niega a sobreescribir una carpeta existente.

Estado: validación exclusivamente Local. Claude y Meta reales requieren
credenciales del titular; no se utilizaron ni enviaron mensajes reales en la
prueba. No se configuraron Development ni Producción. Repo nuevo en branch
`codex/hotel-prospectos`, sin remoto; no hay push ni merge pendiente de apps
existentes. No se modificó documentación de infraestructura porque no cambia
su estado operativo.

Prueba completada: 9 pruebas automatizadas correctas; interfaz abierta y
simulación registrada; instalación independiente en el escritorio; descarga
HTTP del XLSX; validación de sus dos hojas, tabla, panel inmovilizado y estilo
nativo de tachado solo en la fila contactada. Se comprobó el bloqueo hasta
21/12/2026 para un envío demo del 21/10/2026 y el rechazo de mutaciones sin
CSRF y solicitudes de origen externo. No se contactó a ningún hotel real.
