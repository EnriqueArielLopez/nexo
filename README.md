# Nexo · Clientes — versión 3

Aplicación local de Windows para buscar hasta 100 hoteles de habla hispana a
partir del enlace de Instagram del proveedor, ordenar por afinidad estimada,
revisar propuestas y conservar contactos e historial durante nuevas búsquedas.

## Uso

Un solo acceso **Nexo** en el escritorio abre o trae al frente la ventana.
No hay otro acceso para cerrar. La X de la app cierra el servidor; la X de
la ventana también lo cierra después de unos segundos en Edge/Chrome.

1. Crear una cuenta local o entrar. La primera cuenta recupera los datos
   anteriores de esta instalación; cada cuenta posterior tiene otra planilla.
2. Pegar el enlace de Instagram, elegir países (buscador, multiselección y
   América Latina) y buscar. Ciudad, alojamiento y contexto son opcionales.
3. Usar Claude abierto copiando instrucciones y pegando la respuesta JSON,
   o guardar una API key de Anthropic para búsquedas automáticas con saldo.
4. Revisar la planilla ordenada por afinidad, editar mensajes, registrar envíos.
   Pendientes excluye bajas y contactos en espera. Enviados conserva el registro.
5. Descargar Excel cuando se necesite; importar XLSX, CSV o JSON para recuperar
   contactos y envíos. Una planilla antigua nunca borra el historial posterior.

La búsqueda automática se divide en hasta diez grupos. Si no hay candidatos
válidos suficientes devuelve los encontrados; no inventa perfiles para llegar
a 100. La afinidad es una estimación comercial con evidencia, no probabilidad
de compra. Revisar identidad, idioma, fuente y propuesta. No extrae seguidores,
perfiles privados ni credenciales de sesiones de Claude o Instagram.

## Qué puede automatizarse

Anthropic exige autenticación API para terceros; una sesión abierta de Claude
no autoriza a Nexo a reutilizar sus cookies o suscripción. El modo manual utiliza
la conversación habitual y la respuesta importada. El modo API requiere saldo.

La API oficial de Instagram requiere cuenta profesional, aplicación Meta y token
con permisos/aprobación correspondientes. Esta versión no aloja un OAuth público.
Se sincronizan hasta 50 conversaciones y 50 mensajes por conversación. Solo
habilita destinatarios con mensaje entrante verificado de las últimas 24 horas.
**No automatiza propuestas en frío a los hoteles recién descubiertos.**

La cola revisada y autorizada por el usuario ordena por afinidad, omite contactos
no habilitados, verifica que el texto aprobado no cambió, espacia envíos y se
pausa por cupo diario/mensual o errores. El intervalo interno de 45 segundos y
los presupuestos iniciales de 5/día y 50/mes NO son límites oficiales ni garantías
contra bloqueos. No se encontró un cupo diario universal oficial seguro.

La cola requiere aplicación abierta y sesión activa. Al reiniciar, una cola en
curso queda pausada para revisión; una espera por cupo puede seguir al cambiar
el día/mes mientras siga abierta y Meta siga permitiéndolo. Errores inciertos
no se reintentan automáticamente: conciliar contra Instagram. El presupuesto,
las bajas y la espera de los envíos API se comparten entre perfiles locales
que conecten la misma cuenta de Instagram en esta instalación.

Los envíos externos se registran manualmente; Nexo no conoce toda la actividad
externa ni puede aplicar un límite global entre computadoras. Dos meses de
espera no sustituyen el consentimiento. Respetar bajas. Cambios de username
pueden impedir deduplicar de forma fiable.

Fuentes oficiales revisadas el 21/10/2026:
- https://support.claude.com/en/articles/13189465-log-in-to-your-claude-account
- https://www.anthropic.com/legal/consumer-terms
- https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api
- https://www.facebook.com/help/477434105621119

## Datos, sesiones y Excel

Datos estables: `%LOCALAPPDATA%\NexoClientes\Datos`. SQLite es la fuente del
historial; Excel es una exportación. El maestro `Clientes.xlsx` se actualiza
al guardar contactos o registrar envíos, con filas tachadas y hoja Historial.
Las descargas anteriores son instantáneas: volver a descargar o reimportar.
Cerrar el maestro en Excel si impide actualizarlo; SQLite conserva el envío.

