# Línea base y resultado de pruebas

## Cierre final acotado: fuente de resultados vigente

Consultar closure.md, local-start-diagnostic.json, vector-diagnostic.json, local-start-replay.json, handler-concurrency-results.json y verification-results.json. Esta continuación no volvió a consultar producción. Las tablas anteriores de RPC y EXPLAIN se conservan como evidencia histórica, no como mediciones nuevas.

Las 20 caracterizaciones integrales del handler y CAPI incluyen solicitudes simultáneas, errores 503/red, recuperación, identidad estable, backoff, presupuesto de reintentos y replay de la cola diferida. Se observaron duplicados Lead, envíos concurrentes CAPI y pérdida de incrementos del contador de retry. Las aprobaciones fijan esos resultados actuales; no significan que exista entrega única. Ver contracts.md para la distinción.

screen-baseline.json incorpora categorías separadas de requests/bytes estáticos, aplicación, API y preflight. Las 24 muestras siguen siendo sintéticas y no constituyen benchmark del backend completo. El host es compartido y algunas mediciones coinciden con diagnóstico local: no inferir percentiles ni atribuir diferencias temporales a la moneda.

El timeout ARS de 12 segundos queda formalmente pendiente de la futura fase de Audiencias. EXPLAIN sin ANALYZE solo aporta costos estimados; no identifica con certeza la causa temporal. Ese pendiente, por sí solo, no bloquea el cierre de Fase 0.


## Ampliación del 16 de septiembre de 2026

El resultado actual y los bloqueos de cierre están en `closure.md`. Los informes reproducibles son `verification-results.json` (suite completa, incluidos exit codes), `concurrency-results.json`, `screen-baseline.json`, `audience-diagnostics.json`, `production-explain.json`, `migration-replay.json` y `artifact-audit.json`.

La revisión ahora ejecuta ESLint completo, no solo los cuatro tests nuevos; las 18 advertencias detectadas están en archivos productivos preexistentes y no se corrigen en esta fase. El build Next de producción con URL/key sintéticos también completó con éxito. Ningún archivo productivo versionado se modificó.

Se agregaron 22 escenarios de concurrencia sobre conexiones PostgreSQL/PostgREST locales y funciones reales de las colas. El total del último pase exitoso debe leerse de `verification-results.json`; no sumar pases repetidos, mediciones ni assertions internas para inflarlo. La omisión de Data API en el comando frontend se ejecuta aparte con la base local.

### Comparación local equivalente ARS/PYG

Mismo usuario ficticio, fechas, valores, filas y rol por moneda. Se recrea una base aislada, se cargan las definiciones reales de audiencias y se aplica timeout de 8 s. Una muestra por caso, sin elevar el límite. Las estadísticas de la tabla se recolectan solo sobre el fixture local. No se usa EXPLAIN ANALYZE.

| Filas/compradores por moneda | ARS RPC ms | PYG RPC ms | JSON de texto por moneda |
| ---: | ---: | ---: | ---: |
| 200 | 43,240 | 38,835 | 48.480 bytes |
| 2.815 | 246,880 | 361,003 | 688.630 bytes |
| 8.000 | 723,182 | 632,231 | 1.961.210 bytes |
| 42.449 | 3.066,006 | 5.601,351 | 10.480.783 bytes |

El fixture tiene un evento simple por comprador y no representa la distribución, anchura de filas, caché, policies completas ni contención de producción. No constituye p50/p95 ni prueba de que el problema ARS esté resuelto. La moneda por sí sola no reprodujo el timeout bajo este procedimiento. Ver muestras exactas y costos estimados en `audience-diagnostics.json`.

### Diagnóstico acotado en producción

Una única transacción READ ONLY con `statement_timeout=8s` obtuvo EXPLAIN sin ANALYZE del SELECT interno para ambas monedas, con el mismo as_of/período y selección del propietario con más compras por moneda. No ejecutó la RPC, no regresó compradores y no guardó filtros ni identificadores.

La huella MD5 de la función v2 sigue siendo `1659c3114fde6a378d9c9f0b525e7995`. ARS: costo estimado total 353,87, con 330,99 en el Index Scan del CTE raw_purchases; estima 170 filas allí y 57 compradores finales. PYG: costo total 9,89, con 9,48 en el mismo CTE y tres filas estimadas; una final. ARS usa Merge Join y PYG Nested Loop en esta planificación con parámetros literales. Los valores son unidades del planificador, no tiempos, filas reales ni prueba de un plan PL/pgSQL almacenado.

