# Aislamiento de contexto por recorrido — 16/11/2026

Publicación de Builder autorizada expresamente por Leo el 16/11, después de aceptar conservar la captura actual de timestamps. Rama `fix/journey-tracking-20261116` en el worktree `landing-builder-meta-log-20261116`, basada en `11bd6ea2` (código productivo `7cb86ad0` más su documentación de validación). API2 permanece exclusivamente local en `feature/atrio-integration`; su código y migración no forman parte de esta publicación.

## Cambios

1. Un LEAD con promo completo nuevo sin Contact coincidente deja de heredar contexto de la última conversión del mismo teléfono/gerencia. Conserva el mensaje/código y la evidencia aportada por su propio evento. No copia FBC, FBP, píxel, datos de formulario, IP/UA ni evidencia de publicidad de A a B. Se preserva la vinculación exacta de la integración secundaria WhatsApp Cloud API y el fallback anterior para mensajes sin promo completo.
2. Una recompra con promo exacto y coherente selecciona esa fila como fuente completa de contexto tanto para WhatsApp como para Atrio. Evita mezclar el píxel de A con FBC/FBP, URL o navegador de B.

La resolución independiente de píxel conserva sus políticas ya aprobadas: landing/tag o un único píxel configurado pueden identificar un destino, pero no demuestran origen Meta Ads. Los filtros por origen y evento permanecen vigentes. Contact, primer mensaje y Purchase/recompra mantienen sus hitos internos y fechas; los eventos estándar Meta, Graph v26, SDK, IDs, deduplicación y aceptación estricta no cambian.

## Alcance compartido

Fuente canónica: receptor único `supabase/functions/conversions/index.ts`. Lo consumen motor clásico, motor constructor y los cuatro gateways a través de sus emisores actuales. La prueba existente de proveedores cubre Rey de Ases, Ases del Norte, Ganamos NET y Ganamos+ mediante el handler compartido; no constituye una prueba real del proveedor. No cambian SDK, Worker público, frontend, Atrio, esquemas Builder ni configuraciones de clientes. NexoBet queda expresamente a cargo de otra sesión; `node scripts/sync-nexobet-marketing.mjs` verificó sus 24 fuentes fijadas sin actualizarlas.

API2 agrega el guardado del recorrido anterior al HTTP y entrega persistente de notificaciones con payload/IDs/tiempo fijos. Su migración y guía están en `C:/Users/Leo/Documents/GitHub/api2/docs/releases/20261116-purchase-tracking-journeys-local.md`. La lógica de saldos, cargas, retiros y efectos financieros no se modifica.

## Verificación

- `node scripts/check-journey-context-isolation.mjs`: 4 escenarios con handlers reales y DB/HTTP simulados. B sin Contact con filtro de origen activado/desactivado; repetición del LEAD B y Purchase posterior sin contaminar A; recompra tardía A frente a B más reciente, tanto WhatsApp como Atrio.
- `node scripts/check-meta-journey.mjs`: 20 regresiones de CTA, eventos internos, identidad y filtros, incluidas T7/T8/T9 y WhatsApp tradicional.
- `node scripts/check-meta-receipts.mjs`: 66 escenarios de recibos y reintentos CAPI.
- `node scripts/check-meta-transport-log.mjs`: 29 escenarios de metadatos de transporte.
- `node scripts/check-purchase-source-url.mjs`: 24 escenarios de compra, recompra, duplicados, reintento y contexto de los cuatro proveedores.
- `deno test --allow-env --allow-read supabase/functions/conversions`: 172 pruebas aprobadas.
- `deno check supabase/functions/conversions/index.ts`: aprobado.

Las pruebas se ejecutaron con datos sintéticos y sin tráfico real a Meta o a los proveedores, sin escritura productiva ni reparación de históricos. El registro separado de publicación `journey-tracking-production-20261116.json` identificará commit, versión de función, despliegue READY, dominios y verificaciones. No se cambia la captura de hora de API2: Builder conserva el timestamp recibido durante sus envíos/reintentos.

La versión productiva anterior es `conversions` v183 y Vercel `dpl_BzGbHiA4eeD39dycbrjrLLu24eeN`, commit `7cb86ad0`. Backup local de la función completa: `.vercel/journey-tracking-backup/conversions-v183.json`. La entrega sólo sustituye el entrypoint revisado y conserva las otras diecinueve dependencias publicadas, incluida su representación original. No requiere migración ni redeploy de `retry-failed-conversions`.

Publicado y verificado el 16/11 a las 15:27 ART: commit `14f389dbcbb0924fa3cbe422c53a70e9858aca25` en main; `conversions` v184 ACTIVE con sus veinte archivos comprobados exactamente y autenticación interna conservada (petición sin firma: 401). Vercel `dpl_4mrZBH1BMiR9adMrnYRPUcFzWLKH` READY, ambos dominios al mismo commit y `/login` HTTP 200. Desde las 18:26:19.275 UTC se observaron un Lead y dos Purchase naturales con HTTP 200, Graph v26 y `events_received: 1`. No se enviaron eventos sintéticos. API2 sigue local. Detalle en [registro de producción](journey-tracking-production-20261116.json).

Checkpoint: `../.checkpoints/journey-tracking-20261116-144211` desde el directorio común CURSOR, con snapshots del estado previo de ambos árboles de Builder y API2.
