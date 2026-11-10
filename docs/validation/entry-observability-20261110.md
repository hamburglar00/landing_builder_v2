# PREWARM-OBS: contrato y entrega de diagnósticos

Estado al 10/11/2026 19:33 UTC: backend, Builder, clásico, Atrio, Nexo, los cuatro gateways Vercel y Worker Ganamos+ publicados y verificados. La implementación/regresión/publicación de este lote está cerrada; comparar velocidad productiva requiere muestras equivalentes posteriores. API2 y Panel3 continúan locales. El estado por producto, sus releases y las primeras observaciones de ingesta están en [prewarm-obs-checklist-20261110.md](./prewarm-obs-checklist-20261110.md).

## Identificadores y tiempos

- `flow_id` conserva el recorrido hasta 24 horas; `attempt_id` cambia al tocar el CTA y se conserva durante los reintentos de transporte.
- `navigation_id` identifica el documento o una nueva activación desde BFCache. `navigation_elapsed_ms` usa ese reloj; `elapsed_ms` sigue usando el comienzo del recorrido. Una restauración no vuelve a informar DNS/descarga de la navegación anterior.
- `request_id` identifica cada solicitud física; un reintento tiene otro request UUID y conserva el mismo attempt. Los headers internos admiten exclusivamente UUID: `x-entry-flow-id`, `x-entry-attempt-id`, `x-entry-navigation-id`, `x-entry-request-id`. Nunca autorizan operaciones ni cambian una identidad o la deduplicación de negocio.
- `release` sigue siendo la versión de la landing. `component` y `component_release` describen al emisor (`landing`, `gateway`, `chat`). Si falta el SHA de un gateway/chat, queda desconocido; no se usa el de la landing.
- `occurred_at_ms` se usa sólo en memoria para informar una respuesta precalentada que terminó antes de instalar el runtime. No se envían timestamps de ese campo ni URLs, nombres, teléfonos, credenciales o datos bancarios.

## Hitos

`phone_at_click` informa `phone_readiness` (`ready`, `pending`, `failed`, `unknown`). `phone_wait_completed.duration_ms` mide la espera restante desde el clic; cero significa que ya estaba listo. `destination_request` conserva el tiempo total del fetch. `phone_outcome` distingue `ready`, `empty`, `http_error`, `network_error`, `invalid_response`, `legacy_unknown`, `unconfigured`, `timeout`.

Las fases Edge admitidas son `phone_owner`, `phone_plan`, `phone_cache`, `phone_select`, `phone_total`. Los tiempos de padre/hijo o de trabajos paralelos se superponen: no sumar percentiles. Los tiempos ResourceTiming sin request_id son una observación del navegador; para correlación backend se usan los registros con request_id.

`welcome_ready`/`wallet_ready` son resultados lógicos; `welcome_visible`/`wallet_visible` son hitos visuales distintos. `wallet_result` admite `available`, `not_applicable`, `unavailable`, `error`. Que no corresponda una billetera no significa un error del chat. `chat_usable` conserva su comprobación del cliente: interfaz visible y operable.

El pequeño bootstrap temprano se comparte entre T1–T9 y se instala en head antes del prewarm/CSS; la factory completa sigue en el recurso cacheable. El bootstrap y la factory adoptan el mismo contexto, navegación, intento y UUID tempranos. Un envío validado antes de descargar la factory conserva ese intento al adoptarse. La cola temprana propia de T7 delega en el mismo buffer. No se añade otra cola persistida ni se demora Meta.

## Entrega, pestañas y límites

El collector devuelve `200 {accepted:true,event_ids:[...]}` únicamente después de que el RPC confirma persistencia o duplicados del mismo contexto. El cliente elimina sólo esos UUID. `204` vacío, un rechazo, un timeout y `sendBeacon(true)` no son confirmación de persistencia.