Se identifica como mayor costo **estimado** la lectura/normalización de raw_purchases, seguida de materialización, deduplicación, ordenamientos y agregación. No se puede atribuir con certeza el timeout real a un nodo usando solo EXPLAIN: faltan conteos y tiempos efectivos del mismo contexto. Se conserva el timeout ARS de 12 s del 15 de septiembre como línea base; no se repitió la llamada pesada ni se optimizó nada.

### Pantallas

`screen-baseline.json` y `closure.md` documentan requests, bytes, filas sintéticas, tiempos de transporte observado, trabajo del navegador y operaciones. Se ejecuta el build real, con layout y precargas, aislado de endpoints externos. Los tiempos de respuesta del fixture son transporte del harness, no latencia Supabase. No reemplazan mediciones integradas de la DB por pantalla. Las métricas se toman en procesos de Chromium independientes para evitar sumar contadores entre navegaciones.

## Registro histórico del 15 de septiembre

## Estado inicial y final

Main limpio al iniciar; commit `a4e752cf58f628813d3979d598b60d480caaac8d`. Solo se agregan archivos de esta fase. No hay cambios en archivos productivos. Entorno: Windows, Node 22.12.0, Chromium/Edge headless 153, PostgreSQL local 17.6, PostgREST local 14.1. Los tests usan únicamente datos sintéticos.

| Suite | Antes | Después |
| --- | --- | --- |
| Frontend, npm test | 85 aprobadas, 1 integración omitida | 99 aprobadas, 1 integración omitida |
| Integración Data API, runner local | pendiente por falta de fixture | 1 aprobada con 1.205 compradores y límite 1.000 |
| Deno conversions + builder-config | 41 aprobadas | 41 aprobadas |
| meta-ip-collector | 5 aprobadas | 5 aprobadas |
| SQL existentes | 87 aprobadas al provisionar runner local | 87 aprobadas |
| SQL nuevas | no existían | 24 aprobadas |

Resultado combinado final: 257 comprobaciones aprobadas, cero fallidas. La integración omitida en el comando general se ejecutó y pasó por separado; se cuenta una sola vez. Nuevas: 14 en frontend y 24 SQL. Los tests incluyen subtests; no son 257 archivos ni 257 escenarios integrales.

TypeScript completo: `tsc --noEmit --incremental false`, exit 0. ESLint de los cuatro archivos nuevos de tests, exit 0. Las primeras ejecuciones del runner encontraron dependencias faltantes del esquema mínimo y particularidades de Docker Desktop; se corrigió el runner y terminó con éxito. No se modificaron tests existentes ni producción para hacerlos pasar.

Duraciones orientativas del runner: frontend inicial 46,52 s y final 10,08 s; collector inicial 0,64 s y final 0,72 s; Deno final ~1 s de tests. Son tiempos de ejecución de pruebas con cachés/carga variables, NO una mejora de rendimiento del producto. Integración Data API final ~631 ms de test, incluyendo transporte y validación local, no latencia de producción.

## Pruebas añadidas

- `frontend/tests/phase0AudiencePipeline.test.ts`: fixture posicional -> mapper -> ranking con empates y moneda -> scope/AND -> resumen -> CSV exacto; no exportables y métricas independientes. Respuesta de 2.815 personas sin paginar, rechazo de duplicados, versión inválida y error RPC.
- `frontend/tests/phase0LandingContracts.test.ts`: cache/tag, teléfono vacío, HTTP fallido, JSON/red inválidos, parámetros y preservación del payload.
- `frontend/tests/phase0PhoneHandlers.test.ts`: ejecuta los handlers reales transpilados con SDK simulado; métodos, autorización comercial, inexistencia, caché fair, warmup, falta de teléfonos, error SQL y extensión/contador.
- `frontend/tests/phase0HomeContracts.test.ts`: fecha fija, orgánicos/eventos de prueba, ausencia de actividad, ingreso/promedio y conteo legacy de filas duplicadas.
- `supabase/tests/phase0_audience_boundaries.test.sql`: 12 aserciones de fronteras inclusivas, microsegundos, as_of, ARS/PYG, tests, negativos, tipo desconocido e inactivos.
- `supabase/tests/phase0_purchase_claims.test.sql`: 12 aserciones del contrato SQL de idempotencia y reintentos.

## Producción: mediciones activas acotadas

