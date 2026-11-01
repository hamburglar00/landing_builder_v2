# Recepción durable de Purchase e imágenes de Atrio — validación local

Validación local del lote iniciado el 31/10/2026. El usuario autorizó posteriormente completar commit, push, migración y despliegue. El estado productivo se registra por separado después de verificar las publicaciones. API2 permanece en `43916e19`; este lote no lo modifica ni cambia el mensaje de error del comprobante.

Publicado y verificado el 01/11; ver [versiones activas, índice adicional y recuperación de un recibo aceptado](purchase-profile-production-20261101.md).

## Problema y comportamiento

El receptor de Builder esperaba atribución, enriquecimiento y Meta antes de contestar a API2, cuyo plazo es de diez segundos. Un timeout no demostraba que la conversión no se hubiera procesado. El nuevo camino guarda el JSON completo y devuelve 202 antes de ese trabajo. La misma entrega conserva el primer recibo y payload; un error de base de datos produce un 5xx reintentable. Los fetch de admisión comparten un presupuesto de ocho segundos, independiente del cliente del worker. La lectura del cuerpo y la conectividad del emisor no constituyen una garantía de latencia de extremo a extremo.

`purchase_ingest_jobs` y sus RPC son privados: RLS habilitada, sin acceso público o de usuarios autenticados, operación exclusiva de servicio. La clave se acota al receptor. Payload, contexto y fecha de aceptación son inmutables. No se guardan cabeceras de autenticación en el contexto. El worker recibe el receptor desde el registro persistido, no desde la URL ni desde un flag del payload.

