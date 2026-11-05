# Gateway por gerencia — 04/11/2026

Estado al 05/11/2026: publicación autorizada de Rey, Ases del Norte, Ganamos NET, Ganamos+ y Atrio; migración Atrio aplicada. API2 permanece local en `feature/atrio-integration`; su responsable realiza la activación. Hasta actualizar API2, los enlaces por gerencia muestran «Enlace no disponible». Las pruebas no crean cuentas reales ni ejecutan operaciones monetarias.

## Publicación verificada — 05/11/2026

| Proyecto | Commit de aplicación | Despliegue Vercel listo y promovido | Acceso público |
| --- | --- | --- | --- |
| Landing Builder | `89f4e4f` | `dpl_72ctTiaRe1mR89ShwW19eu5ySK8K` | https://mkt.panelbotadmin.com/login |
| Atrio | `b99c7f1` | `dpl_DESjiEstwQ999tceTK3RsYNQy4SF` | https://www.atrio.website/login |
| Rey de Ases | `b1f1ef4` | `dpl_9s2dGjYRCPh8VsYjGqcJ7ZM3vvGq` | https://www.reydeases.fun/casino/list/home |
| Ases del Norte | `f9276c7` | `dpl_GbahH6AYkYjHCNAjYJkJxCGCEcrF` | https://www.asesdelnorte.online/jugadores/home.php |
| Ganamos NET | `14735a1` | `dpl_HHAEEi1ERj96tuWxeg2bmF3pgUzU` | https://www.ganamosnet.icu/home |
| Ganamos+ | `a48dbd3` | `dpl_RQhRjybU8vnPDeyTzMBbDvJt6fbk` | https://ganamosnet.global/home |

Ganamos+ también quedó publicado en Cloudflare, Worker `multi-skin-gateway`, versión `1cde6922-84fe-4ac5-87bd-547725c14de7`, para su dominio público y `multi-skin-gateway.meta-ip-collector.workers.dev`.