Supabase MCP, transacción READ ONLY, contexto auth.uid y rol authenticated, sin devolver personas. Selección del propietario con más filas Purchase por moneda; el UUID no se conserva. `as_of=2026-09-15T23:40:00Z`, período desde `2026-08-17T03:00:00Z` hasta ese instante. Los fixtures no incorporan datos de producción.

| Operación | Resultado | Filas/personas | Tamaño |
| --- | --- | --- | --- |
| get_meta_audience_buyers_v2_payload, PYG | 94,10 ms, una muestra | 195 compradores en un JSON escalar | 58.153 bytes de JSONB serializado a texto |
| get_meta_audience_buyers_v2_payload, ARS | statement_timeout a 12 s dentro de la RPC | no disponible | no disponible |

El reloj PYG excluye descubrimiento del usuario; incluye llamada/materialización del payload, no red ni deserialización del navegador. `octet_length(data::text)` no es tamaño HTTP comprimido ni pg_column_size. La cancelación ARS ocurrió en el cuerpo de la RPC; es una observación bajo el límite por sentencia, no un p95 ni un tiempo exacto de terminación. No se elevó timeout ni se repitió esa carga. El script reproducible usa por defecto un límite más conservador de 8 s.

Inventario agregado observado: 42.449 filas con purchase_event_id no vacío ARS y 574 PYG, entre todos los usuarios. Esto NO es compradores deduplicados ni filas transferidas a un cliente, y no excluye por sí solo los test events.

## Producción: observación pasiva de pg_stat_statements

Snapshot `2026-09-15T23:52:21Z`; reset `2026-09-15T16:50:07Z`. Datos completos permitidos en production-statistics.json. No se reseteó la extensión ni se ejecutaron los jobs para medirlos.

| Consulta identificada | Calls | Media ms | Máximo ms | Total ms | Bloques temporales escritos |
| --- | ---: | ---: | ---: | ---: | ---: |
| refresh_home_overview_stats_cache | 7 | 26.130,96 | 32.217,58 | 182.916,71 | 13.699 |
| refresh_phone… | 14 | 11.509,71 | 16.114,83 | 161.135,97 | 24.468 |
| get_phone_for_landing, consulta frecuente | 453 | 187,29 | 2.354,89 | 84.840,78 | 0 |
| get_gerencia_availability_summaries | 4 | 127,40 | 174,60 | 509,62 | 0 |
| get_home_overview_stats_cached_by_currency | 2 | 10,39 | 11,38 | 20,77 | 0 |

Otra consulta que menciona get_phone_for_landing registró 10.760,37 ms en una muestra. No se mezcla con la consulta frecuente: distinto queryid puede incluir envoltorios o parámetros/contextos diferentes.

La consulta histórica que menciona audiencias y registra 31.070,22 ms incluye envoltorio de medición. No se presenta como tiempo aislado de RPC. Las categorías se asignan por nombre dentro del SQL; no se guardan los textos, que podrían contener datos sensibles. El snapshot de estadísticas incluye tráfico real, cron y consultas diagnósticas. No permite reconstruir p50/p95, carga por pantalla ni tiempo de red.

## Navegador real con compradores sintéticos

Funciones actuales compiladas, Edge headless 153 sobre Windows, 8 procesadores lógicos informados; sin throttling. Tres calentamientos y 15 muestras por tamaño. Dataset con empates, Top10 por valor de período AND cantidad >=2; no son tiempos medidos con personas reales. El equipo ejecutaba también trabajo local: estos valores orientan la comparación, no constituyen un SLA.

| Compradores | JSON sintético UTF-8 | Personas tras reglas | Total p50 / p95 ms | Reglas p50 / p95 ms | CSV p50 / p95 ms |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 2.815 | 528.011 | 308 | 61,7 / 77,7 | 17,9 / 24,4 | 0,6 / 1,4 |
| 7.975 | 1.500.038 | 869 | 169,4 / 226,6 | 48,5 / 76,9 | 2,8 / 10,5 |
| 20.000 | 3.785.202 | 2.000 | 365,7 / 546,0 | 98,6 / 131,5 | 5,3 / 7,2 |

Total incluye mapper, reglas, resumen y CSV; no JSON.parse, red, React ni pintura. Mapper p50: 41,6 / 119,3 / 264,9 ms; resumen p50: 0,2 / 1,1 / 1,5 ms. La construcción del fixture y cálculo de bytes quedan fuera del reloj. Los tamaños CSV resultantes son 12.522 / 35.523 / 82.905 bytes, sin BOM.

