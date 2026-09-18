# Contrato propuesto y modelo de amenazas

Estado: **DIFERIDA por decisión voluntaria del usuario**, por prioridad actual y necesidad de cambios coordinados en api2 e intermediarios externos. Fase diseñada y documentada, implementación no iniciada, sin cierre técnico ni remediación. La acreditación anterior del contrato api2 se conserva sin volver a abrir ese repositorio. No se crearon credenciales, código de autenticación ni migración. Kommo y Chatrace están inactivos por confirmación operativa; sus requisitos se aplican antes de una futura reactivación.

**Riesgo aceptado durante la postergación:** conversions sigue aceptando solicitudes externas sin autenticación criptográfica propia. No hay protección HMAC implementada para esos eventos. Todo mecanismo descrito a continuación es propuesto; su aceptación documental no demuestra que opere hoy. Los [requisitos para retomar y cerrar](README.md#requisitos-para-retomar-y-cerrar-técnicamente) incluyen nueva autorización, bindings, contrato del test, versiones, implementación coordinada, tráfico firmado, rechazo estricto y pruebas; este checkpoint sólo registra la decisión de diferir.

## Límite de confianza

Hoy, `name` permite escoger un perfil y ejecutar el handler con service_role. CORS, Origin, Referer, una clave pública o conocer el nombre no prueban identidad. Un JWT válido tampoco autoriza por sí solo otro tenant. Firmar desde un proxy público que acepta destino y payload arbitrarios no resuelve esa autorización.

Se deben separar autenticación del emisor, autorización del tenant/acciones e integridad del transporte. La firma no certifica que un contacto sea humano ni que una compra sea verdadera: esa garantía depende del origen previamente acreditado. No se introduce aquí una política antiabuso o validación de negocio nueva.

| Entrada | Mecanismo propuesto | Restricción |
| --- | --- | --- |
| Panel | JWT de usuario verificado mediante Auth, no simple decode/getSession | C01 pertenece al panel admin: exigir ese rol desde `profiles.role`, protegido desde 1B.1, y un tenant acreditado; nunca user_metadata. No habilitar nuevas acciones de usuarios normales sin consumidor acreditado |
| Servidores internos | HMAC-SHA256 con clave independiente por emisor y entorno | Registro servidor de tenants, acciones y flags internos permitidos; service_role no se distribuye como credencial de emisor |
| api2 activo | HMAC en transporte de PurchaseTrackingService | Manager.ownerId vinculado en servidor a tenant y destino; body intacto, misma política de reintentos; no firmar url_post o URL de prueba sin autorización |
| Landings públicas | `/api/track` mantiene su interfaz y sólo el servidor firma | Resolver/validar tenant, landing y destino exacto con datos servidor; Contact y sus variantes legítimas acreditadas, nunca un firmador genérico |
| Chatrace/Kommo inactivos | Sin credenciales activas; acreditar mecanismo antes de reactivar | No asumir que firman ni habilitar excepción unsigned; mantener pendientes sus contratos de reactivación |
| Emisor desconocido | Rechazar | No implementar el corte mientras el censo activo siga incompleto |

El registro de emisores contiene ID opaco, entorno/audiencia, IDs de tenant autorizados, acciones y flags permitidos, key IDs habilitados y referencia a su clave en configuración servidor. Las claves son independientes entre clásico, constructor, worker de replays, WhatsApp y cada integración externa acreditada; no se reutilizan secretos de cron, revalidación, Meta o service_role. No se proponen valores productivos ni se los registra en documentos.

## Vinculación de origen, tenant, acción y destino

En los dos proxies actuales, `landing_id` y `landing_name` ya viajan dentro del payload Contact. La propuesta es resolver esa landing con datos servidor, comprobar su propietario/nombre contra el tenant y usar exclusivamente el destino del catálogo servidor. El `postUrl` recibido debe coincidir con ese destino y query acreditados; no se usa para elegir dónde enviar credenciales. Se conserva el objeto de negocio sin agregarle campos ni corregir discrepancias silenciosamente. Las filas antiguas sin identificación suficiente quedan como dependencia de contrato: no se descartan, reescriben ni firman a ciegas.

El emisor y key ID están dentro de la cadena firmada. La audiencia debe corresponder uno a uno al destino registrado (entorno, protocolo, host, puerto y ruta), y el receptor acepta únicamente su audiencia configurada. El tenant queda ligado por la query `name` firmada y su correspondencia servidor con un ID autorizado; la acción, landing y flags quedan ligados por el hash de todo el body y la autorización de ese emisor. Así se vinculan los cuatro elementos sin cambiar el payload. Una clave no permite escoger otra audiencia ni otro tenant fuera de su registro.

Para las landings públicas esto acredita al intermediario y limita lo que puede firmar; no autentica a una persona anónima ni demuestra que ocurrió una compra. Origin/Referer, `client_ip_proof` y datos públicos de una landing no sustituyen autorización. El intermediario sólo puede admitir las acciones Contact acreditadas, sin convertir campos `action` conflictivos ni flags internos en eventos válidos.

En Kommo, validar primero una prueba de origen soportada por la integración real y vinculada al raw body si el mecanismo lo permite. No está acreditado que el proveedor emita HMAC: si sólo admite un secreto servidor, debe comprobarse en un transporte seguro y limitarse al emisor/tenant correspondientes, sin confundirlo con integridad firmada. Un registro servidor debe vincular la identidad autenticada a cuenta/canal y tenant; `name`, `account`, `receiver` y `x-amocrm-requestid` recibidos no bastan por sí solos. Si se conserva el query por compatibilidad, comprobar coincidencia y rechazar discrepancias antes del parser funcional/cola/enriquecimiento. No cambiar `clientScope`, dedupe, normalización ni extracción de Purchase. Firmar la salida sólo después de esa validación.

El historial muestra que el secreto de Kommo se comprobaba y luego se retiró. No permite concluir que restaurarlo funcione hoy ni que un header request ID sea auténtico. La ruta de reconciliación cuenta IDs faltantes y no los reencola. No usarla como promesa de recuperación ante un corte de autenticación.

## Contrato y límite de firma de api2

PurchaseTrackingService concentra tres recorridos de negocio y un test administrativo. La URL completa proviene de owner_settings.url_post mediante Manager.ownerId; el test toma una URL del request. El JSON no lleva identidad Supabase ni landing explícita. Por ello el binding autorizado debe existir fuera del JSON: owner de api2 → ID/nombre de tenant receptor → destino/audiencia registrados. La edición autorizada de url_post no concede permiso para otro tenant. El parámetro name debe coincidir con ese binding; no modificar la query ni el body para corregir una discrepancia silenciosamente.

Firmar los bytes exactos que se entregarán a Axios, luego de la construcción funcional actual del objeto. No cambiar Math.round, campos null, códigos promo, normalización, action_event_id o receipt flags. El serializer y Content-Type deben producir el mismo body que la versión actual; comprobarlo con fixtures sintéticos antes de implementar el rollout. El emisor no envía event_id/event_time: mantener su ausencia. timestamp/dateTime del body se crean una vez y permanecen durante el bucle; el timestamp de firma es otro dato, sólo en headers.

Tres intentos y dos pausas posibles de cinco segundos; nuevo nonce/firma en cada intento sin recrear el body. Mantener timeout de negocio sin límite Axios y test de diez segundos, así como criterios actuales de éxito/error. No introducir una cola ni reinterpretar 200/202. Un log persistido no acredita replay: el log LEAD existe antes de saber si el envío fue exitoso, y una invocación posterior sin promo puede omitirse. La pérdida al agotar intentos es un riesgo existente que exige cobertura antes del corte, no autorización para cambiar dedupe.

El error Axios actual incluye configuración/request y podría revelar futuros headers de firma si se registra completo. La futura capa de transporte debe emitir sólo errores sanitizados con código/status/intento; jamás clave, firma, body ni URL completa. No extender la limpieza a logs ajenos al cambio. El test no puede convertirse en firmador de URLs arbitrarias: la sesión/rol ya comprobados deben vincularse además al owner/tenant autorizado.

Los redirects actuales y cualquier URL alternativa necesitan acreditación antes de deshabilitarlos para solicitudes firmadas. Nunca enviar una firma a un destino fuera del catálogo. La futura implementación debe conservar las funcionalidades legítimas de prueba/otros destinos que se acrediten sin distribuir claves al navegador. Este pase no decide bindings productivos ni consulta valores de configuración.

## Protocolo de firma propuesto v1

Método POST. Se firma el body JSON **tal como se enviará**, después de las transformaciones que el emisor actual ya realiza. UTF-8, sin cambiar orden de propiedades, números, espacios, contenido ni campos. El receptor calcula el hash de los bytes recibidos antes de parsear; luego entrega el mismo contenido al flujo actual. Nunca reconstruir JSON para verificar una firma. `event_time` permanece ajeno al timestamp de autenticación.

Headers nuevos para servidores:

- `X-Conv-Version: 1`.
- `X-Conv-Issuer`: identificador ASCII `[a-z0-9-]{1,64}` registrado.
- `X-Conv-Key-Id`: identificador ASCII `[a-z0-9-]{1,64}` de una clave habilitada.
- `X-Conv-Timestamp`: segundos Unix decimales, sin signo ni ceros iniciales.
- `X-Conv-Nonce`: 16 bytes aleatorios criptográficos, representados en 32 caracteres hexadecimales minúsculos.
- `X-Conv-Signature`: `v1=` seguido del HMAC en 64 caracteres hexadecimales minúsculos.

Canonicalización exacta propuesta, en este orden, con LF entre líneas y **un LF final**:

```text
CONVERSIONS-HMAC-V1
<audiencia fija de servidor para este entorno y función>
<X-Conv-Issuer>
<X-Conv-Key-Id>
<X-Conv-Timestamp>
<X-Conv-Nonce>
POST
conversions
<query raw del URL final, sin el signo de interrogación>
<SHA-256 hexadecimal minúsculo de los bytes del body>
```

La audiencia se obtiene de configuración servidor en ambos extremos, no de un header controlado por el cliente. El identificador lógico `conversions` evita depender de reescrituras del path realizadas por el gateway. El sender firma la query de `new URL(destinoFinal).search.slice(1)`; el receptor usa la misma representación del request entrante. La query completa queda firmada, incluido `name`, su codificación y parámetros adicionales. Su preservación por el gateway debe comprobarse localmente antes de congelar el protocolo; no se afirma que haya sido probado. La autorización sigue interpretando `name` según el contrato actual y verifica que corresponda a un tenant permitido.

Los emisores con credenciales sólo usan destinos servidor acreditados: protocolo, hostname, puerto y ruta exactos. No firman el `postUrl` del navegador ni un `post_url` de cola sin validar su procedencia y vinculación. Redirects HTTP deshabilitados en esos envíos. Debe acreditarse antes que ningún consumidor legítimo dependa de redirects o destinos alternativos; sus valores productivos no se consultaron.

HMAC-SHA256 sobre los bytes UTF-8 de la cadena anterior. Validar formato y longitud, decodificar ambos MAC a 32 bytes y comparar con `node:crypto.timingSafeEqual`, disponible también en la compatibilidad Node de Deno. No comparar strings con `===`. No usar búsquedas de claves por URL, algoritmos escogidos por el cliente ni fallback hacia credenciales públicas. Una solicitud con modos de autenticación mezclados o una firma inválida no puede degradarse a otro modo.

## Tiempo, replay y reintentos

Ventana propuesta: `now - 300 <= timestamp <= now + 30` segundos. Nonce nuevo en **cada intento HTTP**, firmado justo antes de enviar; el body, event_id, action_event_id, event_time, orden, timeout y backoff actuales se conservan. Un evento diferido de hace horas usa timestamp de transporte actual, sin rejuvenecer su evento.

Después de validar identidad, firma, tiempo y autorización, consumir `(issuer, nonce)` mediante inserción atómica única en almacenamiento compartido persistente, nunca en memoria de una instancia. La unicidad abarca los key IDs del mismo emisor. Conservarlo al menos diez minutos y hasta después de expirar su ventana válida. No liberar el nonce si falla el negocio; un reintento legítimo obtiene otro nonce y entra a la deduplicación existente sin modificarla.

La futura migración, si se autoriza implementar, crearía sólo el estado de autenticación necesario en un esquema no expuesto, sin grants para PUBLIC/anon/authenticated ni SECURITY DEFINER. El rol backend usaría únicamente los permisos necesarios para reclamar y mantener ese estado. La limpieza debe diseñarse sin modificar cron existente; la expiración temporal ya impide que purgar un nonce viejo reabra una firma válida. El tamaño y mantenimiento del registro se validarían localmente.

Dos requests concurrentes con el mismo nonce: una sola admisión, la otra 409, sin efectos parciales de negocio. Si se pierde la respuesta de una solicitud válida, el siguiente intento legítimo firma un nonce nuevo; la lógica de duplicados actual conserva su decisión y respuesta. No cachear una respuesta funcional inventada para resolver replay ni confundir el nonce con event_id.

## Orden de validación y respuestas

OPTIONS conserva su respuesta actual y no usa service_role. POST pasa primero por validación de credenciales; usuarios mediante Supabase Auth, servidores mediante el registro y firma. Una clave pública/anon o un token decodificado sin verificación no equivalen a sesión. La consulta de rol del panel debe usar su sesión y permisos existentes antes del acceso privilegiado de negocio.

Tras identidad verificada se comprueban tenant, acción y flags. Sólo el worker acreditado podrá enviar `__deferred_retry`, `__inbox_id`, `__backfill_duplicate_action_event_id` y `__source_log_id`; no se agregan, borran ni transforman esos campos en solicitudes legítimas. El estado anti-replay se reclama antes de procesar el evento. Ninguna denegación crea el cliente privilegiado del handler ni llega a su catch que escribe logs mediante service_role. El acceso backend al estado anti-replay sólo ocurre después de la comprobación criptográfica.

| Condición nueva | Respuesta propuesta | Efecto |
| --- | --- | --- |
| Credencial ausente, inválida, expirada, emisor/key ID desconocido o headers ambiguos | 401 con error genérico `unauthorized` | Ningún efecto de negocio; no revelar cuál validación falló |
| Identidad válida sin autorización para tenant/acción/flags | 403, `forbidden` | Ningún efecto de negocio |
| Nonce ya consumido | 409, `replay_detected` | Ningún segundo efecto de negocio |
| Registro/estado de autenticación no disponible | 503, `authentication_unavailable` | Fallar cerrado; no aceptar unsigned |
| Consumidor autorizado | Status, body y headers funcionales actuales | Sin normalización adicional de eventos ni cambios en dedupe/reintentos/contadores |

Los códigos nuevos sólo corresponden a solicitudes no autorizadas o a indisponibilidad de la capa nueva. Los emisores válidos conservan las respuestas de texto del handler; los proxies conservan su JSON actual y estados de cola. No se añade una respuesta JSON que refleje request, headers, firma, clave, token o detalles internos.

Logs de autenticación: código de motivo acotado, ID de emisor acreditado, request ID generado por servidor y duración. Nunca guardar Authorization, apikey, firma, nonce, body, datos personales, query completa ni valores de claves. Los logs funcionales existentes permanecen fuera del cambio; los headers de firma no entran al payload ni a `payload_raw`.

## Rollout, rotación y rollback propuestos

1. Confirmar bindings owner api2/tenant/destino, contrato del test y versiones activas, sin valores secretos. Kommo/Chatrace siguen inactivos y no bloquean por sí solos esta preparación. Resolver los demás emisores activos del constructor/clásico antes del corte global.
2. **Receptor compatible:** preparar y validar localmente verificación JWT/HMAC y estado de replay, con transición explícita para el tráfico unsigned existente. Firma presente pero inválida se rechaza siempre; no permite fallback legacy. Esta etapa no elimina la exposición actual ni declara cerrada la fase.
3. **api2 firmado:** tras autorización separada, incorporar firma/catálogo y errores sanitizados en su transporte conservando body, respuestas, reintentos y condiciones. Credenciales servidor acotadas por emisor/entorno/bindings. Coordinar panel, proxies y Edge activos. No modificar ni activar integraciones inactivas.
4. **Verificación de tráfico → receptor estricto:** en un futuro despliegue autorizado, acreditar versiones e instancias y medir aceptación de firma/legacy/denegaciones mediante métricas sanitizadas. No usar sólo el 2xx como prueba de procesamiento funcional ni reenviar eventos financieros para probar. Confirmar cobertura completa antes de exigir autenticación; fijar cierre explícito de la transición, nunca fallback permanente. No se realizan esas operaciones en este pase.
5. Rotación futura: segundo key ID del mismo emisor, ventana acotada de coexistencia, actualizar emisor y retirar el anterior cuando no pueda quedar un intento firmado válido. Las colas almacenan payload, no firmas de larga duración; cada intento vuelve a firmar. No cambia event_time. El nonce sigue siendo único entre ambas claves. No se ejecutó rotación.
6. Rollback: conservar la puerta de autenticación y volver sólo a una combinación de código/clave previamente validada. En el primer despliegue no hay una versión anterior segura a la que volver automáticamente: detener el rollout y corregir. No habilitar de nuevo el handler público como rollback silencioso; no vaciar ni reescribir colas/eventos.

Coordinación por proyecto, pendiente de bindings y versiones señalados en el README:

- **landing-builder / Next:** C01 requiere sesión y rol admin real; C02/C03 requieren resolver autoridad de firma antes del mismo envío actual. Una pestaña antigua de C01 no adjuntará JWT: confirmar actualización de esa UI antes del corte, sin excepción unsigned para tabs viejas.
- **landing-prueba-1:** actualizar `/api/track`, el emisor compartido y sus reintentos conjuntamente con el constructor. Las páginas cacheadas conservan el payload y llaman al proxy servidor; confirmar que ninguna versión activa use un destino distinto. No se modifica ese repositorio en este pase.
- **api2:** service de tracking, helper/catálogo servidor, pruebas de transporte y autorización del test por owner. No tocar ActionService, callers ni las reglas que generan Lead/Purchase. El checkout tiene cambios preexistentes; sólo se inspeccionó y no puede modificarse con la autorización actual.
- **Intermediario-kommo:** inactivo. Antes de reactivarlo, acreditar origen/tenant, probes y colas y firmar en el cliente compartido; no se incorpora al rollout activo actual.
- **Chatrace:** inactivo. Antes de reactivarlo, acreditar la acción externa; el intermediario sólo cambiaría si se elige un adaptador autenticado. No adelantar Contact a la preparación del link.
- **landing-builder / Edge:** firmar retries y el emisor WhatsApp que realmente esté desplegado; no reemplazar automáticamente el worker histórico por el redirect actual porque cambia el momento/identidad del Contact. Activar la validación estricta de conversions al final, tras confirmar todas las versiones y pendientes. No ejecutar cron ni cambiar su calendario para conseguirlo.

Preparar emisores antes que el receptor estricto conserva compatibilidad con el receptor existente, pero ese intervalo sigue teniendo la exposición actual: debe ser explícito, acotado y no declararse fase cerrada hasta el corte. No se agrega un fallback que acepte firmas inválidas. Si no se puede acreditar cobertura del backlog y de instancias anteriores sin perder eventos o alterar reintentos, el rollout sigue bloqueado.

## Pruebas pendientes, no ejecutadas

- JWT válido del admin legítimo en C01; usuario sin rol requerido, expirado, token anon, metadatos editables y selección de tenant no autorizada rechazados. Agregar otros permisos de panel sólo si aparecen consumidores legítimos acreditados.
- api2 C15-C18: bytes idénticos, ausencia preservada de event_id/event_time, action_event_id/timestamp/dateTime estables dentro de retry, nueva firma/nonce, defaults y timeout conservados, test por owner, URL/tenant falsificados y headers ausentes de errores. No hay una suite existente acreditada de este transporte; la fixture de carga lo reemplaza por un no-op.
- Firma válida e inválida, ausente, truncada, emisor/key ID desconocido, clave revocada, audiencia equivocada, mezcla de modos y timestamps en ambos bordes de ventana.
- Integridad de query y bytes JSON: espacios, Unicode, orden de propiedades, números y campos opcionales; cambio de cualquier byte firmado rechazado, sin alterar el payload legítimo.
- Replay secuencial y concurrente; fallo del almacenamiento; respuesta perdida seguida de retry con nonce nuevo y mismo evento; reloj adelantado, evento diferido y rotación sin cambiar deduplicación funcional.
- Cada recorrido C01–C12 del inventario y los externos que se acrediten; comparación antes/después de status/body, Contact/Lead/Purchase, event_id/event_time, moneda/importe, atribución, flags, secuencia, backoff y contadores.
- Browser público sin claves; tenant/landing/destino arbitrarios, Lead/Purchase o flags internos por proxy público rechazados según el contrato de autorización aprobado; navegación, timing y reserva de teléfonos conservados.
- Claves sintéticas identificables ausentes de bundles cliente, HTML, respuestas y logs; inspeccionar por separado artefactos servidor. Ningún valor real de `.env` se usa como patrón de búsqueda.
- Matriz SQL/pgTAP/Data API del estado anti-replay, una reconstrucción completa, suites afectadas, TypeScript, build, ESLint, auditoría e inventario. No repetir regresiones ajenas.

## Fuentes oficiales consultadas

El [changelog de Supabase](https://supabase.com/changelog) se revisó junto con [Securing Edge Functions](https://supabase.com/docs/guides/functions/auth), [Authorization headers](https://supabase.com/docs/guides/functions/auth-headers), [JWT](https://supabase.com/docs/guides/auth/jwts) y [variables de entorno](https://supabase.com/docs/guides/functions/secrets). La documentación distingue sesión de usuario, API keys y webhooks firmados; desactivar verify_jwt obliga a implementar la comprobación en el handler. No se deduce que una clave publishable autorice operaciones privilegiadas ni se introduce el SDK nuevo como dependencia.

La comparación de MAC se apoya en [Node crypto.timingSafeEqual](https://nodejs.org/api/crypto.html#cryptotimingsafeequala-b) y la [compatibilidad crypto de Deno](https://docs.deno.com/api/node/crypto/). La primitiva no convierte automáticamente el resto del handler en código de tiempo constante; esa propiedad debe revisarse y probarse en el runtime elegido.
