# Apéndice: futura Fase 0C — concurrencia de conversiones y CAPI

Solo planificación. Referencias al commit `a4e752cf58f628813d3979d598b60d480caaac8d`; las líneas pueden cambiar en trabajos posteriores. No se modificó el handler, reintentos, RPC, constraints, estados ni lógica de negocio. Este plan requiere una aprobación separada del bootstrap de Fase 0B.

## Evidencia que motiva el trabajo

`handler-concurrency-results.json` conserva 20 caracterizaciones aprobadas con HTTP local, PostgreSQL/PostgREST reales, callbacks actuales ejecutados en VM y servicios externos simulados. Ese resultado incluye defectos observados:

- Ocho Lead simultáneos generaron ocho envíos con ocho event_id distintos, tanto ARS como PYG.
- Cuatro workers de retry enviaron cuatro requests por evento Contact, Lead o Purchase, con un event_id compartido. En Contact/Lead el contador persistido quedó en 1 frente a 4 requests.
- Contact y Purchase con las identidades cubiertas sí enviaron una vez en los escenarios del handler inicial. No demuestra exclusión entre el handler y un retry, ni todos los casos sin IDs fuertes.
- El test de Lead diferido documenta el comportamiento actual; no prueba exclusividad global del inbox.

No hay prueba de deduplicación real de Meta. Una respuesta 200 simulada solo acredita el camino de respuesta de nuestro código. El esquema actual del harness es acotado y los callbacks se ejecutan fuera del isolate real de Edge; habrá que repetir sobre el esquema completo y, cuando esté disponible, runtime Edge local.

## Puntos exactos de intervención futura

| Ubicación actual | Problema / función | Intervención propuesta, aún no implementada |
| --- | --- | --- |
| conversions/index.ts:1926, insertInboundEvent; insert en 1946 | Retorna data?.id o null; no distingue conflicto de unicidad de otros errores | Adquisición atómica del evento de ingreso y retorno explícito acquired/duplicate/processing/error. El perdedor no continúa a efectos externos; errores de DB se propagan como tales. |
| conversions/index.ts:7829–7927, precheck y creación del inbox | Leer antes de insertar permite que varios requests pasen; null del insert no detiene el flujo | Convertir el precheck en observación complementaria; que una operación atómica de DB sea la autoridad. Mantener la clave y respuesta del contrato de cada acción. |
| conversions/index.ts:4205, handleContact; envío en 4506 | Las restricciones cubren ciertas carreras de insert, no todos los productores del mismo envío | Reclamar también la entrega antes de enviar; el mismo claim debe gobernar handler y retries, sin alterar el matching actual. |
| conversions/index.ts:4566, handleLead; asignaciones lead_event_id en 5111/5270; envío en 5499 | Varios ganadores lógicos pueden crear identidad y enviar sobre un mismo journey | Claim del efecto Lead antes de crear/persistir la identidad. Guardar un único event_id/event_time y resultado canónico en la misma transacción que adquiere el efecto. No usar un UUID nuevo en cada competidor. |
| conversions/index.ts:1249/1295, claimPurchaseEvent/completePurchaseEventClaim; llamadas en 6014/7354 | Ya existe claim para Purchase; hay que preservar su arbitraje de IDs fuertes y revisar recuperación | Reusar su contrato, identificar qué casos quedan sin key y agregar lease/token de propiedad si corresponde. Completar solo con el token vigente; impedir que un worker antiguo cierre un claim nuevo. |
| supabase/migrations/20260728163000_purchase_event_atomic_claims.sql:6/17/40/130 | purchase_event_claims, purchase_event_claim_keys, claim y complete RPC | Nueva migración incremental, no edición histórica. Revisar transición processing→processed/deduplicated/error y recuperación; conservar unicidad (user_id,idempotency_key) y relación entre aliases fuertes. |
| conversions/index.ts:3052, sendToMetaCAPI; fetch en 3871 | Frontera de entrega externa compartida por varias acciones/rutas | Guardar identidad y destino antes de HTTP, usar claim de entrega por efecto/destino, y finalizar con compare-and-set del token. No confundir persistir una conversión con entregar su evento. |
| conversions/index.ts:7952, runAndFinalize; rutas diferidas desde 7990 | Finalización del inbox/claim y entrega tienen ventanas distintas de fallo | Estados y resultado recuperables; un 202 diferido no debe marcar entrega final. Llevar ownership al replay interno con autorización, sin confiar en flags proporcionados por el cliente. |
| retry-failed-conversions/index.ts:111/130/155 | SELECT de Contact, Lead y Purchase elegibles, sin reserva atómica | Sustituir la selección competitiva por RPC de lote: SELECT FOR UPDATE SKIP LOCKED + UPDATE de lease/token/attempt + RETURNING en una sola transacción. Respetar filtros, orden, límites y períodos actuales. |
| retry-failed-conversions/index.ts:683 y fetch en 849 | Identidad de Purchase resuelta antes del envío; varios workers pueden resolver simultáneamente | Resolver/persistir identidad bajo el claim común; conservar resolvePurchaseRetryIdentity y event_time actuales. No generar identidad por intento ni por worker. |
| retry-failed-conversions/index.ts:933/1016 y replay HTTP en 993/1077 | Lead y Purchase deferred seleccionables por varios workers | Reservar inbox deferred con la misma técnica de lote y un token. El handler destino valida ownership; idempotencia persiste aunque se repita el HTTP interno. |
| retry-failed-conversions/index.ts:1308/1331 | Recuperación Lead desde logs y replay | Incluir este productor en el mismo arbitraje; un check de lead_event_id previo no es un lock. No dejar una ruta secundaria que evada el claim. |
| retry-failed-conversions/index.ts:1507, retrySingleContactLeadCapiEvent; 1538/1575/1815/1842/1856 | Lectura de retryCount/lastRetry seguida de escritura y fetch; incrementos perdidos | Claim antes de la decisión de envío; incremento atómico de intento bajo lock; éxito/error mediante token vigente. Conservar backoff de cinco minutos y presupuesto de seis intentos donde hoy apliquen; no imponerlos a Purchase sin verificar su contrato. |

