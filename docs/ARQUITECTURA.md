# Arquitectura y operación de Nexo

## Escritorio independiente

El ejecutable Windows inicia Node en loopback (`127.0.0.1:18761`) y abre la UI.
Su icono de bandeja conserva el proceso cuando se cierra la ventana. Salir de
Nexo detiene búsquedas y tandas después de la operación en curso. No hay servidor
en nube ni integración con Docker, Nginx, Login o RBAC de Practical Solutions.

`server.mjs` coordina las cuentas locales, SQLite, búsqueda, proveedores y colas.
La UI usa POST con sesión, comprobación de origen y CSRF; las conexiones de la
extensión usan un token independiente por usuario, solo sobre loopback.

El ingreso admite cinco fallos por nombre normalizado y bloquea por 15 minutos.
Los intentos durante el bloqueo no prolongan su vencimiento; una vez vencido se
reinicia el contador. El bloqueo responde HTTP 429 con `Retry-After` y su fecha
de vencimiento. La UI muestra el tiempo restante y no reintenta automáticamente.
Los contadores son en memoria, como en versiones anteriores; no hay cambios de
credenciales, cookies, sesiones ni esquema de la base por esta corrección.

## Datos y rendimiento

`core.mjs` conserva contactos, eventos, programaciones y jobs. La actualización
agrega índices sin borrar tablas ni cambiar datos. El listado obtiene el último
evento en SQL y calcula cupos compartidos por canal una sola vez por listado,
evitando recorrer/formatear el historial por cada contacto. Las fechas de cupo
mantienen el día de Argentina. La UI muestra 50 filas por página y conserva el
DOM de las filas si no cambió su contenido.

La limpieza archiva contactos sin eventos ni programaciones pendientes. Las
tandas activas aportan sus ids protegidos; una tanda pausada anterior se descarta
al iniciar otra búsqueda con limpieza. Las bajas y el historial siguen guardados
y se excluyen de nuevos descubrimientos. Restaurar no habilita bajas ni envíos
inciertos. Un respaldo JSON/Excel es una exportación, no una copia del programa.

## Búsqueda

`web-discovery.mjs` separa descubrimiento de revisión de actividad. En modo rápido
no abre Instagram ni consulta publicaciones; los resultados quedan sin verificar.
El alcance rápido tiene un presupuesto de 40 consultas; ampliado, hasta 900.
Cada consulta sigue la paginación normal hasta sus límites. La huella del cursor
incluye proveedor, países, ciudades, rubros y categoría: no se reutiliza un cursor
de filtros diferentes solo porque tenga el mismo tamaño.

La verificación durante la búsqueda es opcional y usa un perfil de navegador
dedicado, separado del emisor. Así una búsqueda no navega la conversación donde
se está enviando. Se conservan pausas, límites y verificaciones humanas del
buscador. El presupuesto no garantiza resultados ni un tiempo máximo: la red o
una verificación humana pueden prolongarlo. Detener libera las esperas.

## Tandas en segundo plano

`instagram-sender.mjs` conserva destinatarios, estados y mensajes en el job
`chromeSender`. La extensión 1.2 crea su ventana con `focused:false` y
`state:minimized`, sin pasar por una ventana normal. La emulación de foco se
recupera al adjuntar el depurador y después de navegar. Solo el inicio de sesión
muestra Chrome automáticamente; un error informa/pausa en Nexo sin activarlo.
Hay un solo worker activo; detener interrumpe la espera entre destinatarios y
reanudar toma únicamente los pendientes. Tras reiniciar queda pausado.
Un envío incierto se registra y bloquea; no se repite automáticamente.

Antes de navegar se aplica el historial SQLite indexado. `instagram-chat.mjs`
identifica el perfil exacto dentro del panel del editor, excluye el listado
lateral y lee filas de mensajes (texto o multimedia), nunca solo un fragmento de
la propuesta actual. La tarjeta inicial del perfil y el borrador no cuentan como
mensajes. La lectura del chat está acotada a 25 comprobaciones locales separadas
por 400 ms, además de los tiempos de navegación/protocolo. Un vacío debe estar
estable, sin carga pendiente y con identidad y estructura reconocidas. No se
escanea toda la bandeja ni se conserva una caché negativa de chats vacíos.

