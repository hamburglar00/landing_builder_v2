# Fase 1A — Diseño de seguridad

Estado: análisis y propuesta, sin implementación. Fecha: 2026-09-17. Base comprobada: rama `main`, HEAD `f3153676c0bbaccd29840f365b86f480920d7598`, árbol inicialmente limpio. La autorización de esta etapa no autoriza ejecutar las migraciones ni desplegar los cambios descritos.

## Alcance y evidencia

Se cruzaron código y tests del checkpoint con consultas nuevas a catálogos remotos, dentro de transacciones READ ONLY, con statement_timeout de 8 segundos y lock_timeout de 1 segundo en las consultas de inventario. La comprobación puntual del CHECK de profiles usó statement_timeout de 8 segundos. Se consultó el manifiesto desplegado de Edge Functions. No se invocaron endpoints de negocio, RPC productivas, cron ni funciones net; no se leyeron filas de aplicación, payloads, usuarios ni valores de credenciales. Los nombres de columnas sensibles son metadata, no sus contenidos.

Inventario: 89 funciones de aplicación en public/private, 65 SECURITY DEFINER, 43 funciones con EXECUTE para PUBLIC, 60 tablas, una vista y diez secuencias. Las 60 tablas tienen RLS y ninguna FORCE RLS; esto no neutraliza privilegios de propietario, BYPASSRLS ni TRUNCATE. Hay 152 políticas. El inventario desplegado contiene 31 Edge Functions. Las firmas se individualizan, incluidas las sobrecargas.

Los 89 hashes de cuerpos SQL coinciden con la evidencia remota del checkpoint. Se localizaron 84 cuerpos idénticos directamente en archivos históricos; cinco requieren seguir transformaciones históricas o la capa de plataforma y se identifican en el inventario. Las menciones textuales y los hashes no prueban ejecución real. El mapa distingue llamadas explícitas, referencias, dependencias SQL por nombre y consumidores externos pendientes de confirmar.

Archivos de apoyo:

- `functions.md`: cada función, seguridad actual, consumidores, mínimo propuesto y efecto de revocar.
- `relations.md`: cada tabla/vista/secuencia, grants, políticas, consumidores y propuesta.
- `endpoints.md`: las 31 Edge Functions y las nueve rutas Next.js, con contratos de acceso.
- `evidence.json`: metadata sanitizada, referencias con archivo/línea y consultas adicionales reproducibles; nunca cuerpos SQL remotos, comandos cron ni valores de configuración.
- `review.json`: comprobaciones documentales finales y límites de esta entrega.

La configuración local expone public y graphql_public. La configuración hosted completa de PostgREST no apareció en current_setting ni pg_db_role_setting; no se equipara automáticamente a config.toml. La aplicación acredita uso de public por Data API. Antes de desplegar se debe confirmar la lista hosted de schemas, el pre-request hook si existe y la exposición GraphQL mediante configuración de solo lectura. Las funciones trigger/event_trigger y las secuencias no equivalen a endpoints RPC/REST ordinarios, aunque tengan ACL amplias. No se probó explotación a través del gateway. Las conclusiones sobre handlers provienen del código del checkpoint; el manifiesto acredita versión/verify_jwt desplegados, no igualdad entre fuente local y bundle remoto. Verificar esa correspondencia antes de implementar.

## 1. Riesgos priorizados

P0 significa prioridad inmediata de diseño/remediación; no significa que se haya observado un ataque. Impacto de tráfico es la posibilidad de interrumpir consumidores legítimos al aplicar la propuesta.

