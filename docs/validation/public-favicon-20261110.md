# Favicon público de LandingBuilder — 10/11/2026

Alcance: las nueve plantillas en Builder (`landing_builder_v2`) y clásico (`public_landing_bl`), más las páginas legales de sus landings. Ambos usan el favicon SVG seleccionado por el usuario. NexoBet conserva su marca y módulo de marketing; los cuatro gateways, su Worker, Atrio y API2 no cambian.

Fuente canónica: `frontend/public/favicon.svg`, optimizado por `node scripts/build-public-landing-favicon.mjs --write`. El generador elimina metadatos visualmente innecesarios y redundancias, conservando los paths y máscara. Resultado: **956 bytes**, frente a 1140 del original; compresión local de 469 bytes con gzip y 419 con Brotli. SVG rasterizado idéntico al original a 16, 32, 64 y 128 px.

El nombre `landingbuilder-favicon-62c5fff643c37fc59332f6cd.svg` contiene el hash del contenido. Se sirve desde `/public-assets/template-entry/`, con la política existente `public, max-age=31536000, immutable` y `nosniff`. Un único `<link rel="icon" type="image/svg+xml" sizes="any">` por documento. Los adaptadores legales añaden el enlace sin modificar el renderer legal compartido con NexoBet. El sincronizador de clásico copia el recurso y genera el bundle desde Builder.

## Verificación

- Generador del favicon y sincronizador clásico: coincidencia exacta de archivos y manifests.
- Comprobación visual del SVG mediante igualdad de píxeles, sin cambiar su geometría.
- 36 casos de navegador: Chromium y WebKit, nueve plantillas por motor. SVG decodificable, enlace único en `<head>` y MIME correcto. Al quitar el enlace, el HTML completo coincide exactamente con la versión previa: Builder `d5e138f` y clásico `3675e1d`. Red bloqueada salvo fixtures sintéticos, sin eventos ni cuentas reales.
- Builder: 26 pruebas de HTML público, Template 8/9 y páginas legales, incluidas las cuatro plataformas, aprobadas; TypeScript sin emisión y ESLint aprobados.
- Clásico: 11 pruebas de entrega pública y renderers rápidos de Template 7, incluidas las cuatro plataformas, aprobadas; TypeScript sin emisión aprobado.
- NexoBet: 24 archivos fijados sin diferencias; regresión del flujo de Marketing con mocks. Sin cambios ni publicación de ese producto.

## Publicación

Push a `main` y despliegue separado de Builder y clásico. Comprobar READY, los alias `constructor.panelbotadmin.com`, `mkt.panelbotadmin.com` y `landing.panelbotadmin.com`, y que el SVG servido y los enlaces de páginas públicas coincidan con el recurso validado. Registrar por producto SHA y despliegue en `.vercel/public-favicon-20261110/release-observed.json`; lectura pública en `production-smoke.json`. No requiere migraciones ni funciones.
