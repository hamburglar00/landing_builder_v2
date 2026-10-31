# Caché y alcance de FBC en todas las plantillas — 31/10/2026

Estado: publicado en Builder `0bb42f5`, deployment `dpl_F9zRGrght255UTLB6LaLjt3zGaeo`, promovido y verificado. [Publicación del lote](purchase-runtime-release-20261031.md).

## Corrección

Builder T1–6 enviaba `/public-assets/landing-runtime-v6.js` con `max-age=31536000, immutable`. Ese nombre no había cambiado en el despliegue de scope v2, por lo que un visitante anterior podía seguir ejecutando el colector previo. El HTML nuevo ahora referencia `/public-assets/template-entry/landing-e23f9f604b65ec406f69bca9.js`.

El prebuild existente genera automáticamente el nombre a partir de SHA-256 del programa. La configuración continúa en el HTML de cada landing, fuera del archivo compartido. Los cuatro programas T7/T8 y las rutas v3–v6 anteriores se conservan. Se reutiliza la política immutable ya configurada para `template-entry`; no se agrega una ruta dinámica ni dependencias.

La clásica T1–6 usa `components/Landing.tsx`, `WhatsAppButton` y `LandingPageViewTracker`, servidos en chunks cliente de Next. Su compilador instalado define `[contenthash]` para producción (`node_modules/next/dist/build/webpack-config.js`, líneas 1023 y 1029), sin override de webpack en el proyecto. `build-classic-template7.mjs` verificó que su bundle compartido no cambia con este arreglo; no requiere desplegar la clásica por este cambio.

## Verificación

- 29/29 pruebas: `publicLandingHtml.test.ts`, `template7Performance.test.ts` y `template7RuntimeAsset.test.ts`. Comprueban que los seis HTML referencian el hash actual, que corresponde al archivo y que no contiene configuración de una landing. Regresiones de T7/T8 y cuatro proveedores incluidas.
- `tsc --noEmit` de Builder: correcto.
- `build-template7-runtime-assets.mjs` y `build-classic-template7.mjs`: correctos; los cuatro assets T7/T8 no cambiaron.
- `scripts/check-public-runtime-cache.mjs`: Chromium/T1 directo y WebKit/T6 con `fbclid` actual. Cada navegador cargó dos documentos con v6 y el servidor recibió una sola descarga: se comprobó la caché HTTP real. Al entrar al HTML actual se pidió el asset nuevo y no se ejecutó v6. Contact/journey usaron scope v2; directo no heredó el FBC global ajeno, y el clic actual se conservó. Dependencias y eventos aislados en servidor loopback, CSP, Pixel/SDK simulados y navegación exterior detenida. [Resultado JSON](public-runtime-cache-20261031.json).

Esta verificación cubre la entrega nueva del programa. Un documento abierto o restaurado desde bfcache no se transforma retroactivamente: requiere obtener el HTML actualizado. No se alteran conversiones históricas.

## Alcance de la auditoría de atribución

Los caminos de Contact/journey de Builder 1–8 y clásica 1–8 consumen el colector común de FBC; no hay excepción para el slug Diana. T1–6 Builder utiliza el programa genérico; T7/T8 utilizan los cuatro assets compartidos; clásica T1–6 utiliza los componentes React. Las únicas lecturas globales de FBC en el colector nuevo sirven para marcar cuarentena, no como fallback aceptado. El arreglo de caché permite entregar esa misma protección a visitantes anteriores de Builder T1–6.

Límites que no deben confundirse con el filtrado de nuestro payload:

- El Pixel oficial del navegador todavía administra sus propias cookies y envíos `fbq`; las pruebas aisladas no certifican el contenido de la petición interna de Meta. El filtro comprobado es el FBC que nuestro runtime envía a Contact/journey/CAPI.
- `_fbp` continúa como identificador del navegador. Otros campos de identidad de marketing conservan el namespace histórico `landing-builder:<pixel>:<slug>` y algunos fallbacks de `window.__META`; no se migraron a UUID/moneda. Eso no autoriza ni cambia la cuenta del casino.
- UTM y campos `facebook`, `portofolio`, `cp`, `campana`, `conjunto`, `anuncio` provienen de la URL actual. No se encontró una herencia por storage de esos campos en los caminos revisados; reutilizar una URL conserva sus parámetros y no prueba por sí mismo el origen de un anuncio.
- Una atribución FBC v2 válida de la misma landing/moneda/píxel puede persistir hasta 90 días con su timestamp original. El acceso directo posterior y el origen conservado son datos distintos. La primera journey puede preceder a la respuesta nativa de EBP; Contact recoge la señal disponible al pulsar.
- La cobertura previa de 208 escenarios y los cuatro casos de runtime completo corresponde a T7/T8. T1–6 tiene revisión de caminos, verificaciones de los seis HTML y los dos casos de caché completos de este lote, no una certificación de todas las combinaciones dentro de Instagram/Facebook en iPhone.
