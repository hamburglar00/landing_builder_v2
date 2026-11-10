# Espera y diagnóstico del número — 10/11/2026

## Alcance aprobado

La selección de números conserva el endpoint, autenticación, filtros de uso publicitario, disponibilidad y reparto. La función `landing-phone` continúa en su versión 26; no se modifican API2, Panel3 ni las reglas de asignación.

El precalentamiento y el clic comparten una sola consulta pendiente por landing. El visitante puede esperar hasta 15 segundos desde el clic. Si vence esa espera, el botón vuelve a estar disponible con una explicación breve; otro clic sigue esperando la misma consulta. Un fallo terminado permite un reintento explícito. Una respuesta tardía se conserva, pero no abre WhatsApp ni dispara Contact automáticamente.

El helper distingue demora, fallo de red, respuesta HTTP, respuesta inválida y ausencia real de número. Las promesas de HTML anterior siguen siendo compatibles; un resultado `null` antiguo se informa como causa desconocida. Se mantiene la vigencia previa de 90 segundos para datos iniciales y el refresco de T6 al volver de WhatsApp.

Los registros usan fases, códigos, estado HTTP y duración. No agregan teléfonos, mensajes, credenciales ni payloads a la telemetría. Pixel, identidad, atribución, eventID y deduplicación conservan su recorrido.

## Paridad y publicación

La implementación compartida se genera para constructor y clásico. Se retienen los assets anteriores para el HTML cacheado. T7–T9 derivan de este runtime: se actualizó el ancla textual de su generador, conservando la guarda que ignora intentos obsoletos. No cambia su selección de asesor ni el circuito de los cuatro gateways.

NexoBet usa otro resolver y otra cola CAPI; sus 24 archivos compartidos se verificaron sin diferencias. No requiere copiar este resolver de WhatsApp. Los generadores de clásico aceptan `LANDING_CLASSIC_ROOT` para trabajar en un checkout aislado sin escribir sobre otras sesiones.

Checkpoint incremental: `20261110T144114Z_pre-entry-reliability`, además del checkpoint completo previo del 09/11. Los originales y la rama de tipografía de otra sesión se preservan.

## Regresión local

Todas las pruebas usan transporte interceptado o fixtures; no asignan números reales ni envían eventos a Meta.

| Validación | Resultado |
| --- | --- |
| Helper, esperas, errores, legado, HTML, Pixel y telemetría | 31/31 tests, incluidos 18 escenarios Chromium |
| Assets finales: T1–T9 × clásico/constructor × Chromium/WebKit | 36/36 recorridos; un Contact por recorrido |
| Embudo, escritura temprana, privacidad y reanudación | 8/8 escenarios |
| FBC acotado por landing, cuatro runtimes y dos navegadores | 208 comprobaciones, 26 casos |
| Atribución, resolución y entrada a los cuatro proveedores | 50/50 escenarios Chromium |
| CTA y aviso de espera a 390 px, con texto contenido | 12/12 renderers; suite 31/31 repetida tras integrar tipografía e iconos |
| Generación y comparación del renderer y assets clásico/constructor | OK |
| Emisor de preparación clásico | Sin diferencias |
| Tipos del helper, encoding y diff-check | OK |

La integración conserva los cambios concurrentes de tipografía e iconos publicados hasta Builder `4824c0a` y clásico `c22bcbe`. Se verificó nuevamente la igualdad de los assets y el renderer compartido tras cada fusión. El harness de atribución se actualizó para servir los assets con hash y validar `/api/template7/prepare`, recorrido que ya usaba la producción anterior; conserva las comprobaciones de proveedor, promo, atribución y un único Contact.

## Compilación remota y entrega estática

Las previews Builder `dpl_CVrbfntdTiJiZbpAE2rgce3Z97Vm` (fuente `aef3993`) y clásico `dpl_8odwyHqX2e3FCa62DhWbWcrFhEoi` (fuente `69aa483`) completaron su build en Vercel. Se verificaron 14 recursos: los cinco JS nuevos, el CSS de esa integración y un JS anterior en cada preview. Todos respondieron HTTP 200, con SHA256 idéntico al commit correspondiente y `Cache-Control: public, max-age=31536000, immutable`. La lectura no ejecutó JavaScript ni abrió landings ni asignó números.

La actualización posterior de iconos conserva los cinco runtimes byte a byte; fue integrada desde main y validada de nuevo por los generadores y la suite móvil. La compilación productiva final usa las variables de producción, separadas de las previews. Los identificadores y el estado final del despliegue se conservan en la evidencia local del lote.

Comandos principales, desde `frontend`:

```powershell
$env:RUN_PHONE_BROWSER='1'
node --import tsx --test --test-concurrency=1 tests/landingPhoneRequest.test.ts tests/landingPhoneBrowser.test.ts tests/publicTelemetryBootstrap.test.ts tests/publicLandingHtml.test.ts tests/phoneAdministrationClient.test.ts
node node_modules/tsx/dist/cli.mjs scripts/all-template-delivery-browser-check.ts
```

Desde la raíz:

```powershell
node scripts/check-entry-funnel-browser.mjs
node scripts/check-scoped-fbc-browser.mjs
node scripts/build-template7-runtime-assets.mjs
node scripts/build-classic-template7.mjs
node scripts/build-classic-preparation.mjs
```

En un worktree aislado, definir `LANDING_CLASSIC_ROOT` con el checkout clásico correspondiente. Ejecutar el postinstall `frontend/scripts/sync-meta-param-builder.mjs` antes de los tests de assets si sólo se enlazaron dependencias existentes.

## Límites y reversión

Esto corrige la espera prematura y evita consultas simultáneas, pero no elimina la latencia del preflight o del servidor. Mientras la petición siga pendiente no se inicia otra selección. La evolución de fallos y tiempos debe evaluarse con tráfico posterior al despliegue, sin interpretar causa desconocida como falta de inventario.

La reversión web consiste en recuperar los commits/despliegues anteriores. El índice de la cola CAPI es independiente y no necesita retirarse al revertir la web: no altera datos ni elegibilidad. Su guía específica conserva el procedimiento de recuperación.
