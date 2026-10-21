# Nexo · Clientes 3.2

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
