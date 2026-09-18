Diagnóstico del contrato y destinos de revalidación — Fase 1B.2
============================================================

Fecha de inspección: 2026-09-17, America/Buenos_Aires (consultas DNS del 2026-09-18 UTC).

**Conclusión:** se encontró el receptor clásico en el repositorio local hermano `landing-prueba-1`. Su contrato permite trasladar el POST al servidor sin cambiar la invalidación ni el calentamiento legítimos. Se recomienda **B: catálogo servidor de destinos fijos por entorno**, separado de `settings.url_base`. Falta acreditar la asociación productiva dominio → proyecto → código desplegado y el control administrativo de esos destinos. No se habilita ningún destino ni se implementa el puente en este diagnóstico.

**1. Alcance, evidencia y límites**

- Builder: rama `main`, HEAD `31babbb9eec24afa37930fc616b6d97448b4c7e9`.
- Receptor encontrado: repositorio hermano `landing-prueba-1`, HEAD `3322b634a06504ae469a4faee0383148707bc9b5`, árbol de trabajo limpio al inspeccionarlo. Su paquete se denomina `landing-runtime`.
- Se inspeccionaron fuentes, historia local, documentación y metadatos no sensibles de vinculación a Vercel. Las únicas consultas nuevas de infraestructura fueron DNS públicos de tres dominios; no se llamó a endpoints de revalidación ni a APIs de cuentas o bases remotas.
- No se leyeron archivos de entorno ni valores productivos de `settings`, secretos, credenciales o configuraciones remotas. No se comprobó la igualdad entre el secreto de la base y el del receptor.
- No se ejecutaron suites, build, migraciones, reconstrucciones ni despliegues. Las pruebas de la sección 9 son pendientes, no resultados aprobados.
- Único archivo agregado por este diagnóstico: `docs/security/phase-1b2/revalidation-contract-diagnostic.md`. Los cuatro documentos anteriores se conservan byte por byte. Su inventario de cuatro archivos describe el corte anterior, no este agregado.
- No se modifican aplicación, repositorio hermano, configuración, base, migraciones ni recursos Docker. No hay staging, commit, push ni escritura remota.

Fuentes principales, todas locales salvo las referencias técnicas enlazadas al final de sus afirmaciones:

| Fuente | Evidencia relevante |
| --- | --- |
| `frontend/lib/settingsDb.ts:15,32` | Lectura y escritura de la fila global `settings.id = 1`; la lectura incluye actualmente el secreto. |
| `frontend/lib/landing/publicUrls.ts:3` | Dominios predeterminados, precedencias y URLs públicas por motor. |
| `frontend/lib/landing/publishLanding.ts:39` | POST del navegador, secreto en JSON y manejo diferente de fallos clásico/constructor. |
| `frontend/app/api/revalidate/route.ts:58,147` | Receptor del constructor, verificación y calentamiento. |
| `frontend/components/landing/PublishTargetSection.tsx` | Dos motores, enlaces y explicación del proyecto clásico independiente. |
| `frontend/README.md:147` | Contrato documentado histórico; describe además un GET desde el cliente que el helper actual ya no realiza. |
| [Receptor clásico](../../../../landing-prueba-1/app/api/revalidate/route.ts) | Contrato ejecutable local del runtime clásico. |
| [Configuración clásica en caché](../../../../landing-prueba-1/app/api/config/route.ts) | Configuración por nombre y tag `landing-config:<name>`. |
| [README clásico](../../../../landing-prueba-1/README.md) | Endpoint, secreto de entorno compartido y desarrollo local. |

Huella SHA-256 del receptor clásico inspeccionado: `95ababcf9de45258cc70ea30665e3026c7539759ff693dd39971c7cea409b0d7`. Del README clásico: `3d117dfcbb882f9199fb7b86a063754db82a78d620b11a94c1391e5c0901f88f`. Identifican evidencia local; no certifican un despliegue.

**2. Todos los usos acreditados de `settings.url_base`**

Lectura compartida: `getSettings()` selecciona explícitamente `id, url_base, show_client_landing_preview, revalidate_secret`. Las seis pantallas reciben, por tanto, el secreto incluso cuando sólo necesitan enlaces o una bandera. El comentario del helper que dice “Solo admins” no basta como control: una migración posterior concede lectura mediante política a usuarios autenticados.

