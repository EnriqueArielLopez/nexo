# Validación 3.12.0

Fecha: 5 de noviembre de 2026. Ambiente: Local Windows x64; web local y
publicación Sites separada. Nexo no depende de los servidores Development o
Producción de Practical Solutions. No se modificaron instalaciones del usuario,
Compose, Nginx, certificados ni copias envs de esa infraestructura.

## Cambios

- Comercios en general y alias compatible del rubro anterior. Filtros de país,
  ciudad, oportunidad y exclusión de contactos compartidos por web y Windows.
  Estrellas de hotel solo para alojamientos; selección mixta hotel/gastronomía
  conserva los negocios de ambos rubros.
- Búsqueda con corte de consultas consecutivas sin novedades y presupuesto
  comprobado entre consultas. Conserva resultados parciales y cursor. Historial
  local evita volver a comprobar cuentas ya contactadas; chats desconocidos se
  revisan individualmente antes de enviar.
- Revisión de chat de solo lectura antes de copiar propuestas, sin comandos de
  escritura. Conversaciones previas se guardan sin inventar fecha de envío ni
  consumir el cupo. Revisión manual explícita cuando no hay acceso al chat;
  prueba caduca a los cinco minutos y cambiar el texto la invalida.
- Agenda web/móvil con IndexedDB, transacciones entre pestañas, respaldos JSON,
  importación JSON/CSV/XLSX y exportación CSV. Importar y archivar no quita
  bloqueos de enviados, conversaciones previas, bajas o envíos inciertos.
- Diseño común con tipografía Manrope local, navegación de tres pasos, filtros
  esenciales visibles, opciones avanzadas plegables y adaptación móvil.

## Evidencia local

- Suite Node: 146 pruebas sin fallos. Incluye regresiones, protocolos de Chrome
  simulados, HTTP real, límites de archivos y transferencia CSV web → Windows.
- Lanzador C#: 14 comprobaciones de salud e identidad sin fallos.
- Web: TypeScript y compilación de producción correctos; npm audit sin avisos conocidos en dependencias de ejecución y desarrollo. 21 comprobaciones HTTP del artefacto compilado, con búsqueda integrada deshabilitada.
- Contrato UI: 273 IDs presentes, sin referencias literales a controles ausentes.
- Navegador: ingreso y filtros de comercios de Windows con espacio ficticio;
  alta de negocio en web, revisión obligatoria antes de copiar, registro de
  conversación previa, recarga y reimportación del JSON con contacto bloqueado;
  Excel generado por Windows recuperado en web con sus estados. Viewport móvil
  390 × 844, sin desborde horizontal de página y contactos en tarjetas.
- No se enviaron mensajes reales ni correos. No se usaron credenciales de
  Instagram del usuario. La entrega real y el comportamiento ante cambios
  futuros del DOM de Instagram requieren validación con una sesión propia.

## Límites de la web

Sin API autorizada del operador, abre una búsqueda externa y permite agregar
perfiles revisados; no hace búsqueda automática del proveedor ni sortea CAPTCHA.
El usuario confirmó que no tiene API. No se compró ni activó un servicio pago.
La agenda es real, pero no tiene sincronización ni lectura automática de chats
privados: necesita revisión manual y respaldos actualizados entre dispositivos.

Las pruebas móviles usan un viewport de navegador; no sustituyen ensayos en
hardware Android/iOS. El navegador puede borrar almacenamiento. Los respaldos
no están cifrados. Estos controles no certifican ausencia de vulnerabilidades ni
cumplimiento legal de campañas. Continúan los límites documentados en SECURITY.md.

## Publicación y cierre

- PR [#7](https://github.com/EnriqueArielLopez/nexo/pull/7) integrado a main.
  Código distribuido: `c5d3f2f166a7bfeb7c16e27f566b4933e5e1e443`;
  tag `v3.12.0`. Main revalidado con Node 24.22.2: 146 pruebas sin fallos.
- [Release pública](https://github.com/EnriqueArielLopez/nexo/releases/tag/v3.12.0)
  publicada el 5 de noviembre de 2026 y marcada como última versión.
  ZIP de 36.591.550 bytes, 58 archivos; 48 archivos de app comparados con
  las fuentes de main. Runtime incluido contrastado con el binario preparado.
- Descarga anónima completa del ZIP y del checksum desde GitHub, iguales al
  paquete probado. SHA256:
  `adc86751c3d170bf4f9009b943baa99ae058822ddbb149d71932dd1202c27446`.
- Portable definitivo: dos smokes HTTP correctos con su Node incluido, recursos
  de inicio de la UI accesibles y estado de 1200 clientes leído en 93 ms en
  esta PC. No extrapolar ese tiempo a hardware móvil o a consultas de red.
- Web pública: https://nexo-comercios-app.chalkycove20.chatgpt.site,
  versión 1 de Sites, fuente main
  `e6ce45b1eb5626b84bab2883deb8b35c463d9ee1`. Archivo de publicación SHA256
  `ff2ed3dbaffe0221a473e6510530905d16dbd5a0944cefecc515149c874d7c94`.
  21 comprobaciones externas propias sin fallos. Acceso sin login de Nexo,
  agenda inicial vacía y filtros de país/ciudad/comercio verificados en la UI.
- Rama feature local y remota `codex/nexo-comercios-experiencia` eliminada
  después del merge y de validar main. Checkout del alojamiento conservado
  en main para mantenimiento. Instancias locales y pestañas propias de QA
  cerradas; queda abierta la web publicada como resultado.
- README, EMPEZA-ACA, arquitectura, seguridad y privacidad actualizados.
  No se tocaron servidores, envs ni repos operativos de Practical Solutions.

Pendientes y límites: CI/CodeQL siguen como plantillas, sin activar porque la
credencial con escritura no tiene el permiso workflow. La otra credencial
visible solo tiene lectura sobre este repo; no se cambió de cuenta ni se
ampliaron permisos. La búsqueda integrada web continúa deshabilitada por falta
de API autorizada, según confirmó el usuario. El envío real con su Instagram,
Android/iOS físico y la firma digital de Windows no quedaron verificados o
resueltos; la comprobación manual, los respaldos y los avisos de privacidad
siguen siendo necesarios. No hay garantía de ausencia de incidentes o reclamos.