Los workers reclaman hasta cuatro recibos en paralelo, con token y lease de diez minutos, superior al máximo de 400 segundos de una instancia de Edge en los [límites vigentes de Supabase](https://supabase.com/docs/guides/functions/limits). Completan con comparación del token; los fallos transitorios esperan progresivamente y los trabajos interrumpidos se recuperan al vencer el lease. Hay ocho intentos como máximo. Los terminales `failed` se conservan para investigación; un duplicado no los reactiva. Consultar estos estados y su `last_http_status`/`response_body` al investigar una entrega, sin ejecutar replays históricos.

Después de un crash se conserva el mismo Meta `event_id`; si ya existe la conversión, se recupera por receptor y ese ID. La entrega CAPI pendiente usa el reintento existente, que excluye recibos activos y relee el estado antes de enviar para descartar snapshots desactualizados. Una compra que espera a un Lead solamente completa su recibo después de persistir y confirmar el inbox diferido. Los reintentos de ese inbox se autentican con la credencial interna existente. El nuevo vínculo `conversion_inbox.purchase_ingest_job_id` permite recuperar el payload completo del recibo en un replay legítimo, incluso si un inbox legacy tiene JSON truncado, sin reescribir su payload histórico. La lectura exige el mismo receptor y no cae al JSON truncado si falla.

No cambian las operaciones monetarias ni las políticas de fecha, monto mínimo, origen, first/repeat, píxel, moneda, FBC/FBP, URL del recorrido o deduplicación financiera. Contact y Lead conservan sus rutas. El cambio central sirve a Rey, Ases, NET y Multi Skin sin modificar los gateways ni el Worker de Cloudflare.

## Validación

- 114 pruebas Deno del paquete de conversiones: fechas, atribución, origen, URL, pixel, configuración CAPI, importes y diagnóstico.
- 49 comprobaciones del módulo durable y handler de retry: autenticación, límites, payload completo, errores, fencing, 202 diferido, exclusión CAPI, revalidación de snapshots, identidad legacy y replays internos desde el recibo íntegro. Una lectura fallida del recibo o de su perfil mantiene el inbox recuperable.
- 9 comprobaciones del entrypoint real: ACK posterior al commit, payload >4000 caracteres, primer payload inmutable, ACK perdido, presupuesto de admisión, rechazos, controles públicos sin autoridad, claims ocupadas y recuperación de conversión. Incluye el cliente HTTP real de API2 en local: acepta 202 con un intento y sin reintento de transporte.
- 8 comprobaciones del handoff diferido real: INSERT/UPDATE fallidos dan 503, retry conserva inbox, payload íntegro, conflicto entre receptores, flags públicos y vínculo a recibo desde inbox legacy.
- 20 escenarios SQL en Postgres WASM/PGlite, más el contenedor TAP: constraints, inmutabilidad, permisos/RLS, leases, tokens, ocho intentos, backoff, exclusión por aliases, vínculo de inbox sin reescritura del payload y cron interceptado.
- Regresiones existentes: 21 escenarios de URL de compra para los cuatro proveedores, diez de fecha original y siete de diagnóstico con API2 real en local. El verificador antiguo esperaba tres reintentos también ante 422; se actualizó para comprobar un intento ante rechazo permanente y tres ante 503, según el contrato ya vigente de API2. No se modificó API2.
- `deno check` de los dos entrypoints y sincronización SDK `--check` de los cuatro gateways.
- Atrio: 12 escenarios / 24 superficies en Chromium y WebKit, móvil/escritorio, tres temas, cliente e inbox; TypeScript, ESLint y 15 regresiones de estados, enlaces y origen. La imagen completa conserva apertura, captions, confirmación real, tildes, errores, documentos y stickers. Capturas locales: `internal-chat/.vercel/chat-image-presentation-20261031/`. Ejecutar `node tests/chat-image-message.browser.mjs` desde Atrio con Playwright y sus navegadores instalados; admite `PLAYWRIGHT_MODULE_PATH` para una instalación alternativa. En esta máquina la matriz usó el Playwright global con sus binarios, sin añadir dependencias al proyecto.
- Perfil directo de Atrio: 24 escenarios Chromium/WebKit × móvil/escritorio × tres temas × widget/directo, más diez comprobaciones focales de credenciales. Conserva el bridge del widget y sólo revela la cuenta de la sesión firmada con cookie privada del mismo bot. Las conversaciones sin cuenta vinculada no fabrican credenciales. Evidencia local en `internal-chat/.vercel/client-profile-parity-20261031/`.

Todas las pruebas usan datos sintéticos y HTTP interceptado. No se enviaron conversiones a Meta, no se movió dinero ni se escribió negocio productivo. PGlite ejecuta SQL real pero no certifica contención entre sesiones independientes; cron/pg_net se interceptan y no prueban la entrega del scheduler productivo. Chromium/WebKit no certifican Instagram/Facebook nativos en iPhone.

Comandos reproducibles desde Builder:

```powershell
deno check --no-lock supabase/functions/conversions/index.ts supabase/functions/retry-failed-conversions/index.ts
deno test --no-lock supabase/functions/conversions/*_test.ts
node scripts/check-purchase-ingest.mjs
node scripts/check-purchase-acceptance.mjs --api2-root=C:/Users/Leo/Documents/GitHub/api2
node scripts/check-purchase-deferred-ingest.mjs
node scripts/check-purchase-source-url.mjs
node scripts/check-purchase-original-event-time.mjs
node scripts/check-tracking-diagnostics.mjs --api2-root=C:/Users/Leo/Documents/GitHub/api2
$env:PURCHASE_INGEST_PGLITE='<ruta local a @electric-sql/pglite/dist/index.js>'
node --test supabase/tests/purchase_ingest_queue.test.mjs
node scripts/sync-gateway-app-sdk.mjs --check
```

## Publicación pendiente

1. Aplicar `20261101000753_durable_purchase_ingest_queue.sql` antes de activar la nueva admisión. El archivo se alinea con la versión registrada por MCP al aplicar exactamente el SQL validado, originalmente creado por CLI como `20261031233646`; no cambia su contenido. Confirmar que `sync_phones_url` y `sync_phones_cron_secret` existen y que el cron queda programado; no imprimir su secreto. La migración no copia inbox históricos.
2. Publicar `retry-failed-conversions` con `conversions/purchase_ingest.ts` y dependencias, para excluir recibos activos y autenticar replays.
3. Publicar `conversions` con el mismo módulo. La ruta pública sigue usando `verify_jwt=false`; la ruta del worker exige POST y Bearer del cron antes de reclamar trabajo.
4. Verificar funciones activas, cron y permisos; observar la siguiente entrega legítima para confirmar 202, estado final del recibo, fecha/ID y envío CAPI. No fabricar una operación monetaria ni reenviar conversiones históricas para ese smoke.
5. Publicar Atrio por su despliegue habitual para activar la nueva presentación de imágenes. El SDK de los cuatro gateways coincide; no requiere republicar esos gateways.

Para revertir la admisión, conservar el worker y cron mientras existan recibos `queued` o `processing`; retirarlos con trabajo pendiente dejaría entregas aceptadas sin procesar. No borrar recibos, cambiar IDs ni reiniciar conversiones para resolver una reversión. Un fallo de publicación antes de activar `conversions` deja la admisión previa; no declararlo un arreglo del timeout.