La numeración en rangos de esta tabla orienta la revisión; los nombres de funciones son la referencia estable. Ninguno de estos puntos fue modificado.

## Contrato de estados e idempotencia a diseñar

Separar estado de negocio (contact/lead/purchase) del estado de procesamiento. El plan propone estados operativos equivalentes a pendiente, en proceso con lease, entregado y error recuperable/terminal; sus nombres físicos y compatibilidad con columnas actuales se revisarán antes de implementar. No agregar nuevos valores a `estado` de conversiones ni alterar qué evento se atribuye a qué journey.

Conservar las restricciones existentes como punto de partida:

- Contact: `20260427200000_conversions_contact_dedupe_unique_indexes.sql`.
- Lead: `20260609120000_lead_inbox_dedupe_by_promo.sql`: mismo action_event_id con promo distinta puede ser legítimo. Preservar también el matching actual sin promo y su ventana de phone/agency; no extender una unicidad global a casos hoy diferenciados.
- Purchase: `20260609123000_purchase_inbox_dedupe_by_promo_without_strong_ids.sql`, dedupe Coelsa/transacción y claims de `20260728163000`.

No asumir que una única restricción sobre teléfono, action_event_id o conversion_id cubre todas las reglas. La clave de entrega debe identificar el efecto canónico, tipo de evento y destino real (pixel/dataset/ruta); dos destinos legítimos no son necesariamente un duplicado. Preservar aislamiento de usuario y resolución ARS/PYG sin cambiar la semántica actual de IDs fuertes. Casos sin identificador estable o diferencias entre matching de handler/DB exigen una consulta al usuario antes de fijar la regla.

Para lote: reservar filas mediante SKIP LOCKED, asignar token/lease y confirmar la transacción antes de llamar HTTP. No mantener locks de fila durante la llamada a Meta. Para un evento específico: INSERT ON CONFLICT / UPDATE condicional bajo transacción, con resultado inequívoco de ganador. Un mutex en memoria no protege múltiples instancias.

Cada finalización deberá comprobar ID de claim, token vigente y estado. Lease expirado permite recuperación con un token nuevo; el worker viejo no puede actualizar el resultado nuevo. El token protege la DB, pero no cancela un HTTP externo ya en vuelo. La expiración, heartbeat y política de resultado incierto requieren diseño y tests explícitos.

