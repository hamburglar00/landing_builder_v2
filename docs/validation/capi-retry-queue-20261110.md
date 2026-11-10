# Reparación de la cola CAPI — 2026-11-10

Estado: índice y migración aplicados en producción el 2026-11-10 a las 14:58:52 UTC; worker v54 publicado a las 15:01:28.722 UTC. Primera ejecución programada posterior completada con HTTP 200.

## Comprobación productiva

- Índice válido, listo y activo, con definición exacta; 8 KiB al verificar. EXPLAIN sin ANALYZE usa el nuevo índice, con coste estimado 2.08 frente al barrido anterior de 28281.60. Son costes del planificador, no tiempos.
- La creación concurrente autónoma terminó correctamente. El mecanismo de migraciones transaccional rechazó primero la creación con SQLSTATE 25001 sin cambios; luego se ejecutó únicamente CREATE INDEX CONCURRENTLY en autocommit y la migración validó/adoptó el índice existente.
- Los ocho archivos remotos de v54 coinciden byte a byte con el paquete revisado. Se conserva `verify_jwt: false` y la autenticación interna previa. `landing-phone` permanece en v26.
- Consulta única de logs entre 15:01:28.722 y 15:08:17 UTC: una invocación POST programada, HTTP 200 a las 15:06:12.570, duración 12136 ms; cero diagnósticos de selección de cola en esa ventana. No se invocó manualmente el worker ni se enviaron eventos de prueba a Meta.
- Los hallazgos de asesores coinciden exactamente con el baseline: 102 de seguridad en seis grupos y 431 de rendimiento en siete grupos. Esto verifica ausencia de cambios en esos hallazgos, no que el proyecto carezca de deuda previa.

Una ejecución exitosa confirma que el cron completó su recorrido; no certifica por sí sola la entrega individual de todos los eventos a Meta. Evidencia detallada y respaldo del worker anterior en `CURSOR/.local/entry-reliability-20261110`.

## Problema y alcance

El selector inicial de `retry-failed-conversions` contempla errores Contact, Lead y CompleteRegistration bajo `contact_capi_retryable`. El índice previo sólo cubría Contact; en producción el selector terminaba con SQLSTATE 57014 antes de procesar las colas.

Este lote agrega un índice parcial adicional sobre `created_at` para ese mismo OR. Conserva el índice Contact anterior. No cambia filtros, eventos, payloads, deduplicación, contadores, límites, respuestas HTTP ni reglas financieras.

Se agregan logs JSON de error de selección con vocabulario cerrado: `event=capi_retry_queue_selection_failed`, `version=1`, `phase` y `sqlstate`. Los estados SQL reconocidos se conservan; otros códigos quedan como `unknown`. No se registran message/details/hint, consultas, clientes ni payloads. La salida temprana de Purchase deja de imprimir el mensaje bruto del error.

## Archivos

- `supabase/migrations/20261110145852_optimize_contact_capi_retry_queue.sql`, generado inicialmente mediante Supabase CLI 2.121.0 y renombrado para coincidir con la versión registrada en producción.
- `supabase/operations/contact-capi-retry-index.concurrent.sql`: única sentencia de creación concurrente.
- `supabase/operations/contact-capi-retry-index.rollback.sql`: retirada explícita sólo del índice adicional.
- `supabase/functions/retry-failed-conversions/queue_diagnostics.ts` y sus tres llamadas en el worker.
- `scripts/test-capi-retry-queue.mjs`.

## Preparación para producción

La observación de sólo lectura encontró aproximadamente 120.000 filas, 203 MiB de heap y 626 MiB incluyendo índices/TOAST. El snapshot de bloqueos no mostró bloqueos ni otra creación de índice, pero debe comprobarse de nuevo al ejecutar.

