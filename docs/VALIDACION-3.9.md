# Validación de Nexo 3.9

Fecha: 2026-11-03, Argentina. Revisión base: `8710f0f`.

## Alcance

Trabajo sobre una rama feature desde `main`. Nexo es una aplicación Windows
independiente del catálogo `ps-stack`; no se desplegó ni modificó infraestructura
compartida de Development/Producción. Local no se presenta como esos ambientes.
No se modificó la instalación activa ni la base de la persona usuaria.

## Pruebas realizadas

- 109 pruebas Node pasan (incluyen las 97 previas) después de los cambios de búsqueda, almacenamiento,
  UI y envío. Se incorporaron regresiones de búsqueda rápida, huella de filtros,
  limpieza/restauración, cupos al cambiar de mes, comandos vencidos, minimización,
  recuperación de tandas, detención durante login y colas de email.
- Smoke HTTP con proceso real y base aislada: login, CSRF/origen, 1.200 clientes,
  edición, rechazo de envío sin confirmación/huella válida, limpieza de 1.199
  contactos conservando un evento, restauración y descarga Excel. La respuesta
  de estado con 1.200 clientes se midió entre 106 y 439 ms en esta PC con Node 22/24 y distintas cargas (mediciones puntuales,
  no promesa de latencia).
- UI con cuenta y 120 contactos ficticios: páginas 1–50/51–100, filtro por nombre,
  editor y guardado de borrador, recuperación de tanda pausada con enviados y
  pendientes, controles visibles desde otros pasos y configuración rápida.

Los envíos automatizados de las pruebas usan proveedores simulados. No se
enviaron propuestas, emails ni mensajes reales, ni se usaron tokens del titular.
La búsqueda rápida reduce el trabajo por candidato; no se midió una mejora
porcentual de resultados reales ni se garantiza encontrar 100.

- Búsqueda pública real desde la UI, en base aislada: Hoteles, Salta, todas las
  categorías, oferta de fotografía/redes. Encontró 20/20 candidatos en 21 segundos,
  con 1 consulta, 3 páginas y 21 resultados examinados. Actividad sin verificar,
  cero llamadas de pago y cero mensajes. La limpieza retiró 119 candidatos
  ficticios y conservó el único evento ficticio previo. No extrapolar estos
  tiempos a otras regiones o al objetivo de 100.
- Compilación x64 y 9 comprobaciones de health del lanzador correctas.
- Portable: 51 entradas, Node 24.22.2 x64, ZIP íntegro y SHA-256 verificado; sin
  bases, perfiles, configuraciones personales ni datos de QA. Código empaquetado
  coincidente por hash con el probado. No se alteró el runtime instalado de la PC.

- Smoke adicional del servidor ejecutado desde el portable con su propio Node:
  acceso, 1.200 clientes, edición, limpieza/restauración y Excel correctos; estado
  en 266 ms. Las pruebas usan una base temporal independiente.

## Límites y validaciones pendientes

- Validar una tanda con sesión real de Chrome y destinatarios/textos aprobados,
  trabajando a la vez en otras ventanas. Las pruebas de protocolo no sustituyen
  la sesión real de Instagram ni sus cambios de interfaz.
- Verificar SMTP con la casilla de quien vaya a usar el programa.
- Probar instalación completa en otra PC física Windows 10/11 y carga/recarga de
  extensión por esa persona. El portable limpio no contiene sesiones ni datos.
- CI está preparado en `docs/validate-workflow.example.yml`, sin activar. GitHub
  rechazó crear el workflow porque la credencial OAuth del titular no tiene el
  scope `workflow`; la otra cuenta conectada solo tiene lectura en este repo.
  El código y los releases sí se pueden publicar. No se ampliaron permisos.
- La aplicación y extensión no tienen firma/publicación en una tienda. El paquete
  incluye la guía manual; la configuración oficial de Meta sigue siendo opcional.