| ID | Evidencia y riesgo | Propuesta limitada a acceso | Riesgo del cambio / tráfico |
| --- | --- | --- | --- |
| S01 P0 | authenticated puede UPDATE profiles.role; la policy sólo exige auth.uid() = id antes/después. No hay trigger de aplicación que proteja role. Numerosas políticas y handlers confían en profiles.role = admin. Escalada a administrador de aplicación deducida del esquema; no ejecutada. | Retirar UPDATE a nivel tabla para roles públicos y conceder sólo las columnas legítimamente editables, después de acreditar sus consumidores. role, id y created_at no deben editarse desde el navegador. Administrar roles mediante el backend administrativo ya autenticado. | Medio; validar edición de perfil, alta y administración. Precede confiar en cualquier check de admin. |
| S02 P0 | conversions: verify_jwt=false, sin validación de identidad en el handler, selecciona cliente por name y usa SERVICE_ROLE_KEY. También acepta indicadores internos de replay del payload. | Autorización por emisor y tenant, antes de cualquier efecto; diferenciar backend, integrador y acceso público legítimo. Los flags internos requieren emisor interno, sin cambiar su semántica. Estrategia detallada abajo. | Alto; afecta ingestión real si se exige una credencial antes de migrar al emisor. |
| S03 P0 | reset-phone-counters y rama manual de sync-phones usan user_id enviado por el cliente sin autenticarlo; reset-phone-messages carece de control de propietario en el handler. La pantalla Teléfonos envía el JWT anon como Bearer. | Sesión real + propietario/admin verificado; mantener por separado el secreto cron de sync. | Alto; adaptar sólo transporte de autorización de la pantalla antes de bloquear el acceso antiguo. No cambiar contadores ni sincronización. |
| S04 P1 | 42 tablas public conceden TRUNCATE a anon y authenticated; una vista también tiene ese grant, sin capacidad de truncar la vista. RLS no protege TRUNCATE. No se identificó un contrato legítimo que lo requiera. | Revocar en tablas enumeradas; quitar también el grant inútil de la vista; tratar defaults por owner/schema. | Bajo tras tests; no confundir privilegio SQL con una ruta HTTP TRUNCATE directa. |
| S05 P1 | 12 cron_* SECURITY DEFINER ejecutables por PUBLIC/anon/authenticated; 11 aparecen en jobs activos, cron_sync_telegram_connections no tiene job activo identificado. refresh_constructor_landing_phone_cache también es ejecutable por anon. | EXECUTE sólo para el rol postgres que ejecuta cron y los consumidores internos acreditados. Revocar PUBLIC además de los grants directos. | Bajo/medio; comprobar cron y operación manual interna. No cambiar schedules, cuerpos ni momento de envío. |
| S06 P1 | get_home_overview_stats es DEFINER y PUBLIC; sólo rechaza otro tenant si auth.uid() no es nulo. El cuerpo remoto coincide con la migración revisada. | Revocar PUBLIC/anon; conservar authenticated autorizado y backend sólo si existe contrato. Añadir en fase posterior control explícito del principal cuando sea necesario, sin tocar cálculo alguno. | Medio; no hay llamada frontend actual al RPC antiguo, pero no se acredita ausencia de integradores externos. |
| S07 P1 | gerencia_phones permite SELECT a todo authenticated. Su policy ALL usa una subconsulta con g.id = g.gerencia_id, sin correlación a la fila exterior. Si existe una gerencia propia que cumpla esa igualdad, podría autorizar modificaciones ajenas. | Confirmar contrato de visibilidad entre clientes; proponer únicamente correlación de propiedad y alcance autorizado. No cambiar asignación, reservas ni métricas. | Alto; decisión explícita de acceso, pruebas entre tenants y gerencias sintéticas. |
| S08 P1 | settings permite SELECT a cualquier authenticated, incluida la columna revalidate_secret. Configuración CAPI/Kommo/Chatrace devuelve columnas de tokens al frontend autorizado; conversionsDb usa SELECT *. | Separar lectura de campos públicos y administración de secretos. Secretos sólo consumidos por backend; ingreso de nuevas credenciales por propietario/admin, sin devolver el valor almacenado. | Alto para pantallas de integración: no basta revocar columnas porque SELECT * falla. Requiere aprobación de adaptación exclusivamente de acceso a secretos. |
| S09 P1 | telegram-webhook tolera encabezado secreto ausente/incorrecto para mensajes con texto. | Acreditar configuración del emisor y luego exigir secreto válido, conservando reconexiones autorizadas. | Alto; observar y validar primero, sin cambiar flujos de notificación. |
| S10 P2 | Muchos DEFINER son postgres y search_path=public; public no permite CREATE a anon/authenticated. Algunos paths omiten pg_temp explícito. Presencia de auth.uid en un cuerpo no prueba una guarda correcta. | Mantener DEFINER donde hace falta; auditar resolución de nombres, fijar path seguro por función y sólo después considerar propietario dedicado con privilegios probados. | Medio/alto; cambio de owner o INVOKER global podría cortar triggers, reservas, cachés y cron. |
| S11 P2 | pg_net 0.19.5 INVOKER conserva EXECUTE PUBLIC y grants PUBLIC amplios sobre cola/respuestas/secuencia. La paridad de Fase 0 no certifica seguridad. | Revisar con plataforma roles SQL realmente alcanzables; no tocar objetos de extensión ni asumir exposición REST de net. Adaptación, si procede, separada y acreditada. | Alto para cron; no normalizar como seguro ni actualizar extensión en esta fase. |
| S12 P2 | Token histórico en ledger documentado en Fase 0; no se acreditó referencia activa ni vigencia externa. JWT anon legado es público, no service_role. | Owner confirma vigencia del token histórico y decide rotación separada; migración futura a publishable con pruebas de gateway. | Medio; no se inspeccionaron ni rotaron valores en 1A. |