| Consumidor | Lectura/uso actual de `url_base` | Escritura |
| --- | --- | --- |
| `frontend/app/(panel)/admin/settings/page.tsx:29` | Muestra el campo URL base. Su texto de ayuda mezcla enlaces y revalidación. También muestra/edita el secreto. | `updateSettings()` desde el formulario; conserva URL recortada, bandera y secreto. |
| `frontend/app/(panel)/admin/tests/page.tsx:257` | Exige URL base no vacía; compone directamente `<url_base>/api/revalidate`. Este botón prueba el clásico, sin derivar el motor de `publish_target`. | Ninguna de URL base. |
| `frontend/app/(panel)/admin/landings/[id]/editar/page.tsx:213` | Pasa la base al publicador y al selector de motor para mostrar/copiar URLs. | Ninguna de URL base. |
| `frontend/app/(panel)/dashboard/landing/[id]/editar/page.tsx:222` | Igual uso para el editor del cliente; también obtiene la bandera de preview. | Ninguna de URL base. |
| `frontend/app/(panel)/admin/landings/page.tsx:55` | Enlaces de las tarjetas. Para landings externas forma base/nombre o `#`; para los demás motores usa el helper de URLs. | Ninguna. |
| `frontend/app/(panel)/dashboard/landings/page.tsx:54` | Mismos enlaces en el listado del cliente. | Ninguna. |
| `supabase/functions/conversions/index.ts:4048` | `deriveEventSourceUrl`: si no viene URL en el payload, lee únicamente `url_base` y compone base/nombre como alternativa. Uso no relacionado con el secreto. | Ninguna. Se registra la dependencia; queda fuera de cambios y pruebas de esta fase. |

Lectores indirectos: `PublishTargetSection` muestra y copia URLs; `publicUrls.ts` decide la base pública; `publishLanding.ts` reutiliza hoy esa misma base como destino del POST. El helper público prioriza `url_base`, luego `NEXT_PUBLIC_CLASSIC_LANDING_BASE_URL`, luego `https://landing.panelbotadmin.com`; para constructor usa `NEXT_PUBLIC_CONSTRUCTOR_LANDING_BASE_URL` o `https://mkt.panelbotadmin.com`, con ruta pública `/l/<name>`. La normalización de barras finales no es una validación de confianza.

Único escritor funcional encontrado: `updateSettings()`, llamado por Configuración. La migración inicial crea la fila con URL vacía. No se encontraron otros escritores activos de la columna. La autorización efectiva de la escritura corresponde a grants y RLS, no al hecho de que el formulario esté bajo `/admin`.

Otras apariciones no son consumidores productivos adicionales: comentario de `builder-config`, documentación, catálogos/evidencia histórica y fixtures de `scripts/phase0/screen-fixtures.mjs` y `handler-schema.mjs`. La búsqueda de nombres de campo y variable no encontró otros lectores directos activos de `settings` fuera del helper y el lector de backend indicado.

`public_landing_runtime` y `public_landing_legacy_base_url` son columnas diferentes, creadas por `20260613090000_public_landing_runtime_switch.sql`. Su RPC pública devuelve solamente esas dos columnas. No hay consumidor activo del antiguo proxy global en el frontend actual; su historia no demuestra el enrutamiento desplegado de hoy. No deben reutilizarse como catálogo confiable ni reactivarse aquí. Tampoco debe usarse `external_domain` de una landing como destino del secreto.

**3. Contrato clásico acreditado por código local**

| Elemento | Comportamiento encontrado |
| --- | --- |
| Servicio | Next.js del repositorio hermano; dependencia declarada `^15.5.22`. El builder declara Next.js `16.1.6`. No se propone actualizar versiones. |
| Ruta/método | `POST /api/revalidate`; también `OPTIONS` con 204. No exporta handler GET. |
| Dominio | El handler no fija uno. El builder propone por defecto `https://landing.panelbotadmin.com`, pero hoy la URL efectiva puede reemplazarse desde `settings.url_base` o configuración pública. No se consultó el valor productivo. |
| Entrada | `Content-Type: application/json`, cuerpo `{ "name": "<nombre>", "secret": "<secreto>" }`; no requiere query. Convierte ambos campos a string y recorta `name`. |
| Autenticación actual | Compara `body.secret` con `process.env.REVALIDATE_SECRET`, que debe ser no vacío. No consulta `settings`, sesión Supabase ni roles. |
| Invalidación | `revalidatePath('/' + name)` y `revalidateTag('landing-config:' + name)`. |
| Calentamiento | Sobre el origen de la solicitud recibida: GET `/api/config?name=<codificado>&_ts=<timestamp>`, luego GET `/<codificado>?warm=1&_ts=<timestamp>`. Si falla el segundo, espera 250 ms y lo reintenta una vez. Cada GET tiene límite de 5 segundos. |
| Éxito | HTTP 200, JSON `{ revalidated: true, path, warmedConfig, warmedPage, warmedPageRetry }`. Puede devolver 200 con calentamiento fallido; eso no invalida el resultado de invalidación. |
| Credencial inválida/ausente | HTTP 401, `{ error: 'Invalid secret' }`. |
| Nombre vacío con credencial válida | HTTP 400, `{ error: 'Missing name' }`. |
| Excepción, incluido JSON inválido | HTTP 500, `{ error: 'Revalidate failed', details: <mensaje de excepción> }`. No hay garantía de que el mensaje interno nunca incluya entrada sensible. No se reprodujo contra producción. |
| CORS | Orígenes de `ALLOWED_ORIGINS`; si falta una coincidencia responde con el primer configurado o `*`. Esto no autoriza al solicitante ni impide clientes HTTP ajenos al navegador. |