Los gateways extraen `diagnostic_proof` de la respuesta validada de `/complete`, lo conservan en sessionStorage de la pestaña y lo adjuntan fuera del batch. Su propósito criptográfico es distinto del handoff/cookie; nunca concede acceso. El getter público del contexto no devuelve proof ni cookies. El ingreso con `ef` valida ese handoff, incluso si otra pestaña cambió la cookie. Sólo los ingresos antiguos sin proof/ef recurren a la cookie compartida; esa compatibilidad no puede reconstruir una pestaña histórica que nunca tuvo contexto propio.

La cola es de 80 eventos y cada batch tiene hasta 20; cuerpo máximo 16 KiB. Cada navegación admite hasta 300 eventos; el servidor acepta hasta 2000 por recorrido/24 h y 3000 por landing/minuto. Un replay del mismo event_id no cuenta otra vez. La retención de 90 días y los roles existentes no cambian.

`telemetry_loss` distingue overflow, invalid_batch, context_mismatch, rate_limited, collector_rejected y delivery_failed. Un rechazo booleano del RPC no demuestra que se agotó un cupo: se registra collector_rejected y HTTP 422 sin consulta adicional. Se limita a un informe por motivo/navegación, no genera informes por el fallo de un informe solo y conserva contadores acotados. Sus cantidades son eventos afectados o incidentes de entrega, no clientes. La propia telemetría sigue siendo best effort: un navegador cerrado/offline puede no entregar su informe de pérdida. `source=unknown` nunca significa tráfico humano confirmado.

## Publicación y reversión

Ya aplicadas las migraciones `20261110163119_entry_funnel_navigation_delivery_observability.sql` de Builder y `20261110163133_nexobet_entry_funnel_observability.sql` de Nexo. Se verificaron las columnas/roles y que anon/authenticated no tienen EXECUTE del RPC. El esquema es aditivo y los batches históricos siguen siendo válidos. Los collectors de Builder/Nexo, los cuatro proxies Vercel, Worker y ambos motores están publicados y verificados. Un emisor nuevo frente a un collector antiguo no borra la cola por un 204; conserva y reintenta de forma acotada. Una reversión de código puede conservar las columnas nuevas; no borrar métricas para volver a una versión anterior.

`landing-phone` v27 también está aplicada: OPTIONS 200 con Max-Age600; GET/POST de validación 400 con no-store. Esto satisface el requisito Edge-first previo al cliente `cache:default`, sin seleccionar un teléfono real ni ejecutar altas. Es reutilización del permiso CORS, no caché HTTP de números asignados. La evidencia privada es `CURSOR/.local/prewarm-obs-20261110/backend-rollout.json`.

En una reversión de frontends se conserva obligatoriamente `Cache-Control:no-store` en todas las respuestas GET/POST de `landing-phone`, incluidos errores. Los runtimes nuevos pueden seguir abiertos o cacheados y usar `fetch cache:default`; no restaurar Edge v26 sin mantener esa política. Revertir UI no exige quitar columnas ni volver a una Edge que permita almacenar una asignación.

Atrio productivo: la revisión inicial `7514116` fue seguida por `bd71604da050f61fb63e2d81a3334c30f1e1a319`, deployment READY `dpl_8vWb6DfC2bA2dALusxp4Z3DNP6Nh`, origen final `https://www.atrio.website`. El ajuste retira un export no permitido en una ruta Next sin cambiar GET/headers/JSON; su hash público coincide con el baseline. Builder `39f2be4` y clásico `fdc90b8` también están publicados; sus 21 comprobaciones estáticas y los cuatro assets de gateways coinciden con los commits. Worker Ganamos+ sirve la release `0504cb3`, con health y asset verificados en sus dos hostnames. Nexo `0eb8d60` está READY en `dpl_AwpMmkyNgBhGkF1Vsws1ZBrcgeTu` y `nexobet.fun`, con runtime exacto, collector anónimo accesible a su validación y cron protegido; el checklist contiene las evidencias completas.

