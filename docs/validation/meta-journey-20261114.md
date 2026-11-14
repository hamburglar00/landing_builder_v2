# Recorrido interno y Meta — 14/11/2026

## Estado

Publicación autorizada por Leo y realizada el 14/11. Las migraciones, funciones y despliegues productivos se detallan abajo. No se generaron eventos de prueba a Meta, replays históricos ni operaciones financieras. El checkpoint previo verificado está en `C:/Users/Leo/Desktop/V2/CURSOR/.checkpoints/meta-journey-20261114-154737` (8 repositorios, 58 artefactos verificados por SHA256). Una comparación posterior de los ocho HEAD, parches del índice/working tree y bytes de archivos nuevos confirmó que el trabajo original seguía intacto (34 verificaciones).

| Producto | Base aislada | Alcance |
| --- | --- | --- |
| Builder | `4175972087e4427cb7edba87eaa33bdc0e9cf1d3` | Receptor CAPI, clasificación de origen, hitos internos, estadísticas/tabla/exportación, configuración de píxeles y cola HTTP |
| Clásico | `f253160d8d078834a409832b3453c32cb1bb22ac` | Verificación del mismo receptor/captura; runtime/SDK sin cambios |
| Atrio | `614196db210e7acb1527801a9e8b77b12660dee1` | Outbox de primer mensaje humano, HMAC, transporte y cron independientes |
| NexoBet | `7a07e16f4f78216ee5e0039c5539e3685d28c456` | Adaptadores propios y copia selectiva de estadísticas; datos y servicios independientes |
| Rey/Ases/NET/Ganamos+ | Checkpoint por repositorio | Contratos de ingreso y widget compartido; no se alteran SDK ni Worker |

## Compatibilidad y datos

Los campos públicos `contact_*`, `lead_*`, `registration_*` y `purchase_*` conservan entregas e identidades existentes. Nuevos campos internos de la conversión identifican CTA, mensaje y compra. La proyección histórica excluye el CTA publicitario de los mensajes; no hace backfill masivo ni reenvía eventos aceptados. Un cambio de estado CAPI no transforma un CTA histórico sin instrumentación en un recorrido con cero mensajes confirmado. IDs históricos conocidos sin fecha propia se conservan al registrar un mensaje nuevo, con su fallback anterior de fecha de creación; no se inventa una fecha ni se elimina la compra del total.

Origen publicitario y selección de píxel son decisiones distintas. La evidencia guarda método, parámetros concretos, valores, fecha original y conversión fuente. El clasificador rechaza UTM genérica, FBP aislado, flags declarados por el emisor y FBC vencido/inconsistente; conserva las convenciones secundarias de CTWA/Chatrace identificadas por su método. Una adquisición identificada como desconocida no se reclasifica por una cookie posterior de otro clic. Quitar la configuración de un píxel capturado no habilita desviar el recorrido hacia otro. Las preferencias anteriores de cada píxel se mantienen.

Atrio firma únicamente `INTERNAL_CONVERSATION_STARTED`; requiere clave dedicada `BUILDER_INTERNAL_EVENTS_SECRET` allí y `ATRIO_INTERNAL_EVENTS_SECRET` en Builder. No usar/copiar service-role entre productos. El receptor comprueba además el propietario del asesor en el directorio: una firma válida no autoriza otra cuenta elegida por URL. Confirma sólo persistencia o duplicado comprobado, incluidos cambios concurrentes de identidad. No está conectado al sender de Meta. Nexo utiliza su propio registro interno.

La elegibilidad temporal de CAPI se evalúa por evento: una adquisición posterior a una compra demorada no puede suministrarle píxel, incluso si la compra derivada ya no contiene `contact_*`. Se conserva la evidencia original del CTA y la fecha/monto de la compra; no se cambia el matching financiero ni se inventa otra campaña. La tolerancia de reloj es cinco minutos y los registros sin fecha comprobable conservan compatibilidad.

## Verificación completada

| Área | Resultado |
| --- | --- |
| Backend Builder | 151 pruebas Deno, receptor y retry con typecheck correcto |
| Recorrido completo | 20 escenarios de handlers reales con DB/HTTP simulados: T7/T8/T9, ambos eventos CTA, switches independientes, WA, firma, primer mensaje y compras |
| Purchase | 8 admisión duradera, 49 ingestión/retry, 8 entrega diferida, 24 URL/píxel/cronología y 10 fechas originales; cero solicitudes reales |
| Migración de hitos | SQL PGlite: recibos Meta intactos, humano separado del CTA, histórico sin fecha/medición conservado, defaults y privilegios |
| Cola HTTP | 8 pruebas SQL de leases/recuperación y 6 de transporte/recibos |
| Frontend Builder | 50 pruebas de estadísticas, rangos, funnel, tabla, altas, históricos y exportación; TypeScript correcto |
| Atrio | SQL/transporte, regresiones de origen/ingreso de cuatro proveedores, TypeScript y ESLint correctos; presupuesto de reintentos y finalización protegida por lease PostgreSQL |
| NexoBet | 49 pruebas de adaptadores aprobadas y 1 omisión preexistente; 2 compartidas; 15 SQL (incluyen compra anterior al CTA y retry inmutable); TypeScript y pins compartidos correctos |
| Gateways | 16 comprobaciones de contratos; cuatro SDK idénticos, SHA256 `a878b2c423f42bdee414265dd567e1e71cab6bdddf95db6b01a93ad3fad5e687` |
| Motores de landing | Los cuatro runtimes T7/T8 coinciden byte a byte entre Builder y Clásico; SDK oficial 1.3.1 idéntico, SHA256 `9f11e6cfc737d685de93b0a54722e9524c8de86be716b015d763af7794ce7085` |

