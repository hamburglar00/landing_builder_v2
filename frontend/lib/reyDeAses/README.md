# Template 7: ingreso real

## Manager de cada landing

En Redirección, el editor configura el manager de PBAdmin para cada asesor asignado y casino. Si existe uno solo, se guarda automáticamente; con varios, se elige por nombre de gerencia, Manager ID y tipo y se confirma con **Guardar manager**. Este guardado es inmediato, independiente de la publicación general de la landing.

La relación persistida vive en `advisor_manager_routes` de Atrio. El navegador llama al proxy autenticado `/api/atrio/manager-routes`; este verifica acceso a la landing y propietario/workspace del asesor antes de usar el canal privado a Atrio. No se exponen claves de integración ni se consulta API2 en el ingreso para elegir un manager. Las cuentas existentes conservan su vinculación. El predeterminado del gateway solo aplica a entradas sin landing; no resuelve una landing nueva ambigua.

Publicado junto con Atrio el 16/10/2026 de Argentina. API2 conserva en local el lote acumulado con tres migraciones pendientes; esta selección agrega únicamente `20261017020346_landing_manager_routes.sql` en Atrio. La selección no modifica el flujo del login del proveedor ni certifica una mejora de latencia.

## Carga inicial: primera etapa de optimización

Template 7 entrega el formulario, CSS crítico y runtime en el HTML inicial. No espera a un stylesheet o runtime externos ni a la hidratación de React para aceptar el nombre. El prewarm de asesor comienza antes de descubrir imágenes; el constructor inicia en paralelo su identidad HttpOnly. Si el CTA se toca antes de resolver esa identidad, espera la promesa existente antes de enviar, sin duplicar solicitudes. Los templates 1–6 conservan su renderer y recursos anteriores.

Las imágenes públicas de `landing-images` usan derivados de Supabase Storage: logo en densidades 1x/2x/3x y fondos de 640/1024/1600 px. Se conserva la URL original en la configuración del editor, proporciones y transparencia. La publicación autorizada prepara los derivados con tres descargas simultáneas y un límite total de ocho segundos. Si falla una transformación, la página intenta el original. Las landings ya publicadas reciben este comportamiento cuando se regenera su HTML, sin volver a subir imágenes; no se modifican los límites de subida existentes ni URLs privadas o externas. No requiere migración.

El motor clásico comparte el renderer público generado desde este repositorio, pero conserva `/api/template7/start` y su identidad de dispositivo. Después de cambiar el renderer, desde la raíz de `landing-builder` ejecutar:

```sh
node scripts/build-classic-template7.mjs --write
node scripts/build-classic-template7.mjs
```

El segundo comando verifica paridad con `../landing-prueba-1/lib/template7/shared.cjs`. Ese archivo es código de servidor: no se descarga completo en el navegador. Ambas aplicaciones incluyen una copia local versionada del SDK público de parámetros de Meta.

Validación: `npm test` y `npm run build` en ambos motores; desde `frontend`, `npx tsx scripts/template7-browser-check.ts` prueba los cuatro proveedores en ambos motores con red interceptada, una sola emisión de Contact y el mismo `event_id` de Pixel/CAPI. Desde la raíz, `node scripts/phase0/template7-classic-smoke.mjs` comprueba un build clásico local en el puerto 3093 con sus chunks demorados. Estas pruebas no crean jugadores ni envían conversiones reales.

Esta primera etapa no cambió la creación de cuentas ni el flag de API2. La preparación anticipada y la medición productiva se completaron en la actualización del 17/10 UTC descrita más abajo. Los tiempos de las pruebas con demoras artificiales no son un benchmark de producción.

## Flujo de creación e ingreso

### Reingreso automático — publicado el 16/10/2026

Al abrir una landing normal del Template 7, el navegador consulta `/resume` en el gateway de su proveedor/skin antes de pedir el nombre. La navegación de primer nivel permite validar la cookie HttpOnly `SameSite=Lax`, incluso entre dominios distintos. Con sesión vigente, el gateway continúa por su entrada normal y recupera la cuenta sin llamar a API2, generar otro usuario ni emitir otro Contact. Sin sesión, o con una cookie inválida/vencida, regresa una sola vez al formulario y restaura los parámetros de atribución originales.

