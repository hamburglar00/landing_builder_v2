# Publicación de Atrio y Template 7 — 16/10/2026

Actualización posterior a la prueba original: el usuario cargó 1.000 a
`prueba5584`. Las fichas se acreditaron, pero API2 no guardó el resultado y dejó
la operación 1 en `processing`. Se reprodujo y corrigió localmente el error de
serialización JSON con MySQL/Lucid reales; lo debe publicar el programador y
conciliar el registro histórico. No requiere otra migración. Atrio publicó por
separado el formato de miles y mensajes de resultado no confirmado en
`dpl_7nvLyZt9GNEbLEMK16tQvfHujaUe`. La comprobación productiva posterior mostró
saldo `$1.000`, carga `10.000` y retiro `1.000`; no se confirmaron otros movimientos.
El registro siguiente conserva el estado de la prueba original, anterior a esa
carga manual. Evidencia del incidente en
`internal-chat/docs/validation/atrio-player-operations-formatting-2026-10-16.json`
y `api2/docs/validation/atrio-player-operation-2026-10-16.json`.

Landing Builder, el motor clásico, Atrio y los cuatro gateways están publicados.
Se usa el endpoint que ya estaba en producción en API2. El lote nuevo de API2
permanece local y no se ejecutó su migración. Los cambios de Panel3 que requieren
ese backend siguen diferidos.

La publicación se hizo desde snapshots de los cambios locales mediante Vercel
CLI. Ganamos+ también requirió publicar el Worker de Cloudflare de su dominio
real. Se verificó que los siete dominios de Vercel resuelven a los deployments
esperados y están `READY`. No se hicieron commits ni pushes; las ramas locales
conservan los cambios. Los IDs, bases Git y hashes de manifiestos están en
[production-validation.json](production-validation.json). Los snapshots y
baselines se conservan en `.vercel/release-20261016`, ignorado por Git. Las
actualizaciones documentales posteriores no cambian el código publicado.

## Prueba real con el manager 1035

Se verificaron la vinculación con Gera y la gerencia operativa real de Rey de
Ases. Se corrigió la asignación de la landing al cliente Atrio vigente del mismo
owner y moneda; la referencia anterior correspondía a un cliente retirado y no
tenía asignación activa.

- El constructor creó una sola cuenta real, `prueba5584`, y el gateway confirmó
  la sesión mediante la API real del casino.
- Volver a la landing con esa sesión ingresó automáticamente.
- El endpoint clásico recuperó esa misma cuenta y completó el login. Los
  reintentos del ensayo reutilizaron el dispositivo y la cuenta existentes.
- Atrio vinculó el ID externo, el jugador, la cuenta y el chat. El mensaje del
  cliente quedó guardado y PBAdmin respondió `202` al webhook.
- **Consultar saldo** del inbox devolvió **$0** desde el proveedor real.
  **Cargar** y **Retirar** abrieron sus formularios y se cancelaron; no se
  confirmaron movimientos de fichas.
- Configuración mostró el UUID completo, botones de copiar y el token oculto.
  Mostrar y ocultar revelaron y volvieron a enmascarar el token existente. No se
  regeneró ni se modificó el token del manager.
- El webhook autenticado insertó una respuesta que apareció en tiempo real en
  el widget. El reenvío con la misma clave conservó un solo mensaje.
- `/resume` devolvió al formulario sin sesión en los cuatro gateways, incluido
  Ganamos+ en Cloudflare y Multi Skin en Vercel, con `private, no-store` y sin
  referrer.

La sesión temporal del asesor se revocó al terminar y se cerraron los navegadores
descartables. La evidencia no contiene tokens, cookies ni contraseñas. Los 13
escenarios integrados de API2 y MySQL descartable son otra validación local;
sus correcciones de recuperación/concurrencia siguen pendientes en producción.

## Cambios necesarios detectados al publicar

Ambos motores conservan `external_user_id` como `provider_external_account_id`
al vincular la cuenta con Atrio; el inbox necesita ese valor para operar. El
motor clásico tenía un adaptador público que respondía `integration_pending`:
ahora consume API2 con autenticación servidor a servidor, timeout, validación de
plataforma y rechazo de respuestas incompletas. Con el flag público activo, su
allowlist histórica de demo no sustituye el alta real.

Validación dirigida del constructor: 28 pruebas, 13 escenarios integrados locales,
TypeScript y ESLint de los archivos modificados correctos. Motor clásico: 38
pruebas y TypeScript correctos. Los siete builds de Vercel y el build OpenNext
terminaron correctamente. Las suites de gateways pasaron: Rey 118 con dos pruebas
SQL optativas omitidas, Multi Skin 73, Ases 69 y Ganamos NET 74.

## Prueba manual y límites