Una conversación previa crea un evento `contacted`, sin texto privado ni mensaje
supuestamente enviado. La escritura es transaccional e idempotente; no sustituye
un evento enviado o incierto. No consume cupo, cancela programaciones pendientes y
bloquea nuevas tandas por cualquier canal, igual que el historial anterior. La UI
la conserva en Enviados con fecha de detección, sin atribuir esa fecha al mensaje
anterior. El índice `event_contact_latest` incorpora este estado sin borrar datos.
La limpieza y la búsqueda conservan esos contactos. Se reutiliza una lectura de
actividad del perfil de menos de 24 horas. Antes del Enter se vuelve a comprobar
el chat para detectar historial que haya terminado de cargar durante la escritura.

El endpoint de inicio exige confirmación y la huella de la vista previa. Se
revisan bajas, actividad, cupos y cambios del mensaje antes de escribir. La
extensión rechaza comandos vencidos; el puente elimina comandos que vencieron
antes de entregarlos. No se controlan pestañas personales del usuario.

`email-queue.mjs` responde al iniciar y ejecuta SMTP de a uno. Persiste ids,
propuestas y resultados, sin contraseñas. Detener no interrumpe un SMTP ya
iniciado. Un error pausa la tanda, y una respuesta incierta requiere conciliación
en Historial. La reserva transaccional del evento sigue protegiendo duplicados.

Chrome y la PC deben seguir abiertos. La API oficial de Meta es otra vía y
mantiene sus permisos y requisitos. No se incorporaron servicios externos.

Referencias: [ventanas de Chrome](https://developer.chrome.com/docs/extensions/reference/api/windows),
[protocolo de emulación](https://chromedevtools.github.io/devtools-protocol/tot/Emulation/).

## Distribución y actualización

`build-portable.ps1` compila el lanzador y empaqueta una lista explícita de código,
assets, extensión sin configurar y runtime x64. Genera ZIP, versión y checksum.
No empaqueta datos, perfiles, secretos ni QA. Los paquetes son específicos de
Windows x64; no son instaladores para macOS/Linux.

El runtime y su licencia se pueden elegir mediante `-NodePath` y
`-NodeLicensePath`; solo se aceptan x64 y Node >=22.13. La distribución 3.10 usa
Node 24 LTS verificado contra los checksums oficiales. Quien descarga el ZIP no
necesita instalarlo aparte.

Los datos de Windows quedan en `%LOCALAPPDATA%\NexoClientes\Datos`. Para actualizar,
respaldar desde la app, cerrar desde la bandeja y abrir el nuevo portable.
Recargar la extensión instalada después del primer arranque. Para volver a la
versión anterior, cerrar Nexo y abrir el portable anterior; no restaurar una base
vieja encima del historial reciente. Los nuevos índices son aditivos. Después de registrar eventos `contacted`, no
operar tandas con un runtime anterior a 3.10: esas versiones no conocen ese estado.
Para un rollback que permita envíos hace falta conservar esta protección o
conciliar esos contactos primero; nunca restaurar una base vieja para omitirlos.

## Alcance y próximos pasos

La escala prevista es una PC y sus cuentas locales; la paginación visual no
convierte SQLite en un servicio multiusuario distribuido. Para operación central
con varios equipos harían falta API autenticada, base compartida y workers en un
servidor, con diseño de permisos y migración separados.

Pendientes: firma de ejecutables, instalador/actualizador y publicación de la
extensión en una tienda. La instalación de la extensión sigue siendo manual por
persona; no se distribuye el token de una instalación existente. Validar envíos
con la cuenta real y destinatarios revisados antes de operar una campaña.
