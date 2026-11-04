# Validación de Nexo 3.10.0

Fecha: 2026-11-04, Argentina. Rama `codex/nexo-envios-sin-duplicados`, desde
`main` actualizado. Nexo es una app Windows independiente de `ps-stack`:
no se modificaron servidores ni documentación de infraestructura compartida.

## Correcciones

El control anterior buscaba los primeros 40 caracteres de la propuesta actual.
Una conversación con otro texto no lo bloqueaba. También atribuía a hoy un envío
que solo había encontrado en el chat, consumiendo el cupo de esa tanda.

Se reemplazó por lectura estructurada del panel del destinatario, con identidad
exacta, separación de la lista lateral, carga estable y mensajes de texto o
multimedia. No se confunden borradores, tarjetas iniciales ni enlaces de perfil
contenidos en mensajes ajenos. La evidencia positiva se guarda transaccionalmente
como `contacted`, sin copiar mensajes privados, sin nuevo envío y sin cupo.
Persiste al reiniciar, limpiar, redescubrir o editar la propuesta. Enviados e
Historial muestran la detección por separado; no se afirma la fecha original.

Para destinatarios conocidos se consulta solo SQLite. Para los restantes se lee
su chat, con hasta 25 comprobaciones DOM de 400 ms (más navegación/protocolo), sin
barrer la bandeja. El vacío no se conserva entre tandas. La actividad del perfil
se reutiliza por 24 h. Una lectura incierta se omite con motivo visible.

La extensión 1.2.0 crea la ventana minimizada y recupera la emulación de foco al
reconectar; el sender la reafirma después de navegar. Los errores dejan de
activar Chrome. Solo el login lo muestra automáticamente. Progreso recalculado
a partir de los destinatarios, incluyendo fallos que pausan la tanda.

El diseño final reemplaza las capas acumuladas por una sola base de estilos:
marca propia, navegación lateral azul oscuro, Manrope local, resumen real de la
cartera y editor en dos paneles. El ingreso tiene composición propia y la guía
manual coincide con Descubrir, Clientes y Enviar propuestas. En móvil usa
navegación inferior. Las capturas públicas contienen datos ficticios.

El smoke descubrió que preparar la tanda regeneraba y pisaba la propuesta
personalizada. Se corrigió con message_custom y se probó también tras migrar
una base anterior. El cambio de plantilla sigue aplicándose a mensajes
automáticos. El respaldo/importación conserva conversaciones e inciertos y no
transforma una fecha de detección en un envío. Las pruebas no modifican datos
personales.

## Evidencia local

- Suite final completa: 123/123 pruebas correctas con Node 24.22.2 x64,
  incluida la memoria tras cerrar/reabrir SQLite, borradores, migración anterior,
  respaldo/importación y primer inicio sin configuración privada. El grupo de sender/extensión
  tiene 12/12 casos correctos.
- 12/12 escenarios DOM en navegador real con HTML ficticio: vacío, propuesta
  distinta, mensaje con hora/controles, multimedia, borrador, tarjeta inicial,
  perfil lateral, enlace en otro mensaje, perfil sin barra final, carga activa,
  invitación sin editor y estructura desconocida. No acceden a Instagram.
- HTTP real con 1.200 clientes y base temporal: sesión, CSRF/origen, edición,
  limpieza/restauración conservando enviados y conversaciones, cupos y descarga
  de Excel con la etiqueta de conversación previa. El estado respondió en 37 ms
  en una ejecución local; es una medición puntual, no una garantía.
- UI con base ficticia aislada en 127.0.0.1:18779: login, recarga, Enviados con
  ambas clases de registro y casillas bloqueadas, selección, paso de envío y
  vista previa con confirmación requerida. Revisión visual en el navegador integrado a 1320 × 940 y 390 × 844: navegación, filtros,
  guardado y persistencia del borrador en la vista previa, tabla sin desborde
  horizontal, selección, confirmación obligatoria, guía e ingreso. Sin errores
  de consola en esos flujos.
- Nueve comprobaciones del lanzador Windows correctas.
- Portable compilado con Node 24.22.2 x64. Smoke HTTP desde su propio runtime:
  correcto, incluidos 1.200 clientes y Excel (38 ms de estado en esa ejecución).

Evidencias y datos de prueba están en `qa/`, fuera de Git. Los proveedores de las
pruebas de envío son simulados. No se enviaron propuestas ni se usaron sesiones,
tokens o bases personales. La instalación activa permanece sin modificar.

## Uso y límites

Recargar la extensión instalada después de actualizar; no instalar otra copia.
Chrome y la PC deben seguir abiertos. La prueba de emulación y de los comandos
no reemplaza una tanda supervisada con una sesión real, destinatarios y textos
aprobados. Los cambios de interfaz de Instagram pueden requerir adaptar la
lectura; ante una estructura desconocida se omite sin enviar.

Las versiones anteriores a 3.10 no conocen `contacted`: no operar envíos con ellas
sobre una base que ya registró conversaciones mediante esta versión. Un rollback
operativo debe conservar la protección o conciliar esos contactos. No restaurar
una base antigua sobre el historial reciente.

## Entrega

El PR #4 reúne correcciones e interfaz final. Se valida la rama en Local y con
un portable aislado; después se integra a main y se genera desde allí el ZIP
público. La instalación activa del titular no se reemplaza como parte de la
publicación. Nexo no usa los servidores Development/Producción de ps-stack.

Portable candidato con interfaz final: 52 entradas y 44 archivos coincidentes
por SHA-256. Primer inicio y HTTP con 1.200 contactos correctos desde su propio
Node 24.22.2. Checksum del candidato:
`872c884dd7089c75fbe06ddc711942b3f8338b397cc4926a2b3a3ca01b29ca60`.
Estado de publicación y checksum final: se registran después de verificar la release.
