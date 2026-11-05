# Nexo web · agenda en el dispositivo

Aplicación real para PC y celular. Comparte interfaz y criterios con Nexo para
Windows. La agenda se guarda en IndexedDB de cada navegador; el servidor no
recibe ni sincroniza contactos, propuestas, importaciones o historial.

## Uso

Abrí https://nexo-comercios-app.chalkycove20.chatgpt.site desde un navegador
actualizado. Elegí rubro y zona, abrí la búsqueda externa y agregá los perfiles
que revises. También admite CSV, Excel XLSX y respaldos JSON de Nexo.

Antes de copiar una propuesta, revisá la conversación en Instagram. Si existe
cualquier mensaje, elegí «Ya hay mensajes» y no vuelvas a contactar. La web no
puede leer chats privados ni automatizar envíos. Enviá desde Instagram y recién
después registralo. Windows conserva sus conexiones y búsquedas automáticas.

«Guardar copia» descarga agenda, preferencias e historial. Importá ese archivo
en el otro dispositivo antes de continuar una campaña. No hay sincronización
ni contraseña propia de Nexo web. Borrar el almacenamiento del navegador borra
la agenda. El respaldo no está cifrado: guardalo de forma privada.

## Desarrollo local

Requiere Node 22.13 o posterior, npm e Internet para instalar dependencias.
Desde esta carpeta:

```powershell
npm run install:ci
node scripts/run-framework.mjs dev --hostname 127.0.0.1 --port 18795
```

Abrir http://127.0.0.1:18795. Para regenerar la UI desde la raíz de Nexo:

```powershell
node scripts/sync-nexo.mjs ..
npm run build
```

Los recursos generados quedan versionados para compilar este proyecto por
separado. El script añade revisión de contenido a JS/CSS y caché offline de
recursos propios; nunca guarda /api/ en el service worker.

Con la vista previa iniciada, `node scripts/smoke.mjs` verifica cabeceras,
rutas y rechazos del buscador. También admite una URL pública como argumento.
El test no envía contactos, claves ni mensajes.

## Búsqueda integrada opcional

Deshabilitada por defecto: no se necesita una API para usar la agenda, importar
o abrir búsquedas externas. Solo el operador del alojamiento puede habilitar
una API autorizada mediante BRAVE_SEARCH_API_KEY o SERPER_API_KEY como secreto
del servidor. Nunca usar claves NEXT_PUBLIC_*, pedirlas por UI ni versionarlas.
El endpoint acepta únicamente filtros cerrados, usa límites y caché de
resultados públicos. Configurar también el cupo económico en el proveedor.

D1 DB contiene exclusivamente contadores de cuota. La migración versionada de
drizzle se aplica una sola vez mediante el alojamiento. No recrear migraciones
ni ejecutar instrucciones sobre bases ajenas para probar la app.

La identidad del Site está en .openai/hosting.json y debe conservarse. Publicar
solo fuente revisada, commiteada y pusheada a main del repositorio del Site con
su artefacto correspondiente. El repositorio GitHub conserva una copia canónica
revisable de este proyecto. No incluir .env, .dev.vars, .wrangler, tokens,
node_modules, datos, logs ni resultados de pruebas en la publicación.