Fuentes principales de S01/S07/S08: permisos efectivos y expresiones de políticas remotas sanitizadas en evidence.json. S02: conversions/index.ts:7713 y :7826. S03: sync-phones/index.ts:120, reset-phone-counters/index.ts:52 y TelefonosPageContent.tsx:352/402/433. S06: 20260514183000_home_overview_inferred_leads.sql:29. S09: telegram-webhook/index.ts:138. Estas observaciones no declaran corregido ningún hallazgo.

## 2. Consumidores legítimos y límites de certeza

El navegador administrativo usa NEXT_PUBLIC_SUPABASE_ANON_KEY como clave de proyecto y una sesión de usuario para Data API. La clave pública no autentica un usuario ni un tenant. Los visitantes de landings no tienen sesión y deben seguir pudiendo cargar configuración, obtener/confirmar teléfono, redirigir y emitir los eventos legítimos actuales. Los servidores Next.js/Edge y cron tienen contratos diferentes.

Rutas acreditadas de conversions:

1. PublicLandingRuntimeScript -> /api/track -> tracking/upstream -> conversions. El browser usa fetch o sendBeacon; upstream hoy envía sólo Content-Type. /api/track/retry repite el mismo transporte y sí protege su invocación con secreto.
2. builder-config y editores generan/publican postUrl directo. IntegracionesMetaCapi, ConversionConfigurationPanel y dashboard muestran la URL a integradores. No hay censo suficiente en el repositorio de proveedores, snippets externos, callbacks ni configuración de sus headers.
3. retry-failed-conversions reenvía diferidos/backfills a conversions con sus flags internos; el endpoint de cron autentica su propia entrada, pero el receptor conversions no distingue al emisor.
4. whatsapp-cloud-redirect invoca conversions. Mantener exactamente el momento de la invocación y los datos ya producidos por ese handler.
5. Tests locales de concurrencia ejercitan el handler; no son consumidores productivos ni prueban autorización de un proveedor real.

No se usaron access logs con URLs completas, nombres de clientes, IP o cuerpos para llenar huecos. Un nombre no encontrado no autoriza a eliminar un contrato. Todas las referencias candidatas quedan marcadas como tales en los inventarios; los consumidores externos deben ser confirmados por su responsable antes del corte.

## 3. Permisos mínimos propuestos

No usar REVOKE ALL global sobre public ni cambiar todo a SECURITY INVOKER. Inventariar por firma y tabla. El mínimo mantiene funciones públicas necesarias con EXECUTE explícito a anon/authenticated cuando corresponda, y elimina PUBLIC de funciones internas. Revocar anon sin revocar PUBLIC es ineficaz.

- Visitante: sólo interfaces públicas de landing, teléfono, promoción y tracking autorizadas por su contrato. No CRUD directo general, cron, claims, colas, reset ni rol administrativo.
- authenticated: SELECT/INSERT/UPDATE/DELETE sólo según operaciones acreditadas y políticas de propietario/admin; ningún TRUNCATE, DDL, TRIGGER, REFERENCES o MAINTAIN sin contrato expreso. Audiencias conserva RPC INVOKER y RLS, incluidas firmas antiguas hasta cerrar consumidores.
- Backend service_role: mantener temporalmente permisos actuales necesarios; autenticar y autorizar antes de usarlo. No transmitirlo al browser ni usarlo como clave de un integrador. Su BYPASSRLS exige control de tenant en la frontera.
- postgres: propietario/migraciones y los jobs actuales; no es credencial de cliente. authenticator conserva únicamente su papel de selección de rol del gateway, sin nuevos grants de aplicación.
- Funciones trigger: ejecutar por el mecanismo de trigger con owner/control de creación existente; no exponer como RPC. Revocar EXECUTE del usuario final sólo tras probar DML y restauración/creación de triggers en la versión local; no deshabilitar ni recrear triggers para sortear fallos.
- Secuencias: USAGE/SELECT sólo a quienes insertan directamente y realmente lo necesitan; no UPDATE para resetearlas desde un navegador. Resolver dependencia/default antes de revocar; no tocar valores ni asignación de IDs.

