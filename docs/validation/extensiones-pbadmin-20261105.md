# Extensiones PBAdmin — implementación y activación

Implementación autorizada el 04/11/2026; validación local final el 05/11/2026. El 05/11 el usuario autorizó publicar Builder y Atrio, incluidas sus migraciones y función `create-client`. API2 y Panel3 permanecen locales. No se crearon ni vincularon cuentas reales; las banderas de Extensiones siguen apagadas hasta publicar y configurar API2/Panel3.

Migraciones productivas aplicadas: Builder `20261105152221_pbadmin_extensions_identity.sql`; Atrio `20261105152220_pbadmin_extensions_identity.sql`. Los nombres locales coinciden con las versiones registradas en Supabase. Función `create-client`: versión 38, con sus dependencias compartidas y autenticación propia existente.

Builder y Atrio publicados y promovidos en Vercel; sus logins nativos responden 200 y los accesos PBAdmin continúan apagados. [Registro de publicación, versiones y comprobaciones públicas](gateway-agency-20261104/README.md#publicación-verificada--05112026).

Revisión posterior de Supabase: RLS activo y sin SELECT de `anon`/`authenticated` en las tres tablas privadas; 69 políticas restrictivas en Builder y 42 en Atrio; hook instalado sin reemplazar otro; sesiones nativas permitidas. Los avisos nuevos del advisor corresponden a las tablas sin políticas públicas, intencionalmente exclusivas del servidor ([RLS sin políticas](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)), y a las funciones `SECURITY DEFINER` de comprobación de sesión, que sólo validan la identidad de la propia petición y necesitan poder ejecutarse desde el hook y las políticas ([anon](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [authenticated](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)). La reserva de identidades y el vínculo de gerencia siguen siendo exclusivos de `service_role`.

## Comportamiento

- Ajuste posterior del 05/11, **sólo local**: el usuario elige «Ya tengo cuenta» o «Crear cuenta» en PBAdmin. El mapa precargado se eliminó; no se ejecutaron vínculos reales. La galería de gateways adopta proporción 3:4, degradado inferior y animaciones equivalentes al constructor, respetando movimiento reducido.
- `POST /front/extensions/connect` autentica al usuario PBAdmin, aplica permisos y emite una autorización privada con intención persistida `create`/`link`. El endpoint privado `/api/pbadmin/connect` de cada proveedor verifica credenciales nativas sólo en `link`, vincula o crea de forma idempotente y registra el resultado en API2. Después se abre el autologin normal. El acceso público `open` no puede crear vínculos.
- Las altas nuevas usan «Ingresar con PBAdmin»; no se solicita ni se copia su contraseña. La contraseña nativa se usa únicamente para la prueba de propiedad y no se persiste. Se cierra sólo la sesión temporal de verificación, conservando las anteriores. Un error nativo 401 se informa como 422 a Panel3 para conservar la sesión PBAdmin. El límite de diez autorizaciones por minuto incluye las ya canjeadas.
- Panel3: «Extensiones» reemplaza Marketing; el enlace anterior redirige. Administrador de administración: Builder y Atrio. Marketing: Atrio. Cajero: sólo Tracking. Superadmin: conserva Tracking y sus herramientas existentes, sin alta automática de cliente.
- El acceso desde el hub y «Ingresar con PBAdmin» en ambos logins usa las credenciales exclusivamente en Panel3. Se intercambia un código opaco de 60 segundos, vinculado a PKCE y al navegador; el canje es único, incluso con concurrencia. Las cuentas nativas existentes conservan su contraseña y su ingreso habitual.
- Builder conserva una cuenta `client` por administración. Cada sesión registra la persona PBAdmin que la abrió. No se comparte la contraseña de PBAdmin ni se convierte al cliente en superadmin del constructor.
- Las altas nuevas pasan por la misma función `supabase/functions/_shared/initialize-client.ts` que el alta manual, incluida la aprobación previa de Auth. Conservan los defaults vigentes de tablas, módulos, columnas y plan. La reserva de UUID permite retomar altas parciales sin crear otra cuenta ni reiniciar su plan.
- Atrio crea un administrador por administración y un asesor por usuario. Marketing puede activar primero. El administrador entra como administrador y puede atender como su asesor personal y volver, sin otra contraseña. El cambio verifica la persona, la administración y la relación actual entre perfiles.
- La creación de bots toma las credenciales de Atrio del usuario asignado, en servidor. No entrega el token al formulario. Mantiene la validación real del token y las restricciones actuales de canal, rol, gerencia operativa y manager.
- La importación inicial y la reconciliación posterior conservan la configuración del constructor, los workspaces PYG existentes y el botón manual de vinculación. Las nuevas incorporaciones usan ARS. Las bajas limpian el inventario del bot, sin borrar la gerencia ni las landings.
- URL Post: completar si está vacía; respetar valores existentes y ediciones manuales posteriores, incluso si se vacía. «Usar URL del constructor» restaura expresamente la automática.

## Vinculación explícita y conservación de recursos

El mapa de nueve clientes y las exclusiones por administración se eliminaron por instrucción explícita posterior. El usuario vincula una cuenta nativa demostrando sus credenciales o crea una nueva con identidad PBAdmin. Una cuenta ya vinculada a otra administración no puede apropiarse; tampoco se reemplaza un vínculo existente. No se infiere pertenencia por email y no se borran vínculos reales.

Un administrador Atrio nativo elige su asesor personal entre los que le pertenecen, o crea uno nuevo. Esta elección precede a la reserva; se conservan chats, slug, token y configuración del asesor existente. Un Marketing vincula su asesor sólo si pertenece al administrador Atrio ya vinculado a la administración PBAdmin. Una administración con bots Atrio previos y sin vínculo no puede crear automáticamente un duplicado: debe usar «Ya tengo cuenta». Las cuentas con MFA verificado requieren revisión; no se omite el segundo factor.

Gera y Diana en las landings de prueba de Golden se conservan. La importación automática no mueve ni modifica esos asesores. Las restricciones globales de unicidad de gerencia/asesor se mantienen: los conflictos quedan en revisión. Los bots sin gerencia y los inventarios que superan los límites actuales del directorio también quedan pendientes; no se inventan asignaciones ni se anuncia una importación completa en esos casos.

## Sincronización y sesiones

API2 reconcilia cada minuto las administraciones vinculadas, con concesión persistida y un hash de los metadatos pertinentes. Sólo comunica cambios o reintenta fallos pendientes; una revisión estable no se reenvía hasta un cambio. Detecta altas, cambios, bajas y transferencias de bots, y cambios de rol/administración. No agrega consultas ni llamadas HTTP al recorrido template → gateway.

Las sesiones delegadas se registran por `session_id`, usuario y administración. RLS mantiene el aislamiento original y rechaza sesiones delegadas revocadas o vencidas. El hook de PostgREST protege también RPCs con `SECURITY DEFINER`; Storage aplica el mismo control a sus objetos. Las cuentas nativas anteriores conservan su autorización original. El chequeo del hook no consulta PBAdmin desde PostgreSQL.

Las sesiones se comprueban contra API2 al usar los accesos internos y se revisan en la reconciliación. La expiración máxima del registro delegado es 30 días. Las credenciales de integración se cifran en API2 y Atrio. No se registran contraseñas, tokens ni códigos en logs. Un cambio de administración/rol incompatible pide revisar el vínculo, sin trasladar silenciosamente recursos.

La importación divide gerencias y asesores en lotes independientes; un asesor conserva el inventario completo aunque sus bots pertenezcan a gerencias de distintos lotes o monedas. Se verificó con 201 asesores. Los conflictos de unicidad requieren revisión; los fallos temporales de escritura vuelven al estado pendiente y se reintentan. La concesión de API2 usa la precisión real de `TIMESTAMP` y vuelve a comprobar la fecha pendiente al reclamar, evitando trabajo duplicado entre instancias.

Se corrigió además el directorio privado de Atrio para consultar `profiles.full_name`; `profiles.name` no existe en el esquema verificado. Es necesario para que funcione la importación de asesores reales.

## Configuración preparada, pendiente de aplicar

Mantener todas las banderas apagadas hasta preparar ambos extremos. Secretos distintos para Builder y Atrio, aleatorios y de al menos 32 caracteres; nunca valores de ejemplo ni claves públicas. Los orígenes admiten HTTPS, sin path/query/credenciales; HTTP sólo para localhost en desarrollo.

| Proyecto | Variables nuevas |
| --- | --- |
| API2 | `EXTENSIONS_ENABLED`, `EXTENSIONS_BUILDER_ORIGIN`, `EXTENSIONS_BUILDER_SECRET`, `EXTENSIONS_ATRIO_ORIGIN`, `EXTENSIONS_ATRIO_SECRET`, `EXTENSIONS_BUILDER_TRACKING_ORIGIN` (origen Supabase del constructor) |
| Builder / Atrio, servidor | `PBADMIN_EXTENSIONS_ENABLED`, `PBADMIN_EXTENSIONS_API_ORIGIN` (origen API2, sin `/api/v1`), `PBADMIN_EXTENSIONS_PANEL_ORIGIN`, `PBADMIN_EXTENSIONS_APP_ORIGIN`, `PBADMIN_EXTENSIONS_SECRET` correspondiente al proveedor |
| Builder, compilación del front | `NEXT_PUBLIC_PBADMIN_EXTENSIONS_ENABLED` para el acceso del login |
| Builder, opcional | `PBADMIN_DEFAULTS_ADMIN_ID`: administrador Builder de referencia para defaults; si se omite debe existir exactamente uno |

Se reutilizan las configuraciones existentes de Supabase, el puente `INTERNAL_CHAT_ORIGIN` / `INTERNAL_CHAT_PLAYER_RESOLVE_KEY` y la integración global API2 de Atrio. El cron necesita que API2 habilite sus tareas de fondo, como los crons existentes.

Orden de futura activación:

1. Revisar y aplicar `api2/database/migrations/20261104000005_create_extensions.ts`, todavía pendiente de publicación. Ahora incluye `extension_codes.intent` (por defecto `open`).
2. Las migraciones de identidad de Builder y Atrio ya están aplicadas. No sustituyen las migraciones pendientes de API2.
3. Las migraciones instalaron el hook `public.pbadmin_check_session` para `authenticator`; la inspección previa confirmó que no sustituía otro hook. Se verificaron las políticas restrictivas, tablas privadas y autorización nativa después de aplicarlas.
4. La base anterior de Builder/Atrio y `create-client` ya fue publicada con Extensiones apagado. Este ajuste de autoservicio sigue local: publicar sus rutas `/api/pbadmin/connect` y el broker API2/Panel3 coordinadamente, preparar secretos/orígenes y comprobar el puente del directorio. No requiere nuevas migraciones Supabase ni cambios de Edge Functions. Publicar API2 sigue a cargo de su responsable.
5. Habilitar las banderas y comprobar «Ya tengo cuenta» y «Crear cuenta» con una administración de prueba. La activación no aplica correspondencias masivas.

No borrar tablas de auditoría o reservas para resolver un error. Deshabilitar los accesos nuevos mediante las banderas si hace falta retirar el lote; conservar datos y cuentas creadas. Revisar las sesiones activas antes de un rollback de esquema.

## Verificación reproducible

Validación del lote inicial publicado: 20 escenarios API2/MySQL, 15 con Auth/PostgreSQL/PostgREST reales, 7 en Chromium, 8 de aislamiento PostgreSQL y 25 de regresión del importador/directorio/sincronización. TypeScript de los cuatro proyectos y lint de los módulos nuevos sin errores. Entornos efímeros locales, sin cuentas de producción.

Ajuste de autoservicio y galería del 05/11: 25 escenarios API2/MySQL, 17 con GoTrue/PostgreSQL/PostgREST reales y 22 Chromium; TypeScript de los cuatro proyectos y lint dirigido sin errores. Incluye credenciales nativas inválidas, conservación de contraseña/sesión/configuración, rechazo de otra administración, selección explícita del asesor, alta sin contraseña PBAdmin, rechazo de `open` sin vínculo y presentación móvil/escritorio. No se volvió a ejecutar toda la batería histórica sin cambios de esquema. Capturas en Panel3: `docs/validation/gateways-gallery-20261105/` y `docs/validation/extensions-self-service-20261105/`.

También se compilaron con Turbopack las rutas nuevas de Builder y Atrio (`next build --experimental-build-mode compile --debug-build-paths=...`). Los manifiestos incluyen los endpoints y callbacks esperados. Fue una compilación dirigida, sin prerenderizado completo ni publicación. Builder mantiene el aviso previo de múltiples lockfiles y resuelve correctamente el módulo compartido fuera de `frontend`.

- API2: `npm run test:extensions` usa MySQL 8.4 desechable en localhost y no carga archivos de entorno ni inicializa Adonis/proveedores.
- Builder: `npm run test:extensions` desde `frontend` levanta PostgreSQL 17, GoTrue y PostgREST reales en contenedores efímeros. Prueba alta, reintento parcial, defaults, credenciales nativas, importación, exclusiones, revocación, cambio de contexto y pertenencia de asesores.
- Panel3: `npm run test:extensions` verifica los componentes reales, cliente HTTP y hook de autenticación en Chromium, con backend de prueba y bloqueo de tráfico externo.
- Atrio: `PBADMIN_TEST_PGLITE` debe apuntar al módulo local PGlite; ejecutar `node --test tests/pbadmin-extensions-database.test.mjs`. Verifica reservas, grants y RLS. Las mismas tablas/funciones también se ejecutan en el fixture PostgreSQL real de Builder.
- Regresión: pruebas existentes de importación Builder, directorio y sincronización de managers de Atrio; TypeScript de los cuatro proyectos; generación de tipos de rutas Next16; comprobación del SDK y login compartidos de los cuatro gateways.

Los scripts eliminan únicamente sus contenedores, red y archivos temporales propios. La vista local de suscripciones y sus datos de prueba se conservan.