El receptor no registra explícitamente el secreto ni lo devuelve en los campos normales de éxito. La rama genérica `details` impide prometer ausencia universal de filtraciones: un error de parseo puede incluir fragmentos del cuerpo. El futuro puente debe responder con códigos propios y campos permitidos, nunca reenviar cuerpos/errores crudos. Para cubrir también llamadas directas al receptor, se necesita un cambio mínimo de saneamiento en ese repositorio y comprobar la configuración de logs del despliegue, sin leer registros con secretos.

No hay redirects explícitos en este handler ni reglas `redirects`/`rewrites` en el `next.config.mjs` inspeccionado. Los fetch del navegador y del calentamiento no configuran `redirect`; su valor predeterminado es `follow`. No se verificaron redirects de CDN, normalización de rutas o dominios en producción. [Referencia de Request.redirect](https://developer.mozilla.org/en-US/docs/Web/API/Request/redirect).

El código local acredita la forma del contrato, no que ese mismo commit esté atendiendo actualmente el dominio. Tampoco acredita quién tiene hoy acceso administrativo al dominio o al proyecto remoto.

**4. Contrato constructor y diferencias que deben preservarse**

`frontend/app/api/revalidate/route.ts` recibe el mismo cuerpo con `name` y `secret`. Primero compara con `REVALIDATE_SECRET` del servidor; si no coincide, llama con la clave anon a `verify_revalidate_secret(p_secret)` mediante Data API. La migración histórica concede ejecución de esa RPC a `anon` y `authenticated`; no devuelve el valor, pero ofrece un verificador público. La futura restricción debe retirar esa dependencia pública y sustituirla por verificación exclusivamente backend, sin añadir otro `SECURITY DEFINER`.

Devuelve 400 para JSON/nombre inválidos, 401 para secreto inválido. Invalida `/l/<name>`, `/<name>` y el tag de configuración; calienta `/l/<name>` con un límite de 8 segundos. En éxito devuelve 200 con `ok: true`; si el calentamiento falla, 502 con `ok: false`, `error: 'warm_failed'`, rutas y objeto `warmed`. Este último puede contener mensaje de excepción y URL derivados del calentamiento; el puente no debe propagarlos sin proyección.

El publicador actual conserva el guardado aunque falle el clásico y devuelve `revalidated: false`; en constructor lanza un aviso de que se guardó pero no se publicó al instante. Debe mantenerse esa diferencia. Para clásico, un 200 válido con `warmedPage: false` seguirá siendo una invalidación completada. La aceptación accidental actual de un 200 no JSON no debe convertirse en contrato de éxito: se necesita validar las respuestas del servicio y dar un error seguro ante respuestas anómalas.

El README del builder describe un GET de calentamiento desde el navegador después del POST. El helper actual sólo hace POST; el receptor clásico ya ejecuta los GET. No se debe agregar un segundo calentamiento en el cliente para reproducir documentación antigua.

**5. Destinos y entornos: encontrado frente a confirmado**

| Entorno/destino | Evidencia local | Estado para el catálogo |
| --- | --- | --- |
| Producción clásica: `https://landing.panelbotadmin.com:443/api/revalidate` | Default de `publicUrls.ts`, documentación y receptor clásico local compatible. | Candidato concreto. Pendiente asociación dominio/proyecto/versión y control administrativo. |
| Producción constructor: `https://mkt.panelbotadmin.com:443/api/revalidate` | Default de `publicUrls.ts` y receptor del builder. | Candidato concreto. Pendiente acreditar el despliegue que posee esa caché. |
| `https://constructor.panelbotadmin.com` | Origen entrante en la lista CORS del builder. | No demuestra que sea destino saliente de revalidación ni alias del mismo despliegue. No agregar por inferencia. |
| Clásico local: `http://localhost:3000` | README del runtime y script `next dev` sin puerto explícito. | Entorno local acreditado documentalmente; proceso activo y puerto efectivo no verificados. |
| Builder local: puertos 3000, 3001 y 3017 | Orígenes permitidos por CORS; comentario del clásico menciona constructor en 3001. | CORS no acredita tres receptores. Propuesta de pareja local: clásico en 3000 y builder en 3001, fijados desde servidor al implementar. |
| Staging/preview | No se encontró dominio fijo propio ni catálogo de staging en fuentes/configuración no sensible. Vínculos Vercel permiten identificar proyectos, no previews activos. | Deshabilitado hasta acreditar destino y aislamiento. Ningún comodín `*.vercel.app`. |

Metadatos locales de Vercel: builder vinculado al nombre `landing-builder-v2-k259` (raíz y frontend); runtime clásico a `public-landing-bl`. La comparación local de identificadores da una misma organización y proyectos distintos. Se omitieron los identificadores. Estos archivos no prueban permisos actuales, asignación de dominios ni despliegues vigentes.

DNS público, observación del 2026-09-18 entre 00:43:12 y 00:43:13 UTC: el clásico resolvió por CNAME `8ed2ce59f006d60c.vercel-dns-017.com`; `mkt` y `constructor` por `79169ceea18005cc.vercel-dns-017.com`. Las respuestas A fueron públicas y no hubo AAAA. Esto es compatible con alojamiento en Vercel. Compartir CNAME no prueba compartir proyecto, versión ni caché. No se fijarán esas IP observadas como configuración permanente.

Quién controla los destinos: sólo se acredita la vinculación local a una organización Vercel común. El titular del dominio y los administradores remotos autorizados permanecen **no acreditados**; se requiere confirmación no sensible de su responsable o metadatos de despliegue. No se pidió ni inspeccionó ninguna credencial.

**6. Alternativas y recomendación**

| Alternativa | Adecuación al repositorio | Decisión propuesta |
| --- | --- | --- |
| A. Un destino productivo fijo | Simple para el clásico productivo, pero existen dos motores con rutas/cachés distintas y desarrollo local. Un fallback de desarrollo a producción sería inaceptable. | Insuficiente para todo el flujo actual. Útil sólo si el alcance se limitara a un motor y entorno. |
| B. Destinos fijos por entorno | Conserva POST al runtime que posee cada caché, admite ambos motores y separa local/producción. No depende del campo editable. | **Recomendada**, con staging cerrado por defecto y activación sólo tras acreditar destinos. |
| C. Invalidación interna, sin HTTP externo | Viable únicamente cuando el código servidor se ejecuta en el mismo despliegue/caché que la landing. El clásico está en otro repositorio y vinculado a otro proyecto. La arquitectura actual también necesita calentamiento. | No reemplaza el clásico. Evaluar después para constructor sólo si se acredita el despliegue común y se preserva el calentamiento; no ampliar esta fase para unificar proyectos. |

Next.js permite `revalidatePath` en funciones servidor y Route Handlers; desde un Route Handler marca la ruta para revalidación en la siguiente visita. No hay en estos repositorios un mecanismo acreditado que haga que una llamada local invalide por sí sola la caché de otro proyecto. Esa limitación arquitectónica y la separación de repositorios fundamentan la recomendación B. [Documentación de Next.js](https://nextjs.org/docs/app/api-reference/functions/revalidatePath).

**7. Diseño concreto propuesto, todavía sin implementar**

Catálogo exclusivamente servidor, con identificadores lógicos sin URL incorporada:

| Identificador de entorno | Motor `classic` | Motor `constructor` |
| --- | --- | --- |
| `production` | URL clásica exacta de la sección 5, una vez acreditada | URL constructor exacta de la sección 5, una vez acreditada |
| `staging` | Deshabilitado | Deshabilitado |
| `local` | Propuesta: `http://localhost:3000/api/revalidate` | Propuesta: `http://localhost:3001/api/revalidate` |

Los nombres son identificadores opacos para la API, no credenciales ni autorización. El entorno se selecciona desde configuración servidor del despliegue. No se infiere sólo de `NODE_ENV`, porque un preview también puede ser un build de producción. Una configuración ausente o desconocida falla cerrada, sin fallback a producción, `settings`, variables `NEXT_PUBLIC_*`, `Host`, `Origin` o URLs aportadas por el navegador. La configuración servidor valida la combinación entorno/destino al iniciar.

Flujo previsto:

1. El navegador solicita una acción a una ruta del mismo panel, propuesta `POST /api/landings/revalidate`: `{ action: 'publish', landingId }` o `{ action: 'test-classic', name }`. El discriminante selecciona una operación con autorización propia, nunca una URL. El botón de prueba administrativa conserva el nombre que ya usa, validado con esquema acotado. Ninguna operación admite URL, secreto o entorno seleccionable. Un GET autenticado y reservado a administradores en esa misma ruta puede devolver exclusivamente `{ configured: boolean }` para Configuración, sin ejecutar revalidación.
2. El servidor valida el token de sesión con Supabase Auth y consulta autorización efectiva: administrador o usuario autorizado sobre esa landing. No basta `getSession()` sin validación ni una ruta bajo `/admin`. La prueba clásica exige administrador. No se copian cookies ni Authorization del usuario al receptor externo.
3. Para publicación, obtiene nombre y `publish_target` desde la landing autorizada en base. Para el botón administrativo conserva la operación clásica por nombre; limita su sintaxis a un nombre de landing válido, sin rutas, URLs ni query. No hace que un navegador elija entre endpoints. Un nombre legítimo inexistente puede seguir recibiendo el resultado de invalidación del clásico; no se introduce un requisito nuevo de existencia sólo para el diagnóstico administrativo.
4. Selecciona `{entorno, motor}` en el catálogo, valida destino y resolución de red. Sólo entonces obtiene la credencial necesaria dentro de un módulo `server-only` y envía el JSON original `{ name, secret }` al receptor aprobado.
5. Valida la respuesta, limita tamaño y tiempo y devuelve únicamente un resultado propio: estado, invalidación, booleanos de calentamiento y código de error fijo. No devuelve el cuerpo upstream, `details`, el secreto, cabeceras de autenticación ni mensajes crudos de excepciones.

El catálogo de URLs y el origen de la credencial son conceptos distintos. Para el primer cambio puede conservarse `settings.revalidate_secret` como fuente backend de la credencial compartida, sin trasladarla a configuración pública. La lectura necesita sólo SELECT desde servidor; las acciones de revalidación no necesitan UPDATE, INSERT ni DELETE de esa columna. El verificador constructor debe dejar de depender de la RPC pública. El clásico continúa verificando su variable servidor. Staging/local usan credenciales propias sintéticas o aisladas, jamás una credencial de producción. No se cambia ni lee el valor actual para diseñar esto.

Controles de destino y transporte:

- Coincidencia exacta de protocolo, hostname normalizado, puerto efectivo y ruta `/api/revalidate`. HTTPS obligatorio en producción/staging. Sin userinfo, fragmentos, query, sufijos de dominio, subdominios comodín ni rutas alternativas. `:443` explícito e implícito representan el mismo puerto efectivo; no se compara mediante prefijos de strings.
- Ninguna entrada del navegador, campo editable, nombre de landing, URL pública o cabecera puede sustituir el origen de conexión. Cambiar `url_base` no cambia el catálogo. El nombre viaja como dato JSON, no formando el destino del POST.
- `redirect: 'error'` explícito: cualquier 3xx se trata como error y no genera una segunda solicitud. La canonicalización de host/path debe resolverse con un destino aprobado antes del despliegue, nunca siguiendo el redirect con el secreto.
- En producción/staging se rechazan literales IP y resoluciones no públicas: redes privadas, loopback, link-local, metadata, ULA, direcciones no especificadas/multicast y variantes IPv4 encapsuladas en IPv6. Se revisan A y AAAA, no sólo la primera respuesta. No debe existir una ventana entre validar DNS y conectar a otra resolución: usar resolución validada en el transporte manteniendo hostname TLS/SNI, o control de egreso equivalente verificable.
- Loopback se admite sólo para entradas locales exactas, runtime local explícito y secreto sintético. Nunca desde producción o previews, incluso ante un identificador manipulado. Los puertos locales son parte de la configuración del servidor.
- Límite propuesto del POST clásico: 20 segundos, a validar contra el presupuesto actual de hasta tres GET de 5 segundos y una espera de 250 ms más invalidación. No reintentar automáticamente el POST. Conservar el reintento de calentamiento ya existente dentro del clásico.
- Los GET internos de calentamiento también requieren origen servidor confiable y redirects deshabilitados; no deben depender de un `Host` arbitrario. Usan rutas derivadas y nombre codificado, nunca llevan el secreto. Esto requiere un ajuste acotado de los receptores, sin alterar qué páginas invalidan ni los resultados booleanos de calentamiento.
- Logs permitidos: identificador de operación, entorno/motor, código fijo y estado HTTP. Sin payloads, credenciales, errores crudos, cuerpos upstream o serialización de objetos cliente. Responses y Server Components sólo reciben tipos sin secreto; la configuración se marca `server-only` y nunca usa prefijo `NEXT_PUBLIC_`.

La recomendación de allowlists estrictas, bloqueo de redirects y protección frente a resolución DNS que termine en redes internas sigue la guía de SSRF de OWASP. Validar un string URL una sola vez y luego ejecutar un fetch que resuelva/conecte libremente no cubre esos riesgos. [Guía de prevención SSRF](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html).

**8. Migración de las seis pantallas y archivos previstos**

Se conserva `url_base` como dato no sensible para construir enlaces, copiado de URLs y el lector de backend ya indicado. No se renombra ni elimina la columna, ni se cambian precedencias de URLs públicas o campos externos. Su ayuda en Configuración deberá aclarar que no controla la revalidación. Una URL de una campaña no pasa automáticamente a ser un destino autorizado para secretos.

| Pantalla | Cambio futuro acotado | Comportamiento legítimo que se conserva |
| --- | --- | --- |
| Configuración admin | Quitar lectura/escritura/estado del secreto; reemplazar input y botón de mostrar por estado “configurada/no configurada”, obtenido como booleano servidor. Mantener URL base, bandera y nombre del perfil. | Guardado de ajustes no sensibles. La gestión del secreto pasa a operación servidor. |
| Tests admin | Cambiar únicamente el handler de revalidación por la acción servidor clásica; mostrar resultado tipado y errores seguros. | Campo nombre, botón, progreso, resultado y diagnóstico clásico. No tocar otros botones ni sus flujos. |
| Editor admin | Eliminar estado/parametrización del secreto; enviar ID a la acción después del guardado. | Motor elegido, enlaces, guardado, navegación y diferencia de errores clásico/constructor. |
| Editor cliente | Igual cambio, con autorización sobre su landing. | Preview, edición propia, enlaces y publicación permitida. No convertir la acción en exclusiva de administradores. |
| Listado admin | Consumir proyección explícita segura de settings. | Tarjetas y URLs actuales, incluidas landings externas. |
| Listado cliente | Misma proyección segura. | Listado, permisos y enlaces actuales. |

No es posible conservar literalmente el control visible que muestra/edita el secreto y simultáneamente garantizar que el navegador nunca lo reciba ni lo envíe. Se propone conservar las funciones de negocio y reemplazar ese único control por un estado no sensible. Los mensajes técnicos de CORS/secretos y los errores upstream crudos también deben convertirse en mensajes seguros; no se promete identidad textual de errores inseguros.

Cambios previstos por archivo, **ninguno realizado ahora**:

| Archivo | Modificación prevista |
| --- | --- |
| `frontend/lib/settingsDb.ts` | Tipo/proyección sin secreto y actualización limitada a campos no sensibles. |
| Las seis rutas `page.tsx` enumeradas en la sección 2 | Adaptaciones exactas de la tabla anterior. |
| `frontend/lib/landing/publishLanding.ts` | Cliente de la acción autenticada; sin secreto ni URL de transporte. Puede conservar cálculo de URL pública por separado. |
| Nuevo `frontend/lib/revalidation/catalog.server.ts` | Catálogo, selección servidor del entorno y validación de URL/red. |
| Nuevo `frontend/lib/revalidation/service.server.ts` | Autorización, lectura backend mínima, transporte y proyección segura de respuestas. Separar transporte en otro archivo sólo si lo requiere la implementación. |
| Nueva `frontend/app/api/landings/revalidate/route.ts` | Frontera autenticada del panel: POST para publicación/prueba clásica administrativa y GET administrativo del estado configurado, con cuerpos discriminados sin URL. |
| `frontend/app/api/revalidate/route.ts` | Verificación backend sin RPC anon, errores estáticos y calentamiento a origen confiable sin redirects; preservar contrato constructor. |
| `frontend/README.md` | Actualizar contrato, configuración servidor y separación de URL pública/destino. |
| Futura migración 270, nombre/timestamp aún no generados | Grants de columna efectivos, proyecciones necesarias y retiro de ejecución pública del verificador; conservar las 269 existentes. Antes de crearla, consultar ayuda de CLI como exige la fase. |
| Pruebas nuevas acotadas de settings/revalidación y runners locales afectados | SQL, Data API, autorización, transporte, frontend y canario sintético. Se concretarán antes de implementar, sin tocar suites ajenas. |
| `docs/security/phase-1b2/` | Registrar posteriormente implementación, evidencia e inventario; los cuatro documentos previos siguen protegidos en este diagnóstico. |
| Repositorio hermano: `app/api/revalidate/route.ts` | Pendiente autorización de alcance: quitar `details`, errores estáticos, origen fijo de calentamiento y redirects deshabilitados. No cambiar invalidación ni exponer secretos. |

No se prevén cambios en `publicUrls.ts`, `PublishTargetSection`, rutas que sirven landings, lógica de negocio ni lectores ajenos a esta fase. Tampoco se modifica ninguna configuración de despliegue ahora. Los nombres de archivos nuevos son propuesta, no inventario de archivos creados.

**9. Pruebas necesarias antes de implementar/cerrar**

1. **Contrato sintético local:** levantar runtime clásico y builder aislados con secreto sintético; verificar POST, ambos motores, paths/tags, secuencia de calentamiento, reintento, 200 clásico con warm fallido, 401, 400, errores y timeout. Comprobar que ninguna respuesta refleja el canario, incluso frente a JSON inválido y errores artificiales. No invocar acciones de las pantallas ajenas a revalidación.
2. **Autorización:** sin sesión, sesión vencida/falsa, cliente sobre landing ajena, cliente sobre propia, administrador y prueba clásica administrativa. Alterar ID/nombre/motor/env/URL en solicitudes no debe ampliar permisos ni cambiar destinos. El acceso del navegador a una clave pública de Supabase no reemplaza autorización.
3. **Destinos:** coincidencias exactas, dominios parecidos, puertos/rutas/query inesperados, userinfo, variantes de IP, DNS con A/AAAA internos, rebinding y producción intentando seleccionar local. Simular todos los redirects relevantes y acreditar cero solicitudes al destino de `Location`. Verificar resolución/conexión real del transporte, no sólo un mock del parser.
4. **Separación de URL pública:** cambiar `url_base` a un dominio sintético controlado debe cambiar sólo los enlaces esperados y producir cero solicitudes con secreto hacia él. Mantener el lector no sensible de backend sin modificar su implementación.
5. **Grants y Data API:** demostrar permisos efectivos además de RLS. `PUBLIC`, `anon` y `authenticated` no pueden leer/insertar/actualizar el secreto por nombre, alias, `select=*`, vistas o RPC; payloads mixtos con campos permitidos y secreto fallan atómicamente. Un `select=*` directo puede ser rechazado con error de permisos: no se debe simular éxito ni esconder el error. Las seis pantallas usan proyección segura y funcionan. Backend conserva únicamente los permisos requeridos sobre el secreto; no se depende de BYPASSRLS para sustituir grants.
6. **No filtraciones:** canario sintético ausente en respuestas del panel/API, errores, logs capturados, HTML/RSC y artefactos servidos al navegador. Revisar bundle y mapa de imports servidor/cliente; comprobar que ninguna credencial privada se inyecta mediante `NEXT_PUBLIC_*` o configuración de Next. No usar un secreto productivo como patrón de búsqueda.
7. **Compatibilidad visible:** enlaces/copiar, bandera de preview, formularios, listas, navegación y avisos de publicación de las seis pantallas. Sólo sustituir el control sensible y mensajes inseguros indicados. El test clásico sigue probando clásico.
8. **Cierre de fase:** reconstrucción completa 270/270, integridad de las 269 previas, Data API, suites afectadas, TypeScript, build, ESLint y auditoría. Las 536 comprobaciones históricas de 1B.1 no acreditan esta implementación futura. Guardar hashes y evidencia final, separando claramente pruebas ejecutadas de previstas.

La inspección previa de imports del frontend no sustituye el análisis del bundle futuro ni prueba la configuración desplegada. En el código inspeccionado, el cliente compartido usa las variables públicas de URL y clave anon; el secreto llega hoy desde la consulta a settings. No se inspeccionaron valores de entorno para descartar una configuración remota incorrecta: esa comprobación deberá hacerse con resultados booleanos/saneados, sin volcar valores.

**10. Rollout, rotación futura y rollback propuestos**

- Antes de habilitar: acreditar destinos/propietarios/versión desplegada; aprobar alcance del receptor clásico; definir entorno explícito y staging apagado. Congelar el contrato con las pruebas sintéticas locales.
- Preparar una versión compatible de receptores y puente servidor con configuración privada y respuesta segura. Probar todo localmente; la futura autorización de despliegue será independiente. Ninguna de estas acciones se ejecuta ahora.
- Coordinar retirada de acceso al secreto, desactivación de RPC pública y frontend sin secreto en una ventana controlada. Los clientes viejos que aún consulten la columna fallarán cerrados y deberán recargar; no dejar un período de compatibilidad que mantenga el secreto legible para evitar ese error.
- El puente nunca debe habilitarse con la combinación “credencial servidor + destino editable”. La fuente de la URL y la validación de transporte deben estar cerradas antes de cualquier acceso a la credencial.
- **Rotación necesaria durante el despliegue:** el diseño actual hace accesible el secreto desde el navegador; debe tratarse como potencialmente expuesto aunque no se acredite una extracción. Rotarlo después de cerrar las lecturas y los clientes antiguos, coordinando base/backend y todos los receptores para evitar desincronización. Separar secretos de producción, staging y local. No leer, generar, reemplazar ni rotar el secreto productivo en esta fase diagnóstica.
- Revisar configuración de captura de cuerpos/errores en los servicios y saneamiento antes de la rotación; no recuperar ni copiar logs potencialmente sensibles para este diagnóstico. CORS deja de ser requisito del navegador hacia el receptor cuando el POST sale del servidor.
- **Rollback seguro:** volver a la última versión compatible del puente/receptor manteniendo grants restrictivos, catálogo y credencial nueva. Si esa versión aún no existe, detener la revalidación instantánea y emitir un estado seguro conservando el guardado, hasta reparar el camino autorizado. No restaurar lectura/escritura del secreto desde el navegador, aceptar destinos editables ni reutilizar la credencial retirada. No se garantiza publicación instantánea durante esa contingencia.

**11. Decisiones que necesitan intervención**

1. Confirmar, con información no sensible, qué proyecto/versión controla `landing.panelbotadmin.com` y `mkt.panelbotadmin.com`, quién administra esos destinos y si `constructor.panelbotadmin.com` es sólo panel o también receptor. El repositorio y DNS no acreditan esa asignación actual.
2. Confirmar si existe un staging que deba soportarse ahora. Si no existe o no se necesita, mantenerlo deshabilitado; no es necesario crear uno. Para local se propone clásico 3000 + builder 3001, ajustables sólo en configuración servidor si se usan otros puertos.
3. Autorizar, antes de una futura implementación, el ajuste acotado del receptor clásico en el repositorio hermano o encargarlo a su responsable. El contrato se puede conservar, pero no se puede acreditar la garantía de errores seguros para llamadas directas dejando intacta su rama `details`.
4. Aceptar la sustitución del campo visible de secreto por un estado no sensible. Conservar ese control de lectura/escritura y cumplir la prohibición de exponer/enviar el secreto son requisitos incompatibles.

No se necesita una decisión sobre renombrar `url_base`, cambiar campañas, unificar runtimes, reabrir otros hallazgos o iniciar otra fase: se propone conservarlos fuera del alcance. La recomendación es B; no se ejecuta ni se habilita mientras falta la acreditación indicada.

**12. Preservación de los cuatro documentos originales**

SHA-256 tomado antes de este diagnóstico adicional y exigido sin cambios al finalizar:

| Documento | SHA-256 |
| --- | --- |
| `README.md` | `0054040c154c366aa6a72bf6b811b55d4bebb0b728141ee2c20136374a8fa7a2` |
| `audit.json` | `ef3fabb3d8209eff81b9f49cfb141ba3024acb5a0bb165a4667b4854c871ffc7` |
| `consumers.json` | `dd513c34613b459a823e74178f5b1110e755c825501f4e557d22ed9c20a8ba6f` |
| `review.json` | `58df6748f62a0b97fe1520c6c5cbb6648d5a42d7ec8d90b63f528cfd1a062cd2` |

Estado de la fase: diagnóstico ampliado, **sin implementación ni pruebas nuevas ejecutadas**. Este documento no declara Fase 1B.2 cerrada ni lista para checkpoint.