Nexo ya tiene adaptador de ingesta propio para su landing nativa T9, con tablas `nx_entry_funnel_events`/límites y ownership de `nx_landings`/`nx_accounts` en su base. Comparte contrato, bootstrap y emisor mediante `vendor/entry-funnel.json`, que fija hashes SHA256 por fuente y runtime; no escribe en las tablas de Builder. Su único origen de collector adicional admitido es `https://nexobet.fun`. La cobertura nativa no presupone que existan T7/T8 nativos en Nexo.

El proxy de Nexo deja pasar exclusivamente `/api/entry-funnel` sin exigir sesión de cliente; el handler mantiene origen/payload y el RPC mantiene ownership/cuotas. Siete regresiones nuevas recorren ese límite y comprueban que rutas vecinas y de cuenta siguen protegidas. El bloqueo anónimo se detectó y corrigió antes de publicar Nexo; no se abrió un prefijo general de API.

## Verificación local

- Baseline antes de editar: 16 pruebas de contrato/collector/bootstrap aprobadas.
- Contrato/collector/bootstrap/navegación y adopción T7: 28 pruebas aprobadas (reload, BFCache, hora de respuesta temprana, releases separados, ACK parcial/204, beacon, pérdida acotada y envío validado antes de descargar la factory).
- SQL PostgreSQL en memoria: 32 verificaciones aprobadas, incluyendo fronteras 300/2000/3000 y deduplicación sin consumo repetido. Comando: `node --max-old-space-size=384 scripts/test-entry-navigation-database.mjs`, con `PGLITE_MODULE` apuntando a la dependencia instalada. No conecta a producción.
- Reporte SQL de porcentaje/salida: 23 verificaciones en PostgreSQL en memoria, con clics repetidos, readiness tardía, contexto incompleto, documento/release distintos, sin muestra y adaptación a tabla Nexo. Comando: `node --max-old-space-size=384 scripts/test-entry-performance-report.mjs`, con la misma dependencia. El reporte conserva recuentos de CTA y teléfono, intentos únicos, cobertura y excluidos.
- Builder backend: 63 pruebas de start/preparation/skin/trazas aprobadas; renovar preparación actualiza el request UUID del intento. Las suites finales de los cuatro gateways están detalladas abajo.
- Nexo nativo: 17 pruebas aprobadas con seis escenarios de navegador Chromium/WebKit: runtime listo, retenido hasta la salida y liberado durante el POST. Comprueban Pixel/CAPI, un solo intento, correlación, ACK y rechazo de contexto privado/cruzado. No equivalen a la regresión global de Nexo ni a una conexión con API2/proveedor real.
- Nexo global: 37 etapas consolidadas aprobadas, preservando evidencias de los intentos fallidos y revalidando los cambios posteriores al merge; no se presenta como una única invocación completa aprobada. El cierre integrado pasó 84 casos Next/build/HTTPS, ocho de la nueva tarjeta y 20 de PWA. La revisión independiente no halló bloqueos. Fuente exacta y alcance por etapa: `CURSOR/.local/prewarm-obs-20261110/nexo-regression-consolidated-37.json`.

Los reportes de cobertura, teléfono y pérdidas están en `scripts/entry-performance-report.sql`; requieren un rango temporal explícito al usarse operativamente. El reporte por intento usa el primer `phone_at_click`, no suma clics repetidos; muestra total observado, muestra elegible, desconocidos/contextos excluidos y salidas no observadas. Sin muestra, el porcentaje queda NULL; nunca supera 100%. Clic→outbound se calcula con tiempos del mismo recorrido/documento, sin mezclar relojes ni sumar fases. No demuestra apertura de WhatsApp.