El inventario de relaciones propone operaciones por tabla, pero el análisis estático no es una prueba completa de ramas dinámicas. Para tablas con consumidor desconocido, el mínimo final queda pendiente y no se autoriza revocación de lectura/escritura. TRUNCATE se trata separadamente.

## 4. Protección de conversions sin cortar clientes

Mantener por ahora verify_jwt=false durante la transición de un endpoint mixto. Activarlo de golpe cortaría emisores sin JWT y no reemplaza la autorización por cliente. Tampoco sirve exigir la clave anon/publishable que cualquiera puede obtener. CORS, Origin, Referer, IP y name no son autenticación.

Diseño preferido para emisores servidor: credencial de integración acotada por emisor/tenant, o firma HMAC en headers sobre método, destino y bytes enviados. Validación antes de crear el cliente privilegiado y antes de toda escritura/envío; comparación segura y vínculo del principal con el tenant resuelto por name. No serializar de nuevo el payload para verificar una firma del proveedor. No enviar service_role como credencial compartida de terceros. A los backends propios se les puede añadir autenticación de transporte sin cambiar el JSON, endpoint, número de intentos ni tiempos de negocio. La elección exacta firma/secreto queda sujeta a las capacidades reales del integrador.

Los visitantes anónimos necesitan una entrada pública. El proxy /api/track existente puede acreditar su identidad servidor hacia conversions, pero firmar indiscriminadamente cualquier petición del navegador NO autentica al visitante ni evita falsificación de eventos. Debe validar el alcance de landing/tenant autorizado antes de adjuntar credenciales y no firmar una URL arbitraria enviada por el usuario. El allowlist actual de hosts no basta para delegar una identidad privilegiada: comprobar destino concreto y redirects, conservando todos los destinos legítimos acreditados. No proponer restringir acciones de Contact/Lead/Purchase sin confirmar el contrato.

Para landings de emisión directa, una capacidad pública acotada a landing/tenant puede limitar alcance, pero no demostrar que el visitante es humano ni impedir que otro visitante la obtenga. Cookies de sesión técnica en la ruta ya existente son compatibles con sendBeacon del mismo origen; un header nuevo no lo es. No introducir un proxy nuevo, challenge, login, rate limit, buffering, ventana de descarte o traslado de ruta como supuesto cambio inocuo: requeriría decisión y paridad de transporte. Si el emisor no admite credenciales sin alterar su contrato, mantener explícitamente ese canal público hasta la decisión del responsable. El riesgo residual debe quedar aceptado; no declarar conversions completamente autenticado.

Plan de transición, sin ejecutarlo:

1. Censo por canal y responsable, sin datos de eventos. Registrar capacidad de headers/firma, tenant autorizado y uso de sendBeacon. Decidir cuáles son públicos por diseño y cuáles privados.
2. Tests sintéticos de compatibilidad y clasificación de identidad en observación, sin bloquear ni producir un segundo envío. Registrar sólo contadores agregados de decisiones, versión de auth y códigos de razón; nunca payloads, tokens, nombres ni IDs de eventos.
3. Migrar primero backend Next.js, reintentos y redirect mediante headers; preservar bytes, event_id, event_time, monedas y acciones. Invalidar cualquier intento público de asumir el principal interno; habilitar rechazo sólo después de comprobar los emisores internos.
4. Incorporar cada integrador conocido. Aceptar ambos mecanismos por ventana aprobada y por emisor, no una puerta trasera universal por ausencia de credencial. La rama pública legítima es una autorización distinta, no fallback de credenciales inválidas.
5. Exigir autenticación sólo en canales migrados. Para cada corte, aprobar censo completo y umbral de errores; ante consumidores desconocidos no ejecutar el corte. No registrar éxito ni 2xx artificiales para eventos rechazados.

Un nonce de autenticación no reemplaza event_id ni puede descartar un reintento legítimo. Si se escoge expiración de firma, firmar cada intento de transporte con su tiempo técnico sin modificar event_time; comprobar colas antiguas y diferidos. No introducir aquí una segunda regla de deduplicación.

