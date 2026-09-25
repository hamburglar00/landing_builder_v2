# Estadísticas: recorrido productivo y candidato diferido

Paquete sanitizado preparado el 2026-09-25 mediante lectura. Los archivos SQL son documentación para revisión, **no migraciones para ejecutar**. No se extrajeron filas de negocio. Nombres de columnas como `phone`, `email`, `nombre` o `token` son identificadores del esquema, no valores personales ni credenciales.

## Estado y recuperación

- Rama `main`, HEAD `f92fa53f8cb77c077f53582298a5a33059480de7`, upstream local `origin/main` en `f8ed2986ff584ee107f4f5ce18ce708b1548273d`. Un commit documental por delante; staging vacío. No se hizo fetch, checkout, reset ni commit.
- Producción conocida: `f8ed298`; Vercel estable, ledger 280, índice 277 activo, objetos 278 compensados, 279/280 productivas, `conversions` v161 y `landing-phone` v22. Fuente conservada: `docs/release/cross-tenant-phone-timezone-rollout/validation.json`, sección `rollout`. No se presenta esto como una nueva comprobación de Vercel.
- Ambas ramas locales `main` y `release/cross-tenant-phone-timezone-20260925` apuntaban a `f92fa53`. Sobrevivió `archive/deferred-statistics-a493e3f`, con código y evidencia del candidato; sus archivos ausentes del árbol actual se leyeron con `git show`, sin cambiar de rama.
- Sobrevivieron `schema-and-indexes.sql` (42.421 bytes, modificado 16:51:33 UTC) y `deferred-candidate.sql` (67.217 bytes, 16:53:15 UTC). Los tamaños y SHA-256 originales están en `execution-plan.json.recovery`.
- El esquema conservaba tablas, constraints e índices válidos. Su generador había omitido políticas y cardinalidades en el formato final; se anexaron 41 políticas, 92 estados de índices y 30 estadísticas escalares. El prefijo original se preservó byte por byte.
- El SQL diferido conservaba íntegros la migración 278 y sus helpers. Sólo el bloque del ensayo de timeout estaba truncado y contenía texto de la herramienta; se sustituyó por el blob Git original `20c547cca0422bcdcd83119fb49c6d872e184880:supabase/migrations/20260925014851_scope_conversion_statistics_timeout.sql`.
- Al recuperar había procesos de Codex y PowerShell de sesiones anteriores. Docker Desktop también seguía activo desde el 21/09; `docker ps` no mostró contenedores activos y no había contenedores Supabase, ni siquiera detenidos. No se observaron procesos Node/Python/psql/Supabase/Vercel/Git ni listeners en 3000, 3001, 5432, 54321, 54322 o 8080. No se terminaron procesos ajenos. No se encontró `AGENTS.md` aplicable.

## Tres recorridos distintos

| Estado | Entrada | Transporte y cálculo |
| --- | --- | --- |
| UI productiva en `f8ed298` | `/admin/conversiones` y `/dashboard/conversiones`, pestaña Estadísticas | Navegador → Data API sobre tablas → arrays → cálculos React/TypeScript |
| RPC instalado | `/rest/v1/rpc/get_conversion_report` | `public.get_conversion_report(jsonb)` → helpers `conversions_read` → tablas y agregaciones JSON; sin consumidor en esa UI productiva |
| Candidato archivado, retirado | `POST /api/conversions/statistics` para estadísticas globales | Next.js → Data API con sesión del usuario → resumen RPC → contexto RPC → páginas RPC → cálculo Node → respuesta NDJSON |

La inspección de referencias en `frontend` y `supabase/functions` del árbol productivo no encontró llamadas a `get_conversion_report` ni al endpoint diferido. La existencia de funciones instaladas no demuestra que la pestaña las consuma. Tampoco se encontró `conversions_read.stats_native` en el catálogo consultado durante esta recuperación: los planes históricos de esa función no son el plan de la UI actual.

El catálogo instalado conserva `get_conversion_report` como invoker, con `statement_timeout=60s` y `work_mem=16MB`. Esos ajustes pertenecen a ese RPC. No son el presupuesto de las consultas directas de la UI ni el del ensayo diferido a 8/15 segundos.

## UI productiva: trazabilidad exacta

Referencias de código respecto de `f8ed298`; estos archivos también son idénticos en HEAD.

