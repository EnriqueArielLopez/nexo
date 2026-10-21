# Conexión oficial de Instagram en Nexo 3.7

Estado al 21/10/2026, Local: código preparado y probado con Meta simulado.
No hay aplicación de Meta registrada ni servicio HTTPS desplegado para Nexo.
No se inició sesión ni se enviaron mensajes reales. El botón informa ese
pendiente; no presenta la cuenta como conectada.

## Qué hará el usuario una vez activada la integración

1. En Ajustes > Instagram escribe la cuenta remitente (en este caso mila.content).
2. Pulsa Conectar Instagram y autoriza en la página oficial de Instagram.
3. Nexo verifica que la cuenta autorizada sea la indicada y guarda el permiso
   cifrado por Windows, asociado al usuario local de Nexo.
4. Probar un mensaje permite indicar otra cuenta y revisar destinatario/texto.
   La otra cuenta tiene que escribir primero a la remitente. Preparar no envía;
   hace falta marcar la confirmación y pulsar Enviar un mensaje de prueba.
5. Las tandas automáticas toman primero los destinatarios permitidos por Meta,
   por afinidad y cupo restante. La revisión explícita de los perfiles y textos
   autoriza esa tanda. Los restantes se omiten con su motivo. También se
   mantiene Preparar manual para contactos que no habilita la API oficial.

La integración no permite iniciar mensajes comerciales a cualquier perfil
encontrado. Se aplica una ventana conservadora de 24 horas desde la entrada
comprobada. El cupo inicial es 5 Instagram/día y 50/mes, configurable: son
presupuestos internos y no una garantía de que Instagram no restrinja la cuenta.
Nexo usa además el cupo compartido por cuenta entre usuarios locales, las bajas,
el historial y el bloqueo de resultados inciertos. Una prueba real consume cupo
y queda en historial/Excel; no se repite automáticamente. La cola requiere Nexo
abierto. La autorización puede vencer o ser revocada: se vuelve a autorizar.

## Activación inicial por el responsable de Nexo (pendiente)

Esta configuración se hace una vez para el programa y su servicio. Los clientes
de la app no deben copiar tokens ni recibir la clave privada de la aplicación.

1. Crear la aplicación en Meta for Developers y configurar Instagram API con
   Instagram Login para cuentas profesionales (empresa o creador). Solicitar
   únicamente instagram_business_basic e instagram_business_manage_messages.
2. Registrar el retorno EXACTO `https://TU-DOMINIO-DE-CONEXION/callback`.
   Usar un dominio HTTPS propio dedicado; no se supone que psolutions.space
   ni los servidores compartidos de esta workspace estén autorizados para ello.
3. Configurar las URLs públicas de privacidad/eliminación de datos y los demás
   requisitos que solicite Meta para el caso de uso. Para desarrollo, configurar
   los roles/testers que corresponda. Para otras cuentas, completar los permisos,
   revisión y verificaciones exigidos por Meta antes de distribuir la integración.
4. Publicar el servicio de autorización que se incluye a continuación detrás de
   HTTPS. El app secret queda exclusivamente en las variables privadas de ESE
   servidor. No va en Nexo.exe, el ZIP, JavaScript del navegador ni Git.
5. Informar a Nexo la URL pública del servicio, reiniciar la app y comprobar el
   flujo de autorización real. Completar entonces una prueba autorizada con dos
   cuentas distintas. Esa validación real sigue pendiente.

## Servicio listo para desplegar

Archivo independiente: `instagram-oauth-service.mjs`, Node >=22.14, sin paquetes.
El portable lo incluye en `servicio-instagram`, separado del programa de escritorio.
Se ejecuta con `node instagram-oauth-service.mjs` y estas variables privadas:

