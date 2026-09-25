# Rollout de blindaje y zona horaria

Alcance autorizado: blindaje cross-tenant ya activo como `conversions` v161, intervalos de asignación interpretados en `America/Argentina/Buenos_Aires`, y truncado exclusivamente visual de `ctwa_clid`.

Estadísticas permanece diferida. La cadena incorpora las migraciones 275–278 ya registradas en el ledger y una reconciliación idempotente posterior a 279 que conserva ausentes los objetos de 278. No incorpora rutas, frontend ni RPC activas de Estadísticas.

## Baseline previo

- `origin/main`: `6b0f327093382f88d632948fe922dbca8ef8e645`.
- Supabase: ledger 278; objetos 278 ausentes; índice 277 activo; migración 279 ausente.
- `conversions`: v161 ACTIVE, paquete `983feb28ff2d4093b993aefea6e696377d0b3aafcd69bc52f9adc252941a2fc3`.
- `landing-phone`: v21 ACTIVE, paquete `91989231e45c7cd72f02560d0182d1616ff226e4dea56f3238d507158b42517d`.
- Vercel Production: `dpl_8rfPZoBhDusubWCRq3puHATWpTjM`, READY, Node 24.x, ambos dominios productivos.
- Sin locks en espera ni mantenimiento detectado.

## Rollback SQL preparado

- `get_cached_constructor_landing_phone(text)`: MD5 `19470aa85e8a6667e97fdfa216a10ecd`
- `get_phone_for_landing(text,boolean)`: MD5 `63e4ec1ce039e9f45939a80610f503e8`
- `record_landing_phone_availability_demand(text,uuid,text,text,integer,bigint,text)`: MD5 `74d2bf4fbb2c88b39d25c44524aef651`

El archivo `rollback.sql` restaura únicamente esas tres definiciones, conserva ACL/owners y no modifica datos ni ledger. Ante falla: restaurar primero Vercel, luego `landing-phone`, y finalmente ejecutar este SQL compensatorio.

## Gates locales

- event_attribution: 12/12.
- handlers de teléfonos: 5/5.
- Deno check: aprobado.
- TypeScript y build Node 24: aprobados.
- ESLint focalizado: aprobado.
- Reconstrucción: 280/280; objetos 278 ausentes; rollback aprobado; cero recursos residuales.

## Resultado productivo

Rollout completado sin rollback el 25 de septiembre de 2026. El commit productivo y `origin/main` son `f8ed2986ff584ee107f4f5ce18ce708b1548273d`.

1. Se publicó primero la rama `release/cross-tenant-phone-timezone-20260925` y Vercel generó un Preview protegido del commit exacto.
2. El dry-run de Supabase mostró únicamente 279 y 280. Ambas se aplicaron mediante `supabase db push`; el ledger terminó en 280.
3. Las tres funciones conservan owner y ACL previos y ahora interpretan la hora con `America/Argentina/Buenos_Aires`. El índice 277 continúa válido. Los objetos diferidos de Estadísticas 278 continúan ausentes.
4. `landing-phone` avanzó de v21 a v22. La descarga posterior coincide byte por byte con el fuente local, SHA-256 `28ca385f7c60cdcdeb812f49c16baf27a908ef6c78a372c69fe6d3b71c9f0541`.
5. `conversions` permaneció en v161, paquete `983feb28ff2d4093b993aefea6e696377d0b3aafcd69bc52f9adc252941a2fc3`; no se volvió a desplegar.
6. El deployment Production `dpl_989PRh3Z9dSo6GnkzoZUwEmPamFn` quedó READY para el commit exacto, y `mkt.panelbotadmin.com` y `constructor.panelbotadmin.com` apuntan a él.

Los smokes públicos aprobaron login, Conversiones, Inbox, rutas de landings, `landing-phone` y la disponibilidad de `conversions`. El identificador sintético inexistente devolvió 404 y el GET no mutante a `conversions` devolvió 405. La ruta excluida `/api/conversions/statistics` devuelve 404. No se crearon filas, usuarios ni eventos de prueba, y no se llamó a Meta.

La observación se extendió de `2026-09-25T00:13:44-03:00` a `2026-09-25T00:35:51-03:00`: 21 sondeos estables, cero errores de Vercel, cero locks y actividad natural continua en conversiones y demandas. No se activó ningún umbral de rollback. Los dos Previews y el bypass de protección generado por la CLI se eliminaron al cerrar; el proyecto quedó con cero bypasses.

## Estado final y reversión

- Supabase: ledger 280; 279 y 280 registradas; Estadísticas 278 sigue compensada.
- Edge: `landing-phone` v22 y `conversions` v161, ambas ACTIVE.
- Vercel: Production en `dpl_989PRh3Z9dSo6GnkzoZUwEmPamFn`; fallback conservado en `dpl_8rfPZoBhDusubWCRq3puHATWpTjM`.
- Rollback no ejecutado. El artefacto SQL previo permanece disponible en `rollback.sql`; el orden seguro sigue siendo Vercel, `landing-phone` y luego SQL compensatorio.
- Cero cambios de métricas, datos comerciales o lógica de negocio ajena al blindaje y a la interpretación horaria autorizada.