## 5. Revocación de TRUNCATE

El conjunto exacto de 42 tablas y la vista está en relations.md. Preflight futuro: comparar ACL con evidence.json, registrar grantor/grantee/grantable y privilegios heredados/PUBLIC, confirmar cero contratos SQL de truncado con roles de cliente. No se observó una llamada legítima en código.

La migración futura S-M02 sólo retiraría TRUNCATE de anon/authenticated y de PUBLIC si lo concediera en esos objetos, conservando service_role y propietarios. No ejecutar TRUNCATE para comprobarlo en producción. En una base local aislada: BEGIN, SET LOCAL ROLE, invocación sobre fixtures, comprobar 42501 y ROLLBACK; además has_table_privilege=false y datos inalterados. Verificar que DELETE autorizado sigue funcionando y DELETE de otro tenant no.

Los default privileges son por creador: inventariar cada owner/schema y retirar TRUNCATE de futuros objetos para roles de cliente, sin alterar grants de otros privilegios ni aplicar un default global por suposición. En net existe una concesión PUBLIC independiente: no considerarla resuelta revocando sólo grants directos, ni incluirla silenciosamente en esta migración de tablas de aplicación. Requiere revisión separada de plataforma/cron.

## 6. Tratamiento de SECURITY DEFINER, RLS y credenciales

functions.md cubre las 65 firmas DEFINER individualmente. Criterios:

- Mantener en claims, asignación/reserva, contadores, funciones internas de cálculo/cache, configuración segura y triggers cuando el llamador legítimo carece de privilegios sobre tablas. No cambiar resultados ni convertir a INVOKER para satisfacer un advisor.
- Cron y refresh internos: revocar ejecución pública, mantener cron postgres y llamadas anidadas legítimas. Revocar EXECUTE no altera el cuerpo, la cola ni el schedule.
- Reporting/WhatsApp autenticados: mantener firmas y ACL necesarias; comprobar owner/admin, auth.uid nulo, tenant ajeno y todas las sobrecargas. El wrapper de una sobrecarga debe validar mediante su función destino; no concluir falta de control sólo porque el wrapper no contiene auth.uid.
- Landing/routing/teléfono públicos: mantener proyección pública y comportamiento actual, definir explícitamente audiencia. No eliminar RPC antiguas sólo por no encontrar una llamada directa. get_cached_constructor_landing_phone se usa en SSR con anon; verify_revalidate_secret se usa desde Next.js con anon aunque sea un backend.
- rls_auto_enable/ensure_rls: conservar el mecanismo de plataforma acreditado y su path pg_catalog. No alterar roles/event triggers como parte de limpieza general. ACL redundantes sólo con prueba de compatibilidad de creación de tablas y aprobación específica.
- search_path: verificar cada referencia, operadores, casts y llamada anidada. Objetivo por firma: esquemas de confianza explícitos, pg_temp al final y ningún esquema modificable por el llamador; si el cuerpo ya califica todo, path vacío puede ser adecuado. No reemplazar public por path vacío sin resolver nombres. Owners nuevos y grants mínimos son un lote separado, de alto impacto, no condición para retirar EXECUTE público.
- No añadir FORCE RLS masivo. No protege contra BYPASSRLS y puede afectar caminos de propietario. Mantener funnel_contacts security_invoker=true; comprobar vista y tablas base con los mismos roles. Revisar policies permissive mediante su combinación OR, no aisladamente.

SERVICE_ROLE_KEY/SUPABASE_SERVICE_ROLE_KEY sólo se referencian en código servidor/Edge. getSupabaseServerClient permite fallback anon; si se exige una identidad privilegiada, la propuesta es fallo explícito por configuración incompleta, nunca poner la clave privilegiada en NEXT_PUBLIC. Confirmar importación exclusivamente servidor y ausencia en bundle/HTML/logs en tests futuros. No se inspeccionaron los valores desplegados, por lo que esto no certifica el inventario de secrets de la plataforma.

