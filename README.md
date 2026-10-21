# Nexo · Clientes 3.5.0

## Estado vigente 3.5 — 21/10/2026, Local

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