No es posible garantizar «un solo request HTTP para siempre» ante un crash después de que Meta acepte y antes de guardar el éxito. Reintentar ofrece recuperación, pero puede repetir el request; omitirlo puede perder una entrega. Persistir event_id y destino antes del primer envío permite reutilizarlos en esa ventana. La deduplicación final depende del contrato del receptor y no queda probada por nuestro simulador. Ese límite debe aparecer en los resultados, no esconderse detrás de un contador local.

## Pruebas de aceptación propuestas

Todas locales, fixtures sintéticos, reloj controlado, barreras reproducibles y transporte que rechaza cualquier destino no simulado. Ejecutar el mismo procedimiento para ARS y PYG.

1. Ocho requests idénticos de Contact, Lead y Purchase: un efecto persistido, un claim ganador, una identidad canónica y un envío por destino en el escenario sin fallos. Todos los perdedores obtienen una respuesta coherente con el contrato aprobado.
2. Ocho eventos legítimamente distintos, incluidas promos distintas y tenants distintos: ninguno suprimido por exceso de dedupe; todos drenados. Probar aliases Coelsa/transacción y casos sin IDs fuertes según contratos existentes.
3. Handler inicial y cuatro workers de retry compitiendo sobre el mismo efecto: exclusión común, no dos mecanismos desconectados. Lotes solapados y cola mayor que su límite: sin starvation ni filas atascadas.
4. Meta simulado con 429, 503, excepción de red, timeout y recuperación: backoff/presupuesto actuales, event_id/event_time/destino estables, contadores exactos de intentos adquiridos y resultado terminal explícito.
5. Crash después de reservar y antes de HTTP: lease vence, otro worker recupera; el worker viejo no finaliza el nuevo claim.
6. Crash o respuesta perdida después de aceptación simulada: registrar por separado requests HTTP, identidades distintas y efectos del receptor simulado. Puede haber más de un request; un efecto en ese simulador solo valida el contrato artificial de idempotencia configurado, no el comportamiento real de Meta.
7. Expiración de lease mientras sigue HTTP en vuelo: token impide escritura tardía en DB; documentar duplicación potencial del transporte y la política aprobada para resultado incierto.
8. Deferred Lead/Purchase y replay desde logs con workers simultáneos, reinicio de proceso y retry de HTTP interno: un dueño del inbox, sin escape por __deferred_retry, y drenaje completo.
9. Repetir con el esquema completo y roles reales de la aplicación después de aprobar 0B; no desactivar RLS ni reemplazar triggers para lograr verde. Repetir contra Edge runtime local cuando arranque, manteniendo simulación externa verificable.

Las 299 caracterizaciones deben conservar su trazabilidad. Las que hoy afirman el defecto de duplicación cambiarían de expectativa solo dentro de una corrección 0C aprobada, con el resultado anterior retenido; no se pueden pedir simultáneamente «ocho envíos como antes» y «un envío» como aserciones de éxito del mismo escenario.

## Archivos futuros y rollback

Posibles archivos productivos, únicamente tras aprobar 0C: `supabase/functions/conversions/index.ts`, `supabase/functions/retry-failed-conversions/index.ts`, helpers de identidad en `conversions/shared.ts` si fuese necesario, y una nueva migración incremental para claims/leases/RPC. Esa migración se creará con `supabase migration new conversion_delivery_claims` después de verificar su ayuda; el timestamp lo generará la CLI, no este plan. No se editará `20260728163000_purchase_event_atomic_claims.sql`.

Tests a ampliar: `scripts/phase0/run-handler-concurrency.mjs`, su runtime y fixtures, tests Deno de identidad y nuevos pgTAP de claims. Evidencia en esta carpeta. Planificar compatibilidad de workers viejos/nuevos y expansión de esquema antes de cualquier despliegue; dos protocolos simultáneos pueden saltarse la exclusión.

Rollback de una prueba local: detener workers, conservar evidencia y descartar únicamente la DB sintética propia. Un futuro rollback productivo no debe borrar registros de idempotencia ni volver a habilitar workers antiguos que ignoren leases mientras haya entregas en vuelo; requiere drenar/pausar el procesamiento y un plan específico aprobado. No hay despliegue productivo autorizado por este apéndice.