Se corrigió una incompatibilidad real encontrada en la comprobación pública: Workers no admite `redirect: "error"`. Ambos puentes de ingreso usan `manual` y rechazan las respuestas 3xx sin seguirlas ni reenviar secretos. La corrección y sus pruebas están sincronizadas en los cuatro gateways: 52 pruebas de ingreso/gerencia/rutas por proyecto, más 6 de codificación de consultas del bundle Cloudflare. [Contrato de Request en Workers](https://developers.cloudflare.com/workers/runtime-apis/request/).

La primera compilación Cloudflare incorporó el entorno local; se retiró esa versión y se recompiló desde el archivo limpio del commit. La versión final no contiene valores en `next-env.mjs` de producción y usa únicamente los bindings del Worker, conservados con `--keep-vars`. Para futuros despliegues: extraer `git archive` excluyendo `.env*` y `.dev.vars*`, compilar allí, comprobar que el objeto `production` del manifiesto de entorno está vacío y después desplegar. No publicar directamente una compilación creada con archivos de entorno locales.

Comprobación pública en Chromium a 390 y 1365 px: los cuatro formularios muestran el logo transparente cargado a 220 × 110 px, sin desbordamiento horizontal ni errores de JavaScript. Los health checks responden 200. `/17` devuelve 404 con «Enlace no disponible» y sin formulario en los cuatro, porque API2 conserva su versión anterior. El 401 HTTP del login genérico sin sesión es su contrato existente; la página HTML se muestra correctamente. No se probó un ingreso con credenciales reales ni se crearon jugadores.

Builder y Atrio: login nativo HTTP 200; acceso PBAdmin oculto y `/api/pbadmin/start` HTTP 503 por bandera apagada. La función `create-client` versión 38 rechaza una petición sin autorización con 401. [Resultados públicos](production-results-20261105.json), [Ganamos NET escritorio](production-net-1365.png) y [Ganamos+ móvil](production-plus-390.png).

API2 permanece en `c09680b3` con sus cambios locales; Panel3 en `68bed4c` con los suyos. Este lote no hizo commit, push, migraciones ni despliegue de ninguno de ellos.

## Comportamiento

`https://<dominio-del-gateway>/<agency_id>` valida el circuito antes de mostrar el formulario. Incluye pertenencia al proveedor del dominio, gerencia activa, único bot Atrio sobre la gerencia **operativa**, token habilitado para escribir, conexión exacta de Atrio y asesor con cuenta habilitada. MKT utiliza `operational_agency_id`; no utiliza la referencia histórica. No se limpiaron las referencias MKT ni se alteraron bots WhatsApp.

- **Ingresar:** API2 verifica las credenciales contra el proveedor y la pertenencia a la gerencia exacta. Conserva el jugador original si ya existe en API2, incluso si fue creado por WhatsApp. Registra una autorización explícita e indexada en `atrio_existing_player_bindings`, sin alterar creador, saldo, bonos o historia. Si existe en el casino pero no en API2, crea sólo su identidad local con los valores estándar. Nunca crea una cuenta de casino en el ingreso.
- **Crear cuenta:** usa el provisionador durable existente de Atrio/API2, con nombre e identidad de navegador firmada en cookie HttpOnly. Reintentos y respuestas interrumpidas recuperan el mismo intento. No hay fallback de asesor/bot/proveedor.
- Atrio vincula o recupera atómicamente jugador, cuenta y conversación. Una cuenta asignada a otra conexión no se transfiere. Si el enlace coincide con una cuenta pendiente de template, reutiliza esa identidad.
- Después de las verificaciones API2 se obtiene la sesión final del proveedor y se usa el mismo adaptador de sesión del login genérico. Así una comprobación posterior no reemplaza la sesión que se entrega al navegador. El gateway confirma la cookie antes de abrir el casino/widget. Usuario y clave se consultan mediante el perfil privado existente; la respuesta del formulario sólo incluye redirección y recuperación cifrada.
- El formulario genérico conserva sus reglas anteriores. Ambos formularios utilizan los logos transparentes existentes, de 220 × 110 px reservados. Ganamos+ conserva su skin configurada, relay y cookies existentes.

## Rendimiento y aislamiento

No se modificaron los handlers de template, preparación, handoff, recuperación automática ni SDK. El catch-all comprueba si la ruta es numérica; sólo entonces importa y ejecuta el circuito nuevo. Rutas normales y métodos del proxy conservan su implementación. No se incorpora un viaje a API2/Atrio ni una consulta SQL al camino normal template → gateway.

La autorización de jugadores originales de Atrio devuelve el resultado sin consultar la tabla nueva. Sólo los jugadores importados desde otro canal requieren comprobar su autorización explícita. Las lecturas usan índices; Atrio conserva el índice existente `(target_provider, lower(provider_username))`, conexiones y cuentas por conexión. La serialización es por agencia en MySQL y por cuenta/proveedor en PostgreSQL, con proveedor externo consultado antes de la transacción.

El enlace directo sí espera las verificaciones del circuito y del proveedor. No se presenta como una medición de latencia productiva: la disponibilidad/tiempo del proveedor y la carga global continúan influyendo.

## Validación local

| Comprobación | Resultado |
| --- | --- |
| Suites completas gateways | Rey 479; Ases 406; NET 412; Plus 430 aprobadas; Rey conserva 7 pruebas omitidas preexistentes |
| Revisión final de login/entrada/ruteo | 44 pruebas por gateway, incluido el reintento después de un fallo de sesión final |
| Atrio servicio/RPC/provisión existente | 52 aprobadas, de ellas 8 reportadas sobre PostgreSQL PGlite con SQL real |
| API2 importación MySQL | 6 reportadas aprobadas: concurrencia, pertenencia, duplicados, token deshabilitado, preservación de historial y salida sin consulta en cuentas originales |
| API2 regresión financiera MySQL | 107 aprobadas; incluye jugador importado y revocación del vínculo antes de ejecutar |
| API2 permisos/credenciales/estado/full carga/unicidad | 31 aprobadas, más 22 de confirmación automática y latencia |
| Chromium y WebKit | 48 escenarios: 4 marcas, móvil/escritorio, error, ingreso, alta y almacenamiento sin claves |
| Compilación | Next de los 4 gateways y Atrio; OpenNext/Worker de Plus con 6 pruebas de parche de query |
| Sincronización | Login/entrada compartidos y SDK canónico verificados con `--check` |

TypeScript aprobado en los proyectos afectados. Lint de runtime nuevo API2 y Atrio sin errores. Pruebas de proveedor/red aisladas: estos resultados no certifican el E2E productivo ni las aplicaciones nativas de Instagram/Facebook en iPhone. Screenshots `*-390.png` y `ganamos_net-1365.png` se generaron a partir del HTML real con HTTP simulado y assets del repositorio.

Revisión final: los cuatro objetos de adaptador de proveedor coinciden literalmente con su implementación previa al extraerlos a un módulo compartido por sus rutas. Se preservaron por hash 36 de los 40 archivos preexistentes modificados de API2; los otros cuatro se extendieron expresamente para este lote (contexto, rutas, autorización financiera y su prueba), conservando el trabajo anterior. No se modificó `env.dev`.

Comandos de reproducción:

```text
# landing-builder
node scripts/sync-gateway-login.mjs --check
node scripts/sync-gateway-app-sdk.mjs --check
node scripts/check-gateway-agency-browser.mjs
# cada gateway
npm test
npm run build
# multi-skin-gateway
npm run build:cloudflare
# internal-chat (PGlite instalado fuera del repositorio)
node --experimental-strip-types --test tests/gateway-agency.test.mjs tests/gateway-agency-database.test.mjs tests/direct-bot-account.test.mjs
# api2 (sólo MySQL desechable mediante bootstrap, nunca producción)
node --import ./tests/helpers/atrio_player_provision_mysql_bootstrap.mjs --test tests/isolated/gateway_agency.mysql.test.ts
npm run test:bot-financial:mysql
```

Para la prueba SQL de Atrio, `ATRIO_DIRECT_BOT_PGLITE` debe apuntar al `dist/index.js` del paquete PGlite. Los tests MySQL verifican el nombre de la base descartable; ejecutar secuencialmente las suites que la comparten.

## Activación pendiente

1. El programador despliega API2 junto con las migraciones de unicidad Atrio `20261104000002_unique_atrio_bot_per_operational_agency.ts` y vinculaciones `20261104000003_create_atrio_existing_player_bindings.ts`. Aplicarlas antes del código que consulta la tabla; respetar las dependencias de los otros cambios locales, separados de este lote. La unicidad falla ante duplicados y nunca reasigna registros.
2. Aplicada en Atrio el 05/11/2026: `20261105152217_gateway_agency_entry.sql`. Añade únicamente un RPC `SECURITY INVOKER`, con `search_path` vacío y ejecución sólo para `service_role`. No abre permisos a clientes anónimos/autenticados ni migra cuentas históricas. El usuario autorizó publicar Atrio y los cuatro gateways; API2 sigue local, por lo que los enlaces de gerencia permanecen no disponibles hasta actualizarlo.
3. Publicar Atrio y los cuatro gateways, incluido el Worker de Plus. Conservar secretos existentes y comprobar los orígenes configurados por casino; el enlace falla cerrado si API2, token, conexión o cuenta del asesor no está disponible. No requiere nuevas variables de entorno.
4. Verificar GET de agencias válidas/ajenas/inexistentes en los dominios públicos y realizar un E2E autorizado con cuentas controladas. No usar cuentas ni dinero de clientes como fixtures.

Para retirar la funcionalidad después de importar jugadores, deshabilitar las rutas nuevas y conservar los vínculos y su lector mientras existan sesiones importadas. No borrar la tabla o reasignar jugadores como rollback; las cuentas del casino y sus historias son reales aunque el formulario se retire.
