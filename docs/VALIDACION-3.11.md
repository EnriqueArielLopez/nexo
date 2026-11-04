# Validación de seguridad 3.11.0

Fecha: 4 de noviembre de 2026. Ambiente: Local Windows x64 y portable aislado.
Nexo es independiente de los servidores de Practical Solutions; no se desplegó
en Development ni Producción y no se modificó una instalación activa del usuario.

## Alcance y correcciones

Revisión de código y pruebas adversarias con cuentas, destinatarios y secretos
ficticios. Se revisaron HTTP local, sesiones/CSRF, cuentas, DPAPI, ZIP/XML/CSV,
correo, consultas públicas, extensión, herramientas del asistente/MCP y paquete.

| Riesgo observado | Corrección y verificación |
| --- | --- |
| ZIP podía declarar menos bytes que su contenido almacenado; referencias Excel dispersas y XML malformado podían forzar trabajo excesivo | Verificación de estructura/rangos/CRC/tamaño real, rechazo de duplicados, lectura XML previa con profundidad y tags limitados, límites de filas/columnas/celdas y pruebas maliciosas |
| Bloqueo de contraseñas se perdía al reiniciar y se evitaba rotando nombres | Contadores SQLite persistentes y límite global antes de scrypt; prueba de reinicio/rotación |
| Hashes usaban un costo menor al seleccionado para esta distribución | scrypt N=16384/r=8/p=5, sal individual, formato versionado y migración verificada de credenciales anteriores |
| Extensión reenviaba comandos de depuración sin lista y cookies completas | Lista acotada, validación de URL y ventana propia, evaluación contextual y solo presencia de sesión; rechazos verificados con Chrome simulado |
| MCP descifraba credenciales y aceptaba un booleano del modelo para enviar o programar | Eliminación del acceso a DPAPI y de esas herramientas, rechazo incluso si se invocan directamente; pruebas por stdio y selección obligatoria de espacio |
| DNS se validaba y después se resolvía otra vez al conectar | Dirección validada fijada al socket, rechazo de redes reservadas/transiciones, redirecciones validadas y pruebas de sustitución de resolución |
| Configuración SMTP/encabezados podían aceptar valores peligrosos; cambiar destino podía reutilizar credenciales | Sobres y encabezados validados, TLS obligatorio, cambio de servidor/casilla requiere clave nueva y ruta general no cambia transporte; respuestas remotas no se copian en errores |
| Cualquier cliente local con CSRF público podía cerrar la app sin sesión; el lanzador confiaba solo en el nombre del servicio | Cierre con sesión o token privado renovado por arranque, archivo fuera del servidor estático y adaptación del lanzador; prueba de rechazo y cierre válido; desafío HMAC para autenticar el servidor sin transmitir la clave y rechazo de respuestas falsas/reutilizadas |

Las contraseñas anteriores se refuerzan al acceder. No operar esa base con una
versión anterior a 3.11 después de migrar. No borrar/restaurar una base antigua
para eludir esta regla, porque perdería memoria de contactos y bajas.

## Evidencia reproducible

- `npm test`: 133 pruebas, sin fallos ni omisiones, incluyendo seguridad y las
  regresiones previas de duplicados, borradores, colas y OAuth.
- Lanzador Windows compilado: 14 comprobaciones de salud e identidad.
  Dominio de navegador privado por instalación y rechazo del alias genérico,
  para aislar cookies entre aplicaciones locales; login comprobado en Chromium.
  Integración C# contra HTTP de QA: servidor genuino aceptado, clave de otra
  instalación rechazada y cierre privado completado sin abrir ventanas.
- Smoke HTTP del portable con Node incluido: primera instalación, dos espacios
  aislados, sesión/CSRF, límites, cierre privado, 1200 contactos, borradores,
  archivo/restauración, historial de conversaciones y descarga de Excel.
- Navegador local con nombres, evidencia y propuestas maliciosos: cero nodos
  HTML inyectados, cero atributos ejecutables y cero enlaces de protocolo
  peligroso en el editor; propuesta conservada como texto literal.
- ZIP auditado contra los archivos fuente, prueba de integridad y SHA256;
  sin bases, `.env`, logs, perfiles, configuración de extensión ni datos de QA.
- Node 24.22.2 x64 contrastado con SHA256 oficial del archivo del proveedor.
- Patrones de claves en archivos versionados y alertas abiertas de secretos de
  GitHub: sin coincidencias/alertas observadas durante la revisión. Esto no
  demuestra que todo secreto imaginable sea detectable.

Los archivos temporales y reportes locales de QA quedan fuera de Git. No se
enviaron mensajes, correos ni propuestas a cuentas reales para probar seguridad.

## GitHub y distribución

Reportes privados de vulnerabilidades, análisis de secretos y protección de
push activados. Las plantillas de pruebas Windows y CodeQL están preparadas en
`docs/*workflow.example.yml`, fijadas a commits oficiales; no ejecutadas como
workflows, porque la credencial disponible no tiene el permiso `workflow`.

El portable incluye `SECURITY.md` y `PRIVACIDAD.md`. Mantiene el diseño 3.10 y las
protecciones para no repetir contactos, con extensión 1.3. Recargar la extensión
y volver a configurar el conector de Claude si hay varios espacios.

## Límites y pendientes

No se usaron credenciales ni sesiones reales de Instagram, SMTP o Anthropic.
El control de permisos de la extensión se probó con Chrome simulado, sin una
campaña real. No se auditó infraestructura OAuth remota ni se simuló malware con
permisos de administrador o acceso al mismo usuario Windows. SQLite, respaldos,
Excel y perfiles siguen siendo legibles para ese usuario del sistema operativo.

Pendientes: activar CI/CodeQL con permiso `workflow`, firma del ejecutable,
publicación de extensión, revisión externa independiente y una función granular
de supresión de datos por titular. La retención y los derechos deben gestionarse
también en respaldos, adjuntos y proveedores. Ver [PRIVACIDAD.md](../PRIVACIDAD.md).
No se ofrece garantía de seguridad absoluta, cumplimiento legal o ausencia de
demandas; el uso comercial/para terceros requiere evaluación de su caso.
