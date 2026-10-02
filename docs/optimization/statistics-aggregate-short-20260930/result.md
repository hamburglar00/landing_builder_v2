# Estadísticas de períodos cortos: intento local retirado

Fecha: 2026-09-30. Base `2643d957a4eb27fe7c405555a98cdc1c3f63ada7`, ledger 280. No hubo migración nueva, cambio de manifiesto, Preview, escritura hosted ni rollout. La implementación productiva de Estadísticas continúa intacta.

## Dos rutas examinadas

La primera RPC local, que no llamaba a `get_conversion_report`, filtraba fecha, moneda y alcance con RLS y devolvía métricas preparadas. Serializaba las filas a JSON y las volvía a recorrer con `conversions_read.stats`. Ocho comparaciones sintéticas de Hoy/Ayer × ARS/PYG × administrador/cliente no mostraron diferencias en 57 métricas escalares ni en desgloses, series, provincias, contactos destacados y HTML renderizado. Con unas 4.708 filas ARS visibles en Hoy, tres ejecuciones SQL locales tardaron 3.523,5 / 3.551,3 / 3.413,7 ms (mediana 3.523,5; máximo 3.551,3). Se descartó porque conservaba el costo de serialización y no resolvía la descarga de filas que hacen las páginas para construir los filtros.

Se probó después una entrada pública temporal `SECURITY INVOKER` con JWT, RLS y límites obligatorios de fecha, moneda, administrador, zona horaria y máximo SQL de 31 días. Invocaba directamente `conversions_read.stats_native`, existente desde la migración 276, y devolvía sólo su informe `stats`. No llamaba al RPC completo `get_conversion_report`, no activaba objetos de la migración 278 y no escaneaba el histórico global para regiones. El modelo nativo materializa una base filtrada y arma métricas relacionales, aunque sus agrupaciones y ordenaciones usan espacio temporal.

En el fixture descartable, Hoy ARS administrador pasó la comparación canónica integral: 4.708 conversiones visibles, 57 escalares y estructuras sin diferencias. `EXPLAIN (ANALYZE, BUFFERS)` del RPC dio **1.442,9 ms**, 4.961 bloques compartidos leídos desde caché, 151 bloques temporales leídos y 367 escritos. Al ampliar el fixture a **33.909 conversiones ARS en siete días**, la misma llamada superó el límite individual de 8 s y PostgreSQL la canceló con `57014`. No se ejecutó Mes ni se intentó otra arquitectura: siete días falló el gate acordado.

## Decisión y estado final

Ambas RPC candidatas, el código de presentación preparado y el harness experimental fueron retirados. No queda ninguna RPC nueva en `supabase/migrations`, ni integración activa en administrador o cliente. Hoy, Ayer, Semana, Mes, Mes pasado, personalizados y Máximo siguen usando el recorrido vigente. **No hay un máximo de días acreditado para una ruta rápida**. El informe anterior de siete días en `../statistics-seven-day/result.md` se conservó sin cambios.

La única mejora de código retenida agrupa una vez las conversiones y contactos por campaña, dispositivo y landing en `frontend/components/conversiones/StatsPanel.tsx`, evitando filtros completos repetidos para cada clave sin cambiar fórmulas ni orden. La base local, sus contenedores, redes y volúmenes propios se eliminaron al terminar. TypeScript, tests focalizados, build Node 24, encoding y `git diff --check` se verificaron tras retirar la candidata.

El cuello observado está dentro del cálculo nativo para varios días, antes de integrar la pantalla. Dado el límite de intentos acordado, no hay otra implementación propuesta en esta rama. Cualquier futuro enfoque necesitaría una decisión explícita de alcance y un nuevo presupuesto de experimentación.