| Paso | Archivo y línea | Consumidor / resultado |
| --- | --- | --- |
| Inicio y cambio de rango, admin | `frontend/app/(panel)/admin/conversiones/page.tsx:840`, `:1014`, `:1034` | `Promise.all` de conversiones y journey starts; `handleDateRangeChange` llama `refreshTable` |
| Inicio y cambio de rango, dashboard | `frontend/app/(panel)/dashboard/conversiones/page.tsx:1214`, `:1451` | Mismas lecturas, limitadas al usuario |
| Adaptador admin | `frontend/lib/conversionPageDataSource.ts:88` | `fetchConversionsForAdminFiltered` y `fetchConversionJourneyStartsForAdminFiltered` |
| Adaptador dashboard | `frontend/lib/conversionPageDataSource.ts:122` | `fetchConversionsFiltered` y `fetchConversionJourneyStartsFiltered` |
| Corte del visor | `frontend/lib/conversionsDb.ts:526` | GET `/rest/v1/conversion_view_preferences`, `hidden_by`, `visible_from`; `maybeSingle()` |
| Conversiones | `frontend/lib/conversionsDb.ts:907`, `:1033`, `:1050` | GET `/rest/v1/conversions`; proyección `CONVERSIONS_SELECT` (`:841`), `created_at DESC`, límites de fecha inclusivos y páginas por offset |
| Inicios | `frontend/lib/conversionsDb.ts:949`, `:1064`, `:1079` | GET `/rest/v1/conversion_journey_starts`; proyección `:871`, `first_seen_at DESC`, fechas inclusivas y páginas por offset |
| Ocultos | `frontend/lib/conversionsDb.ts:991`, `:1739`, `:1747` | GET `/rest/v1/hidden_conversions`; IDs únicos en lotes de 100, `hidden_by` + `conversion_id IN (...)`; exclusión posterior con `Set` |
| Filtrado y funnel | Admin `page.tsx:410`, `:419`, `:425`, `:590`; `frontend/lib/conversionsDb.ts:1100` | Moneda, fechas, exclusión de eventos de prueba, filtros y `buildFunnelContactsFromConversions` en navegador |
| Render | Admin `page.tsx:1533`; dashboard `page.tsx:1917` | `StatsPanel` recibe conversiones filtradas, funnel, starts, umbral y rango |
| Cálculo | `frontend/components/conversiones/StatsPanel.tsx:486`, `:547`; `frontend/lib/conversionStats.ts:242`, `:290`, `:532` | `computeStatsTruthMetrics`, `computeCoreStats`, `computeJourneyStartStats` y cálculos por segmento |

El usuario se obtiene con Supabase Auth; las lecturas se ejecutan bajo RLS. Dashboard agrega `user_id = viewer`; admin omite ese predicado explícito y depende del rol almacenado y de RLS. Las dos lecturas aplican `latestIso(range.start, visible_from)`; los journey starts no pasan por `excludeHiddenConversions`.

El arranque también lee `conversions_config`, `conversions_pixel_configs`, `profiles`, `gerencias` y `gerencia_phones`. Admin `page.tsx:863` arma etiquetas para los filtros; `:904` lee `landings` y las líneas siguientes consultan `landings_gerencias` para opciones de Desempeño. Son consultas independientes y mapas en JavaScript, no JOIN de filas productivas del reporte. `fetchReportingConversions` y `fetchAvailability` pertenecen a Desempeño; no son la consulta principal de Estadísticas. El esquema adjunto conserva esas dependencias de contexto.

`allConversions` de `StatsPanel` se deriva del array cargado para el rango seleccionado. Su nombre no implica una segunda lectura de todo el histórico. El modo demo usa datos locales y queda fuera del recorrido hosted.

## Origen de «Data API en páginas de 1.000 filas»

La afirmación se acredita por **ambos lados**, con fechas y consumidores distintos:

| Evidencia | Ubicación | Qué acredita |
| --- | --- | --- |
| Configuración hosted capturada el 2026-09-19 | `docs/release/pre-production/data-api.json:3`, `:6`, `:11` | `GET /v1/projects/{project-ref}/postgrest` registró `maxRows: 1000`; es evidencia del proyecto, no una inferencia del valor por defecto |
| Código productivo de conversiones | `frontend/lib/conversionsDb.ts:917`, `:937` | `const pageSize = 1000`; `query.range(offset, offset + chunkSize - 1)`, consumido por las variantes admin/dashboard filtradas y de reportes |
| Código productivo de journey starts | `frontend/lib/conversionsDb.ts:959`, `:979` | Misma constante y fórmula, consumidas por las variantes admin/dashboard de starts |
| Configuración local | `supabase/config.toml:18` | `max_rows = 1000`; confirma el entorno local, por sí sola no prueba hosted |

`range` usa extremos inclusivos: 0–999, 1000–1999, etc. La lectura termina cuando llegan menos filas que `chunkSize`; para N filas y tamaño 1.000 sin límite explícito hace `floor(N/1000)+1` solicitudes, incluida la página vacía si N es múltiplo exacto. Cambiar sólo Max Rows no cambia la constante del frontend. Reducir Max Rows por debajo de `chunkSize` podría hacer que el lector interprete una página cortada como final.