Los templates 1–6 y los previews embebidos conservan su comportamiento. Las rutas de demo fueron retiradas el 17/10. Las URLs de retorno aceptadas son `https://mkt.panelbotadmin.com`, `https://landing.panelbotadmin.com` y el `LANDING_BUILDER_ORIGIN` del gateway. Para otros dominios, configurar la misma lista de orígenes públicos separados por coma en `TEMPLATE7_LANDING_ORIGINS` tanto en el motor de landings como en sus gateways. Una landing servida en un origen no habilitado conserva el formulario. El canje no transmite nombres, teléfonos, identificadores de dispositivo ni credenciales al gateway.

El 16/10/2026 se publicó `/resume` en los cuatro gateways y después el constructor y el motor clásico. Ganamos+ se publicó también en su Worker de Cloudflare, que sirve `ganamosnet.global`. Se habilitó `TEMPLATE7_API2_PLAYER_CREATION_ENABLED` en ambos motores y se probó el alta real con el manager 1035 contra API2 vigente. El lote pendiente de API2 conserva una sola migración y permanece local. El acceso directo a la raíz de cada gateway ya recupera la sesión guardada. Evidencia y límites: [publicación del 16/10](../../../docs/release/atrio-template7-20261016/README.md).

Validación local reproducible desde `frontend`: `npx tsx --import ./tests/revalidation-server-loader.mjs --test tests/template7Reentry.test.ts` y `npx tsx scripts/template7-reentry-browser-check.ts`. El navegador ejecuta los handlers y el cifrado reales con cookies sintéticas en 32 escenarios: dos motores, cuatro proveedores y sesión válida, ausente, adulterada o vencida. Toda la red se intercepta; no crea cuentas ni envía conversiones reales. Requiere los cuatro repositorios de gateways como carpetas hermanas.

La landing normal usa `/l/{slug}`. Mientras la persona escribe, `/api/template7/warm` prepara en Atrio su identidad y la relación con el manager seleccionado. El CTA llama a `/api/template7/prepare`, que crea un pase opaco de cinco minutos y redirige inmediatamente a `/prepare` del gateway. Esa pantalla solicita la cuenta por el canal privado. La misma respuesta incluye el usuario y el handoff terminado: el vínculo en Atrio y la emisión del handoff se ejecutan en paralelo después de crear o recuperar la cuenta, sin otra llamada del navegador a `/finalize`. El gateway inicia sesión contra el proveedor e instala su cookie HttpOnly. `Continuar` entra apenas la sesión está lista, también automáticamente y sin espera fija. El chat se carga dentro del casino y su disponibilidad se mide por separado. La creación requiere las credenciales privadas reales de API2; se retiró el flag transitorio de habilitación. Nunca usa credenciales demo por un error de API2. Las mejoras adicionales de idempotencia de API2 siguen pendientes de publicación por el programador.

