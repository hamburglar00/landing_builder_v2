# PURCHASE 126018: entrega tardía y fecha original · 31/10/2026

Builder recibió el 31/10 dos confirmaciones de cargas del 21/10. Al no recibir `event_time`, asignó la hora de recepción e ignoró `confirmed_at`, `timestamp` y `dateTime`. La segunda carga quedó como recompra por existir la primera, con otra identidad de acción y transacción. **Ninguna se envió a Meta:** ambas se omitieron por origen no publicitario, antes de una solicitud HTTP.

Corrección publicada en Atrio `a7f7920` y Edge `conversions` v172. [Versiones, verificación y rollback del lote](purchase-runtime-release-20261031.md).

## Cronología comprobada, en UTC

| Registro | Confirmación original | Recepción en inbox | Resultado Builder |
| --- | --- | --- | --- |
| 118947 | 21/10 18:57:08 | 31/10 18:35:18.093 | Actualizó el CONTACT existente a primera compra de 1000 ARS; procesado a las 18:35:26.548. |
| 126018 | 21/10 18:59:13 | 31/10 18:35:25.793 | Creó recompra de 1000 ARS; procesado a las 18:35:32.173. |

Las acciones son `pbadmin-purchase:api2:automatic:148072` y `pbadmin-purchase:api2:automatic:148074`, respectivamente. Cada una tiene una sola recepción inbox y una reserva `purchase_event_claims` procesada, con claves distintas de acción y pago. El índice único `(user_id, idempotency_key)` está vigente. No se encontró duplicación de esas dos transacciones en Builder. Esta observación no certifica por sí sola el movimiento financiero del proveedor.

La fila 126018 heredó la procedencia de 118947 (`b93c5126-b486-404b-a9ee-cde8be64afa7`) y conserva `purchase_attribution_status=created_repeat_unverifiable|gerencia:unresolved`. Ese estado describe la comprobación de atribución; no demuestra una asignación incorrecta de asesor. Ambas filas tienen `from_meta_ads=false`, sin FBC ni UTM, y `purchase_status_capi=skipped_not_meta_ads`. El log 1247147 del 31/10 a las 18:35:31.640 registra la omisión de la recompra. No hay payload ni respuesta Meta para estas entregas. El HTTP 200 de inbox es la respuesta de procesamiento de Builder, no una aceptación de Meta.

## Causa y corrección autorizada

La auditoría de Atrio confirmó que las dos cargas y sus deliveries se crearon el 21/10. Las entregas quedaron `skipped`/`failed` sin `eventUrl`. El 31/10 a las 18:13:18 UTC se corrigió exclusivamente la URL de eventos del Admin Diana; la cola admite reintentar `pending`, `failed` y `skipped` sin corte de antigüedad. Ambas confirmaciones llegaron a Builder a las 18:35 UTC. No hubo un mensaje nuevo de Inbox que represente otra carga: el último mensaje de la conversación es del 23/10 a las 19:28:11 UTC. No está probado qué endpoint o ejecución puntual disparó esos reintentos; la secuencia demuestra entregas tardías de confirmaciones existentes, no una nueva operación financiera.

El payload persistido en Atrio conservaba la confirmación original pero no incluía `event_time`, según la auditoría de Atrio realizada en paralelo. La reproducción con las funciones reales mostró que `ensurePayloadEventTime` completaba ese campo con la recepción; `handlePurchase` luego lo seleccionaba y `toValidEventTime` lo conservaba. El normalizador no había cambiado una fecha antigua explícita: la fecha original nunca se había seleccionado.

La corrección Builder vive en `supabase/functions/conversions/event_time.ts`, llamada desde el mismo punto previo al inbox. Conserva `event_time` explícito válido, normaliza segundos/milisegundos/ISO y después considera el alias temporal de la acción. Si ambos campos son válidos pero discrepan, alinea el alias de esa acción con el instante canónico elegido: así los handlers existentes, que leen primero el alias, respetan la misma prioridad. Sin `event_time` válido, el alias válido sigue prevaleciendo como antes. Para PURCHASE, `confirmed_at` precede a `timestamp`, `dateTime` y `datetime`; solo utiliza recepción si no existe ninguna fecha original válida. Los aliases inválidos no pueden ocultar el valor correcto; los campos originales de confirmación no se alteran. Las fechas ISO antiguas sin zona se interpretan determinísticamente como UTC, acorde con la convención del servidor. No hay actualización de fechas por antigüedad: el filtro CAPI existente puede omitir eventos de más de siete días con `skipped_old_event_time`.

Atrio corrige en el mismo lote su emisión y preparación de backlog: añade el `event_time` original y falla si no puede establecer una fecha original válida, sin recurrir a `Date.now()`. Los IDs, reservas, montos, políticas CAPI y campos originales se conservan. No se reescribieron las dos filas investigadas ni se reenviaron sus eventos. Sin migraciones ni cambios de API2.

## Creación de fila frente a momento del hecho

La columna Fecha de conversiones y sus filtros usan `created_at`. Ese campo no equivale necesariamente a la fecha de una carga: 118947 fue creada como CONTACT el 21/10 a las 18:56:22 y recibió el PURCHASE el 31/10; 126018 fue creada al recibir la recompra el 31/10. `purchase_event_time` describe cuándo ocurrió la carga y `conversion_inbox.created_at` cuándo llegó esa entrega. El arreglo conserva estas distinciones, sin reinterpretar la interfaz ni modificar `created_at`.

Referencias UI: `frontend/components/conversiones/conversionPageShared.ts`, `frontend/components/conversiones/DateRangeFilter.tsx` y ambas páginas de conversiones de Admin/Cliente.

## Alcance agregado y validación

La consulta del 31/10 encontró 283 filas con `purchase_event_time` de ese día UTC. Solo dos conservaban `confirmed_at` ISO válido más de siete días anterior; ambas coinciden también con `timestamp` original. Son las filas de este caso, de un único cliente; ninguna de otros clientes. Ambas están `skipped_not_meta_ads`, sin logs con payload o respuesta Meta. El alcance no incluye fechas originales ausentes o formatos que no puedan compararse de esa manera.

Validación aislada: `deno test supabase/functions/conversions/event_time_test.ts` cubre los dos casos reales, precedencias, conflictos entre `event_time` y los cuatro aliases, reintento estable, formatos, zonas horarias, fechas inválidas y fallback de recepción. `node scripts/check-purchase-original-event-time.mjs` ejecuta las funciones reales de entrada y política CAPI, además de las dos expresiones de selección temporal extraídas de los handlers PURCHASE, con IO simulado: primera compra y recompra antiguas, alias discrepante, origen no Meta intacto y borde exacto de siete días, sin solicitudes externas. No simula el flujo completo de matching de esos handlers. La auditoría de producción fue solo lectura; no se hicieron cargas, retiros, reenvíos ni modificaciones históricas.

Evidencia local sanitizada: `.vercel/purchase126018-readonly-20261031.json`. La decisión está registrada en [el acuerdo compartido](../DECISIONES_APROBADAS_ATRIO_TEMPLATE7_GATEWAYS.md), apartado «Fecha original de PURCHASE y entregas tardías».