La configuración hosted no se volvió a consultar durante esta recuperación: se conserva su fecha de acreditación. La documentación oficial confirma la semántica inclusiva de [`range`](https://supabase.com/docs/reference/javascript/using-modifiers-range) y el límite configurable en [`select`](https://supabase.com/docs/reference/javascript/select); esas fuentes no sustituyen la captura específica del proyecto.

**El candidato diferido no pagina a 1.000.** En `archive/deferred-statistics-a493e3f:frontend/lib/server/conversionStatistics/transport.ts:28`, `:39`, `:43`, envía `p_cursor`, admite 21.000 filas y una fila centinela. `public.get_conversion_stats_source` usa `LIMIT 21001`, orden `created_at DESC, id ASC`, y cursor por esa pareja. Devuelve un escalar `bytea` mediante el dominio `application/vnd.conversion-columns`; las filas de negocio van dentro del contenido serializado. Max Rows no corta ese contenido interno a 1.000. El resumen devuelve un escalar JSON. Los bloques de 2.500 del procesamiento Node son otra unidad y no páginas Data API.

## Candidato diferido: recorrido exacto

Las referencias siguientes pertenecen a la rama archivada, **no** a los archivos productivos actuales:

1. Admin `frontend/app/(panel)/admin/conversiones/page.tsx:422` crea `readRequest` (`from/to` ISO o null y timezone del navegador); `:431` llama `useConversionReadModel`.
2. `frontend/components/conversiones/useConversionReadModel.ts:26` → `frontend/lib/conversionReadModels.ts:90`. `isGlobalStatistics` selecciona el endpoint; otros reportes usan `get_conversion_report`.
3. `frontend/lib/conversionReadModels.ts:110` hace POST `/api/conversions/statistics` con la sesión existente.
4. `frontend/app/api/conversions/statistics/route.ts:9` valida solicitud y fechas, rechaza parámetros de identidad y fija `now` en `:25`. `dataApi.ts:54` valida la sesión con `auth.getUser`; SQL usa `auth.uid()`, RLS y `profiles.role`.
5. `frontend/lib/server/conversionStatistics/transport.ts:15` llama `/rest/v1/rpc/get_conversion_stats_summary` → `conversions_read.stats_summary` → `conversions`, `conversion_journey_starts`, `hidden_conversions`, `conversion_view_preferences`, `profiles`.
6. `transport.ts:21` llama `/rest/v1/rpc/get_conversion_stats_source` con `p_context_only=true` → `stats_money` y starts. Luego `:28` consume las páginas con cursor. `report.ts`/`context.ts` completan los cálculos en Node; `route.ts:43` transmite summary y complete como NDJSON.

Cada RPC tiene su snapshot MVCC. Compartir `now` no las convierte en una transacción única. No hay caché persistente del reporte. El ensayo con 8 segundos está en `a493e3f`; la variante terminal con timeout RPC de 15 segundos y timeout HTTP de 15 segundos está en `20c547c` (`frontend/lib/server/conversionStatistics/dataApi.ts:35`). Ese candidato de timeout también se retiró. No debe confundirse su nombre histórico «280» con la migración productiva 280 de reconciliación.

## Contenido y límites

- [current-production.sql](current-production.sql): traducción SQL de las consultas directas, claramente marcada como tal, y 35 definiciones exactas instaladas obtenidas por `pg_get_functiondef` durante la recuperación. No se capturó el SQL interno generado por PostgREST.
- [deferred-candidate.sql](deferred-candidate.sql): migración 278, candidato terminal de timeout completo y helpers. Ambos bloques contienen definiciones repetidas porque son los blobs históricos exactos; no son dos implementaciones activas.
- [schema-and-indexes.sql](schema-and-indexes.sql): 11 tablas, constraints, 92 índices, políticas y metadatos. No es un dump restaurable: incluye también los índices que respaldan constraints, dependencias externas como `auth.users`, y valores aproximados de catálogo.
- [execution-plan.md](execution-plan.md) y [execution-plan.json](execution-plan.json): evidencia reutilizada, métricas y alcance explícito de cada plan; ningún EXPLAIN nuevo.
- [date-presets.md](date-presets.md): los siete presets y el request exacto del timeout.

Los SHA-256 de origen y las redacciones están en el JSON. Los identificadores UUID literales de planes se sustituyeron por valores sintéticos estables, manteniendo SQL técnico, tipos, estructura, cardinalidades y métricas. No se incluyeron valores de nombres, correos, teléfonos, credenciales, JWT ni filas productivas. Las validaciones locales se registran en `execution-plan.json.validation`.

Validación final: 312 statements SQL parseados, cuerpos SQL y PL/pgSQL revisados sin ejecutar, 16 archivos de referencia cotejados con Git, siete ejemplos de fechas verificados y ocho enlaces internos válidos. El parser aislado requirió normalizar en memoria el dominio de retorno del source RPC a su tipo base `bytea`; los archivos no se alteraron para esa comprobación. Se verificaron hashes de evidencia, definiciones de catálogo y ausencia de patrones de secretos, datos personales y valores privados de los archivos de entorno. Los archivos siguen sin commit y el staging permanece vacío.