| Variable | Valor / propósito |
| --- | --- |
| NEXO_META_APP_ID | Instagram App ID asignado por Meta |
| NEXO_META_APP_SECRET | Instagram App Secret; solo en el servidor de conexión |
| NEXO_META_PUBLIC_URL | Origen HTTPS público, sin ruta, query ni credenciales |
| NEXO_META_GRAPH_VERSION | v24.0 por defecto; verificar soporte al activar |
| NEXO_META_PORT | 18862 por defecto; escucha solamente en 127.0.0.1 |

El proxy TLS del servidor debe llevar las rutas `/v1/status`, `/v1/start`,
`/v1/poll`, `/v1/cancel` y `/callback` a ese puerto. Debe limitar solicitudes y
evitar registrar las query de `/callback` y credenciales/cuerpos de autorización.
Sin NEXO_META_APP_ID/SECRET/PUBLIC_URL válidos, `/v1/status` devuelve ready:false.
No se distribuyen valores privados ni se crea un túnel público automáticamente.

Pruebas de disponibilidad al desplegar: HTTPS válido en `/v1/status`, autorización
registrada en Meta que devuelve `/callback`, concesión de ambos permisos,
perfil profesional correcto y lectura de conversaciones. Los tests simulados
no validan el dominio, la aceptación de Meta ni la revisión de la aplicación.

## Cómo informar la URL al escritorio

Elegir una de estas alternativas, por orden de prioridad:

1. Variable de entorno NEXO_INSTAGRAM_CONNECT_URL en el proceso de Nexo.
2. Archivo `%LOCALAPPDATA%\NexoClientes\Datos\instagram-connection.json`:
   `{"serviceUrl":"https://TU-DOMINIO-DE-CONEXION"}`.
3. Para compartir un portable ya configurado, crear `instagram-public-config.json`
   junto a `server.mjs` antes de compilar. El ejemplo versionado tiene otro nombre
   y no se carga por defecto. El build copia el archivo público solo si existe.

Estas alternativas contienen únicamente una URL pública. Nunca agregar appSecret
ni tokens. Reiniciar Nexo al cambiarlas. Sin esa URL, el estado es Pendiente de
configuración inicial; no intenta autorizar ni enviar mensajes.

## Protección del flujo y operación

El escritorio crea un secreto aleatorio y envía al servicio solo su hash para
iniciar. El retorno de Meta usa un state de un uso; el canje del código y la
obtención del permiso de larga duración ocurren en el servidor. Solo el
escritorio que conserva el secreto puede recuperar el resultado por HTTPS, una
sola vez. El token no atraviesa URLs de retorno al escritorio ni JavaScript del
navegador. El servicio retiene los resultados únicamente en memoria por un máximo
de unos 10 minutos más el intervalo de limpieza de 30 segundos; no hay base de
tokens ni logs de contenidos. Reiniciar el servicio obliga a repetir las
autorizaciones pendientes. Cada callback informa errores genéricos sin códigos,
tokens ni mensajes de error externos.

Nexo vuelve a comprobar la identidad antes de guardar el token con DPAPI. Se
rechazan otras cuentas, cancelaciones, respuestas tardías y permisos incompletos.
Desconectar solo Instagram elimina su permiso local y pausa la cola, conservando
las otras conexiones e historial. El usuario también puede revocar el permiso
en Meta; la eliminación local no equivale a revocar la concesión en Meta.

Validación Local: pruebas unitarias y HTTP con proveedor ficticio, autorización,
cancelación, state/prueba de posesión, permisos, cuenta distinta, token cifrado,
vista previa sin envío, prueba confirmada con recibo ficticio, cuota, Excel y
rechazo de repetición. Falta la autorización y envío reales del titular.

## Fuentes oficiales consultadas

- https://www.postman.com/meta/instagram/folder/6raa77c/instagram-api-with-instagram-login
- https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api
- https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login/

Las páginas de Developers requirieron login o limitaron lectura durante esta
preparación. Se verificaron en la colección oficial de Meta los scopes, los
requisitos de cuenta profesional y de conversación iniciada por el destinatario.
El canje OAuth y los permisos efectivos deberán comprobarse en la activación real.
