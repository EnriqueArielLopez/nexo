# Nexo · Clientes 3.8

Nexo busca negocios (por ejemplo hoteles) que publican poco en Instagram y les envía
tu propuesta desde tu propio Google Chrome, de a uno y con pausas de 20 a 40 segundos.
Cada persona lo usa en su computadora, con su cuenta local y su Instagram: los datos
no salen de esa PC.

## Cómo instalarlo (Windows)

1. Entrá a la sección **Releases** de este repositorio (columna derecha) y abrí la
   última versión.
2. En **Assets** descargá **`Nexo-Windows-portable.zip`**.
3. Clic derecho sobre el ZIP > **Extraer todo**, en una carpeta fija (por ejemplo
   `Documentos\Nexo`). No lo abras desde adentro del ZIP.
4. Abrí **`Nexo.exe`**. Si Windows dice "Windows protegió su PC": **Más información >
   Ejecutar de todos modos** (el programa no está firmado).
5. Creá tu cuenta local (usuario y contraseña de 10 caracteres o más).
6. Arriba aparece **"Conectá Nexo con tu Google Chrome"**. Seguí sus 4 pasos (una sola vez):
   iniciá sesión en Instagram en Chrome, tocá **Conectar mi Chrome**, activá
   **Modo de desarrollador** en `chrome://extensions` y tocá **Cargar descomprimida**
   eligiendo la carpeta que abre Nexo.
7. Listo: **1 Buscar** → **2 Elegir** → **3 Enviar**. El archivo `EMPEZA-ACA.txt` del ZIP
   explica cada paso.

**Requisitos:** Windows 10/11 de 64 bits, Google Chrome, Microsoft Edge (viene con
Windows; Nexo lo usa minimizado para buscar) e Internet. No hace falta instalar Node,
ni claves de API, ni Claude.

## Para desarrollar

El código está en la raíz (`server.mjs` es el servidor local en `127.0.0.1:18761`,
`public/` la interfaz, `chrome-extension/` la extensión). Con Node 22:

```
node --test test.mjs search.test.mjs web-discovery.test.mjs prospecting.test.mjs browser-search.test.mjs instagram-official.test.mjs instagram-sender.test.mjs
```

Para armar el paquete que se comparte: `powershell -File build-portable.ps1 -OutputDirectory release-vXYZ\Nexo`
(genera la carpeta y `Nexo-Windows-portable.zip`) y subilo como Release:
`gh release create vX.Y.Z release-vXYZ\Nexo-Windows-portable.zip`.

---

## Historial de versiones



## Estado vigente 3.7 — 21/10/2026, Local

Preparación de la conexión oficial de Instagram, sin pedir al usuario que
inicie sesión ahora. La cuenta remitente indicada es mila.content. Ajustes
incorpora Conectar Instagram, cancelar/desconectar y Probar un mensaje con
vista previa y confirmación. La integración avanzada por token se conserva
plegada por compatibilidad; el flujo principal no pide copiar tokens.

El servicio OAuth separado mantiene el app secret en el servidor, canjea el
código en Meta y devuelve el permiso solo al escritorio que inició el flujo
con una prueba de posesión. State, autorización y resultado son de un uso;
se comprueban identidad, permisos, expiración y cancelación. El permiso se
guarda con DPAPI en la cuenta local y no se expone en estado, navegador o URL.
Al vencer se pausa la cola y se pide volver a autorizar.

Las tandas oficiales revisan permiso de conversación ANTES de elegir el cupo
y toman el resto disponible tanto local como compartido por cuenta. Exigen
vista previa y confirmación de perfiles y mensajes; un cambio de destinatarios,
cuenta o texto invalida la tanda. El test exige otro destinatario que haya
escrito en las últimas 24h, confirmación y recibo de Meta; consume cupo y se
registra en historial/Excel. Doble envío y respuesta incierta se bloquean.
Preparar manual sigue disponible por separado.

IMPORTANTE: aún no hay aplicación de Meta registrada, servicio HTTPS desplegado,
cuenta real autorizada ni envío real validado. Sin configuración, la interfaz
muestra Pendiente y no abre la autorización ni permite probar mensajes. Para
activar más adelante, seguir INSTAGRAM-OFICIAL.md, también incluido en el
portable junto al servicio listo para desplegar. No se desplegó ningún servicio,
se creó ningún túnel ni se tocaron los ambientes compartidos. La incorporación
futura del servicio a infraestructura/runbooks queda expresamente pendiente
de elegir el host y dominio y registrar la app; no se modificaron los docs
centrales ni su branch de otro trabajo.

Validación Local: 78 tests aprobados; OAuth HTTP, pairing, denegación, caducidad,
cuenta distinta, cancelación, datos públicos sin tokens, recuperación del permiso
cifrado al reiniciar y prueba completa con proveedor simulado. Smoke HTTP de
100 seleccionados: 99 contactos fríos omitidos y 1 permitido enviado por cola
con recibo FICTICIO. UI: pendiente sin configuración y test con destinatario,
texto explícitamente ficticio, confirmación y recibo simulado. No se usaron
credenciales de Meta ni se enviaron mensajes reales.

Branch codex/nexo-instagram-oficial, basada en la instalación estable local
0971cea. Sin remoto configurado: commits locales, sin push/merge/limpieza de
branches. Solo Local; no hay validación de Development/Producción aplicable
a este app independiente. La búsqueda real de 100 y revisión actual de feeds
siguen con el pendiente documentado en 3.6.


## Estado anterior 3.6 — 21/10/2026, Local

