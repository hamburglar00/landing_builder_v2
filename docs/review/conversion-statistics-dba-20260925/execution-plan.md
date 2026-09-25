# Evidencia de ejecución y revisión SQL

No se ejecutaron consultas de carga, EXPLAIN, ANALYZE ni benchmarks durante esta recuperación. [execution-plan.json](execution-plan.json) conserva evidencia previa con origen Git, SHA-256, alcance y redacciones. Sólo se consultaron definiciones y metadatos de catálogo para completar el paquete.

## Qué demuestra cada evidencia

| ID en JSON | Entorno / alcance | Evidencia |
| --- | --- | --- |
| `local_summary` | Fixture sintético, administrador ARS, candidato por secciones | Resumen de EXPLAIN ANALYZE/BUFFERS y nodos; ejecución 1.793,537 ms; shared hit 54.895, read 6.737; temp read/write 0/0 |
| `local_context` | Fixture sintético, RPC source con contexto | Árbol completo superior y tres planes anidados; ejecución 1.439,958 ms; shared hit 54.697, read 6.864; temp read/write 0/0 |
| `local_uninstrumented_samples` | Fixture sintético, muestras separadas de instrumentación | Resumen, contexto y páginas: tres rondas por moneda con tiempos y bytes |
| `historical_hosted_estimate` | Hosted, 22/09, SQL extraído de un candidato anterior `stats_native`, rol administrativo | EXPLAIN sin ANALYZE; árbol completo estimado. No acredita tiempos, buffers reales ni el plan del timeout de 278 |
| `historical_hosted_generic_estimate` | Mismo diagnóstico histórico, alternativa genérica | Estimaciones de estadísticas; no demuestra que el ensayo fallido eligiera ese plan. Se omitieron los planes ajenos del lookup de conversiones |
| `hostedTimeout` | Hosted, candidato 278 y variante terminal de 15 segundos, rol authenticated | 8.112 ms y 57014 en primer intento; 15.502,8 ms y 57014 en terminal. No existe aquí un árbol ANALYZE/BUFFERS del statement abortado |

`local_summary` ya estaba resumido en su archivo original: las cadenas `query` fueron recortadas por el generador histórico y **no son SQL ejecutable completo**. Se preservaron como evidencia; el SQL completo está en `deferred-candidate.sql`. No se fabricó un árbol inexistente. `local_context` sí conserva los árboles completos.

Los planes locales corresponden al cuerpo de cálculo sellado con SHA-256 `3ee10a156548aefe769e77055689210f8ddd88ac8b9ba41e41ada187ada48e92`, anterior a la adaptación final de transporte/autorización. `hostedTimeout.reusedPerformance` documenta por qué se reutilizó esa evidencia. Es una comparación local acreditada, no una medición hosted de la versión terminal. El fixture ARS tenía 81.630 filas; el endpoint compilado había mostrado resumen en 1.853 ms y total en 9.004 ms. Esas cifras no sustituyen el fallo hosted.

Los planes hosted históricos se obtuvieron con contexto administrativo que omite RLS, `work_mem=2184kB`, mientras el RPC tenía `work_mem=16MB`. Las limitaciones originales se conservan literalmente en el JSON. No hay un EXPLAIN acreditado de las páginas que consume la UI productiva actual. Esa ausencia se declara en lugar de ejecutar otra prueba costosa.

## CROSS JOIN y multiplicación de filas

**UI productiva.** Las dos consultas principales son SELECT sobre una tabla, sin JOIN explícito. RLS añade comprobaciones de propietario/rol por `EXISTS`; no añade filas al resultado. Las consultas de etiquetas alimentan mapas en JavaScript. No se encontró un producto cartesiano SQL en ese recorrido. La paginación por offset vuelve a procesar la ordenación/posición de cada página; no hay un desempate por `id`, por lo que timestamps repetidos y escrituras concurrentes merecen revisión de estabilidad.

**Candidato 278, `stats_summary`.** Los nombres siguientes se pueden localizar directamente en `deferred-candidate.sql`:

| Operación | Cardinalidad / coste a revisar |
| --- | --- |
| `CROSS JOIN settings` | `settings` es un SELECT escalar de una fila; conserva N filas, no N×N |
| `CROSS JOIN LATERAL ... phone_norm`, `clean_keys`, `purchase_kind` | Subselects escalares: una fila por entrada. `OFFSET 0` conserva una barrera de evaluación; puede limitar simplificaciones del planner. Hay trabajo repetido por fila |
| `CROSS JOIN LATERAL (VALUES (...contact...), (...lead...), (...purchase...))` | Hasta tres filas por conversión antes de `WHERE enabled` y deduplicación por claves. La expansión es intencional; debe medirse por sus loops, no clasificarse como cartesiano ilimitado |
| `firsts LEFT JOIN contact_ext ON ext` | `contact_ext` agrupa por `ext`; lado derecho único. Puede haber varios `firsts` para un `ext`, pero no duplicados de ese lado derecho |
| `first_refs` y `x LEFT JOIN first_refs ON ext` | `first_refs` usa DISTINCT; unión muchos a uno, sin multiplicar `x` por coincidencias duplicadas |
| Combinación final de agregados | Agregados sin GROUP BY y settings producen una fila; su combinación no cruza dos universos de conversiones |
| `stats_money`: `CROSS JOIN regions` | `regions` es un objeto JSON agregado de una fila. `first_totals` agrupa por scope antes del LEFT JOIN con money |