Para Nexo se ejecuta por separado contra `public.nx_entry_funnel_events` y se cambia `collector_scope` a `nexo`. Se conserva landing/motor/template/release/environment/source. El esquema no almacena el dominio o alias público: ese desglose histórico no se puede reconstruir. No unir bases ocultando su collector ni presentar `source=unknown` como personas reales.

Si la factory nunca descarga en Nexo, los hitos cliente de cuenta lista/salida pueden faltar. El contexto temprano viaja en POST/handoff y las fases del servidor/gateway mantienen correlación. El alta sigue sin esperar a telemetría. En WebKit interceptado, el fixture rechazó correctamente Origin:null y recuperó la cola por fetch JSON; no se usa ese detalle del fixture para afirmar un comportamiento de Safari productivo.

Primera observación posterior de Edge v27 comunicada por el coordinador: 10/11 16:31:51–16:46:00 UTC, 17 solicitudes correctas; 17/17 con request UUID y fases owner/plan/select; ninguna muestra de cache. Medianas: total 1102,7 ms, owner 403,4 ms, plan 238,1 ms y select 386,9 ms. No se generó tráfico de selección de prueba; tampoco se infiere que sean 17 clientes humanos. Esta muestra confirma emisión, no una mejora frente a otra cohorte; no sumar esas medianas.

El seguimiento de logs 17:03:04–19:02:13 UTC contiene 171 solicitudes `ok` y 125 preflight, todas con request UUID; p50 de ejecución de las correctas 1.278,3 ms. No aparecen otros outcomes en ese corte, sin que ello demuestre ausencia de errores de red o cobertura total. No se generó tráfico de selección para la lectura ni existe baseline equivalente para comparar velocidad. Evidencia: `CURSOR/.local/prewarm-obs-20261110/phone-production-followup.json`.

### Integración final de los motores y proveedores

- Builder: 492 pruebas aprobadas, cero fallos; cuatro escenarios de navegador se ejecutan por separado con su flag. La suite de teléfono reportó 42 aprobaciones, incluidos CORS en Chromium/WebKit.
- Clásico: 47 pruebas aprobadas, cero fallos. Incluye correlación y redacción de errores del fallback `/start`; se conserva su adaptador y el paralelismo original.
- TypeScript completo de ambos motores aprobado sin emisión incremental. Los fixtures que cargan el motor clásico ahora admiten `LANDING_CLASSIC_ROOT` y comprueban el worktree del lote.
- Gateways finales: Rey 550 aprobadas y 11 omitidas por sus condiciones existentes; Ases 475, NET 481 y Multi 517 aprobadas, cero fallos.
- Los sincronizadores de este lote admiten `PRODUCT_WORKTREES_FILE`: mapa completo de ocho productos, rutas absolutas y rechazo de targets ausentes/desconocidos. API2/Panel3 no son targets permitidos. Cuatro pruebas de resolución de rutas aprobadas.
- Worker Multi: tres pruebas aisladas confirman que OpenNext conserva UUID diagnósticos hacia servicios propios, que el relay no los transmite al casino y que no conceden autorización.
- Matriz de HTML y assets generados: 36 escenarios aprobados (T1–T9, constructor/clásico, Chromium/WebKit). Comprueba Pixel/CAPI con el mismo event_id, atribución, deduplicación al repetir, destino publicitario, CTA y telemetría sin identificadores privados; todo el tráfico usa fixtures interceptados.
- El harness de esa matriz captura los JSON de sendBeacon de forma síncrona y conserva su envío nativo. Se retiró la lectura asíncrona Blob.text que producía NotReadableError al destruirse el documento en WebKit; no se omitieron errores ni se relajaron las aserciones del producto.
- Atribución publicitaria: 50 escenarios aprobados entre ambos motores, resolución por ruta/parámetro/automática y los cuatro proveedores. El fixture CORS se alineó con los cuatro encabezados UUID de Edge v27 y usa un número publicitario ficticio. Conserva verificaciones exactas de Contact, atribución aceptada por servidor y una sola preparación.
