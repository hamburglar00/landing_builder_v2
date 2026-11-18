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