La lectura actual de tokens CAPI/Kommo/Chatrace por la pantalla impide afirmar que todas las credenciales sean hoy exclusivamente backend. Propuesta separada: lectura de configuración sin secretos + actualización autenticada que conserve el valor anterior cuando no se cambia. Los emisores seguirían obteniendo el mismo secreto en backend; ninguna modificación del payload CAPI. Preservar las autorizaciones legítimas de propietario/admin y requerir aprobación de la UX de ingreso sin relectura. WhatsApp ya protege meta_access_token/meta_app_secret mediante grants por columna y RPC; conservar ese patrón y revisar webhook_verify_token, que sí es legible. No confundir tokens públicos de navegación/participación con claves privilegiadas sólo por su nombre.

## 7. Migraciones previstas, no creadas

Identificadores de diseño; asignar timestamp normal sólo después de aprobación. No editar ninguna de las 268 migraciones históricas ni el bootstrap de paridad.

| Lote | Contenido exacto previsto | Precondición | Impacto / rollback |
| --- | --- | --- | --- |
| S-M01 | ACL por columna de profiles; mantener SELECT propio y escritura de columnas permitidas; role sólo backend administrativo. | Confirmar edición de perfil y ejecutar tests de rol/alta/admin. | Medio; reversión de ACL concreta, sin datos. No restaurar exposición crítica automáticamente. |
| S-M02 | TRUNCATE de las 42 tablas y vista; defaults de owners acreditados. | Lista sellada y prueba local de roles. | Bajo; grants anteriores exactos, aprobación de riesgo al revertir. |
| S-M03 | ACL por firma de los 12 cron_* y refresh_constructor_landing_phone_cache; get_home_overview_stats sin PUBLIC/anon; clientes de cada firma cerrados. | Jobs y consumidores acreditados; sin lectura de sus secretos. | Medio; restaurar exclusivamente ACL del lote. |
| S-M04 | Guardas de autorización de funciones afectadas; paths por firma revisada; ACL de triggers sólo tras prueba. | Pruebas de nombres, invocación anidada y ausencia de cambios en resultados. | Medio/alto; definición y ACL previas por firma, nunca copiar secretos históricos a un rollback. |
| S-M05 | Policies de gerencia_phones y grants de columnas sensibles/settings. | Decisión de alcance entre tenants, frontend compatible y contrato de administración de secretos. | Alto; lote dividido por objeto, sin tocar reglas de negocio. |
| S-M06 | Defaults futuros de EXECUTE/CRUD y permisos de secuencias por consumidores. | Revisar todos los owners y migraciones futuras; no cortar funciones de constraints privadas. | Medio; restaurar sólo defaults modificados. |

Protección de conversions/otros handlers es un despliegue de autorización separado, no una migración SQL que finja proteger Edge. pg_net/plataforma, traslado a schema API dedicado, rotación y cambio a publishable quedan fuera del primer lote y necesitan diseño/aprobación específica. Mover tablas a otro schema ahora rompería clientes y no se propone.

## 8. Tests previstos de compatibilidad y seguridad

Ejecutar en el bootstrap local de Fase 0, con red aislada, cron detenido y datos sintéticos. Meta, Telegram, PBAdmin y cualquier proveedor simulados. Roles: anon, authenticated de A/B, admin de aplicación acreditado, service_role, authenticator y postgres. Una sesión PostgreSQL por principal y claims transaccionales, sin reutilizar estado entre casos.

1. Matriz completa por cada objeto/rol/operación del inventario; ACL efectivas incluyendo PUBLIC, herencia, columna, schema y secuencia. RLS de owner/admin/otro tenant/nulo; UPDATE con USING y WITH CHECK, views y funciones anidadas.
2. profiles: intento de modificar role/id/created_at rechazado; edición autorizada permitida; administrador no deriva de datos editables ni de user_metadata. Alta de clientes y administración existentes siguen funcionando.
3. TRUNCATE local revertido; cero filas alteradas; DELETE legítimo preservado; persistencia de restricciones después de otra migración y roles creadores/defaults.
4. RPC: cada firma y sobrecarga, auth.uid nulo, tenant propio/ajeno/admin; llamadas directas e indirectas; triggers ante INSERT/UPDATE/DELETE; sustitución de objetos/nombres temporales sintéticos. No ejecutar wrappers cron reales: stubs de HTTP dentro del entorno aislado y rollback de cola.
5. conversions: cada canal legítimo, credencial ausente/incorrecta/otro tenant/caducada, backend y replay interno. Afirmar cero escritura y cero envío para denegados. OPTIONS y errores de autenticación explícitos. sendBeacon, payload intacto, nombre de cliente correctamente vinculado; credencial pública nunca equivale a sesión/admin.
6. Paridad de Contact/Lead/Purchase autorizados: mismos bytes semánticos de payload, event_id/event_time, monedas ARS/PYG, purchase_type, atribución, deduplicación, orden e instante lógico de envío y respuestas de negocio. Reejecutar la caracterización concurrente, sin esperar que desaparezcan duplicaciones conocidas. No prometer latencia idéntica: medir el coste técnico de auth y no cambiar buffers/reintentos.
7. Cron/retries: secretos sintéticos, colas previas y reintentos viejos siguen autorizados; firma técnica renovable sin alterar event_time. No reenvíos sombra, ni dobles handlers, ni una ejecución de prueba de Meta real.
8. Secretos: resultados Data API/RPC/bundles/HTML/logs no incluyen credenciales almacenadas; guardado autorizado sin relectura cuando se apruebe ese contrato; service_role nunca alcanza navegador, tercero ni fixture.
9. Panel y público: Inicio, Conversiones, Audiencias, Landings/Editor, Teléfonos, integraciones/WhatsApp, promociones y revalidate. Usar sesión real donde se diseñe, sin cambiar reglas de las pantallas. GraphQL/Realtime y restore/schema cache en local cuando sean consumidores confirmados.

