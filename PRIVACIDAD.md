# Datos y uso responsable

Estado: Nexo 3.12.0, 5 de noviembre de 2026. Este documento describe el programa
distribuido; no certifica el cumplimiento legal de una campaña o de un servicio.

## Qué guarda y dónde

Por defecto en `%LOCALAPPDATA%\NexoClientes\Datos`: espacios locales, hashes de
contraseñas y sesiones, conexiones recordadas cifradas con DPAPI, contactos,
fuentes, actividad observada, propuestas, historial, exclusiones y programaciones.
También puede guardar adjuntos, Excel, estado del asistente y perfiles del
navegador. Cambiar `NEXO_DATA_DIR`/`HOTEL_DATA_DIR` cambia esa ubicación.

El código distribuido no incorpora analítica ni envía una copia de la base al
autor. Cada persona administra sus propios datos y conexiones. Nexo no requiere
una cuenta central del autor para usar la planilla o la búsqueda pública.

## Versión web y móvil

La agenda se conserva en IndexedDB del navegador, sin contraseña propia ni
sincronización automática. Quien pueda abrir ese perfil del navegador puede
consultarla. No guardar claves de Instagram, correo o buscadores en ella.
Los datos importados se procesan en el dispositivo y no se suben a Nexo.

Guardar una copia descarga un JSON con preferencias, contactos y estados;
exportar CSV permite abrir la agenda en una planilla. Son archivos sin cifrado.
Borrar los datos del navegador, usar almacenamiento temporal o perder el
perfil del dispositivo puede eliminar la agenda: conservar respaldos privados.
No se garantiza persistencia permanente del almacenamiento del navegador.

El alojamiento recibe las conexiones HTTP habituales necesarias para servir
la aplicación. No hay endpoint de subida de agendas ni analítica añadida.
La búsqueda externa transmite al buscador el rubro y zona elegidos, no la agenda.
La búsqueda integrada está deshabilitada mientras no se configure una API
servidor autorizada. Si se habilita, transmite solo filtros de rubro y zona;
usa límites por minuto/día/globales, caché de resultados públicos y contadores
con identificadores efímeros derivados de la IP. El código no guarda la IP cruda.
El proveedor de alojamiento puede conservar sus propios registros operativos.

La web no puede leer conversaciones privadas de Instagram. La comprobación
manual y el registro de conversaciones anteriores son necesarios antes de
preparar una propuesta; el historial solo protege los dispositivos a los que
se haya transferido el respaldo actualizado. Nunca retomar una campaña en
una agenda vacía ni una copia vieja que omita contactos o bajas recientes.

## Qué sale de la computadora

- Buscadores y sitios consultados reciben consultas y la conexión de red habitual.
- Instagram recibe accesos al perfil/chat y mensajes desde la cuenta conectada.
- El proveedor SMTP recibe remitente, destinatarios, propuesta y adjunto enviados.
- Si se conecta la API de Anthropic, recibe pedidos, contexto comercial y los
  contactos/propuestas que se incluyan en el trabajo del asistente.
- Al instalar el conector de Claude, se permite a esa aplicación consultar y
  modificar el espacio elegido. No obtiene credenciales de Nexo ni puede enviar
  emails/programarlos por MCP. Sus otros permisos dependen de su configuración.
- La conexión oficial opcional de Meta usa el servicio HTTPS configurado para
  intercambiar la autorización y entregar la conexión a esta instalación.

Estos proveedores tienen sus propias condiciones, ubicaciones y políticas.
No incluir datos sensibles ni secretos en propuestas, consultas o adjuntos.
Los respaldos JSON y Excel contienen datos de contactos y no están cifrados.

## Conservación y control

Se conservan datos hasta que su responsable los gestione o elimine. Limpiar
resultados archiva pendientes; mantiene el historial para evitar duplicados.
Marcar **No contactar** excluye al destinatario; no borra sus datos. Respetar la
baja también fuera de Nexo y no volver a importar una lista para ignorarla.

Desde Mi espacio se puede exportar un respaldo; desde el cliente se puede
corregir la propuesta/email y registrar la baja. Para borrar toda la instalación,
cancelar envíos/programaciones, desconectar cuentas, cerrar Nexo y eliminar su
carpeta de datos y copias/Excel/adjuntos conservados. El borrado de archivos no
garantiza borrado físico en SSD, copias de nube o backups del sistema. La app no
implementa todavía una supresión granular certificada por titular: ante una
solicitud, identificar todos los archivos/copias y resolverla antes de seguir
tratando esos datos; pedir asistencia técnica si hace falta. No confundir
archivar ni marcar una baja con cumplir una solicitud de supresión.

## Antes de contactar o distribuir

Usar datos pertinentes y una finalidad informada, identificar al remitente,
verificar la base legal aplicable, permitir bajas y atender solicitudes de acceso,
rectificación o supresión. Un perfil público no autoriza cualquier uso. Los cupos
y pausas son protecciones operativas; no otorgan permiso para enviar publicidad
ni aseguran que Meta o el proveedor de correo acepten la campaña.

La [AAIP](https://www.argentina.gob.ar/aaip/datospersonales/responsables/obligaciones)
explica deberes sobre información, seguridad, registro y transferencias
internacionales. La excepción de archivos exclusivamente personales no debe
asumirse para una actividad comercial solo por ejecutarse en una PC personal.
Si se ofrece el programa a clientes o se opera para terceros, hace falta definir
responsable, contacto, finalidad, retención, proveedores y países, y revisar esos
puntos con asesoramiento legal según el caso. Descargar este software no implica
ceder datos al autor ni un servicio de custodia o cumplimiento normativo.
