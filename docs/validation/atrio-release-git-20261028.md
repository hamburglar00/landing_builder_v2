# Lote completo para despliegue — 28/10/2026

Entrega autorizada para commit/push de todo el trabajo pendiente. API2 debe desplegarse por el programador con sus migraciones antes de publicar el lote funcional web. La UI de altura/compresión ya estaba publicada por separado.

| Repositorio | Rama | Commit |
| --- | --- | --- |
| API2 | `feature/atrio-integration` | `3470bd021c99f6dc705e8f870bc8b7f606a80ece` |
| Constructor (`landing-builder`) | `fix/template7-session-reentry` | El commit que contiene este documento. |
| Clásico (`landing-prueba-1`) | `fix/template7-session-reentry` | `84072f79f1b0e034b8e43a9ce4ee652eeea575bf` |
| Atrio (`internal-chat`) | `fix/atrio-inbox-validation` | `680499b92525f0bb63b651a8cf125259bd6010ee` |
| Rey de Ases (`landing-autologuin`) | `fix/template7-session-reentry` | `e7021eabaaad89ad74c196101d840ff176a472d7` |
| Ases del Norte (`ases-gateway`) | `fix/template7-session-reentry` | `f901d40ef54ccc5e4d11aa6205835487de394979` |
| Ganamos NET (`ganamos-gateway`) | `fix/template7-session-reentry` | `6763d2ad1596a68bddcf38100d5c4f330c44d47e` |
| Ganamos+ (`multi-skin-gateway`) | `fix/template7-session-reentry` | `d28967a2b3d9476f2832f3f4c2ee8680ec2bece7` |

## Migraciones y orden

En API2, detener/drenar todas las instancias y workers anteriores y aplicar, en este orden, los archivos de `database/migrations/`:

1. `2026_10_28_000001_atrio_recovery_window.sql`
2. `2026_10_28_000002_atrio_provision_attempt_history.sql`

Alternativas Adonis respectivas: `20261028000001_add_atrio_recovery_window.ts` y `20261028000002_add_atrio_provision_attempt_history.ts`. Aplicar un mecanismo por migración, no SQL y Adonis sobre el mismo cambio. Requieren la recuperación del 27/10 ya instalada; si está pendiente, instalarla primero.

Después desplegar API2 y comprobar el endpoint privado `entry-status`; luego publicar la web y los cuatro gateways. Plus necesita su Worker además de Vercel, preservando variables y secretos. No hay migraciones web nuevas en este lote. No se aplicaron migraciones ni la conciliación histórica de Kobe durante esta entrega.

Guía completa del programador: [API2: orden, migraciones y alcance](https://github.com/johndoe-cloud2/api2/blob/3470bd021c99f6dc705e8f870bc8b7f606a80ece/docs/validation/atrio-deploy-handoff-20261028.md).

La conciliación histórica de Kobe es separada y no debe ejecutarse automáticamente con el despliegue. La nueva validación de cargas distintas no necesita liberar la operación vieja.
