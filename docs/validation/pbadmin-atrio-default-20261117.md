# Validación: Atrio por defecto en altas de PBAdmin

Fecha: 17/11/2026

Rama local: `fix/pbadmin-atrio-default-20261117`

Checkpoint previo: `C:/Users/Leo/Desktop/V2/CURSOR/.checkpoints/pbadmin-atrio-default-20261117-184931`

## Alcance

- Las cuentas nuevas provisionadas desde PBAdmin reciben `show_atrio: true`; ese permiso habilita Atrio y las plantillas 7, 8 y 9.
- Los permisos que ya existían se conservan durante reintentos, recuperación de un alta parcial y vínculo de una cuenta nativa.
- No se modifican altas manuales desde Superadmin, otros permisos de módulos, columnas visibles, plan, migraciones ni productos externos.

## Verificaciones

- `node scripts/test-pbadmin-auth.mjs`: pasó; 21 escenarios reales con Auth/PostgreSQL/PostgREST, incluidos nuevo workspace, permisos persistidos, alta parcial y cuenta nativa vinculada.
- TypeScript (`tsc --noEmit --pretty false --incremental false` desde `frontend`): pasó.
- ESLint sobre `frontend/lib/pbadmin/provider.server.ts`: pasó.
- `git diff --check`: pasó.

## Publicación

No requiere migración ni backfill de datos; el cambio sólo modifica el permiso inicial de futuras cuentas provisionadas desde PBAdmin.

- Commit funcional: `57b77a088e2403b311ac95712d36c285c4e12e5f`, hijo directo de `4b67339ec28a16967014c67d840e11afe47543b4`.
- Push fast-forward a `origin/main`, sin force push.
- Vercel producción: deployment `dpl_9zxiv5wqrt8NuJeGdjFFp2RbnXGf`, estado `READY`, construido desde el commit funcional.
- `constructor.panelbotadmin.com/login` y `mkt.panelbotadmin.com/login` respondieron HTTP 200 y están asignados al deployment.
- El build completo local no pudo terminar la recolección de rutas porque este checkout no tiene `NEXT_PUBLIC_SUPABASE_URL` ni `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Vercel sí completó y publicó el build con el entorno de producción.
