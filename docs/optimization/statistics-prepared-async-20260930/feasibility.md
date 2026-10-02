# Estadísticas: factibilidad de frescura inmediata y Máximo en un minuto

Fecha: 2026-09-30. Rama `feature/statistics-prepared-async-20260930`; base productiva `2643d957a4eb27fe7c405555a98cdc1c3f63ada7`, ledger 280. No hubo migración, Preview, conexión a Supabase hosted ni cambios productivos. Se preservaron los documentos y la mejora local previa.

## Requisitos confirmados

- La primera consulta de un rango extenso, incluido Máximo, debe terminar en **hasta un minuto**.
- La repetición sin cambios debe ser inmediata.
- Una conversión nueva debe reflejarse **inmediatamente** en Estadísticas.
- Las métricas, filtros, atribución, monedas y aislamiento entre clientes deben coincidir con producción.

Un caché del informe final por sí solo no cumple la tercera condición: queda obsoleto al cambiar conversiones, ocultamientos, inicios de recorrido o configuración. Invalidarlo y recalcularlo devuelve el costo de la primera consulta. Un resumen diario de totales tampoco preserva por sí solo los recuentos únicos, la mediana, los primeros eventos de un período ni la atribución entre días. Por ejemplo, una persona que aparece dos días debe contarse una sola vez al consultar ambos.

La invalidación debe considerar, como mínimo, inserciones y actualizaciones de `public.conversions`, altas o bajas de `public.hidden_conversions` y `public.hidden_contacts` por cada usuario que consulta, cambios de `public.conversion_view_preferences.visible_from`, altas y actualizaciones de `public.conversion_journey_starts`, y modificaciones del umbral premium en `public.conversions_config`. Un cambio de umbral reclasifica contactos históricos sin que se inserte una conversión nueva. Los inicios de recorrido tienen `first_seen_at` y `last_seen_at`, de modo que una actualización también puede alterar un rango. Las preferencias de ocultamiento son individuales; una clave de caché compartida entre administradores y clientes filtraría cifras equivocadas.

El cálculo vigente en `frontend/lib/conversionStats.ts` deduplica contactos y leads por usuario y teléfono, cruza eventos por identidad externa, atribuye primeras compras a leads o contactos previos, calcula recurrencia por recorrido, mediana e indicadores de retención que consultan el historial completo. Esas dependencias hacen que invalidar sólo el día de la conversión nueva sea insuficiente para conservar paridad en todos los filtros.

La RPC de Audiencias es más acotada: devuelve compradores y métricas de compra para un propietario y filtros específicos (`get_meta_audience_buyers_v2_payload`), no el conjunto de gráficos, dimensiones, recorridos y métricas de Estadísticas. Su patrón de filtrar temprano y devolver un payload compacto sí es reutilizable, pero sus tiempos no acreditan que el informe completo pueda prepararse en un minuto.

## Prueba local descartada

`scripts/optimization/probe-statistics-facts-local.mjs` reconstruyó las 280 migraciones productivas verificadas por manifiesto en una base descartable, cargó **280.000 conversiones sintéticas** distribuidas en 90 días y copió sólo las columnas que usa el informe a una tabla de lectura separada. La tabla original con índices ocupó **242 MB** y la copia con índices **75 MB**. Se mantuvo el cálculo exacto de `conversions_read.stats_native`, sustituyendo únicamente la tabla de origen, con JWT y RLS en la copia.

La consulta Máximo, administrador global ARS, sobre la copia **alcanzó el `statement_timeout` de 60 segundos** (`SQLSTATE 57014`). No se repitió una consulta equivalente sobre la tabla original porque la opción más pequeña ya había fallado el requisito. Esta prueba no demuestra el tiempo de producción ni mide todas las combinaciones de filtros; sí descarta la simple copia angosta como solución suficiente para el objetivo fijado. Todos los contenedores, redes y volúmenes de la prueba quedaron eliminados.

## Consecuencia de diseño

Para mantener frescura inmediata en el mismo PostgreSQL haría falta una proyección analítica de estados **componibles por identidad y recorrido**, actualizada en la transacción de cada cambio, más consultas que combinen sólo los estados relevantes del rango y filtro. El resultado cacheado tendría que actualizarse o invalidarse de forma coherente al recibir conversiones, inicios, ocultamientos y cambios de configuración. Esa lógica debe probar paridad integral y costo de escritura; no puede derivarse simplemente de los totales diarios ni de una vista materializada de refresco periódico.

La alternativa es un motor analítico separado que ingiera cambios casi en tiempo real. Eso introduce infraestructura, operación y una ventana de propagación que debe medirse; por lo tanto, la frescura literalmente transaccional no puede prometerse sin un diseño adicional. Si se permite una demora de actualización, un caché mantenido de forma periódica simplifica la solución. Si se permite más de un minuto inicial para Máximo, un trabajo asíncrono en la infraestructura actual puede priorizar corrección y progreso antes que latencia.

No se creó una migración ni se conectó la UI: ninguna opción probada hasta ahora acredita simultáneamente los tres requisitos confirmados. La decisión de infraestructura o de cuál límite flexibilizar determina la implementación siguiente.