**RPC instalado `get_conversion_report`.** El cuerpo completo sigue en `current-production.sql`, pero no se le atribuye el tráfico de esa UI. Construye arrays JSON, metadatos, funnel y `conversions_read.stats`. Las expansiones LATERAL de etiquetas sí pueden producir varias etiquetas por contexto, después deduplicadas. En `stats`, los JOIN de dimensiones se hacen sobre grupos por clave; los calendarios se unen a bins agregados. El `LEFT JOIN LATERAL ... LIMIT 1` de mensajes diarios limita la salida a una coincidencia por día, aunque puede repetir búsquedas. No se concluye que todos los JOIN del código completo tengan coste despreciable.

## Recorridos, CTE, LATERAL y JSON

En producción, cada cambio de rango vuelve a cargar conversiones y starts. La exclusión de ocultos añade `ceil(N/100)` solicitudes para N IDs distintos, enviadas con `Promise.all`; es independiente de las páginas de 1.000. Las proyecciones de conversiones son amplias e incluyen payloads JSON. `StatsPanel.tsx:560` y las secciones siguientes filtran arrays por campaña/dispositivo/landing y vuelven a llamar a `computeCoreStats`. El coste de red, parseo JSON y CPU del navegador no aparecería completo en un EXPLAIN de un SELECT individual.

En el candidato, `source`, `clean`, `identity_parts` y `r` usan `NOT MATERIALIZED` para permitir integración con el plan. Eso no promete un único recorrido: los distintos consumidores pueden volver a leer o calcular la fuente. `settings`, `contact_ext`, `firsts`, `first_refs` y otros CTE materializados permiten reutilización dentro del statement, con coste de memoria y posible almacenamiento temporal. Son estructuras por ejecución, no tablas persistentes.

La secuencia del endpoint es resumen → contexto/`stats_money` → páginas. Diferentes RPC pueden recorrer `conversions` otra vez. Cada una tiene snapshot propio. El transporte columnar reduce repetición de claves de JSON, pero requiere `array_agg`, `json_build_object`, diccionarios, conversión a bytes y decodificación. El contexto devuelve starts juntos; las páginas fuente llevan 21.000 filas más centinela. La ruta Node vuelve a preparar y segmentar el material para completar el reporte.

En el RPC instalado hay `jsonb_agg(to_jsonb(...))`, `jsonb_array_elements`, `jsonb_each`, agregaciones por dimensión y cálculos de claves. Sus CTE reutilizan arrays dentro de cada invocación; no son una materialización entre solicitudes. El JSON puede afectar CPU, memoria y ancho de tuplas aun sin archivos temporales.

## Lo acreditado por los nodos locales

En el resumen local, el statement interno duró 1.748,016 ms. `CTE ads` registró 1.069,915 ms, `CTE x` 395,131 ms, `contact_ext` 481,211 ms, `first_refs` 531,699 ms y `totals` 625,469 ms. Los tiempos de nodos son inclusivos: **no se deben sumar** como fases independientes.

La expansión `Values Scan` tuvo 70.206 loops y 2 filas por loop según el resumen; otros `Result` tuvieron 70.206 o 62.046 loops. Eso acredita evaluación repetida, no necesariamente una consulta SQL remota por fila. Desvíos de estimación destacados:

| Nodo / grupo | Estimado | Real |
| --- | ---: | ---: |
| Seq Scan de starts | 47 | 6.304 |
| Sort / agregado de claves de anuncios | 2 | 84.703 |
| `contact_ext` | 200 | 28.298 |
| `firsts` | 107 | 3.264 |
| `first_refs` | 107 | 3.000 |

El DBA puede revisar selectividad, expresiones de moneda/identidad, repetición por CTE y acceso a datos antes de atribuir el fallo a un JOIN concreto. El índice 277 `idx_conversions_user_promo_created(user_id,promo_code,created_at)` está válido y listo en el catálogo. Su existencia beneficia ese patrón de lookup; no demuestra que resuelva una agregación global por moneda sin predicado de `user_id/promo_code`.

La captura previa de esquema registra aproximadamente 85.538 conversiones (511.377.408 bytes totales) y 12.615 starts (37.224.448 bytes totales). Son `reltuples` y tamaños, no conteos exactos leídos de filas. Un `reltuples=-1` significa estadística desconocida. `pg_stats.n_distinct` negativo representa una fracción estimada del número de filas; no es una cantidad negativa real. No se exportaron most-common values ni histogramas.

## Temporales y límites de la conclusión

Los dos resultados locales destacados registran **temp read/write = 0/0** y el resumen de headline no registra spills. El SQL candidato no crea tablas temporales. Esto no descarta spills, sorts externos o hashes por lotes en hosted: el timeout no dejó un plan ANALYZE completo y la memoria/configuración difiere. No se alteró `work_mem`, `statement_timeout`, estadísticas ni índices durante la preparación del paquete.

El resultado operativo acreditado es que el resumen global ARS sin límites de fecha superó tanto el presupuesto inicial de 8 segundos como el terminal de 15 segundos, sin contenido útil. No hay mediana de cinco muestras: se cortó después de la primera, y tampoco hubo muestras PYG ni lectores concurrentes en el ensayo terminal. [date-presets.md](date-presets.md) conserva el request y separa el rango de negocio de los timestamps de ejecución.