Los labels de proveedores en fixtures ejercitan handlers compartidos, no sus APIs reales. PGlite ejecuta SQL PostgreSQL en un motor aislado, no certifica contención entre procesos independientes.

## Revisiones locales y publicación

| Producto | Commit de implementación | Push | Migración/despliegue |
| --- | --- | --- | --- |
| Builder | `bf4d1ad9d306a47420846dde9aaffe8ae23f623b`, documentación `fe0ba37f` | `main` | Migraciones `20261114185112` y `20261114185220`; funciones `conversions` v180 y `retry-failed-conversions` v56; Vercel `dpl_Bax1LyjYHfUGBngkG1nqT1gXJUcj` READY en `constructor.panelbotadmin.com` y `mkt.panelbotadmin.com` |
| Atrio | `ddd68e88685c7ba8c88b65a15b09f142d8ecf93b` y `99bc678dae6d4c210736da40c9a8ae25746124d7` | `fix/internal-conversation-journey-20261114` | Migración `20261114185254`; Vercel `dpl_FE14F15Q2DGV2Q33f2MpmPkfRm3x` READY en `atrio.website` y `www.atrio.website` |
| NexoBet | `4c777e1388551265f3a64ea8fc0b48d18b89756f` | `fix/meta-journey-20261114` | Migración `20261114190148`; Vercel `dpl_DxdwBKcATPscDDn52ZcrFwaDC1QR` READY en `nexobet.fun` |
| Clásico | Sin cambios de fuente; receptor compartido de Builder | No requiere nuevo push | Backend Builder actualizado |
| Cuatro gateways/Worker | Sin cambios de fuente; contratos/SDK verificados | No requiere nuevo push | Consumen la medición del backend Atrio/Nexo actualizado |

Worktrees: `../landing-builder-meta-journey`, `../internal-chat-meta-journey` y `../NexoBet-meta-journey`. Los nueve pins de estadísticas Nexo y el clasificador apuntan al commit de código Builder; las 51 fuentes ajenas a este lote conservan sus revisiones previas. No hay fuentes compartidas marcadas como working tree pendiente. La clave dedicada fue configurada en Supabase Builder y Vercel Atrio. Las compilaciones Preview y de producción quedaron READY; las rutas `/login` responden 200 y el cron de Atrio sin autenticación responde 401, con programación cada cinco minutos. Al comprobar por primera vez las outboxes nuevas estaban vacías: todavía no se ha confirmado un recorrido natural completo posterior al despliegue.

## Orden de publicación y reversión

Orden ejecutado: migraciones Builder, receptor/retry, `main` y frontend Builder; migración y despliegue Atrio; migración y despliegue Nexo. Se verificaron dominios y cron. Trabajos viejos en processing requieren revisión, no replay manual. Seguir observando outboxes y acuses naturales sin generar conversiones de negocio como prueba.

Revertir código por producto a sus revisiones previas conservando columnas, outboxes, recibos e identidades. Desactivar transporte interno si hace falta; no borrar eventos ni reenviar los aceptados. La clasificación futura y los defaults tienen que revertirse expresamente si se revierte esa política. Los archivos originales con cambios del usuario permanecen intactos.

## Límites y trabajo separado

- NexoBet conserva deliberadamente la identidad existente por `landing_id, device_id`; el usuario acuerda separar su rediseño del lote actual. Las campañas sucesivas del mismo navegador requieren ese trabajo independiente, sin cambiar aquí la identidad del gateway.
- Limitación anterior en altas de cuenta confirmadas: un alta dentro del período con CTA anterior puede faltar si la conversión no tiene otro hito en rango, porque primero se consultan conversiones y después se adjuntan `conversion_account_registrations`. No afecta la recuperación por fechas de CTA, mensajes, primera compra ni recompra de este contrato. Su corrección requiere recuperar claves exactas propietario/landing/promo desde las altas paginadas, conservando RLS, límites y ocultos; queda como tarea separada.
- No se certificó concurrencia entre sesiones independientes de PostgreSQL: las pruebas de locks y fencing se ejecutaron con PGlite. No hubo pruebas con publicidad real ni mensajes/compras de producción.
- El disco local quedó sin espacio durante la validación. Los builds completos se ejecutaron posteriormente en Vercel y quedaron READY. La limpieza propuesta de caché npm fue rechazada por revisión automática y no se realizó. La evidencia visual móvil/escritorio de Nexo precede a los últimos ajustes de datos de la tabla; no se presenta como nueva prueba visual posterior.