Gate futuro: primero las 446 comprobaciones contra el baseline inmutable; luego regresión de contratos legítimos más nuevos casos de seguridad, TypeScript/build/ESLint y dos reconstrucciones con las migraciones nuevas. Las matrices de Fase 0 caracterizan también permisos inseguros (por ejemplo TRUNCATE permitido): deben seguir probando ese baseline, no exigirse sin cambios como expectativa del esquema endurecido. Añadir expectativas de autorización versionadas para cada diferencia aprobada; no modificar el baseline para esconderla. Los tests del handler pueden necesitar credenciales sintéticas en el transporte del fixture, conservando todos los payloads y aserciones de negocio. Ninguna autorización nueva debe interpretarse como arreglo de las duplicaciones concurrentes.

Revisados como evidencia: scripts/phase0/run-handler-concurrency.mjs (incluye expectativas de ocho envíos Lead concurrentes), run-concurrency.mjs, bootstrap-compatibility.test.mjs, supabase/tests/phase0_purchase_claims.test.sql (EXECUTE de claims denegado a authenticated), frontend/tests/phase0PhoneHandlers.test.ts y metaAudienceDataApi.integration.test.ts. Sus coberturas no sustituyen una matriz completa de autorización del proyecto.

Los 446 aprobados pertenecen a Fase 0: no se reejecutaron ni se contabilizan como aprobación de 1A. En esta etapa se valida documentación/metadata, no una reparación.

## 9. Despliegue gradual y rollback

Orden propuesto: S01 profiles; TRUNCATE; RPC internos y reporting antiguo; consumidores administrativos; autorización de conversions por canal; columnas/policies de mayor impacto. La protección de rol debe preceder depender de checks de admin. Cada lote tiene diff, ACL anteriores, tests y aprobación propios. Empezar por local/staging, después un grupo de emisores aprobado; no seleccionar al azar eventos reales ni duplicarlos para comparar.

Antes de cada lote remoto futuro: snapshot sólo de definiciones/ACL sanitizadas, confirmar fingerprint base, detectar drift y abortar ante diferencias. Para deploy de autorización, versionar mecanismo por canal y conservar un paquete anterior íntegro; secretos en almacén seguro, nunca en el repositorio/rollback. No cambiar ni apagar cron para hacer coincidir una prueba en producción.

Local/CI debe ejecutar primero las 268 históricas y la compatibilidad de Fase 0 sin cambios, verificar su paridad, y después aplicar las futuras migraciones incrementales aprobadas por el procedimiento normal. No añadirlas al manifiesto cerrado de 268 ni editar la historia. El diff posterior contendrá cambios de seguridad intencionales por lote; acreditarlos como cambios aprobados, no normalizarlos como diferencias inocuas de plataforma. Confirmar dos resultados finales idénticos y la regresión del baseline por separado.

Observar únicamente contadores agregados: autorizaciones/denegaciones por mecanismo y razón, 401/403 inesperados, errores de permisos, cola por estado/antigüedad agregada y retraso de servicio. Definir duración y umbrales con el responsable antes de la primera activación; falta de censo o de ventana acordada bloquea enforcement, no se reemplaza por un número inventado. Para errores de un emisor conocido, detener el lote y revertir su control de acceso, sin vaciar colas ni cambiar el tratamiento de eventos.

