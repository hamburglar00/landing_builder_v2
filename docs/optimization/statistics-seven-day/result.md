# Estadísticas de hasta siete días: ensayo retirado

Fecha: 2026-09-30. Base: `2643d957a4eb27fe7c405555a98cdc1c3f63ada7` (main y origin/main al iniciar). No hubo rollout productivo.

Se probó en una rama aislada una RPC `SECURITY INVOKER` con JWT, RLS y rechazo SQL de fechas nulas, más de siete días calendario de Buenos Aires, monedas ajenas a ARS/PYG y filtros activos. El recorrido anterior quedaba seleccionado para Mes, Mes pasado, Máximo y personalizados largos. La RPC filtraba tenant, moneda y fecha antes de proyectar las filas; el endpoint Node preparaba las métricas y el navegador recibía sólo el informe. Esta última decisión tampoco cumplía literalmente el objetivo de que PostgreSQL devolviera métricas ya preparadas.

## Validación local

Se reconstruyeron las 280 migraciones productivas en una base descartable, se alinearon sólo los objetos de catálogo necesarios y se cargó un fixture sintético de 122.445 conversiones y 13.836 inicios. La migración 281 se generó con Supabase CLI y se verificó contra el manifiesto usando blobs históricos de Git para evitar la conversión CRLF del checkout Windows. Idempotencia y rollback pasaron. El `EXPLAIN (ANALYZE, BUFFERS)` de siete días usó `idx_conversions_created_at`; no justificó un índice adicional ni mostró bloques temporales escritos en el plan local.

| Administrador ARS | Muestras canónicas | Mediana informe SQL + Node | Máximo informe | Máximo SQL | Diferencias |
| --- | ---: | ---: | ---: | ---: | ---: |
| Hoy | 3 | 83,1 ms | 129,1 ms | 59,8 ms | 0 |
| Ayer | 3 | 80,7 ms | 83,4 ms | 60,9 ms | 0 |
| Esta semana | 3 | 235,3 ms | 273,9 ms | 162,3 ms | 0 |
| Siete días completos | 3 | 615,9 ms | 625,4 ms | 342,9 ms | 0 |

Hubo 24 comparaciones canónicas integrales sin diferencias: las doce de la tabla y muestras adicionales PYG, usuario ARS/PYG. Se probaron tenant vacío, dos tenants sin fuga, denegación de elevación a administrador, filtros excluidos, corte de día `03:00Z` y dos lectores concurrentes con resultados idénticos. La Data API local aceptó siete días y rechazó ocho y Máximo con `22023`. Build Node 24, TypeScript, ESLint focalizado, tests y encoding aprobaron.

## Hosted y decisión

La lectura hosted de siete días contenía aproximadamente 4.709 conversiones ARS y 16 PYG en el período medido. Tres pruebas transaccionales SQL para administrador ARS tardaron 3.244,1 / 2.794,3 / 1.242,8 ms; el máximo estuvo por debajo de 8 s. La llamada autenticada directa por Data API también funcionó con usuarios sintéticos (administrador: 4.709 conversiones y 4.764 inicios; cliente vacío: cero). El transporte bruto de tres llamadas ARS por Data API tardó 7.025,7 / 3.857,0 / 4.582,0 ms, con respuesta de aproximadamente 6 MB. Estos tiempos no incluyen la preparación del informe de Node.

El Preview protegido con SSO y sin alias productivos midió el endpoint completo con el usuario sintético administrador ARS. Sus tres muestras fueron **8.074,2 / 6.219,0 / 3.346,1 ms** hasta recibir el informe (la primera respuesta llegó a los 7.900,8 ms). Como el endpoint entrega el informe de una vez, dos muestras superaron el máximo de 5 s para el primer contenido útil y una superó el máximo de 8 s para el informe corto. Por ello **falló el gate hosted**. No se midieron más combinaciones ni se hizo rollout.

Se eliminó el Preview `dpl_2b1AZdERTRc9A1sH6TGpoLuZeQSa`. Se retiraron la RPC hosted, los dos usuarios sintéticos, sus perfiles y sesiones; se comprobó cero remanentes y ledger productivo en 280. El objeto de prueba transaccional tampoco persistió. Se retiró de la rama la implementación local, la migración 281, el manifiesto modificado y los harnesses del ensayo. El recorrido productivo, Vercel Production y Supabase quedaron en la versión anterior. No se enviaron eventos ni se tocaron datos comerciales.