Se amplió la búsqueda que antes recorría 12 consultas sin páginas siguientes y
solo devolvió 5 candidatos. Ahora distribuye consultas por ciudades, sigue el
formulario normal de paginación (hasta 3 páginas por consulta, 540 en total),
evita páginas repetidas y excluye publicaciones/reels de las consultas de perfiles.
El filtro inicial es alta categoría: hoteles de 3 a 5 estrellas o señales
publicadas de categoría equivalente. Directorios y guías se descartan.
También puede leer webs públicas con un único Hotel en JSON-LD, categoría y
un único Instagram enlazado. No adivina cuentas ni emails; estos últimos solo
se guardan cuando aparecen en la fuente. Se limita y cachea la lectura de webs.

Edge trabaja minimizado con perfil dedicado; se muestra si solicita verificación.
No se resuelven CAPTCHA ni se evaden bloqueos. El número 100 es un objetivo,
no una garantía de disponibilidad de información pública. Se informa cuántas
consultas, páginas, perfiles y descartes hubo. Feed, actividad y capacidad de
pago permanecen sin verificar hasta revisión. Un conteo bajo de publicaciones
indexadas puede subir la afinidad, con etiqueta explícita de dato indexado.
No demuestra inactividad ni califica por sí solo al contacto.

Limpiar resultados archiva únicamente candidatos web sin eventos, bajas ni
programaciones activas. Restaurar recupera esos datos. El historial no se borra.
La columna SQLite archived es aditiva; no requiere migración destructiva.
El respaldo JSON incluye archivados y conserva su estado al recuperar.

Selección masiva hasta 100, incluidos candidatos por verificar. Mensaje base
personalizado con nombre/cuenta/ciudad/servicio/remitente; la vista previa toma
solo los primeros por afinidad hasta el cupo restante (5 Instagram, 20 email
por defecto). La confirmación revisa perfiles y textos. Una huella de la tanda
evita usar una vista previa con mensajes/destinatarios cambiados. Instagram
sin token prepara una tanda manual; copiar/abrir no registra envío: el usuario
pulsa Enviar en Instagram y después Ya envié en Nexo. Email usa SMTP y adjunto
configurados. No se envían mensajes reales durante QA. Los enviados, pendientes
e inciertos se excluyen de nuevas tandas, y los conocidos de futuras búsquedas.

Clientes.xlsx conserva todos los activos y se regenera al registrar envíos.
Un archivo previamente descargado es una copia: hay que descargarlo otra vez.
Pruebas locales: 65 tests Node aprobados; smoke HTTP con 100 registros ficticios,
top5/top20, personalización, rechazo de huella inválida, registro manual,
limpiar99/restaurar y Excel100. Lector independiente Python/XML: 100 filas,
15 columnas, 1 evento y estilo de enviado diferente. UI probada con 99 disponibles
tras un envío ficticio; la tanda propuso los 4 restantes del cupo diario.
Validación real y estado de instalación se registran al finalizar más abajo.
Solo Local; sin remoto configurado, sin Development/Producción compartidos.

## Historial de la versión 3.5

## Estado anterior 3.5 — 21/10/2026, Local

Corrección del bloqueo observado en la captura del usuario: el recorrido
principal ya no descarga el HTML del buscador como cliente HTTP. Abre una
ventana visible de Microsoft Edge con un perfil dedicado y lee únicamente la
página pública del buscador. Si aparece una verificación, la búsqueda queda en
estado `waiting` y muestra Ver buscador y Ya completé la verificación · continuar.
El usuario completa la verificación en Edge; la confirmación en Nexo vuelve a
leer la misma página, sin recargarla ni automatizar la resolución. Si sigue la
verificación, vuelve a esperar. Detener cancela también esa espera.

`browser-search.mjs` usa el protocolo DevTools de Edge, sin dependencias extra,
en un puerto aleatorio que escucha en 127.0.0.1. Usa un perfil propio por usuario
en `Datos/buscador/<id>`, no el perfil personal de Edge. Nexo crea/controla solo
su pestaña, acepta navegación únicamente al buscador y no lee contenido de otra
web si el usuario cambia de página. No usa técnicas de ocultación ni evade
CAPTCHA, restricciones o avisos de seguridad. Los perfiles del buscador pueden
guardar cookies normales de ese buscador; no forman parte del ZIP ni del backup
JSON. No iniciar sesiones personales en esta ventana destinada a búsquedas.

Al reiniciar Nexo, una investigación que estaba en espera queda pausada y debe
iniciarse otra, conservando candidatos y exclusiones. Al cerrar Nexo se cierra
la pestaña administrada y se desconecta el controlador. Se corrigió además el
inicio de una nueva búsqueda después de Detener: reinicia el estado cancelado.

Validado: 54 tests Node, 9 del lanzador, smoke HTTP de espera/continuación,
guardado de candidato ficticio, detención y nueva búsqueda, sin API ni mensajes.
Prueba real iniciada desde la UI con cuenta aislada: abrió Edge y detectó la
verificación humana, mostrando los dos controles en Nexo. No se completó el
CAPTCHA real ni se validó obtener contactos después de él o completar 100 reales.
Los tests no sustituyen esa verificación pendiente del usuario.

