# Usar Nexo desde otra PC o celular

Podés dejar de usar la PC anterior. La aplicación, su código y sus paquetes
están disponibles en GitHub. La web publicada funciona en un alojamiento
externo y no necesita que esa PC esté encendida.

## Elegí cómo usarlo

- **Celular, tablet o navegador:** abrir [Nexo web](https://nexo-comercios-app.chalkycove20.chatgpt.site).
- **Windows:** descargar [Nexo-Windows-portable.zip](https://github.com/EnriqueArielLopez/nexo/releases/download/v3.12.0/Nexo-Windows-portable.zip), extraer todo y abrir Nexo.exe.
- **Código y mantenimiento:** la raíz del repositorio contiene Windows y [web/](../web/README.md) contiene la web, con sus dependencias fijadas y configuración de compilación.
- **Recuperar el alojamiento web:** el [paquete Nexo-Web-Sites-3.12.0.tar.gz](https://github.com/EnriqueArielLopez/nexo/releases/download/v3.12.0/Nexo-Web-Sites-3.12.0.tar.gz) está en Releases. Es un artefacto para el alojamiento Sites; para usar Nexo desde el celular solo hace falta abrir el enlace de la web.

Los paquetes de la aplicación no contienen agendas, contraseñas ni conexiones
personales. El código y los paquetes permiten volver a instalar o mantener
Nexo; conservar los datos personales requiere una copia aparte.

## Conservar tu agenda e historial

**El respaldo sí sirve cuando cambiás de equipo:** es el archivo que lleva los
contactos, propuestas, bajas y registros de contacto al dispositivo nuevo.
El archivo no queda ligado a la PC donde se creó.

1. En el dispositivo que contiene tus datos, elegir **Guardar copia**.
2. Guardar el JSON en un destino privado que puedas abrir desde el otro equipo:
   por ejemplo, almacenamiento personal o una memoria USB. No alcanza con
   dejarlo únicamente en Descargas de la PC que vas a abandonar.
3. En el dispositivo nuevo, descargar ese archivo y abrir Nexo.
4. En la web, tocar **Importar una agenda**. En Windows, ir a **Mi agenda →
   Más → Importar una planilla** y elegir el JSON.
5. Comprobar la vista **Enviados** y las bajas antes de contactar. Los pendientes
   archivados también se conservan; se pueden mostrar desde **Más → Restaurar
   resultados limpiados**.

Las cuentas de Instagram y correo se conectan nuevamente cuando corresponda.
El respaldo de agenda no traslada contraseñas, cookies ni sesiones del navegador.
Importarlo no inicia tandas ni envía mensajes.

No hay sincronización automática entre dispositivos ni con GitHub. Antes de
continuar una campaña en otra PC o celular, llevar la copia más reciente. Una
copia vieja puede omitir contactos posteriores; revisar siempre el chat de
Instagram antes de escribir. Borrar el almacenamiento del navegador elimina
la agenda de ese navegador.

## Guardar datos en GitHub

Este repositorio es **público**. No subir aquí respaldos de agenda, planillas
personales, claves, cookies, bases SQLite ni mensajes de clientes, tampoco en
issues o como adjuntos de una release pública.

Si el titular elige GitHub para guardar su respaldo, usar un **repositorio
privado separado**, verificar quién tiene acceso y descargar el archivo desde
esa cuenta al cambiar de equipo. Guardar el respaldo como adjunto privado no
hace que Nexo se sincronice con ese repositorio. El JSON no está cifrado por
Nexo: proteger la cuenta y no ampliar su acceso sin revisar el contenido.

## Archivos públicos de esta entrega

| Material | Dónde está |
| --- | --- |
| App de Windows y checksum | [Release 3.12.0](https://github.com/EnriqueArielLopez/nexo/releases/tag/v3.12.0) |
| Paquete web y checksum | La misma release, archivos Nexo-Web-Sites-3.12.0.tar.gz y .sha256 |
| Fuentes de Windows y web | [Repositorio main](https://github.com/EnriqueArielLopez/nexo/tree/main) |
| Construcción y pruebas | build-portable.ps1, pruebas .test.mjs y web/scripts/smoke.mjs, versionados en el repositorio |
| Controles y validación | [Seguridad](../SECURITY.md), [Privacidad](../PRIVACIDAD.md), [Validación 3.12](VALIDACION-3.12.md) |
| Capturas de la interfaz | [Windows](images/nexo312-busqueda.jpg), [web en escritorio](images/nexo312-web-escritorio.jpg), [web en móvil](images/nexo312-web-movil.jpg), [agenda móvil](images/nexo312-agenda-movil.jpg) |

Las capturas de agenda usan ejemplos ficticios. La guía y las imágenes están
en GitHub, de modo que sus enlaces también funcionan desde otra computadora.
Los archivos temporales de pruebas, las sesiones y los datos privados no forman
parte de la distribución pública.

SHA256 del paquete Windows:
`adc86751c3d170bf4f9009b943baa99ae058822ddbb149d71932dd1202c27446`.

SHA256 del paquete web comprimido descargable:
`08a19087f79d0a0e640f2da22ba308fbb5141c5a56a63901d6ed2d4d7949f46b`.

Verificar con el archivo .sha256 de cada paquete. No confundir el paquete de
la web con un respaldo de agenda: el paquete contiene la aplicación.
