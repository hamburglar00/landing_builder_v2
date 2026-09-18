# Fase 1B.4: privilegios internos

Base: `main`, `abfcbd914b3d1bed785467645766697a22e8651e`. Lote acreditado validado exclusivamente en local; auditoría final aprobada. Los objetos excluidos o ambiguos siguen pendientes y no se declara resuelto TRUNCATE en las 42 tablas. Inventario por objeto y referencias estáticas actuales: `scope.json`. Se referencia la evidencia de Fase 1A, sin copiar sus catálogos completos.

## Alcance acreditado

- La migración 272 fue creada con la CLI después de consultar ambos `--help`. Las 271 anteriores permanecen intactas.
- TRUNCATE: 13 tablas no ambiguas. Las otras 29 del conjunto de 42 se superponen con las exclusiones expresas de conversiones, eventos, teléfonos o revalidación; quedan pendientes de aclarar si existe una excepción exclusiva para este privilegio. No se modifican sus permisos mientras esa excepción no esté acreditada.
- EXECUTE: ocho funciones de trigger y `cron_process_due_promotions()` dejan de ser invocables por PUBLIC, anon y authenticated. Se preservan los permisos de instalación, postgres, service_role y la ejecución legítima de los triggers.
- `consume_ai_assistant_quota`, `get_notification_bot_username` y el RPC antiguo `get_home_overview_stats(uuid, uuid)` conservan authenticated y backend; se retiran PUBLIC y anon. El RPC antiguo ahora rechaza `auth.uid()` nulo antes de consultar datos. Su cálculo, parámetros, owner, SECURITY DEFINER y search_path permanecen intactos.
- Data API: `cron_config` pierde grants directos de cliente que Fase 1A acredita como innecesarios. No tiene policies de cliente y sus consumidores usan backend o cron. Sus valores no se migran ni se leen de producción.

No se cambia frontend, rutas servidor ni Edge Functions. No se amplían grants. Se conservan todos los demás cuerpos, ACL, RLS, triggers, constraints, defaults, schedules y jobs. El resultado autorizado del RPC de estadísticas se compara con el anterior mediante datos sintéticos, sin modificar cálculos ni escribir datos de conversiones.

## Pendientes y exclusiones

Las funciones de conversiones, eventos, teléfonos, CAPI y revalidación quedan excluidas. Los RPC legacy/públicos, helpers sin censo suficiente de consumidores, funciones de plataforma y `cron_sync_telegram_connections()` sin job activo acreditado mantienen sus permisos. Los grants de CRUD que podrían atender policies o consumidores indirectos también se conservan; la ausencia de una llamada estática no demuestra desuso. `scope.json` clasifica los 160 objetos de Fase 1A y registra las decisiones individuales.

La vista `funnel_contacts`, privilegios de `net` y default privileges de futuros objetos no forman parte de este lote. Las landings públicas y `landing-phone` conservan código, contratos y privilegios de ejecución. La matriz y concurrencia acreditadas en Fase 1B.3 se reutilizan porque esas dependencias no cambian.

## Validación

`run-internal-privileges.mjs` ejecuta una única reconstrucción 272/272 en Docker aislado, con jobs deshabilitados en el entorno de prueba. Compara el catálogo inicial con Fase 1B.3 y verifica que el catálogo final difiera exclusivamente en los REVOKE enumerados y la guarda de identidad nula.

La matriz ACL conserva el antes/después para PUBLIC, anon, authenticated, postgres y service_role. TRUNCATE se prueba mediante SQL: PostgREST no ofrece un método HTTP TRUNCATE. Las denegaciones deben producir 42501; el mantenimiento como postgres usa filas sintéticas y rollback. PUBLIC es una concesión colectiva, no un rol de sesión; su ausencia se verifica en las ACL y en las llamadas de sus roles consumidores.

Los tests comparan DML real de los ocho triggers, cuota autenticada, nombre público del bot desde el panel, estadísticas propias/admin/backend y contratos públicos. El cron se ejecuta con URL loopback deshabilitada y credencial sintética dentro de una transacción revertida: la cola nunca se hace visible al worker HTTP. Los RPC y grants REST se prueban contra PostgREST local real, sin guardar tokens.

Resultados: `validation.json`. Hasta dos correcciones clasificadas por fallo, conservando intentos fallidos y reintentando sólo casos pendientes. No se ejecutan TypeScript/build porque no cambia código frontend ni servidor; tampoco suites históricas ajenas. La auditoría y el inventario final se registran en `audit.json` y `review.json`: 11 archivos (uno modificado y diez nuevos), sin hallazgos. No quedan recursos Docker propios; los recursos ajenos permanecen intactos. `.env` sigue presente, ignorado y fuera de Git, sin leer su contenido.

Resultado ejecutado: **272/272 en una reconstrucción y 82 comprobaciones aprobadas**, incluidas ocho aserciones pgTAP dentro de una comprobación. Se conservan ACL de backend/postgres, cuerpos de las otras funciones, RLS y jobs; cero grants agregados. La matriz REST confirma las denegaciones y los resultados propios/admin/backend. Los contratos públicos comparados conservan sus resultados y los triggers mantienen sus restricciones de negocio.

Hubo una corrección de fixture: `phase1b4-tag` violaba el CHECK alfanumérico de `landing_tag` (23514); se usó `phase1b4tag`, manteniendo la prueba de inmutabilidad. El reintento continuó en la misma base antes de aplicar la 272. No se modificó la migración para superar esa prueba. Los detalles se conservan en `validation.json` (campo `corrections`).

## Rollout y rollback

No se despliega aquí. Un rollout futuro requiere confirmar que las ACL, firmas y consumidores sigan coincidiendo, aplicar la 272 y repetir denegaciones y consumos autorizados en el entorno de despliegue. Los objetos pendientes requieren una decisión propia; este lote no declara eliminados sus riesgos.

Antes de desplegar, el rollback debe ensayarse localmente usando las ACL anteriores registradas. No editar migraciones históricas ni restablecer acceso público inseguro como solución automática; ante una regresión, identificar el consumidor y preparar una corrección específica, sin grants generales. No hay rotación, copia ni transformación de secretos.

## Documentación consultada

Se revisaron el [changelog de Supabase](https://supabase.com/changelog), el cambio de [exposición automática de Data API](https://github.com/orgs/supabase/discussions/45329), la guía de [grants y seguridad de Data API](https://supabase.com/docs/guides/api/securing-your-api) y [TRUNCATE en PostgreSQL 17](https://www.postgresql.org/docs/17/sql-truncate.html). RLS no reemplaza la revocación de TRUNCATE ni el control de EXECUTE. Los cambios de defaults anunciados para otros proyectos no se aplican retrospectivamente ni se usan para ampliar este lote.