Las duraciones por componente tienen percentiles propios: no sumar p95 para reconstruir p95 total. Cambiar una regla en la UI normalmente no repite el mapper; no atribuir todo el tiempo de carga al cambio de regla.

## Requests y filas por pantalla

No se tuvo una sesión de navegador autenticada del cliente para registrar una navegación real del panel. Por tanto no se inventa un total de requests, bytes HTTP ni filas transferidas por pantalla. Queda un observador reproducible sin datos personales y estas referencias comprobables por código:

- Inicio: getUser y una llamada home_cached por carga/cambio de moneda; además pueden existir solicitudes del layout, auth y realtime. No se llama con todas las monedas.
- Audiencias: una llamada al payload por carga/cambio de período o moneda. Editar regla/resumen/valor CSV no agrega RPC dentro del componente. Apertura/gestión de guardadas agrega operaciones de configuración. Su página padre también carga datasets y metadata; no confundir una RPC del componente con una sola solicitud de toda la pantalla.
- Conversiones: una solicitud por bloque de 1.000 conversiones y otra por bloque de journeys; más configuración, pixels, visibilidad, ocultos, perfil, gerencias y teléfonos. Para N filas sin límite, floor(N/1000)+1 solicitudes de páginas, incluyendo N=0 o múltiplo exacto. Las consultas de ocultos y otros efectos se cuentan aparte.
- Landing: configuración puede resolverse en servidor/cache; teléfono puede venir de initialPhone o prewarm compartido. Click agrega acciones con efectos y tracking. No se generó un click productivo para medirlo.

Usar navegador en build de producción para evitar efectos duplicados de desarrollo/StrictMode, separar carga inicial y navegación, cache cold/warm y reasignación de moneda. WebSocket/realtime no está representado como todos sus mensajes en Resource Timing. Para filas usar el resultado lógico del endpoint, no su cantidad de contenedores JSON.

## Cobertura y riesgos pendientes

1. ALTA: no hay aún prueba de dos conexiones simultáneas para reservas/claims ni E2E del handler conversions con DB, colas y fallos de Meta. Los tests secuenciales no prueban atomicidad bajo carga. Nunca usar replays productivos para suplirlo.
2. ALTA: la medición ARS no terminó dentro del límite. No hay payload/timing preciso de ese caso; una optimización posterior requiere EXPLAIN de lectura acotado o base local representativa, sin ampliar indiscriminadamente la carga productiva.
3. ALTA: el esquema local es mínimo. No certifica todas las policies, triggers, tipos/constraints ajenos a estas migraciones ni el camino completo del asignador. Las pruebas SQL de configs sí ejecutan su RLS real con dos usuarios.
4. ALTA: equivalencia del código desplegado con main no queda demostrada por los tests. Se registraron versiones/hashes de Edge por MCP; conversions está en v158. Un rollback debe recuperar el artefacto desplegado pertinente, no asumir que HEAD lo reproduce.
5. MEDIA: helper Inicio, RPC de Inicio, Funnel y Audiencias no tienen idénticas definiciones de identidad, first/repeat ni Leads inferidos. No convertir una optimización en una homogeneización silenciosa.
6. MEDIA: snapshot fijo de fechas no congela ingestas retroactivas ni datos de contacto. Comparación old/new debe compartir dataset/transacción; los contadores de producción cambian durante la auditoría.
7. MEDIA: falta traza autenticada de pantallas y E2E de CTA clásico/constructor con red lenta/fallo de prewarm. El harness HTTP no ejecuta scripts de navegación completos. No se afirma que una landing real cargó más rápido.
8. MEDIA: los tests existentes de algunos scripts públicos verifican código generado/markup; no sustituyen prueba de interacción en navegador. El benchmark nuevo sí ejecuta las funciones de audiencias en Chromium, pero no el panel React.
9. MEDIA: no hay todavía fixtures de equivalencia para todas las variantes de medianas/redondeos entre numeric PostgreSQL y Number JavaScript, nombres CSV extremos y límites muy grandes. El oracle nuevo fija ejemplos concretos, no todos los valores posibles.
10. BAJA: tiempos locales sensibles a JIT/GC y carga; se conservan metodología y muestras, sin assertions de tiempo inestables.

No fue necesario definir una regla de negocio nueva para las pruebas añadidas. Las diferencias observadas se documentaron y permanecieron intactas.
