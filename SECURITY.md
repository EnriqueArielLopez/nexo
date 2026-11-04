# Seguridad de Nexo

Usar la última versión publicada. La revisión del 4 de noviembre de 2026 cubre
Nexo 3.11.0 para Windows x64, el servidor local, las importaciones, la extensión,
el conector MCP y el empaquetado. No es una certificación ni garantiza ausencia
de vulnerabilidades. No se ha auditado un despliegue público del servicio OAuth.

## Reportar un problema

Usar [Report a vulnerability](https://github.com/EnriqueArielLopez/nexo/security/advisories/new)
para un reporte privado. Incluir versión, pasos con datos ficticios, impacto y
Windows/Chrome utilizados. No publicar claves, cookies, bases, respaldos o datos
de destinatarios en issues. El canal no implica un plazo de respuesta garantizado.

## Qué protege la aplicación

- Solo escucha en `127.0.0.1`; rechaza Host y Origin ajenos. Las operaciones de la
  web requieren sesión, JSON y token CSRF. El lanzador dispone de una capacidad
  de cierre privada, renovada en cada arranque y fuera del contenido web.
  Antes de abrir la UI verifica una prueba HMAC del servidor con un desafío
  aleatorio; declarar el nombre Nexo en el puerto local no alcanza. La clave
  privada nunca viaja por HTTP y los permisos de salud/cierre se derivan separados.
- Cookies HttpOnly/SameSite Strict y sesiones aleatorias guardadas como hashes.
  Contraseñas con sal individual y scrypt N=16384, r=8, p=5. Las antiguas se
  actualizan al iniciar sesión correctamente. Los fallos persisten en SQLite:
  5 por nombre bloquean 15 minutos; se admiten hasta 20 accesos y 10 registros
  por minuto en esta instalación para limitar el trabajo de autenticación.
- Las conexiones recordadas usan DPAPI del usuario de Windows. Contraseñas y
  tokens no forman parte del respaldo/Excel ni se entregan al conector MCP.
- La extensión verifica su propia ventana y el dominio de Instagram, limita los
  comandos de depuración y devuelve únicamente presencia de sesión; no devuelve
  las cookies completas de Instagram. Requiere recargarse al actualizar.
- Las consultas web resuelven y validan DNS y fijan esa dirección al socket.
  Cada redirección se valida otra vez; redes privadas/reservadas se rechazan.
  Las llamadas con credenciales a proveedores no siguen redirecciones.
- Importaciones limitadas por bytes, filas, columnas y celdas; ZIP verifica
  tamaños reales, CRC, rangos, duplicados y directorios. No ejecuta fórmulas,
  macros ni extrae archivos del Excel al sistema de archivos.
- SMTP solo con TLS verificado en 465/587; valida direcciones/encabezados y no
  reutiliza una contraseña guardada al cambiar de servidor o casilla. Ese cambio
  requiere volver a introducirla. El conector MCP prepara propuestas y no puede
  enviar correos ni programarlos. Esas acciones se confirman en Nexo.
- CSP y escape de texto en la interfaz, consultas SQLite parametrizadas,
  límites de solicitudes y tiempos de lectura. El portable usa una lista de
  archivos permitidos y publica SHA256; no incluye datos de una instalación.

## Límites de confianza

Los espacios de Nexo separan datos dentro de la app. **No aíslan programas ni
personas que comparten el mismo usuario de Windows**. Un programa con acceso a
esa sesión puede leer archivos locales y usar DPAPI; un administrador o malware
también puede modificar el programa. Usar usuarios de Windows separados,
actualizaciones del sistema/navegador y cifrado del disco cuando corresponda.

SQLite, Excel, respaldos, adjuntos y perfiles del navegador contienen datos
legibles para ese usuario de Windows. No se cifran con la contraseña de Nexo.
No compartir `Datos`, perfiles de Chrome ni la extensión ya configurada. La
extensión necesita el permiso potente `debugger`; la lista de comandos reduce
su alcance, pero no convierte una extensión o un equipo comprometido en seguro.
Claude externo tiene sus propios permisos, que Nexo no controla.

No exponer el puerto mediante proxy, túnel o reglas de firewall. El modo desktop
no está diseñado como servicio web público. La conexión oficial requiere una
aplicación Meta y un servicio HTTPS confiable; sus secretos quedan en ese servicio.

Cerrar sesión no elimina conexiones recordadas ni programaciones ya confirmadas.
Revisar/cancelar programaciones y desconectar las cuentas antes de entregar la PC.
Actualizar también las copias guardadas y el runtime al recibir correcciones.
El ejecutable aún no tiene firma digital: un checksum verifica integridad frente
a la referencia publicada, no sustituye la autenticidad de una firma de editor.

## Mantenimiento

`npm test` incluye regresiones de abuso y aislamiento con datos ficticios.
Las plantillas `docs/validate-workflow.example.yml` y
`docs/security-workflow.example.yml` preparan pruebas Windows y CodeQL en
JavaScript, incluyendo una revisión semanal. No están activadas: el acceso de
publicación disponible carece del permiso `workflow`. Los reportes privados,
el análisis de secretos y la protección de push sí están activados en GitHub. Esto complementa la revisión manual, no la
reemplaza. Actualizar las acciones fijadas a commits y Node LTS periódicamente.

Referencias: [OWASP: contraseñas](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html),
[OWASP: SSRF](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html),
[OWASP: CSRF](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).