Instalación real 3.5.0 validada por health y controles HTML en puerto 18761.
Actualizadas ambas copias de Nexo (Desktop y Programs) y el ZIP limpio del
escritorio `Nexo-para-compartir-3.5.0.zip` (36 entradas, incluye browser-search,
sin perfiles, SQLite ni secretos). Respaldo:
`retirados/browser-350-20261021-140458`, `copia-0` escritorio y `copia-1` Programs.
Rollback: cerrar Nexo y restaurar app, Nexo.exe y EMPEZA-ACA.txt de cada copia.
No restaurar SQLite: se conservaron cuentas, filtros, conexiones y contactos.
Servidores QA 18770/18771 cerrados. Captura de la espera humana real en
`qa/nexo-350-verificacion-pendiente.png`, fuera de Git. Branch local
`codex/nexo-busqueda-navegador`, sin remoto ni deploys Development/Producción.
Los detalles de filtros, límites y revisión de candidatos de 3.4 continúan vigentes.
Este estado y EMPEZA-ACA.txt prevalecen sobre el historial siguiente.

Referencias técnicas: [protocolo de Edge](https://learn.microsoft.com/es-es/microsoft-edge/devtools/protocol/)
y [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/).

## Estado vigente 3.4 — 21/10/2026, Local

La búsqueda principal ahora es **web pública directa, sin API ni Claude**.
Completar Instagram, países y Filtros; pulsar Buscar 100 clientes. Nexo consulta
las páginas HTML públicas de DuckDuckGo, identifica perfiles exactos de Instagram,
filtra por palabras del rubro y ubicación en el texto, elimina duplicados y guarda
los resultados en SQLite/Excel. El perfil del proveedor se consulta en el índice
público para identificar servicios con reglas locales. Si no se identifican,
completar Qué ofrecés. No se usa una sesión privada de Instagram ni se leen
seguidores, historias o contenido protegido. Claude/API queda como opción separada.

`web-discovery.mjs` implementa el recorrido. Hasta 72 consultas con al menos
5 segundos entre consultas por búsqueda, límite de 100 altas, timeouts, control
de tamaño/respuesta, redirecciones a sitios públicos, cancelación y guardado
parcial. No evade CAPTCHA ni bloqueos: se detiene y explica el límite.
Los resultados y el historial existentes se conservan. La pestaña inicial es
Todos para que los candidatos Por verificar sean visibles al abrir la app.

La afinidad es una regla local por coincidencias de rubro, ubicación y señales
comerciales en texto indexado. No es análisis semántico completo de IA ni prueba
de intención de compra. No se confirma actividad actual desde un snippet.
El feed siempre queda sin verificar en este recorrido; no se inventan fechas,
carencias, seguidores, emails ni prioridad verificada. Los candidatos requieren
revisión explícita antes de contactar. País en el nombre de un negocio no se
considera ubicación; se usa la biografía, marcadores de ubicación o un conjunto
limitado de ciudades reconocidas. Ubicaciones ambiguas se descartan.

Validación: 49 pruebas Node (incluye 100 candidatos simulados, filtros, fuentes,
cancelación, duplicados, oferta, direcciones privadas y bloqueo), 9 pruebas C#
del lanzador. Smoke HTTP completo sin conexión Claude: 100 candidatos ficticios,
cero mensajes/historial de envío y cero llamadas a API paga. UI local: Buscar
inicia directamente, muestra progreso y los resultados sin pedir conexión.

Prueba real de web: se pudo identificar mila.content como Community Manager y
Content Creator. DuckDuckGo solicitó una verificación humana tras pocas consultas;
no se validó obtener 100 contactos reales. La primera prueba además detectó
homónimos (hotel llamado Argentina en otros países); se endureció geografía y
se agregaron casos de regresión antes de distribuir. Los datos de esa prueba
quedaron aislados en qa y no se incorporaron a la cuenta del usuario.
La lectura de una página pública previamente obtenida produjo un candidato con
Instagram, rubro y ubicación coincidentes. No se presenta esto como validación
de 100 contactos reales ni de actividad comercial actual.

Incluye el arreglo del lanzador: reconoce health JSON `app=nexo, ok=true` sin
exigir una versión fija. El código previo exigía 3.2.0 y fallaba con 3.3.3.
Instalación 3.4.0 aplicada en `Desktop/Nexo` y
`AppData/Local/Programs/NexoClientes`, con ejecutables y módulos verificados por
hash. Servicio, HTML y JavaScript reales comprobados en puerto 18761. Nexo quedó
abierto con el servidor de la copia del escritorio. El ZIP limpio tiene 35
entradas e incluye `web-discovery.mjs`, sin SQLite, secretos ni fixtures.
ZIP nuevo: `Desktop/Nexo-para-compartir-3.4.0.zip`. Los anteriores se conservan.
Respaldo de ambos programas: `retirados/web-340-20261021-135445` (`copia-0`:
escritorio, `copia-1`: Programs). Para rollback, cerrar Nexo y restaurar `app`,
`Nexo.exe` y `EMPEZA-ACA.txt` de cada copia. No restaurar SQLite: no hubo cambios
de schema. Cuentas, contactos, filtros y conexiones permanecieron intactos.
La instancia QA del puerto 18768 se cerró. El código y esta documentación se
guardan en la branch local `codex/nexo-busqueda-web-sin-api`; no hay remoto ni
entornos Development/Producción para esta app independiente.

Este estado 3.4 y EMPEZA-ACA.txt prevalecen sobre el historial siguiente.

## Estado vigente — 21/10/2026, Local

El recorrido elegido por el usuario usa la **app de Claude con su suscripción**.
En Nexo, completar Instagram, países y Filtros (rubro, ciudad y oferta), pulsar
**Buscar con Claude**, revisar el pedido y **Continuar en Claude: copiar pedido**.
Pegar y enviar el pedido en una conversación nueva de Claude con el conector
`nexo` habilitado. Claude investiga y guarda los resultados en la planilla local.
Nexo por sí solo prepara el pedido en este modo; no inicia una investigación
autónoma. La búsqueda dentro de Nexo requiere la opción API independiente.

Se corrigió el pedido que imponía 20 hoteles y omitía los filtros, las
instrucciones API que seguían buscando exclusivamente hoteles, y la falta de
señales comerciales para ventas, turnos y catálogos. El pedido ahora lleva
Instagram, oferta, rubro, países, ciudad y exclusiones, sin autorizar envíos.
Los candidatos API deben coincidir con el rubro solicitado; ambos recorridos
descartan países fuera de la selección y la propia cuenta del proveedor.
La ciudad se transmite como restricción explícita a la investigación; su
validación depende de la evidencia recogida por Claude.

Los campos y herramientas legacy `hotel_*`/`nexo_guardar_hoteles` se conservan
por compatibilidad y representan negocios del rubro elegido. La prioridad
mantiene la exigencia de actividad comercial, oportunidad visible de contenido
y encaje con la oferta. Un feed inaccesible queda Por verificar.

Se recuperó en esta branch el código 3.3.1 que ya estaba distribuido fuera
del repositorio (MCP, email, programación y rubros), para conservar su
funcionalidad al corregirlo. La suite previa aún esperaba 14 columnas en Excel;
ahora valida 15, incluida la columna de email ya instalada.

Validación: `node --test test.mjs search.test.mjs`, 41 pruebas aprobadas,
incluido MCP stdio real con cuenta y datos aislados y proveedores simulados.
Smoke HTTP local: sesión, guardado de filtros, pedido en modo `claude-app`.
No se realizaron búsquedas cobrables ni se enviaron mensajes comerciales.
La investigación real desde la sesión de Claude del usuario sigue pendiente.
La UI local se probó con una cuenta aislada: el botón Buscar con Claude muestra
el pedido con Gastronomía/Argentina/Córdoba y oferta de fotografía. El navegador
de pruebas bloqueó el enlace `claude://`; no se validó ese lanzamiento ni una
investigación real en la app externa. Reiniciar Claude para recargar su conector.

Instalación local 3.3.3 aplicada y comprobada por `/api/health` en puerto 18761.
Se actualizaron `Desktop/Nexo/app` y `AppData/Local/Programs/NexoClientes/app`,
esta última referenciada por los conectores existentes de Claude Desktop y Code.
Se conservaron las cuentas, SQLite y conexiones. Respaldo de programa anterior:
`retirados/busqueda-333-20261021-133427`; respaldo de la última revisión:
`retirados/busqueda-333-20261021-133554`. Rollback: cerrar Nexo, restaurar `app`
y `EMPEZA-ACA.txt` de la copia correspondiente (`copia-0`: escritorio;
`copia-1`: Programs), abrir Nexo y reiniciar Claude. No restaurar datos SQLite.
ZIP limpio nuevo en el escritorio: `Nexo-para-compartir-3.3.3.zip`; los ZIP
anteriores se conservan como versiones históricas. Instancias QA cerradas.
Este proyecto es independiente del stack Practical Solutions, sin remoto Git
ni entornos Development/Producción; no se modifican sus scripts ni configuración.

Los apartados siguientes conservan el historial de la versión 3.2; ante
diferencias, prevalecen este estado y `EMPEZA-ACA.txt`.

Aplicación local para encontrar hasta100 hoteles hispanohablantes a partir del
Instagram del proveedor. La búsqueda interpreta la oferta, revisa fuentes
públicas, clasifica oportunidades, redacta propuestas y conserva el historial.
No garantiza ingresos, clientes ni acceso completo a Instagram.

## Flujo de uso

Entrar al espacio local, pegar Instagram, elegir países y buscar. La primera
vez se abre una conexión de dos pasos: abrir la página oficial de Anthropic,
crear una clave API con saldo y pegarla. La conexión opcionalmente recordada
se cifra con Windows DPAPI CurrentUser. No hay intercambio manual de respuestas
ni JSON en el flujo principal. El acceso API se configura en Console; los planes
Max y Team elegibles pueden reclamar créditos API según las condiciones actuales.
Si no es posible identificar servicios del proveedor, pide una frase en
Filtros > Qué ofrecés, sin lanzar los grupos de búsqueda de hoteles.

La planilla separa Prioritarios, Enviados, Por verificar y Todos. Cada ficha
muestra la oportunidad, señales de operación comercial y fuentes del feed.
La propuesta es editable. Los contactos Por verificar requieren confirmación
explícita del usuario antes de habilitar el contacto desde la interfaz.
Las cuentas y datos son locales; no hay sincronización con nube.

## Claude como asistente de la aplicación

El botón Pedirle a Claude abre una conversación dentro de Nexo. Incluye accesos
Buscar hoteles, Preparar envíos, Ver historial y Mi Excel, además de pedidos
libres. Al conectar se envían al modelo las reglas, perfil, oferta, países,
plantilla, cupos y estado resumido. Cada pedido vuelve a enviar configuración
vigente; no depende de una conversación abierta en la app externa de Claude.
No se incluyen API keys ni tokens Meta en el contexto del modelo.

`assistant.mjs` implementa client tools de la API oficial. Claude puede consultar
contactos e historial, ejecutar la búsqueda, editar propuestas, preparar selección,
iniciar una cola autorizada, pausarla, detener búsqueda y regenerar Excel.
Nexo ejecuta las acciones y responde con sus recibos. La respuesta visible se
compone desde resultados reales de las herramientas; no se acepta como prueba
una afirmación del modelo de que envió mensajes. La bitácora es por usuario y
persiste en su SQLite. Se muestran las últimas6interacciones de hasta12guardadas.

Una orden en el chat no concede permiso de envío. Preparar propone hasta100
hoteles calificados, excluyendo bajas, espera y envíos inciertos. La app muestra
textos/destinatarios y el usuario confirma una selección. El servidor vincula
esa autorización, por cinco minutos y un solo uso, a cuenta Instagram, ids y
hash de cada texto. El modelo no puede fabricar ese permiso ni elevar cupos.
Editar una propuesta revoca aprobación y autorización pendiente. Antes de iniciar
se sincroniza Instagram; la cola vuelve a comprobar Meta/cupos/historial en cada
envío. Cambiar cuenta, texto o estado del contacto invalida la selección.

Cada pedido permite hasta5llamadas de control a Claude, con contexto resumido y
salida limitada. La búsqueda solo se ejecuta una vez por pedido; herramientas
idénticas repetidas devuelven el recibo anterior. Autorizar cola termina tras
iniciarla: no gasta llamadas de Claude por cada envío ni por cada tick del reloj.
Pausar o cerrar sesión cancela futuras acciones del asistente y pausa la cola.
Un envío ya en curso puede finalizar; revisar su recibo, no asumir que se anuló.
No se expone acceso de Claude a archivos arbitrarios, navegador, comandos,
contraseñas, configuración de permisos ni eliminación del historial.

## Criterio de prioridad

- Hotel real vinculado a su Instagram exacto e idioma español.
- Operación comercial: reserva directa, ficha vigente de reservas o reseñas
  fechadas dentro del último año. Excluir negocios cerrados.
- Oportunidad visible del feed: hasta12 publicaciones según recuento visible,
  última publicación comprobada de hace90 días o más, o contenido incompleto
  con observaciones concretas. Es un criterio comercial interno configurable
  en código, no una norma de Instagram ni prueba de capacidad de pago.
- Encaje explícito con los servicios del proveedor.

Las URL de evidencia deben pertenecer a las fuentes devueltas por la búsqueda.
La puntuación es calculada por Nexo a partir de estos criterios, no una
probabilidad de compra ni un cálculo de ingresos. Instagram inaccesible no
significa inactivo. No observar historias no demuestra que no existan;
historias quedan sin verificar. No se inspeccionan sesiones privadas ni se
extraen seguidores. La investigación de texto no sustituye una revisión
visual completa del feed; el usuario debe comprobar las fuentes antes de enviar.
Las evaluaciones de IA pueden contener errores. Candidatos con evidencia
insuficiente van a Por verificar; no se rellenan faltantes con inventados.

Los contactos anteriores y los importados sin análisis se conservan, pero
quedan Por verificar hasta que el usuario confirme la revisión. Excel conserva
los motivos; una importación de Excel no fabrica un nuevo análisis verificado.
Un respaldo integral conserva la evaluación y quién la revisó.

## Consumo y arquitectura de búsqueda

El proveedor se analiza una vez por búsqueda y su resumen se reutiliza en
cinco grupos de hasta20 hoteles. Perfil y oferta se guardan durante siete días,
con clave por URL, contexto y modelo; cambiar contexto invalida esa reutilización.
No se conserva la conversación de investigación entera entre grupos. La
extracción recibe evidencia acotada a28000 caracteres. Presupuesto máximo de
búsqueda: dos consultas web para el proveedor y ocho por grupo. Hasta12 llamadas
Messages para una búsqueda completa sin caché de perfil, frente a20 anteriores;
con perfil reutilizado son hasta10. Estas cifras no garantizan un ahorro en
porcentaje ni un costo fijo: el consumo real depende del proveedor y resultados.
Se registran llamadas/tokens/búsquedas declarados por Anthropic en lastSearch.
No hay reintentos automáticos de llamadas cobrables. Revisar saldo/límites en
Anthropic; Nexo no puede usar sin clave la sesión de la app de Claude.

## Contacto e historial

Claude investiga y redacta; Instagram es el canal de envío. La cola oficial
requiere cuenta profesional, app Meta, token y permisos/aprobación vigentes.
No se implementa OAuth público alojado. Se consultan hasta50 conversaciones y
50 mensajes por conversación, habilitando solo mensaje entrante comprobado en
las últimas24h. No hay automatización de mensajes en frío. Mantener Nexo abierto
para la cola. Al reiniciar queda pausada para revisión.

La cola revisa texto aprobado, prioridad, bajas, dos meses de espera, cupo diario
y mensual; pausa ante error y no reintenta resultados inciertos. Conciliar contra
Instagram. Presupuestos iniciales5/día y50/mes e intervalo45s son internos,
no límites oficiales ni garantías contra bloqueos. Nexo no conoce toda la
actividad externa; registrar manualmente los envíos hechos fuera de la app.
La espera/cupo API se comparte entre usuarios locales de una misma cuenta IG,
pero no entre distintas computadoras. Cambios de username pueden impedir
reconocer duplicados. Respetar bajas y consentimiento.

## Datos y distribución

Instalación: `%LOCALAPPDATA%\Programs\NexoClientes`. Datos estables:
`%LOCALAPPDATA%\NexoClientes\Datos`. SQLite es la fuente del historial.
`Clientes.xlsx` se regenera con filas tachadas al registrar envíos, motivo y
fuente, y hoja Historial. Descargas anteriores son instantáneas. Importar una
planilla antigua no borra envíos posteriores. Si Excel bloquea el archivo, se
conserva el envío en SQLite y se muestra aviso para volver a descargar.

Usuarios locales con contraseña scrypt; sesiones HttpOnly/SameSite,12h o7días.
No hay recuperación por email. Quien tiene acceso a los archivos Windows puede
leer las bases; solo las conexiones recordadas usan DPAPI. No trasladar claves
cifradas a otras cuentas Windows. Respaldo desde perfil no incluye conexiones;
importar el archivo en otra PC para llevar contactos/historial. Para respaldo
integral, cerrar Nexo y copiar Datos. No compartir esa carpeta.

Un único acceso Nexo abre o trae al frente la ventana. Cerrar app o comando
`Nexo.exe --stop` apaga el servidor. X de Edge/Chrome también lo cierra tras unos
segundos; esa variante no se verificó mediante control nativo en esta revisión.
El ZIP limpio incluye Node22.14 y licencias; no necesita Node/Python/Excel/Codex
instalados. Windows10/11 x64 y .NET4.8. Ejecutable sin firma; no probado en otra PC.

## Desarrollo y validación Local

Branch `codex/hotel-prospectos`, sin remoto ni main configurados. Repositorio
local independiente, sin despliegues Development/Producción ni cambios de
infraestructura compartida. No se tocaron sus configuraciones.

`node --test test.mjs`: 38 pruebas de historial, sesiones, Excel, cola, fuentes,
criterios de feed/operación y detección de servicios. `npm start`: PORT y
HOTEL_DATA_DIR para aislar QA. El ejecutable usa puerto18761 y permite
NEXO_DATA_DIR solo como override de QA. Solo escucha en127.0.0.1, valida
Host/Origin y CSRF. Límites de importación8MB/25MB descomprimidos.

`build-portable.ps1 -OutputDirectory release-v32/Nexo` compila y genera ZIP
limpio. `install-desktop.ps1` primera instalación; `update-desktop.ps1` conserva
Datos y el acceso, archiva versión anterior y actualiza el ZIP del escritorio.
Archivos de pruebas, distribución y retirados quedan fuera de Git.

Validación del21/10/2026: 38 tests, búsqueda completa simulada de100 con80
prioritarios/20por verificar, conexión guiada sin formatos técnicos y error de
clave legible. Confirmación manual de revisión y persistencia de evaluación.
Sin búsquedas de pago ni mensajes reales; falta validar con clave del titular,
fuentes reales de Instagram y otra PC física. No se garantiza acceso a feeds
completos ni historias de terceros.

Referencias oficiales revisadas21/10/2026:
- https://support.claude.com/en/articles/9767949-api-key-best-practices-keep-your-keys-safe-and-secure
- https://support.claude.com/en/articles/13189465-log-in-to-your-claude-account
- https://support.claude.com/en/articles/17154008-monthly-api-credits-for-max-and-team-plans
- https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool
- https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api
- https://www.facebook.com/help/477434105621119

Instalación3.1.0 actualizada en esta PC, con respaldo previo de programa y Datos.
ZIP limpio27 entradas; no incluye contactos ni conexiones. Conexión cifrada
y evaluación recuperadas después de reiniciar QA; Excel100 filas y14 columnas
validado con lector independiente. Se mantuvo el único acceso del escritorio.
También se recargó la pestaña que el usuario tenía abierta: retenía la interfaz
anterior aunque el servidor ya se había actualizado. Ahora muestra el login
actual. Los accesos y datos locales se conservaron. Búsqueda y envío real siguen
pendientes de conexión del titular; no se gastó saldo durante las pruebas.

## Validación del asistente — 21/10/2026, Local

38 tests aprobados. Smoke completo con Claude/Meta simulados: configuración
entregada al conectar,100 candidatos ficticios,80 propuestas preparadas, rechazo
de envío sin autorización, edición de propuesta, cola autorizada de un cliente,
recibo Meta ficticio, historial, espera de dos meses y tachado en Excel. Excel
validado con lector independiente (100 contactos,14columnas y recibo en Historial).
Acceso sin sesión al nuevo endpoint devuelve401. Prueba de UI del asistente con
bitácora y botones, sin formatos técnicos. No hubo llamadas de pago ni envíos
reales; todavía se requiere validar con credenciales/permisos del titular.

Instalador y ZIP3.2 actualizados conservando cuentas e historial. Respaldo del
programa y Datos antes de actualizar, fuera de Git. Solo Local; no se cambió
infraestructura compartida, Development ni Producción. Sin remoto para push.

Contrato de herramientas oficial:
https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools
La instalación activa quedó verificada como3.2.0 por health. Código instalado y
ZIP del escritorio coinciden con los archivos finales. ZIP limpio28 entradas;
el escritorio conserva solo Nexo.lnk y Nexo-para-compartir.zip. Respaldo previo:
retirados/actualizacion-20261021-041020. La pestaña anterior no pudo recargarse
por restricción del control del navegador; usar el acceso Nexo del escritorio.
Captura de la prueba ficticia en qa/nexo-32-asistente.png (fuera de Git).


### Cierre 3.6 — 21/10/2026, Local

65 tests aprobados. La regresión de presupuesto prueba que la búsqueda sigue
más allá de 180 páginas cuando faltan coincidencias y no pide una cuarta página
que iba a descartar. Límite final: 180 consultas, hasta 3 páginas cada una (540).
La lectura de hasta 3 webs distintas de una página se hace en paralelo y cachea
resultados. No se aumentó la frecuencia del buscador ni se cambiaron los controles
de verificación humana.

Prueba real controlada con perfil público mila.content, Hoteles, España, sin
Claude/API: acumuló 22 candidatos procedentes de fuentes públicas. La última
corrida agregó 12, recorrió 19 consultas y 47 páginas y examinó 130 perfiles;
17 duplicados, 63 sin ubicación coincidente, 22 sin categoría, 2 directorios
y otros descartes. Se detuvo manualmente al terminar el smoke, sin agotar
el plan. Ejemplos con fuente propia y contacto: Alma Barcelona, Marbella Club,
Majestic Hotel & Spa, Neomagna Madrid y Kimpton Los Monteros. Los datos siguen
en revisión: no se verificó el feed actual ni capacidad de pago. El objetivo
de 100 candidatos reales completos NO quedó validado. Ningún mensaje real
fue enviado. Excel real de QA y captura quedan fuera de Git en qa/.

Instalación 3.6.0 actualizada en Desktop/Nexo y Programs/NexoClientes con respaldo
previo en retirados/premium-360-*. Health 18761 confirma 3.6.0. ZIP del escritorio
Nexo-para-compartir-3.6.0.zip: 40 entradas, sin bases, credenciales ni datos de QA.
Comparación de bases en modo lectura contra respaldo: se conservaron sin cambios
los 8 leads, 1 evento, settings, 0 programaciones y 1 usuario de la cuenta real.
Las pruebas de 100 y los registros manuales ficticios usaron bases aisladas.

Documentación actualizada: README.md y EMPEZA-ACA.txt. Sin cambios a infraestructura
compartida, Development o Producción. Branch local codex/nexo-resultados-premium;
el repo no tiene remoto ni flujo de deploy compartido para merge/push. Se conserva
la branch para revisión; no se eliminaron branches. Pendiente: completar búsqueda
real de 100 y verificar feeds actuales; SMTP y envío desde Instagram del titular
requieren su configuración y revisión de destinatarios/textos.


### Cierre instalado 3.7 — 21/10/2026, Local

78 tests aprobados y verificación de interfaz completa con proveedor ficticio.
El cierre de QA confirmó 3 recibos simulados (prueba HTTP, tanda y prueba de UI),
cupo3, Excel con102 filas y3 envíos, token no legible en estado/SQLite y
desconexión que conserva los datos. Lector independiente XML verificó102 filas
y3 entradas de historial en el archivo ficticio.

Las dos instalaciones Desktop/Nexo y Programs/NexoClientes, el servicio de
autorización separado y el ZIP3.7 del escritorio coinciden por hash con los
archivos probados. Portable45 entradas, sin bases, archivos de configuración
reales ni datos/credenciales de QA. El servicio no se inicia con Nexo.
Health18761 confirmó3.7.0; la primera lectura inmediata fue anterior al arranque
y la siguiente comprobó el servicio activo sin errores.

Respaldo previo: retirados/official-370-20261021-165146. Comparación de bases en
modo lectura:58 leads,1 evento,1 settings,0 programaciones,1 usuario y0 filas
de credenciales, todos sin cambios frente al respaldo. No hay URL del servicio
Instagram configurada en la cuenta real; la autorización sigue desactivada.

Documentación: README.md, EMPEZA-ACA.txt e INSTAGRAM-OFICIAL.md (incluida como
servicio-instagram/ACTIVAR-INSTAGRAM.md en ambas instalaciones y el portable).
Pendientes reales: registrar/configurar la app en Meta, publicar el servicio
HTTPS en un dominio elegido por el titular, configurar su URL pública, conceder
permisos con cuenta profesional y hacer una prueba real con otro destinatario
que haya iniciado la conversación. No se pidió iniciar sesión ahora ni se
realizó ninguna de esas acciones externas. No se tocó infraestructura compartida.

### Corrección Tucumán 3.7.1 — 21/10/2026, Local

Diagnóstico de la búsqueda real guardada: Argentina, Tucuman, Gastronomía,
categoría todas. Solo 4 consultas, 6 páginas, 5 perfiles examinados, 3 descartados
por ubicación y 2 por rubro. No intervino el filtro de hoteles premium.

Se incorporó Tucumán al reconocimiento geográfico y se incluyeron sus localidades
San Miguel de Tucumán, Yerba Buena, Tafí Viejo y Tafí del Valle al pedir la provincia.
Las ciudades específicas mantienen su alcance. Se rechazan países incompatibles
y menciones de Yerba Buena en otra provincia. Se diversifican los términos del
rubro (incluido restobar), hasta 180 consultas, y se eliminan las comillas y
exclusiones inurl que en la prueba pública reducían los resultados a ubicaciones,
publicaciones y perfiles de otros rubros. Los filtros se comprueban en la evidencia,
no se confía en que el buscador los aplique. El resumen incluye rechazos por rubro.

Prueba pública comparativa: 10 consultas anteriores ampliadas pero con sintaxis
restrictiva, 0 candidatos; 4 consultas simples, 40 resultados examinados y 6 cuentas
válidas distintas (54restaurante, eljockeyresto, elsantuariotucuman, jbgtucuman,
arsucerveceria, tbc.barrionorte). Evidencia en qa/tucuman-simple-371.json, fuera de Git.
Estos perfiles son candidatos; no se verificaron actividad actual ni capacidad de pago.
No se probó completar 100 resultados reales. La prueba no modificó la base real.

Instagram: 79 tests aprobados; pruebas HTTP locales con proveedor ficticio verifican
OAuth, protección de credenciales, rechazo del autoenvío y contacto frío, vista
previa, confirmación, recibo, cupo, historial, Excel y bloqueo de repetición; tanda
con 100 seleccionados y solo 1 permitido. Cero mensajes externos. Meta sigue sin
configuración/autorización real y no se puede declarar operativo el envío real.
La vía oficial requiere conversación iniciada por el destinatario; no habilita
prospección por DM frío. No se pidió login, no se desplegó servicio HTTPS.

Branch local codex/nexo-tucuman; sin remoto ni main en este repositorio. No se
modificó infraestructura compartida ni Development/Producción.

Cierre instalado: ambas copias y ZIP 3.7.1 verificados por hash contra el portable.
Health local 18761 confirmó 3.7.1. Respaldo retirados/tucuman-371-20261021-174405.
Comparación de tablas en modo lectura: 161 leads, 1 evento, 1 settings, 0 schedules,
1 usuario y 0 credenciales, idénticos al respaldo. Servicio Instagram sin configurar.
Pruebas aisladas cerradas; no se incorporaron cuentas ni envíos ficticios a los datos
reales. Docs actualizadas README.md y versión/ZIP en EMPEZA-ACA.txt. Se conserva
la branch de trabajo; no hay remoto para push ni merge a main en este repo local.

### Prueba desde la pantalla y cobertura 3.7.2 — 21/10/2026, Local

Se abrió la instalación real del escritorio; la sesión disponible en el navegador
de prueba pedía usuario/contraseña. Para no alterar los datos reales se abrió el
mismo programa en 18776, con cuenta y datos de QA separados, y se inició la búsqueda
desde el botón de la UI: @mila.content, Argentina, Tucuman, Gastronomía, todas las
categorías, oferta identificada automáticamente. Evidencia QA fuera de Git.

La búsqueda pública real llegó a 23 candidatos, 11 consultas, 26 páginas y 229
perfiles examinados; 28 repetidos, 82 sin ubicación y 96 sin rubro. El buscador
pidió verificación humana durante la consulta 11. No se resolvió ni se cambió de
buscador para evitarla. El usuario respondió que no quería completarla ahora y
solicitó dejar la corrección preparada; se detuvo la búsqueda conservando evidencia.
No se confirmó llegar a 100; estos resultados no comprueban feeds desactualizados.

La revisión detectó dos falsos positivos: Tribunales (calle Tucumán y Talcahuano,
CABA) y OLGA (la única mención geográfica era @alterpoint_tucuman). Se excluyen
menciones, hashtags y URLs como ubicación; CABA contradice provincia Tucumán.
Se preservan calles con nombres de provincias como San Juan 1320 en Yerba Buena.
Los enlaces a pestañas /usuario/reels/ y /usuario/tagged/ se reconocen como cuenta;
los enlaces a publicaciones siguen sin identificar un autor por conjetura.

Las consultas de ciudad/provincia ahora prueban diferentes subrubros al principio:
parrilla, restó, cervecería, pizzería, restobar, bodegón, sanguchería y bar, además
de restaurante. Las búsquedas nacionales conservan la cobertura de ciudades.
El panel distingue objetivo incompleto, búsqueda en curso y verificación pendiente,
mostrando los candidatos guardados. No promete encontrar siempre 100.

81 tests aprobados. Reproducción local con la evidencia capturada, sin red:
21 candidatos aceptados y 2 descartados; exportación/importación Excel confirmó
21 filas y 0 envíos. Archivo qa/tucuman-21-candidatos-verificados-filtros.xlsx.
La nueva versión no se volvió a buscar por red porque seguía pendiente el control
humano y el usuario eligió no completarlo. No se enviaron mensajes de ningún tipo.

Limpieza del escritorio limitada a Nexo: ZIP antiguos 3.3.2, 3.3.3, 3.4.0, 3.5.0,
3.6.0 y 3.7.0 trasladados a retirados/escritorio-duplicados-20261021-175253.
El ZIP 3.4.0 estaba abierto en 7-Zip: Restart Manager identificó PID112864 y se
cerró solo esa instancia tras confirmar su línea de comando con la ruta exacta.
No se tocaron archivos de diseño, cursos ni otros programas del escritorio.

Branch local codex/nexo-tucuman-cobertura; repo sin remoto ni main. Infraestructura
compartida, Development y Producción no afectados. No hay despliegue externo.

Cierre instalado 3.7.2: ambas instalaciones verificadas por hash, health18761
3.7.2 y ZIP vigente idéntico al portable. Respaldo previo:
retirados/tucuman-372-20261021-180040. Tablas reales idénticas al respaldo:
161 leads, 1 evento, 1 settings, 0 programaciones, 1 usuario, 0 credenciales.
No se incorporaron datos/cuentas de QA a la cuenta real. Servicio Instagram aún
sin configuración. Se cerraron servidor18776, pestaña y navegador dedicados a QA;
Nexo real quedó abierto. Se retiró también el ZIP3.7.1 al mismo respaldo de
versiones: el escritorio conserva solo Nexo y Nexo-para-compartir-3.7.2.zip.
Captura qa/tucuman-prueba-pantalla-372.png conserva los23 resultados originales
antes de la revisión posterior que descarta2. No representa23 clientes calificados.
Docs actualizadas README.md y versión/ZIP en EMPEZA-ACA.txt. Branch conservada
para revisión; no hay remoto para push ni main para promoción en este repo local.
