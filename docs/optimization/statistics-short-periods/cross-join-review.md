# Estadísticas: inventario de cruces y recorridos

Base productiva: `f8ed2986ff584ee107f4f5ce18ce708b1548273d`. Fuentes inmutables:
[current-production.sql](../../review/conversion-statistics-dba-20260925/current-production.sql),
[deferred-candidate.sql](../../review/conversion-statistics-dba-20260925/deferred-candidate.sql) y
[planes anteriores](../../review/conversion-statistics-dba-20260925/execution-plan.json).
No se volvió a ejecutar Máximo ni EXPLAIN ANALYZE para este inventario.

Se revisaron los árboles SQL y los statements/expresiones PL/pgSQL con pglast 8.4,
además del texto. Resultado: **11 cruces en el catálogo instalado**, incluidos
un `LEFT JOIN ON true` y siete LATERAL; **7 cruces por versión del candidato**
(14 apariciones porque el archivo conserva 278 y la variante descartada).
No aparecen listas `FROM a, b` ni otros productos implícitos en esos árboles.
Las funciones de tabla correlacionadas se incluyen como LATERAL; las que tienen
un solo elemento FROM se describen en expansiones JSON.
Para analizar la firma del retorno binario del candidato, el parser requirió
representar su dominio como `bytea` solamente en memoria; no se cambió el SQL.

`N`, `D`, `G` y `Lᵢ` son cardinalidades estructurales, **no estimaciones del planner**.
`ND` significa no disponible en los planes conservados: no se inventa una medida.
Los valores reales del candidato corresponden al fixture histórico, no a hosted
ni al nuevo ensayo de rangos cortos. Las filas por loop de EXPLAIN están redondeadas.

## Catálogo instalado: todos los cruces

La UI productiva consulta tablas directamente; estos helpers instalados no son
el recorrido que usa actualmente la pestaña. Se incluyen también sus ramas ajenas
a Estadísticas para que el inventario del archivo SQL sea completo.

| Función / línea | Izquierda × derecha | Filas de salida y efecto | Estimado / real acreditado |
| --- | --- | --- | --- |
| `funnel_page:296`, `ordered CROSS JOIN params` | N contactos × 1 fila de parámetros | N antes del filtro de página; luego hasta 20 o 33 | ND / ND; el lado derecho es escalar por construcción |
| `matches_labels:433`, arrays `f CROSS JOIN l` | F filtros × L etiquetas | Hasta F×L pares, restringidos por comparación; `EXISTS` devuelve un booleano y puede detenerse antes | ND / ND; no duplica las filas del llamador |
| `performance:468`, `r CROSS JOIN LATERAL targets` | N conversiones × Lᵢ etiquetas coincidentes | ΣLᵢ; con selección usa las etiquetas seleccionadas que coinciden, sin ella expande etiquetas | ND / ND; multiplicación real por etiquetas |
| `performance:473`, `jsonb_each(phones) p CROSS JOIN LATERAL ... l` | P claves × Lᵢ etiquetas por clave | ΣLᵢ antes del UNION deduplicador | ND / ND |
| `performance:491`, `unnest(keys) LEFT JOIN projected ON true` | 7 métricas × G grupos | 7×max(G,1), luego GROUP BY devuelve 7 filas | ND / ND; producto incondicional acotado, no parámetro de una fila |
| `slice_orders:582`, `unnest(keys) CROSS JOIN unnest(directions)` | 5 criterios × 2 direcciones | Exactamente 10 combinaciones; cada una ordena hasta 10 elementos del ranking | ND / ND; cardinalidad exacta deducida del SQL, no observada con ANALYZE |
| `stats:710`, calendario `LEFT JOIN LATERAL bins ... LIMIT 1` | D días × 0..1 coincidencia por día | D filas, incluso sin coincidencia; puede explorar bins D veces | ND / ND; preserva el match histórico DD/MM entre años |
| `get_conversion_report:868`, `label_contexts CROSS JOIN LATERAL labels` | C contextos distintos × Lᵢ etiquetas | ΣLᵢ, luego DISTINCT ON por etiqueta | ND / ND |
| `get_conversion_report:869`, `start_contexts CROSS JOIN LATERAL start_labels` | S contextos distintos × Lᵢ etiquetas | ΣLᵢ, luego DISTINCT ON por etiqueta | ND / ND |
| `get_conversion_report:911`, grupos de tabla `g CROSS JOIN LATERAL jsonb_array_elements(g.value)` | G grupos × Rᵢ registros | ΣRᵢ antes de DISTINCT teléfono; rama tabla | ND / ND |
| `get_conversion_report:912`, `filtered r CROSS JOIN LATERAL labels` | N registros × Lᵢ etiquetas | ΣLᵢ antes de filtro de teléfonos de la página; rama tabla | ND / ND |

## Candidato diferido: ambas versiones

La segunda posición de línea refiere a la variante descartada de timeout.
No se reactivaron estos objetos para la revisión.