La revisión final ajusta Seleccionar clientes visibles para que actúe solo sobre
la página actual y conserve la selección de otras páginas, hasta el máximo de
100. UI comprobada con 140 contactos: 50 seleccionados en la primera página,
100 al agregar la segunda, y 50 conservados al desmarcar la segunda. La tanda
por cantidad sigue abarcando todos los resultados.

## Cierre

- PR [#1](https://github.com/EnriqueArielLopez/nexo/pull/1) y
  [#2](https://github.com/EnriqueArielLopez/nexo/pull/2) mergeados. Código final
  en `main`, commit `36b2c1ec02a3bdd2cd39519aadbc9563fc53d9aa`.
- Main validado nuevamente por HTTP y por UI para la selección paginada. Portable
  definitivo reconstruido desde main y smoke HTTP desde su propio runtime:
  correcto, 1.200 clientes y respuesta de estado de 149 ms en esa ejecución.
- Release pública [v3.9.0](https://github.com/EnriqueArielLopez/nexo/releases/tag/v3.9.0),
  con ZIP Windows x64 de 35.493.497 bytes y archivo `.sha256`. El ZIP tiene 51 entradas;
  el codigo y los assets de la app coinciden con main. SHA-256 del ZIP:
  `8605afca07628e2d80ef5d64f8320aea50c082f517c2b3881d5f016303f63cfc`.
- Descarga pública y checksum verificados después de publicar. Se conserva la
  release 3.8 para rollback. La instalación personal se actualizó después, según
  el registro siguiente.
- Ramas locales/remotas `codex/nexo-rendimiento-y-envios` y
  `codex/nexo-seleccion-paginada` eliminadas después de merge y validación de main.
- Servidor y pestañas QA cerrados; datos y evidencias aislados fuera de Git.
  Docs actualizadas: README, EMPEZA-ACA, arquitectura y este registro. La
  documentación de infraestructura compartida no cambia porque Nexo sigue
  fuera de ese catálogo y no se tocaron sus ambientes, rutas ni servicios.


## Actualización instalada en Windows — 2026-11-03

Por pedido explícito del titular, se actualizaron las dos instalaciones locales:
`Desktop/Nexo` y `%LOCALAPPDATA%/Programs/NexoClientes`, junto al ZIP para compartir
del escritorio. Se usó el portable 3.9.0 publicado, con Node 24.22.2 x64, sin
recompilar ni modificar el código. Los 51 archivos de cada copia coinciden por
SHA-256 con el portable probado; el ZIP también coincide con la release.

Se utilizó `update-desktop.ps1` con Source explícito y se conservó la ruta de la
copia del escritorio. Respaldo privado, fuera de Git:
`retirados/actualizacion-20261103-203151`, con Programa, Escritorio-Nexo, Datos y
la distribución anterior. No se restauró ni reemplazó la base activa.

Comparación SQLite en modo lectura: todas las columnas originales de contactos,
historial, cuentas, sesiones, configuración, programaciones, jobs y cupos se
conservan. Se agregó únicamente la columna `activity`, vacía, prevista por el
esquema de la aplicación. La lectura del respaldo coincide con el estado previo.
Los conteos y huellas de verificación quedan solo en QA, fuera de Git.

Health real de la instalación en `127.0.0.1:18761`: ok, build/version 3.9.0.
HTML y JS responden 200 y sirven los controles nuevos. Nexo quedó iniciado.
No se hicieron búsquedas, pruebas de envío ni mensajes reales con estos datos.

Los archivos de la extensión instalada están preparados en 1.1.0, conservando su
configuración local. Queda recargar Nexo en `chrome://extensions`: el control
visual de Windows se interrumpió porque no pudo determinar la URL de Chrome con
seguridad. No se intentó otra vía de control visual ni se modificaron permisos.
El conector MCP anterior se detuvo para reemplazar su runtime; sus rutas se
conservaron para que el cliente vuelva a iniciarlo con los archivos nuevos.