Abrir [Template 7 del constructor](https://mkt.panelbotadmin.com/l/rey-de-ases-demo)
en un navegador sin sesión, escribir un nombre y continuar. El slug contiene
`demo`, pero esta ruta normal realiza el alta real. `/testing` conserva el modo
de demostración. También está disponible la
[landing clásica](https://landing.panelbotadmin.com/rey-de-ases-demo).

En [Atrio](https://www.atrio.website/dashboard), entrar como Gera y buscar el
usuario de casino: el inbox prioriza ese usuario sobre el nombre del formulario.
La cuenta del ensayo figura como `prueba5584`.

Los botones de carga y retiro actúan sobre fichas reales al confirmar. Esta
entrega verificó apertura/cancelación; las mutaciones reales y el circuito bancario
de Full Carga no forman parte del resultado acreditado. Tampoco se probaron altas
reales de los otros tres proveedores.

Meta Pixel/CAPI no está certificado por este ensayo: se bloquearon los envíos
del navegador para no producir conversiones de prueba. El LEAD del chat con un
`promo_code` manual de QA recibió `422` por validación de identificadores del
cliente receptor. No afecta el resultado de login, PBAdmin ni saldo; la aceptación
de atribución de un anuncio real requiere su propio ensayo.

## Recordatorio para la entrega de API2

Conservar las correcciones en `fix/atrio-bot-form` y agregar allí los problemas
nuevos que correspondan a API2. El programador debe publicar ese lote y aplicar
las **dos migraciones nuevas** del lote actual:

1. `20261016000001_create_atrio_player_provisions`.
2. `20261016000002_create_atrio_confirmed_load_notifications`.

No se desplegó API2, no se aplicaron esas migraciones y no se modificó su entorno.
Al actualizarlo, coordinar los cambios diferidos de Panel3.

## Cargas confirmadas y origen de conversiones

Publicado el 16/10/2026 en Atrio y en la función `conversions` del constructor.
La interfaz del constructor no necesitó otra publicación para este cambio.

Atrio suma únicamente cargas manuales o Full Carga confirmadas por API2. El
acumulado y el evento PURCHASE pendiente se guardan juntos y cada operación
participa una sola vez. Un fallo de tracking conserva el importe y reintenta el
mismo evento; no ejecuta otra carga. Los retiros no descuentan del acumulado.
La IA conserva la extracción informativa del comprobante, sin sumar importes ni
enviar PURCHASE. No se incorporan comprobantes históricos como cargas.

LEAD y PURCHASE envían el UUID real del asesor en `atrio_id` y el del jugador en
`players_id`; el ID del directorio del constructor queda en `atrio_client_id`.
El payload identifica a Atrio como emisor con `emitter_platform`. El receptor
conserva `source_platform` de la adquisición original: si el recorrido empezó
en Template 7, continúa como `landing` aunque Atrio envíe los eventos posteriores.
Esto también se aplica a las compras repetidas.

API2 mantiene en local una cola durable de confirmaciones. Captura la conversación
original para distinguir las cuentas de un mismo jugador en varias plataformas.
Atrio consulta una prueba de la operación usando las credenciales globales; el
token visible al asesor no permite inventar cargas. La respuesta manual y el
callback de API2 deduplican la misma operación.

El programador debe aplicar las dos migraciones indicadas arriba y publicar el
lote de API2 antes de validar Full Carga en producción. También sigue pendiente
su corrección de serialización JSON. La operación manual histórica 1 del manager
1035 permanece en `processing`; sus 1.000 fichas acreditadas requieren conciliación
contra el movimiento del proveedor. No se repite ni se marca como exitosa a partir
del saldo, y no se agregó automáticamente al acumulado nuevo.

Ver [confirmed-loads-validation.json](confirmed-loads-validation.json) para las
versiones publicadas y las pruebas. Pasaron 17 escenarios nuevos, 58 de regresión
del inbox, 12 verificaciones con Postgres, nueve con MySQL, ocho del flujo automático,
20 pruebas unitarias de Atrio, 55 del receptor, cinco del recorrido HTTP completo
del constructor y 20 controles de interfaz en producción. Las pruebas financieras
usaron proveedores de prueba locales; no se movieron fichas ni se generaron
conversiones reales en Meta durante esta entrega. El ensayo real de un anuncio
y su confirmación en Meta sigue pendiente.

## Ampliacion de los JSON LEAD y PURCHASE

Atrio envia los datos disponibles del cliente (telefono, email y usuario real
de casino), asesor/jugador, promo completa con prefijo/sufijo y contexto de
manager/gerencia operativa. Incluye `action_event_id`, `timestamp` en milisegundos
y `dateTime` UTC. No incluye telefono de bot.

PURCHASE completa nombre del remitente, clasificacion del comprobante y
referencias bancarias con la IA de Atrio y/o el snapshot de API2. La asociacion
usa la conversacion original y evita elegir entre varios comprobantes posibles
o reutilizar el mismo. Si el analisis termina despues de confirmar la carga,
vuelve a intentar el envio; no agrega otra carga. El payload preparado queda
fijo para reintentos. La referencia interna se separa en `pbadmin_transaction_id`,
sin ocupar `transaction_id`, reservado al dato bancario.

El constructor ya soporta estos campos: el ensayo local verifico la persistencia
del JSON, los datos del remitente en `user_data` con hash y la deduplicacion.
Se conserva el origen de adquisicion de Landing. No fue necesario volver a
publicar la funcion del constructor para esta ampliacion.

La parte de API2 sigue local. Se amplio su segunda migracion pendiente para
conservar `tracking_data`; siguen siendo DOS migraciones de API2. Los nuevos
campos que dependen de ese backend pueden quedar null hasta que lo publique
el programador. No se modifico ni concilio la operacion historica 1.

Evidencia: [tracking-payload-validation.json](tracking-payload-validation.json).