Cuentas locales con contraseña scrypt, sesiones HttpOnly/SameSite y caducidad
7 días recordada / 12 horas temporal. No hay recuperación por email ni nube.
Los datos no se cifran íntegramente: quien tiene acceso a los archivos de
Windows puede leer las planillas y bases. La separación es dentro de Nexo.
Las conexiones recordadas opcionalmente usan Windows DPAPI CurrentUser,
no se incluyen en respaldos descargados ni en el ZIP para compartir.

Mi espacio > Descargar respaldo guarda JSON de contactos, bajas e historial
sin conexiones. Importar en otra PC para continuar. Para respaldo integral,
cerrar la app y copiar Datos completa; las conexiones cifradas no son portables
entre cuentas Windows. No compartir esa carpeta. Logout pausa la cola.

Solo escucha en 127.0.0.1:18761; valida Host/Origin, exige CSRF y limita archivos
importados (8 MB, 25 MB descomprimidos). No abre acceso público. Claude API
recibe perfil, filtros, contexto, plantilla y exclusiones; Meta recibe propuestas
solo tras autorizar la cola. Fuentes y sonidos son locales, sonidos opcionales.

## Distribución y actualización local

Instalación de esta PC: `%LOCALAPPDATA%\Programs\NexoClientes`.
Escritorio: un acceso Nexo y `Nexo-para-compartir.zip` limpio.
Versiones anteriores se retiran del escritorio y se archivan en `retirados/`
(fuera de Git), preservando primero su base. No se borra el historial anterior.
El primer usuario real debe crear su cuenta: no se preconfigura una contraseña.

Otra persona extrae TODO el ZIP y abre Nexo.exe con sus conexiones. Requisitos:
Windows 10/11 x64, .NET Framework 4.8 y navegador actualizado. Incluye Node22.14,
licencias Node y Manrope OFL. No necesita Node/Python/Excel/Codex instalados.
Ejecutable compilado localmente, sin firma digital. No probado en otra PC física.

## Desarrollo y verificación

Branch `codex/hotel-prospectos`, sin remoto. Solo Local, sin Dev/Producción.
`node --test test.mjs` cubre investigación simulada de100, importación/exportación,
sesiones, deduplicación, dos meses, cupos, cola, proveedores y errores inciertos.
`npm start` usa PORT y HOTEL_DATA_DIR para pruebas aisladas. El ejecutable acepta
NEXO_DATA_DIR solo como override de datos para QA, puerto18761 fijo.
`build-portable.ps1 -OutputDirectory release-v3/Nexo` genera distribución limpia.
`install-desktop.ps1` migra esta PC conservando históricos y dejando un acceso.

La prueba funcional usa datos ficticios y proveedores simulados. No se hicieron
búsquedas de pago ni envíos reales en cuentas del titular sin credenciales.

## Estado validado — 21/10/2026, Local

- 24 pruebas automáticas aprobadas con proveedores ficticios; búsqueda100 en
  diez grupos, prioridad, pausa diaria y reanudación al cambiar de día simulado.
- Smoke HTTP: sin sesión401, CSRF/origen403, datos tras reiniciar, perfiles
  aislados, logout y reimportación del Excel sin duplicar ni reactivar enviados.
- Excel descargado validado con lector independiente: 14 columnas, tabla,
  historial y tachado nativo. No requiere Excel instalado para generar el archivo.
- Interfaz probada en escritorio y ancho reducido; países, América Latina,
  handoff a Claude, sesión recordada y envío demo que deja Pendientes2/Enviados1.
- Cifrado DPAPI probado con secreto ficticio y recuperación correcta.
- ZIP limpio26 entradas, extraído y ejecutado con runtime propio en esta PC.
  Segunda apertura dejó una sola ventana. La prueba de cierre por AltF4 quedó
  pendiente porque el control nativo de ventanas interrumpió la comprobación;
  cierre por comando/API local validado para actualizar e instalar.
- Instalación definitiva activa, sin cuentas de prueba. Escritorio verificado:
  Nexo.lnk y Nexo-para-compartir.zip. Historial anterior copiado byte por byte.
  Versiones antiguas archivadas en retirados/20261021-033343.
- Sin llamadas reales de pago a Claude ni envíos reales de Instagram. Integración
  con tokens reales y validación en otra PC física quedan pendientes.
- No hay infraestructura compartida ni despliegue Development/Producción en
  este cambio; documentación de esta aplicación actualizada aquí y en EMPEZA-ACA.
