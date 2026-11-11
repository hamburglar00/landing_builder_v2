# COMPARE — corte de observación del 10/11/2026

Consulta de solo lectura a `public.entry_funnel_events` de Builder y `public.nx_entry_funnel_events` de NexoBet. Ventana fija: 10/11/2026 17:03:00–23:25:59 UTC. El corte identifica la versión de landing `fdc90b8ebea48773ded7a4b9debde9231cc8d7d1`, `environment=production`, `source=unknown`. Cada intento se identifica por `(landing_id, flow_id, attempt_id)`; `phone_at_click` toma la primera observación del intento. El origen desconocido no acredita visitas humanas.

| Motor y plantilla | Intentos con clic | Número listo al clic | Pendiente al clic | Solicitud de salida | Clic→solicitud p50 / p90 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Clásico T2 | 66 | 48 | 18 | 66 | 243,5 / 832 ms |
| Clásico T5 | 32 | 20 | 12 | 32 | 273,5 / 1208,3 ms |
| Total observado | 98 | 68 (69,4 %) | 30 (30,6 %) | 98 | No se agregan percentiles entre plantillas |

Los 98 intentos tienen `attempt_started`, `cta_clicked`, `phone_at_click`, `phone_wait_completed` y `outbound_requested`. Los 30 casos pendientes al clic terminaron con `phone_outcome=ready`; los 98 registraron ese resultado. Hubo 16 informes `telemetry_loss` con `loss_reason=delivery_failed`, correspondientes a 14 intentos únicos (T2: 7 informes/6 intentos; T5: 9 informes/8 intentos). No se registró `entry_error` en este corte. Un informe de pérdida de telemetría no demuestra una falla de ingreso ni la pérdida permanente de todos los eventos del intento. `outbound_requested` tampoco confirma que WhatsApp se haya abierto.

La mediana clic→solicitud de salida dentro de T2 fue 230 ms cuando el número estaba listo y 804 ms cuando seguía pendiente; en T5, 257,5 y 590 ms respectivamente. Esta separación describe estos intentos; no prueba una mejora atribuible al prewarm sin una cohorte equivalente anterior.

## Por qué había 30 números pendientes

La fase `destination_request` usa el mismo `request_id` que `phone_at_click`. En **los 30 intentos pendientes** hay duración completa de la solicitud y su inicio calculado como momento de finalización menos esa duración. En los 30 el pedido ya había empezado antes del clic; la menor anticipación observada fue 521 ms. El CTA no inició una segunda búsqueda. La prueba local de la promesa compartida (12 casos) confirma que prewarm, recorrido y clic reutilizan el pedido pendiente.

| Plantilla y estado al clic | Intentos | Inicio del pedido desde navegación, p50 | Clic desde navegación, p50 | Pedido completo, p50 | `phone_total` servidor, p50 |
| --- | ---: | ---: | ---: | ---: | ---: |
| T2 pendiente | 18 | 1312 ms | 3246,5 ms | 2536 ms | 1751,5 ms |
| T2 listo | 48 | 945 ms | 4683 ms | 2060,5 ms | 1446,5 ms |
| T5 pendiente | 12 | 148 ms | 1586,5 ms | 2159 ms | 1883,5 ms |
| T5 listo | 20 | 1159,5 ms | 6142,5 ms | 2236,5 ms | 1581 ms |

Las medianas son por grupo y no se suman entre columnas. T5 pendiente muestra principalmente clics tempranos frente a una solicitud de más de dos segundos. En T2 pendiente coinciden clics más tempranos que los listos, un inicio del pedido algo más tardío y una solicitud algo más lenta. Las fases del servidor son secuenciales (`owner` → `plan` → `select`); en T2 pendiente las medianas de `plan` y `select` fueron 586 y 703 ms, frente a 266,5 y 390,5 ms en T2 listo. Estas diferencias describen la muestra, no identifican por sí solas un error de selección ni autorizan cambiar cuotas o reglas.

Ya existen mediciones de inicio/fin de solicitud y fases servidor; agregar logs genéricos no resolvería esta pregunta. El candidato técnico es reducir el tiempo de las verificaciones y selección en el backend **sin alterar elegibilidad, reserva, rotación ni reparto**. Antes de tocar esa ruta hay que revisar sus RPC y medir una variante controlada con pruebas de reglas de negocio. Un clic inmediato siempre puede adelantarse a una consulta remota; el objetivo práctico es reducir esa ventana y el tiempo restante de espera.

## Alcance de la comparación

Constructor no tiene clientes activos en producción según la aclaración de Leo, y NexoBet sigue en desarrollo; no corresponde esperar tráfico productivo de esos motores para avanzar. Se validan localmente. Tampoco hay muestra de T7–T9 con chat utilizable en este corte. **COMPARE queda pendiente sólo para una comparación interpretable del Clásico** entre versiones/condiciones equivalentes; las versiones anteriores carecen de `phone_at_click`, y `source=unknown` no acredita visitas humanas. La implementación, regresión y publicación de PREWARM-OBS sí están cerradas.

Siguiente corte: comparar T2/T5 del Clásico por landing, versión, fuente, entorno y primer intento/reintento; mantener el denominador de intentos y la cobertura de eventos. Repetir el análisis de `destination_request` y `phone_total` tras cualquier optimización del backend. Constructor y NexoBet se prueban con escenarios locales controlados mientras no haya uso productivo.