La actualización del 17/10 UTC precarga los recursos reales de Atrio durante la preparación del gateway y coloca su cliente al comienzo del body del casino. Tres altas reales con el manager 1035 midieron **1,73 s de promedio en API2**, **6,27 s hasta navegar al casino** y **8,88 s hasta el chat utilizable**, estos últimos desde confirmar el nombre. Una recuperación con preparación completada dio 5,48 s hasta el chat; el reingreso con sesión, 1,71–2,15 s. Son muestras pequeñas, sin limitación de red/CPU y con cachés variables. El recorrido todavía no es instantáneo. Evidencia y límites: [medición de rendimiento](../../../docs/release/template7-performance-20261017/README.md#preparación-anticipada-y-medición-de-altas-17-de-octubre-utc). API2 permanece local con **tres migraciones pendientes**, detalladas allí.

### Preparaciones temporales

Atrio persiste la reserva en `gateway_entry_preparations`, accesible solo mediante el canal privado de servidor. Se valida asesor, dispositivo, landing, casino y manager. No crea jugador, cuenta de casino, conversación ni conversión mientras falta el nombre. La reserva conserva los identificadores ante reintentos, vence a los 15 minutos y un cron limpia las vencidas cada cinco minutos. El envío definitivo revalida la asignación: una reserva ausente, vencida o de un manager anterior no bloquea el flujo normal. Las relaciones de cuentas existentes siguen siendo inmutables.

Migraciones aplicadas únicamente en Atrio: `20261017023054_gateway_entry_preparations.sql` y `20261017023104_schedule_gateway_preparation_cleanup.sql`. La limpieza solo elimina reservas; nunca jugadores o chats. La precarga es opcional y no bloquea el formulario ni habilita altas anticipadas. No se implementó todavía un pool de cuentas ni un tiempo fijo para entregar una cuenta precreada.

Desde `frontend`, `node --import tsx scripts/template7-chat-bootstrap-check.ts` verifica el resolver real de Atrio con almacenamiento aislado. `node --import tsx scripts/template7-widget-load-browser-check.ts` ejecuta los cuatro rewriters y clientes reales con un script del casino retenido: el iframe debe empezar a cargar antes de liberarlo. Ambas pruebas excluyen red externa y cuentas reales.

**Paridad obligatoria:** cualquier proveedor, contrato, campo de atribucion o comportamiento nuevo de Template 7 debe implementarse y probarse tanto en este motor constructor como en el motor clasico de `public_landing_bl`. La matriz vigente es `rey_de_ases`, `multi_skin`, `ases_del_norte` y `ganamos_net`; no se considera terminado un cambio si uno de los dos motores queda atrasado.

Desde el 17/10/2026 se retiraron las rutas `/testing`, su runtime, cookies de demo, selección de cuentas compartidas y endpoints `/api/testing/handoffs`. Todos los ingresos usan API2. La RPC compartida de demostración también fue retirada de Atrio, sin eliminar cuentas ni mensajes históricos. Las preparaciones antiguas marcadas como demo se rechazan.

Template 7 persiste dos dimensiones distintas. `target_provider` identifica la plataforma de cuenta (`rey_de_ases`, `multi_skin`, `ases_del_norte` o `ganamos_net`); `skin_code` identifica el sitio visual dentro de Multi Skin (`ganamos_plus` inicialmente). Ganamos NET es un proveedor independiente de Ganamos+ Multi Skin. Ambos valores se obtienen de la configuración guardada, nunca se confía en la selección del navegador. Atrio mantiene una sola relación de cuenta `multi_skin` por jugador, porque las skins comparten credenciales; el gateway usa `skin_code` para elegir origen, PWA y paleta del widget.

El contrato servidor-servidor con internal-chat usa `INTERNAL_CHAT_ORIGIN` e `INTERNAL_CHAT_PLAYER_RESOLVE_KEY`, **no** `INTERNAL_CHAT_GATEWAY_SECRET`. `POST /api/gateway/players/resolve` recibe `advisor_id`, `advisor_slug`, `device_id`, `name`, `landing_id`, `landing_slug`, `atrio_client_id`, `promo_code`, `target_provider` y `source: "landing_builder"`. El servidor obtiene `target_provider` exclusivamente de la configuración persistida y validada de la landing; no acepta la elección del navegador. La respuesta debe incluir y validar `advisor_id`, `advisor_slug`, `player_id`, `device_id`, `created`, `player_provider_account_id`, `target_provider` y `provider_account_created`. `player_id` identifica al jugador por `advisor_id + device_id`; `player_provider_account_id` identifica su relación con un proveedor. El `platform` del dispositivo es un concepto diferente de `target_provider` y no determina esa relación.

El gateway de Rey de Ases confirmó el contrato contextual. `landing-builder` envía juntos `external_user_id=player_id`, `player_provider_account_id` y `target_provider=rey_de_ases` a `POST /api/handoffs`. El gateway conserva esa relación y la incorpora al token firmado del widget para que Atrio abra la conversación específica de la plataforma. Si la relación UUID o el proveedor no coinciden con la respuesta validada de internal-chat, no se llama al gateway.

El handoff también transporta `promo_code` por el canal servidor-servidor. Cada gateway lo conserva dentro de su sesión y lo incorpora como `promoCode` al token firmado del widget. Así Atrio recibe la atribución exacta sin confiar en parámetros editables del navegador; la query y la captura por mensaje se mantienen como compatibilidad.

Después de resolver la cuenta de plataforma, Landing Builder devuelve solo `username` y un pase de continuación opaco, cifrado y autenticado. La contraseña nunca se renderiza ni aparece como campo JSON legible. Al finalizar, `landing-builder` llama en paralelo a `POST /api/gateway/provider-accounts/link` de Atrio y al handoff del gateway. A Atrio solo envía usuario, proveedor y el ID externo opcional; la contraseña viaja exclusivamente por los canales servidor-servidor protegidos. El navegador canjea el handoff same-origin en `/start` con modo de preactivación: el gateway autentica al proveedor, instala la sesión y responde únicamente la URL interna de destino. El vínculo es idempotente y un conflicto de identidad detiene la redirección sin sobrescribir la cuenta existente. El endpoint histórico de finalización completa se conserva para despliegues escalonados de gateways anteriores.

El rate limit requiere aplicar la migración `supabase/migrations/20261008203009_template7_rate_limits.sql` antes de desplegar la aplicación: crea la tabla privada y la RPC `consume_template7_rate_limit`. Configurar `TEMPLATE7_RATE_LIMIT_HMAC_KEY` solo en el servidor; nunca en variables `NEXT_PUBLIC_`. El dominio `landing.panelbotadmin.com` figura en el proyecto como destino del motor clásico, mientras que el constructor publica por defecto en `mkt.panelbotadmin.com/l/{slug}`. La ruta corta funcionará en el dominio clásico solo si ese host se dirige a esta aplicación; aquí no se cambia DNS.

La migración `20261009032101_optimize_template7_start_context.sql` consolida en una sola transacción la validación de landing y plan, los tres límites durables y la asignación exacta del asesor. La función usa `SECURITY INVOKER` y solo `service_role` puede ejecutarla. Template 7 inicia en `<head>` y en paralelo la cookie de identidad y la selección del asesor, antes del CTA. Vercel ejecuta este proyecto en Portland (`pdx1`), junto a su Supabase de Oregon. Las duraciones de contexto, Atrio, API2 y handoff se registran sin datos personales ni secretos.

La copia local del directorio Atrio se actualiza por dos caminos: un webhook inmediato al editar un asesor y la Edge Function `sync-atrio-directory`, ejecutada cada cinco minutos como reconciliación. Solo sincroniza `id`, nombre visible, slug, estado y revisión, y actualiza exclusivamente clientes Atrio ya vinculados a un owner de Landing Builder. `landing-atrio` resuelve plan, landing y asignación con una única RPC local. Configurar `ATRIO_DIRECTORY_ORIGIN` y la misma `ATRIO_DIRECTORY_SYNC_KEY` privada de Atrio; nunca exponerlas al cliente.

### Acuerdo de publicacion y pendiente de API2 (2026-10-16)

El usuario decide avanzar con Landing Builder, Atrio y los gateways necesarios
usando el endpoint de creacion de jugadores que ya esta desplegado en API2.
La primera prueba completa sera con Rey de Ases y el asesor vinculado al manager
real **1035**: nombre en Template 7, alta, login, chat y operaciones del inbox.
Las pruebas manuales y las verificaciones del agente deben distinguir los
resultados contra API2 vigente de las pruebas aisladas del codigo nuevo local.

**Recordatorio pendiente, sin bloquear esta etapa:** conservar todas las
correcciones de API2 en local para una sola entrega al programador. Por ahora hay
una unica migracion nueva preparada:
`20261016000001_create_atrio_player_provisions`. El programador debe aplicarla
antes de desplegar el nuevo codigo de API2. Las correcciones de recuperacion de
altas y concurrencia permanecen pendientes en produccion hasta esa entrega.
Los problemas nuevos atribuibles a API2 se reproducen y resuelven localmente y
se agregan al mismo lote; no se publica API2 ni se ejecuta su migracion en esta
etapa. El ajuste de `operation_type` se publica desde Atrio.

Para la prueba real, verificar la asignacion del asesor por UUID, la conexion
privada entre servicios y la configuracion global de PBAdmin; habilitar las
altas en el motor elegido y `PBADMIN_PLAYER_OPERATIONS_ENABLED` en Atrio como
parte del despliegue de nuestros componentes. El chat debe quedar vinculado a la
cuenta creada. Los cambios de Panel3 que dependen de validaciones nuevas de API2
se coordinan con la entrega de ese backend.

Los dos adaptadores de alta pública envían el UUID de Atrio como `external_user_id` a API2 y guardan ese mismo valor como `provider_external_account_id` al vincular la cuenta. El inbox necesita ese vínculo para consultar saldo y habilitar las operaciones. El motor clásico ya llama al endpoint real; con el flag de altas activo, su allowlist histórica de demostración no sustituye una solicitud pública por credenciales demo. El flag apagado conserva el comportamiento anterior de la demo.

### Prueba integrada local de alta y recuperación

Desde `frontend`, con las dependencias instaladas en los checkouts de `internal-chat`, `landing-autologuin` y API2:

```sh
npx tsx scripts/template7-local-flow-check.ts --api2-repo /ruta/al/checkout/api2
```

Levanta cinco servidores HTTP en loopback. Ejecuta los handlers y adaptadores reales de preparación/finalización del constructor, la resolución de identidad de Atrio, el método `apiExternalPlayerCreate` y su middleware/validadores/serializador de API2, y los handlers, cifrado y proxy del gateway Rey de Ases. Los repositorios Atrio y gateway deben estar al lado de `landing-builder`; API2 se indica explícitamente. No inicia Adonis ni Next, no lee archivos de entorno, bloquea `fetch` fuera de los servidores de prueba y usa únicamente claves, jugadores y un manager MKT ficticios. El ID 1035 de la fixture no consulta ni modifica el manager real.

Los repositorios de datos, las RPC de Supabase y el casino se sustituyen por almacenamiento y servicios de prueba en memoria. El cliente real de creación del casino queda excluido; el login del gateway sí procesa respuestas y cookies del casino simulado mediante su implementación real. Esta prueba no certifica las migraciones, los permisos, las transacciones de PostgreSQL/MySQL, la interfaz del navegador ni la integración con el proveedor real. La prueba de navegador indicada arriba cubre por separado ambos motores y los cuatro proveedores.

Resultado local del 16/10/2026, después de corregir API2: **13 de 13 escenarios correctos**. Pasan el alta e ingreso, la identidad del widget validada por Atrio, el reingreso por landing y raíz del gateway, la recuperación de la misma cuenta al emitir otra preparación, los cortes de respuesta posteriores a Atrio/API2/vínculo/handoff, el reintento del login y los rechazos de tokens/autenticación inválidos o vencidos. Una sesión ausente, inválida o vencida vuelve a la landing sin crear otra cuenta.

| Escenario corregido en API2 | Resultado actual |
| --- | --- |
| `retry-after-player-write` | El reintento completa el guardado con las credenciales originales; una sola cuenta externa. |
| `retry-after-credential-write` | El reintento recupera las credenciales cifradas y completa el alta sin otra llamada al casino. |
| `concurrent-account-requests` | La reserva única y la transición condicional permiten una sola creación externa. |

El script devuelve código 1 si falla cualquiera de las invariantes; no omite ni marca como aprobados defectos conocidos. API2 ahora persiste la intención y sus credenciales cifradas antes del efecto externo; solo una transición `reserved -> creating` permite crear la cuenta. Las altas confirmadas pueden completar sus escrituras locales después de una interrupción. Una respuesta ambigua del proveedor conserva la intención pendiente de reconciliación y no habilita otra creación automática. La factory y el cifrado reales de API2 se ejecutan con una clave sintética; únicamente su repositorio se sustituye por la fixture.

Desde API2, `npm run test:atrio-provision` agrega 28 pruebas aisladas de recuperación, concurrencia, contextos y cifrado. `npm run test:atrio-provision:mysql` agrega **11 pruebas correctas en MySQL 8.4.11 real y descartable**, incluyendo la migración UP/DOWN y 20 solicitudes simultáneas. El cambio requiere `20261016000001_create_atrio_player_provisions`, probada únicamente en esa base local; **no se aplicó a producción**.

El 16/10/2026 también se verificó el proveedor real con la gerencia operativa del manager **1035**: una sola cuenta de prueba, recuperación tras ambos fallos de escritura en MySQL local y desde procesos nuevos, replay sin otra creación e inicio de sesión mediante el cliente real del gateway. El saldo inicial fue cero; no se ejecutaron cargas ni retiros. La configuración y metadata productivas se consultaron solo con transacciones de lectura; los datos de recuperación de la cuenta quedan cifrados en un journal local privado de API2. La prueba no crea identidades en Atrio ni sesiones persistentes de gateway en producción. La evidencia sin secretos está en `api2/docs/validation/atrio-player-provision-2026-10-16.json`. No se hicieron commits, pushes ni despliegues.