| Función / líneas | Izquierda × derecha → salida estructural | Estimado / real disponible |
| --- | --- | --- |
| `stats_summary:84 / 404`, `clean CROSS JOIN LATERAL phone_norm` | N conversiones × 1 normalización → N | Izquierda ND / 70.206 loops del Result escalar histórico; derecha ND / 1 por loop. Salida del JOIN no conservada; N se deduce de la semántica escalar |
| `stats_summary:96 / 416`, `identity_parts CROSS JOIN settings` | N × 1 → N | `settings` estimado 1 / real 1, loops 1; lado izquierdo y nodo JOIN ND |
| `stats_summary:102 / 422`, `ad_r CROSS JOIN LATERAL VALUES` | N × 3 eventos potenciales → 0..3N tras `enabled` | Izquierda ND / 70.206 invocaciones; VALUES estimado ND / promedio redondeado 2 por loop. Total exacto expandido ND: no se afirma 140.412 a partir del promedio redondeado |
| `stats_summary:126 / 446`, `clean CROSS JOIN LATERAL clean_keys` | N × 1 → N | Result real 1 por loop, 62.046 loops; estimación individual y nodo JOIN ND. CTE `x` final estimado 30.601 / real 62.046 |
| `stats_summary:127 / 447`, resultado anterior `CROSS JOIN LATERAL purchase_kind` | N × 1 → N | Segundo Result real 1 por loop, 62.046 loops; estimación individual y nodo JOIN ND. No añade otra multiplicación de filas |
| `stats_summary:145 / 465`, `totals CROSS JOIN first_totals` | 1 × 1 → 1; LEFT JOIN con agregado ads global 0..1 | Ambos CTE estimados 1 / reales 1, loops 1. `ads` completo estimado 2 / real 1; salida estructural final 1, nodo final no conservado |
| `stats_money:182 / 502`, `conversions CROSS JOIN regions` | N conversiones filtradas × 1 objeto JSON → N | Plan de contexto completo: conversiones estimadas 153 / reales 81.630; regions 1 / 1; Nested Loop salida 153 / 81.630, todos loops 1 |

`OFFSET 0` en subconsultas escalares puede evitar simplificaciones del planner:
que cada una entregue una fila no vuelve gratuito su trabajo por conversión.
La evidencia resumida no identifica por alias todos los Result; la asignación de
los dos de 62.046 loops a las normalizaciones de `x` es una inferencia estructural,
no una nueva captura de planes.

## Otros JOIN y repetición de trabajo

- `firsts LEFT JOIN contact_ext` (136/456): `contact_ext` es DISTINCT por ext.
  Izquierda estimada 107 / real 3.264; derecha 200 / 28.298. Hash Join conservado:
  107 / 3.264. Es muchos a uno. `first_refs` (138/458) deduplica ext después del
  INNER JOIN: estimado 107 / real 3.000. El LEFT JOIN `x → first_refs` (143/463)
  no multiplica `x`: derecha única. `x` completo 30.601 / 62.046; salida exacta
  de ese JOIN no conservada.
- `stats_money` agrega `money` por scope y `first_totals` produce un scope global:
  el LEFT JOIN por scope no duplica grupos. Dimensiones y calendario del helper
  instalado se unen con bins agrupados por clave; el FULL JOIN de provincias
  une como máximo un grupo de cada lado por provincia.
- En la UI vigente no hay JOIN SQL en las consultas principales. RLS/EXISTS y
  la exclusión de ocultos no agregan filas. Offset vuelve a recorrer posiciones
  anteriores; los filtros de ocultos usan lotes de 100 IDs independientes de las
  páginas Data API de 1.000. Los componentes recorren arrays por dimensión.
- `stats_summary`: `source`, `clean`, `identity_parts`, `r`, `ad_r` y `start_rows`
  NOT MATERIALIZED permiten repetir el acceso/expresiones en sus consumidores.
  `settings`, `s`, `ads`, `x`, `contact_ext`, `firsts`, `first_totals`, `first_refs`
  y `totals` materializados se reutilizan dentro del statement, no entre RPC.
- **`stats_money.regions` recorre conversiones de todo el alcance RLS para buscar
  provincias distintas, sin filtro de fecha ni moneda (175/495).** El CROSS JOIN
  de una fila no es la multiplicación cara; el scan que construye esa fila puede
  seguir siendo global aunque el request tenga un período corto. El CTE `r`
  materializado se recorre nuevamente para dinero global, provincias y primeras
  cargas. Resumen, contexto y páginas son RPC separadas con snapshots separados.
- Catálogo instalado: `ad_counts` recorre tres veces el CTE JSON `r` para contact,
  lead y purchase mediante UNION ALL. `core` recorre `r` para varios agregados y
  usa diccionarios JSON de identidad en InitPlans no correlacionados. `stats`
  prepara arrays, recorre campañas/dispositivos/landings, horas/días/semanas,
  repite cálculos de `ad_counts` y llama a `core` por provincia.
- Subconsultas correlacionadas: órdenes de `slice_orders` (10 scans/sorts del
  ranking); bins diarios LATERAL; tracking de metadatos por source; etiquetas,
  disponibilidad y grupos de `performance`; proyección de claves `jsonb_each`
  por fila. El tamaño de los arrays controla el coste aunque no aumenten la
  cardinalidad externa. `jsonb_array_elements`, `jsonb_each`, `jsonb_agg`,
  concatenaciones y diccionarios implican parseo, copia y agregación de JSON.
- No hay CREATE TEMP TABLE en estos cuerpos. Materialización, sort y hash
  pueden usar temporales internos. Los planes locales históricos registran
  temp read/write 0/0; eso no acredita ausencia de spills hosted. Los tiempos
  inclusivos de nodos no se suman como fases independientes.

El timeout hosted anterior fue Máximo + administrador global + ARS, con
`from=null`, `to=null`: 8.112 ms y 15.502,8 ms en intentos distintos, SQLSTATE
57014. No dejó un ANALYZE/BUFFERS completo. Esa evidencia no se transforma en
una supuesta cardinalidad real de sus joins ni se repite el ensayo.
