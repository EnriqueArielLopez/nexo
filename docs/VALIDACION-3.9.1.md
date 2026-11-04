# Corrección del ingreso en Nexo 3.9.1

Fecha: 2026-11-03, Argentina. Aplicación Windows independiente, validada en Local;
no pertenece al catálogo ni a los ambientes compartidos de `ps-stack`.

## Problema y corrección

La instalación devolvió el bloqueo temporal incluso con una credencial válida.
Se reprodujo por separado que, tras vencer el bloqueo, el contador anterior
seguía acumulado: un solo fallo adicional causaba otros 15 minutos de espera.
El mensaje anterior tampoco informaba cuándo se podía volver a intentar.

Se conserva el límite de cinco fallos y 15 minutos. El vencimiento reinicia los
fallos; los intentos bloqueados no renuevan el plazo. El servidor responde 429
con `Retry-After`, código y vencimiento. La pantalla muestra la cuenta regresiva,
desactiva el ingreso durante la espera y ofrece Mostrar/Ocultar contraseña y
aviso de Bloq Mayús. No hay reintentos automáticos ni contraseñas guardadas.

## Validación local de la rama

- 112 pruebas Node correctas, incluidas regresiones con reloj controlado: límite
  exacto de vencimiento, cinco intentos nuevos después de esperar, reinicio tras
  ingreso correcto y aislamiento entre cuentas, también nombres inexistentes.
- HTTP real con SQLite temporal: bloqueo 429, `Retry-After`, ausencia de cookie
  en rechazos y misma fecha de vencimiento ante una contraseña correcta durante
  el bloqueo. La espera no se omite.
- UI contra una base ficticia aislada: quinto fallo, cuenta regresiva y botón
  desactivado; otra cuenta entra; Mostrar/Ocultar funciona; la sesión persiste
  al recargar y Cambiar usuario vuelve al formulario. Evidencia fuera de Git.
- No se enviaron mensajes ni se usaron conexiones reales durante las pruebas.

El control de la ventana nativa sigue limitado por la herramienta de Windows,
que no puede verificar su URL. Esto es independiente del bloqueo de Nexo. Una
prueba en el navegador integrado no se presenta como un ingreso hecho en Edge.

## Publicación e instalación

- PR [#3](https://github.com/EnriqueArielLopez/nexo/pull/3) integrado en `main`,
  revisión `c6753ac`. Autenticación y smoke HTTP revalidados desde main y después
  desde el propio runtime del portable. Las nueve comprobaciones del lanzador
  también pasan. Rama feature local y remota eliminada después de validar main.
- Release [v3.9.1](https://github.com/EnriqueArielLopez/nexo/releases/tag/v3.9.1)
  pública, con ZIP de 36.578.277 bytes y 51 archivos. Node 24.22.2 x64; no contiene
  cuentas, bases, perfiles ni configuración privada. Archivos de la app y assets
  coincidentes con main. Checksum descargado públicamente y digest del asset en
  GitHub coincidentes con el ZIP local:
  `ee0dabf61f03b90a076814fa90d18444d8edecc9a0d5a307166c13622a8039da`.
- Actualizadas ambas copias: `Desktop/Nexo` y
  `%LOCALAPPDATA%/Programs/NexoClientes`, además del ZIP para compartir del
  escritorio. Sus 51 archivos coinciden por hash con el portable verificado.
  Respaldo completo en `retirados/actualizacion-20261103-222022`, fuera de Git,
  con Datos, Programa, Escritorio-Nexo y distribución anterior.
- Comparación de todas las tablas SQLite: datos originales y respaldo idénticos,
  también después de la comprobación final de acceso. Sin migraciones ni cambios
  de usuario, contraseña, contactos, historial, configuración o conexiones.
- Instalación activa: health 3.9.1 correcto, un lanzador y un servidor. Se comprobó
  con la credencial del titular el login HTTP 200 y la carga autenticada de la
  planilla HTTP 200; se revocó únicamente la sesión creada por ese diagnóstico.
  No se autenticó ni modificó el perfil del Edge personal por esa vía.
- Se cerraron la pestaña y el servidor de QA. Nexo instalado quedó iniciado.
  La sesión en la ventana nativa no se puede confirmar desde la herramienta de
  control; no se declara que se haya iniciado allí.

Documentación actualizada: README, EMPEZA-ACA, arquitectura y este registro.
Sin cambios en rutas, scripts ni ambientes de infraestructura compartida.