Rollback SQL restaura ACL/policies/definiciones exactas del lote, sin restaurar tablas/datos ni resetear secuencias. No ejecutar un rollback general del schema. Restaurar una exposición crítica requiere decisión explícita de riesgo; preferir reparar el grant específico legítimo. Rollback de código restaura sólo la versión de autorización/transportes aprobada; conserva colas, secretos vigentes y contratos de envío. Revocar autorización a mitad de un request no debe lanzar un segundo intento de negocio.

## 10. Decisiones que requieren aprobación

1. Quién administra role y qué columnas del perfil puede editar un usuario; habilitar S-M01 sólo con contrato confirmado. No se solicita enviar valores de credenciales.
2. Censo de emisores externos de conversions: cuáles requieren entrada anónima, cuáles admiten headers/firma, responsable y tenant permitido. Aprobar riesgo residual de visitantes públicos; no es posible autenticar como secreto algo distribuido a todos los navegadores.
3. Autorizar en la fase de implementación adaptar únicamente headers/sesión de Teléfonos y transportes internos, sin modificar contadores, payloads ni lógica de eventos. El cliente actual usa anon: revocar primero lo rompería.
4. Confirmar si algún usuario autenticado debe leer teléfonos de otro tenant; corregir la correlación de la policy sólo bajo ese alcance de acceso. No decidir por el nombre de la policy.
5. Aprobar que tokens almacenados no vuelvan al browser y definir la administración de credenciales sin relectura. Hasta migrar SELECT * y guardados existentes, no revocar a ciegas.
6. Confirmar configuración hosted de Data API/GraphQL y consumidores SQL externos; cerrar los contratos pendientes de RPC públicas/legacy antes de retirarlas.
7. Aprobar lotes, grupo inicial, ventanas, umbrales, autoridad para rollback y tratamiento separado de pg_net/token histórico/publishable. Ningún despliegue está autorizado por este documento.

## Límites y pendientes fuera de esta fase

No se corrigieron duplicación concurrente de Lead, duplicación de reintentos CAPI, procesamiento doble de Lead diferido ni incrementos perdidos. No se proponen claims, leases, nueva idempotencia, event_id estable ni SKIP LOCKED aquí. Permanecen en la futura fase de concurrencia. Optimizaciones de Conversiones/Audiencias, percentiles, consultas y timeout ARS siguen fuera del alcance.

No se sostiene que todas las credenciales del deployment estén clasificadas: sólo se revisaron referencias de código y metadata, sin leer valores. No se reabrieron fixtures ni logs productivos. El perfil temporal Chromium de Fase 0 no se utilizó ni limpió. El checkpoint permanece intacto; las únicas incorporaciones son documentos en esta carpeta.

## Referencias oficiales consultadas

Se aplicó la skill Supabase del plugin instalado; la documentación es portable y no depende de su ubicación en una PC.

- [Autenticación de Edge Functions](https://supabase.com/docs/guides/functions/auth): distinguir usuario, servicio y webhook; este diseño no exige instalar otro SDK.
- [Authorization y apikey](https://supabase.com/docs/guides/functions/auth-headers): la configuración del gateway no sustituye autorización de tenant; publishable no es un JWT.
- [Protección de Data API](https://supabase.com/docs/guides/api/securing-your-api): combinar exposición, grants y RLS, incluyendo RPC.
- [Funciones PostgreSQL en Supabase](https://supabase.com/docs/guides/database/functions): permisos de ejecución y contexto de seguridad.
- [PostgreSQL: RLS](https://www.postgresql.org/docs/17/ddl-rowsecurity.html) y [CREATE FUNCTION](https://www.postgresql.org/docs/17/sql-createfunction.html): excepciones de RLS y resolución segura de nombres de DEFINER.
- [Changelog](https://supabase.com/changelog): consultado tras no poder renderizar changelog.md. Los cambios anunciados de defaults Data API, gateway self-hosted y extensiones requieren verificar la configuración concreta antes de implementar; no se actualizó ningún componente ni se asumió adopción automática en este proyecto.

Dictamen: diseño 1A entregado para revisión; ninguna remediación aplicada. La implementación requiere resolver las decisiones y límites por lote. No se inició Fase 0C ni optimización de Fase 1.
