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

Pendientes al preparar esta revisión: integrar el PR, generar y verificar el
portable desde `main`, publicarlo y actualizar las dos copias instaladas con
respaldo. El cierre se registra después de completar esas operaciones.