Usar creación concurrente: permite escrituras mientras construye y puede esperar transacciones antiguas. No garantiza ausencia de carga adicional de CPU/IO. PostgreSQL exige ejecutarla fuera de una transacción y puede dejar un índice inválido si se interrumpe. [Documentación oficial](https://www.postgresql.org/docs/current/sql-createindex.html#SQL-CREATEINDEX-CONCURRENTLY).

Orden de aplicación, reservado al responsable de publicación:

1. Confirmar proyecto, definición y estado del índice por nombre, actividad de `pg_stat_progress_create_index` y transacciones/bloqueos de la tabla.
2. Ejecutar el archivo `.concurrent.sql` como **una única sentencia** en una conexión autónoma con autocommit y tiempo suficiente. No agruparlo con SET, BEGIN u otras sentencias. No ejecutarlo mediante un mecanismo que envuelva la llamada en una transacción.
3. Verificar `indisvalid`, `indisready`, `indislive` y la definición exacta.
4. Aplicar la migración: adopta el índice sin reconstruirlo y valida su forma. Si hay datos y falta el índice, falla antes de intentar una creación normal. En bases vacías permite bootstrap con SHARE NOWAIT y segunda comprobación, siguiendo el patrón existente en `20260922034806_optimize_conversion_edge_lookup.sql`.
5. Verificar EXPLAIN sin ANALYZE del selector y que use el nuevo índice. Mantener el índice de compatibilidad.
6. Publicar el worker con los logs acotados y observar una ejecución programada. No es necesario disparar reintentos manuales para diagnosticar ni validar el plan.

Consultas de control sin payloads:

```sql
select i.indisvalid, i.indisready, i.indislive,
       pg_get_indexdef(i.indexrelid) as definition
from pg_index i
where i.indexrelid =
  to_regclass('public.conversions_contact_capi_retryable_created_idx');

explain (format json)
select id
from public.conversions
where contact_capi_retryable = true
  and (contact_status_capi = 'error'
    or lead_status_capi = 'error'
    or registration_status_capi = 'error')
  and contact_capi_retry_count < 6
order by created_at asc
limit 100;
```

El plan con SELECT id verifica el acceso y no mide el tiempo de descarga de la proyección completa del worker.

## Recuperación y rollback

- Si se interrumpe el build y queda un índice inválido, la migración lo rechaza. Inspeccionar el objeto exacto, retirarlo mediante el archivo de rollback en autocommit y reintentar la creación concurrente cuando corresponda. No omitir este control usando IF NOT EXISTS.
- Si sólo se revierte el worker, conservar el índice adicional: no modifica elegibilidad ni datos.
- Retirar un índice válido restaura el barrido lento conocido. El rollback SQL queda preparado para una retirada deliberada, no como una acción automática al detectar cualquier error.
- No se modifica ni retira `idx_conversions_contact_capi_retry`; no hay restauración de datos porque este lote no actualiza filas.

## Validación realizada

Baseline antes de editar: `node scripts/check-purchase-ingest.mjs`, 49/49.

Después del cambio:

| Comando | Resultado |
| --- | --- |
| `node scripts/test-capi-retry-queue.mjs` con PGLITE_MODULE local | 13/13 |
| `node scripts/check-purchase-ingest.mjs` | 49/49 |
| `node scripts/check-purchase-source-url.mjs` | 21/21 |
| TypeScript estricto, noEmit, del helper de diagnósticos | OK |
| `git diff --check` | OK |

El fixture PostgreSQL en memoria usa 25.000 filas de fondo más 1.875 combinaciones de estados, null, flags y contadores. Comprueba igualdad de candidatos, orden, límite y huella de datos antes/después; bootstrap; adopción; replay idempotente; índice incorrecto; índice inválido simulado en el catálogo del fixture; rollback; y plan sin forzar el optimizador.

Coste estimado del plan del fixture: 2462.14 → 61.38, usando el índice adicional. Son unidades del planificador, no milisegundos ni una promesa de velocidad productiva.

Las pruebas de diagnóstico ejecutan el handler real y sus imports con IO sintético, fuerzan fallo en cada selección y verifican respuestas, ausencia de escrituras/envíos y redacción del error. Las regresiones existentes cubren identidad, dedup, leases, payloads y URLs con transporte simulado.

Las pruebas locales no hicieron peticiones a Meta ni producción. PGlite permite probar la sentencia concurrente autónoma y sus estados, pero no certifica el comportamiento entre sesiones, bloqueos de escritores reales ni aislamiento Edge. La verificación de producción debe registrar por separado plan, build completo y resultado del cron.

## Aplicación del índice en producción

El responsable de publicación confirmó:

- El intento de prebuild mediante `apply_migration` fue rechazado con SQLSTATE 25001, sin cambios, porque esa ruta usa una transacción.
- La sentencia autónoma `CREATE INDEX CONCURRENTLY` mediante `execute_sql` finalizó en unos 19 segundos.
- El índice adicional quedó válido y ocupa 8 KiB. EXPLAIN pasó de Seq Scan + Sort, coste 28281.60, a Index Scan, coste 2.08.
- La migración de adopción `optimize_contact_capi_retry_queue`, versión `20261110145852`, se aplicó correctamente a las 14:58:52 UTC.

Estos resultados confirman la creación y el plan; aún no acreditan una ejecución exitosa del cron ni la publicación del worker con los nuevos diagnósticos. No hubo reintentos manuales en este lote.

## Fuente del worker que se publicaría

Se comparó el backup remoto de la versión 53 con la base local `164ae845a2f21fa6dd127d73aea1a6fd64be5354`: los siete archivos coinciden normalizando únicamente CRLF/LF. Los seis módulos compartidos actuales son además idénticos byte a byte al backup. El único archivo previo cambiado es el entrypoint, con el import y las tres llamadas de diagnóstico; se agrega `queue_diagnostics.ts`. No falta ningún archivo remoto.

Grafo recursivo, relativo a `supabase/`:

```text
functions/retry-failed-conversions/index.ts
functions/retry-failed-conversions/queue_diagnostics.ts
functions/conversions/shared.ts
functions/conversions/landing_cta_event.ts
functions/conversions/pixel_attribution.ts
functions/conversions/workspace_capi.ts
functions/conversions/purchase_source_url.ts
functions/conversions/purchase_ingest.ts
```

La dependencia externa continúa siendo `https://esm.sh/@supabase/supabase-js@2`. La evidencia local `CURSOR/.local/entry-reliability-20261110/retry-worker-source-comparison.json` contiene hashes e imports, sin copiar payloads ni secretos.
