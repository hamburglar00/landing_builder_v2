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

La evidencia remota y la observación se completarán tras el rollout.
