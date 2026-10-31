# Recolección del clic actual mediante EBP

Meta Parameter Builder `1.3.1` exporta `collectParams` desde `shared/ext/ebpExtension.js`. Esa función consulta el `clickID` del navegador interno sin leer ni escribir cookies. En cambio, `collectAndSetParams` omite la consulta cuando ya existe `_fbc`; por eso una cookie global ajena no permite demostrar el clic de la landing actual.

El helper propio utiliza el export oficial sin cambiar el paquete instalado ni el SDK principal. `frontend/lib/meta/collectClickId.mjs` expone `window.__ATRIO_META_COLLECT_CLICK_ID__(): Promise<string|null>`. Devuelve exclusivamente el identificador crudo válido, memoriza una única consulta por página y termina en un máximo de 800 ms. Cargar el asset no inicia la consulta. El runtime debe invocarlo en paralelo, sin esperar desde el CTA.

Se conserva el reconocimiento oficial de iOS/Android y las versiones mínimas de Facebook/Instagram. Esbuild inyecta una referencia léxica privada de `window` para el código EBP; no se modifican `window.webkit`, `XMLHttpRequest`, el SDK global ni prototipos del navegador. El adaptador sólo admite `GET properties://browser/clickID`. Convierte fallos nativos en resultado nulo y cancela sus recursos al vencer el plazo. Evita las promesas derivadas sin manejar que la versión 1.3.1 puede dejar al rechazar el bridge. No contiene lectura/escritura de cookies, llamadas de conversión ni HTTP de negocio.

Asset idéntico en Builder y clásico:

- URL: `/vendor/atrio-meta-click/v1/collect-click-id.313adead513e2b9aab4f3efb.js`.
- Tamaño: **4.067 bytes** sin compresión HTTP.
- SHA256: `313adead513e2b9aab4f3efbfdb56ca77ef2f78080fc219159252352820b2b65`.
- Módulo oficial de entrada SHA256: `1922fe46f2611b6c43151415c95f0921f5311e47b67a663286a88fd2737dac6c`.
- El manifest `lib/meta/ebpAssetManifest.ts` exporta `META_EBP_COLLECTOR_URL` en ambos repositorios. `LICENSE` y `provenance.json` acompañan al asset. La licencia de Meta permite su distribución para uso con sus servicios conservando el aviso de copyright, incluido en el bundle y el archivo de licencia.

Regeneración y sincronización: `node scripts/build-meta-ebp-collector.mjs --write`. Verificación reproducible: `node scripts/build-meta-ebp-collector.mjs --check`. Usa esbuild ya instalado y el paquete fijado a 1.3.1; no agrega dependencias. Conserva assets publicados anteriores para HTML cacheado. Los dos módulos propios y el generador quedan versionados; el export oficial procede del paquete fijado.

`node scripts/check-meta-ebp-collector.mjs` pasó **38 casos** en Chromium/WebKit: éxito iOS, Instagram Android y Facebook Android; rechazo/throw; tiempo agotado; respuesta tardía; identificador inválido/no textual; errores, cuerpo vacío y fallo al abrir/enviar XHR; versiones antiguas y navegador no compatible. Todos conservan cookies `_fbc`/`_fbp` previas, sin siquiera leerlas, mantienen los globals originales, consultan una vez como máximo y terminan dentro de 800 ms. No hubo errores de página, rechazos no manejados ni requests HTTP/Meta adicionales. [Resultados completos](meta-ebp-collector-20261031.json).

Verificación de sintaxis, lint de los módulos y generación reproducible correctas. La fixture simula los bridges nativos y usa tiempo virtual; no certifica todavía Instagram/Facebook en un iPhone físico ni un clic publicitario real. La prioridad y persistencia de atribución pertenecen al runtime consumidor y se verifican en su lote separado. Sin publicación ni cambios de negocio por estas pruebas.
