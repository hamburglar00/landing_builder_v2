Implementación local de Fase 1B.2
================================

Base: `main`, `31babbb9eec24afa37930fc616b6d97448b4c7e9`.

**Estado: lista para checkpoint local; cambios sin staging ni commit.** La continuación autorizada corrigió exclusivamente los fixtures de entorno de `frontend/tests/revalidationSecurity.test.ts`. TypeScript pasó sin diagnósticos; las 17 pruebas de revalidación y seguridad pasaron, al igual que build, inspección de assets cliente, ESLint, auditoría y `git diff --check`. ESLint conserva 18 advertencias en archivos sin cambios de esta fase y no produjo errores.

**Causa exacta de los cuatro TS2345 y corrección mínima**

Las dos firmas productivas, `environmentFromServer(env: NodeJS.ProcessEnv)` y `revalidationBackend(environment, env: NodeJS.ProcessEnv)`, requieren la interfaz real de Node aumentada por Next. En `frontend/node_modules/next/types/global.d.ts`, `NODE_ENV` es obligatorio y de tipo `"development" | "production" | "test"`; el resto de variables admite cadenas o undefined.

- Llamada original en línea 47: el array heterogéneo sin anotación entregaba una unión de objetos con `NODE_ENV` ausente/opcional y, donde estaba presente, ensanchado a `string`. Esa unión no satisface el miembro obligatorio ni su tipo literal.
- Llamadas originales en líneas 135, 136 y 151: compartían un objeto inferido con sólo `NEXT_PUBLIC_SUPABASE_URL: string`, `NEXT_PUBLIC_SUPABASE_ANON_KEY: string` y `SUPABASE_SERVICE_ROLE_KEY: string`. El spread de la primera llamada conservaba esa forma; en las tres faltaba `NODE_ENV`.

La corrección anota el array negativo y el fixture backend con `NodeJS.ProcessEnv` y agrega `NODE_ENV: "test"` en los casos que lo omitían. Se conservan los seis casos negativos y sus motivos de rechazo: configuración de revalidación ausente, staging, preview, señal de preview productiva, local bajo producción y local sin habilitación sintética. No se agregaron casts, supresiones de diagnósticos ni tipos permisivos. No se modificaron firmas productivas, ruta, autorización, catálogo, migración ni lógica de negocio.

**Evidencia ejecutada y reutilizada**

| Comprobación | Resultado | Procedencia |
| --- | --- | --- |
| TypeScript, noEmit, incremental false | Exit 0, sin diagnósticos | Ejecutado primero después de corregir los fixtures |
| Revalidación y seguridad de cliente/servidor | 17 aprobadas, 0 fallidas, 0 omitidas | Nueva ejecución |
| Next build con webpack | Exit 0, compilación completa | Copia temporal sin archivos de entorno |
| Assets cliente, públicos y respuestas serializadas | Sin canarios ni transporte sensible ejecutable | Nueva inspección del build |
| ESLint | Exit 0, 0 errores, 18 advertencias preexistentes | Nueva ejecución; archivos advertidos sin cambios |
| Auditoría de secretos/rutas e integridad | Aprobada, sin hallazgos | Reporte final sellado contra documentos actualizados |
| git diff --check | Exit 0 | Sólo avisos de normalización CRLF/LF en tres archivos ya modificados |
| Reconstrucción y SQL/Data API/profiles | 270/270; 119 comprobaciones aprobadas | Evidencia anterior conservada por hash, sin repetir |
| Seguridad histórica del bootstrap | 34 aprobadas | Resultado anterior reutilizado; fuentes sin cambios |
| Contratos de landing, plantillas y HTML público | 16 aprobadas | Resultado anterior reutilizado; fuentes sin cambios |

Los conteos corresponden a cada runner; no se presentan como suma de pruebas únicas. El intento anterior con TypeScript fallido permanece íntegro dentro de `implementation-validation.json.previousAttempt`; su hash original también se registra. Esa falla está resuelta por la ejecución posterior, no reinterpretada como éxito.

**Inspección de bundles y respuestas**

Se inspeccionaron 125 archivos de `.next/static`, 19 archivos públicos y 443 salidas HTML/RSC/segmentos que pueden llegar al navegador. No contienen los canarios sintéticos de secreto ni de credencial service role. El canario público de control sí aparece en el bundle, acreditando que el build recibió la configuración sintética. No se leyeron archivos `.env*` ni valores productivos; no se cargaron metadatos locales de despliegue.

La búsqueda literal inicial marcó dos nombres de variables en cuatro salidas de Admin Documentación y devolvió exit 1. La revisión de contexto acreditó que son los textos literales `SUPABASE_SERVICE_ROLE_KEY` y `REVALIDATE_SECRET` del README, renderizados como nodos de texto. No son valores, interpolación de entorno ni código ejecutable de transporte. Se conservan ese resultado inicial y su clasificación en el reporte; no se cambió la aplicación ni se excluyeron canarios de la inspección.

Se clasificaron por separado 166 artefactos JS/map exclusivos de servidor. Los identificadores privados aparecen en cuatro de ellos, incluyendo el módulo backend de revalidación; no forman parte de los assets cliente. Las salidas HTML/RSC fueron inspeccionadas como contenido cliente aunque residan bajo `.next/server`. El acceso real al secreto ocurre en base durante la ejecución servidor; la ausencia de un canario de entorno en el build se complementa con las pruebas HTTP sintéticas de cuerpos y respuestas, sin atribuir al build una consulta a datos reales.

**Contratos conservados**

`getSettings` selecciona y devuelve sólo `id, url_base, show_client_landing_preview`, con proyección explícita que descarta campos inesperados. Los consumidores acreditados mantienen esa proyección y Admin Tests ya no consulta settings. El navegador envía únicamente acción, ID y motor a la ruta autenticada; el estado devuelve un booleano y conserva Configurado / No configurado, diferenciando un error de disponibilidad. Los payloads sensibles o mixtos se rechazan.

`url_base` conserva enlaces públicos y no determina solicitudes con credenciales. El catálogo mantiene exclusivamente los dos destinos productivos aprobados y localhost:3000/3001 bajo modo sintético; staging, previews, redirects, URLs arbitrarias y direcciones privadas/loopback en producción permanecen rechazados. Las pruebas no llamaron a dominios productivos.

Los cinco documentos previos y las 270 migraciones permanecen intactos respecto del inicio de esta continuación. El reporte SQL/Data API conserva su hash. Los recursos Docker no fueron usados ni modificados por esta continuación; la limpieza propia acreditada anteriormente se conserva como evidencia histórica. Se retienen los temporales externos anteriores y la nueva copia de validación.

El inventario exacto contiene **36 archivos: 10 modificados y 26 nuevos**, incluyendo los cinco documentos previos y el reporte final de auditoría. Está en `implementation-review.json`. Frente al estado recibido, el único archivo de código corregido es el test; se actualizaron documentación y evidencia de ejecución. El reporte de auditoría contiene los hashes finales de todos los archivos salvo él mismo; el inventario excluye sus hashes recíprocos con review para evitar una dependencia circular.

**Cambio local**

La CLI Supabase 2.75.0 generó `20260918010532_protect_settings_revalidation_secret.sql` después de consultar `--version`, `--help`, `migration --help` y `migration new --help`. La migración 270 modifica permisos, no valores. Se agrega su registro al manifiesto incremental sin alterar las 269 migraciones anteriores ni el manifiesto histórico.

Se revocan SELECT, INSERT, UPDATE, DELETE y REFERENCES amplios sobre `settings` y sus permisos por columna. `authenticated` conserva SELECT de `id, url_base, show_client_landing_preview` y UPDATE de las dos últimas; las políticas existentes siguen limitando las escrituras a administradores. `anon` no tiene un lector directo legítimo de esta tabla. `service_role` conserva SELECT explícito de las seis columnas actuales, sin permisos DML para modificar el secreto. La rotación será una operación administrativa servidor separada.

El verificador `verify_revalidate_secret(text)` deja de ser ejecutable por PUBLIC, anon y authenticated. No se crea SECURITY DEFINER, vista o RPC nueva. El RPC de routing previo conserva sus dos campos no sensibles. No se cambian privilegios de operaciones excluidas del alcance, ni roles o políticas de otras tablas.

Los grants de tabla prevalecen sobre restricciones de columna; RLS decide filas y no reemplaza grants. Por eso la migración retira ambos niveles y el frontend pide columnas concretas. Un SELECT * directo que requiera la columna protegida debe fallar; no se oculta el error. [Column Level Security](https://supabase.com/docs/guides/database/postgres/column-level-security), [Data API](https://supabase.com/docs/guides/api/securing-your-api).

Se revisó el changelog vigente. El cambio de defaults de exposición refuerza la necesidad de grants explícitos. La modificación de versionado de extensiones no aplica al proveedor local congelado y no autoriza a cambiar migraciones históricas. [Changelog](https://supabase.com/changelog), [Versionado de extensiones](https://supabase.com/changelog/extension-version-pinning-ignored).

**Pantallas y clientes**

| Archivo/consumidor | Adaptación |
| --- | --- |
| `frontend/lib/settingsDb.ts` | Selección de tres campos seguros, proyección nueva del resultado y rechazo de claves de actualización desconocidas antes de hacer HTTP. |
| Configuración admin | Conserva URL pública, bandera y perfil. Sustituye lectura/edición del secreto por estado booleano reservado a administradores. Un error de consulta muestra estado no disponible; no se confunde con no configurado. |
| Tests admin | Cambia sólo revalidación. Resuelve el nombre ingresado a ID accesible mediante RLS y solicita una prueba clásica administrativa. No transmite URL, nombre arbitrario al receptor ni secreto. |
| Editor admin y editor cliente | Conservan guardado y motor; envían ID y motor al servidor. Eliminan estado y parámetros del secreto. |
| Listados admin y cliente | Conservan código y enlaces. Reciben la proyección segura del helper compartido. |
| `frontend/lib/landing/publishLanding.ts` | URL pública sólo para enlaces. El POST usa la ruta relativa del panel. Fallo clásico sigue siendo best effort; constructor conserva aviso de guardado sin publicación instantánea. |
| `frontend/lib/revalidation/client.ts` | Sesión Supabase para la ruta propia; sólo acción, ID y motor en el cuerpo. Proyecta resultados y usa mensajes fijos. |

La pantalla de pruebas deja de consultar settings. Las otras cinco lecturas del helper son explícitas y seguras. Los dos listados no requieren cambios de archivo para beneficiarse de esta protección.

`url_base` mantiene los usos de enlaces y el lector backend no sensible acreditado en el diagnóstico. No se usa para transporte ni se modifica el código de ese lector. No se cambian otras acciones de Tests, lógica de negocio, eventos, teléfonos, mantenimiento o tareas programadas.

**Ruta autenticada y catálogo servidor**

`POST /api/landings/revalidate` acepta exactamente tres claves:

```
{ action: "publish" | "test-classic", landingId: "<uuid>", publishTarget: "classic" | "constructor" }
```

Rechaza URLs, destinos, entornos, nombres, secretos y claves adicionales, también en payloads mixtos. Exige Bearer de usuario y lo valida con Auth `getUser`; consulta el rol actual protegido en profiles y la landing bajo RLS con ese mismo token. Aplica además comprobación explícita de propietario o administrador. No usa metadata editable para autorizar.

Publicación compara el motor recibido con el persistido y usa este último. La prueba administrativa es una operación clásica acreditada, sólo para administradores, y valida el acceso al ID aunque esa landing esté publicada actualmente con el constructor. Así conserva el significado del botón clásico documentado. Un nombre inexistente ya no produce una solicitud: la instrucción actual exige una landing identificada y autorizada.

`GET /api/landings/revalidate`, reservado a administradores, devuelve únicamente `{ configured: boolean }`. No expone longitud, valor ni fragmentos del secreto. Todas las respuestas tienen `Cache-Control: no-store`.

| Entorno | Clásico | Constructor |
| --- | --- | --- |
| production | `https://landing.panelbotadmin.com/api/revalidate` | `https://mkt.panelbotadmin.com/api/revalidate` |
| local | `http://localhost:3000/api/revalidate` | `http://localhost:3001/api/revalidate` |

Los dominios fueron aprobados por el usuario. El catálogo vive en un módulo `server-only`; no acepta sustitución de URL por navegador, settings, headers ni variables públicas. Compara protocolo, hostname, puerto efectivo y ruta; rechaza userinfo, query y fragmentos. Production sólo se habilita con `REVALIDATION_ENV=production` y `NODE_ENV=production`. La señal de Vercel preview/development impide habilitarlo. No hay fallback a producción ni staging.

Local requiere `REVALIDATION_ENV=local`, `REVALIDATION_LOCAL_SYNTHETIC=1`, modo test/desarrollo y ausencia de señales Vercel. Los secretos locales deben tener prefijo `phase1b2-local-` y un sufijo sintético de 16–128 caracteres alfanuméricos/guion/guion bajo. También se exige Supabase local en loopback:54321; no se permite usar el backend productivo bajo modo local.

La configuración backend usa `SUPABASE_URL` o la URL pública Supabase del proyecto, clave anon pública para validar usuario/lecturas con RLS, y `SUPABASE_SERVICE_ROLE_KEY` privado para leer la columna. Production admite HTTPS de un host de proyecto `.supabase.co`; local admite el endpoint indicado. No se leyeron valores de los archivos de entorno para verificar configuración productiva. Un despliegue deberá proporcionar estas variables privadas; no se modificó su configuración.

**Transporte y almacenamiento**

El secreto permanece en `settings.id=1`. No se mueve a variables de entorno, no se migra/copia ni se transforma un valor existente. El módulo backend selecciona exclusivamente `revalidate_secret` para la operación que lo necesita. Las credenciales usadas en pruebas son sintéticas.

El POST saliente conserva `{name, secret}`. El transporte Node HTTP/HTTPS no sigue redirects y rechaza todos los 3xx. No reenvía cookies, Origin ni Authorization del usuario. Usa TLS con el hostname original, agente nuevo y lookup de socket fijado a las direcciones previamente validadas; no realiza una segunda resolución DNS libre. Rechaza A/AAAA privados, loopback, link-local, metadata, direcciones especiales y variantes IPv4 encapsuladas cuando corresponde. Loopback sólo pertenece a local.

Se limitan resolución DNS, duración del POST y tamaño de respuesta. Sólo proyecta booleanos de respuestas clásicas válidas; un 200 clásico con warm fallido sigue acreditando invalidación. JSON inválido o respuesta anómala no se considera éxito. Nunca reenvía detalles upstream ni errores crudos. No registra cuerpos ni credenciales.

El receptor constructor de este repositorio verifica con lectura backend, sin RPC anon ni fallback a otra variable de secreto. Conserva paths y tag de invalidación, y el resultado 502 si falla el calentamiento. El calentamiento usa el origen fijo del catálogo, sin credenciales ni redirects, y no depende del Host recibido. Sus respuestas ya no incluyen paths, URLs o mensajes de excepción que puedan reflejar entrada.

**Límite expresamente aprobado:** el receptor clásico de `landing-prueba-1` permanece intacto. El puente sanea todo lo que devuelve al panel, pero no modifica la rama de errores ni el calentamiento internos de ese otro servicio. No se acredita que sus llamadas directas estén saneadas. Su ajuste y la verificación de despliegue quedan para una autorización posterior; aquí no se llama a ninguno de los dominios productivos.

**Cobertura y evidencia de validación**

- `run-settings-security.mjs`: una reconstrucción aislada 270/270, catálogo antes/después, grants efectivos, SQL/DML, Data API real y regresiones pertinentes de profiles. Reutiliza el aislamiento histórico con ejecución externa detenida y limpia sólo recursos propios comprobados.
- `revalidationSecurity.test.ts`: roles/sesión/ownership, catálogo, resolución y DNS fijado, errores, payloads, estado y receptores HTTP sintéticos en los dos puertos locales. Los destinos productivos se comprueban como configuración; no reciben solicitudes.
- `revalidationClient.test.ts`: proyección segura, rechazo de escrituras sensibles, estado booleano, invarianza del destino al cambiar enlaces y comportamiento de fallo clásico/constructor.
- Históricas relevantes: seguridad del bootstrap, contratos de landing, plantillas y HTML público. No se rehacen suites ajenas ni se cuentan las 536 comprobaciones previas como evidencia nueva.
- TypeScript y build en copia temporal de frontend sin archivos `.env*` ni metadatos locales de despliegue. Build con Next/webpack para resolver la dependencia node_modules mediante junction sin ampliar la raíz de compilación al perfil personal. No cambia el bundler configurado del proyecto.
- Inspección del bundle del navegador: columna sensible, clave privada y canarios sintéticos ausentes. El loader de tests sólo resuelve la condición servidor del marcador server-only en Node; el build aplica la frontera real de Next.
- ESLint y auditoría de archivos/integridad al final. No se declara éxito por haber iniciado un comando. Ante una falla se detiene la secuencia sin reintento ni reparación de alcance.

El runner integral es `node scripts/security/run-settings-validation.mjs` y no acepta targets o URLs por argumentos. No se ejecutó en esta continuación porque repetiría la reconstrucción ya acreditada. Se ejecutaron por separado TypeScript, las dos suites de revalidación, build, inspección y ESLint desde un helper temporal externo. La auditoría usa `node scripts/security/audit-settings-artifacts.mjs`. El intento anterior se preserva en el reporte combinado; no se reescribió el reporte de base.

**Rollout y rotación futura — no ejecutados**

Antes de desplegar se deberá coordinar configuración privada en el backend y receptores, comprobar versiones/propiedad de caché y resolver el endurecimiento pendiente del clásico bajo autorización separada. No se leerán secretos para documentar esos pasos.

Preparar primero el camino servidor compatible y sus destinos cerrados. Coordinar la migración y frontend seguro en una ventana controlada; clientes antiguos deben recargar y fallar cerrados al intentar leer la columna. No dejar permisos abiertos por compatibilidad con JavaScript viejo.

El secreto actual debe considerarse potencialmente expuesto por el diseño previo. Rotarlo después de cerrar sus accesos, mediante procedimiento administrativo servidor, sincronizando settings y el receptor clásico. El constructor obtiene el valor desde la misma base. No habilitar ninguna edición desde navegador, ni reutilizar secretos de producción en local. No se ejecutó rotación ni se copió el valor actual.

Rollback seguro: conservar grants restrictivos y secreto nuevo, y volver a una versión servidor compatible. Si no existe, deshabilitar la revalidación instantánea con estado seguro hasta reparar, conservando el guardado. No restaurar el input de secreto, grants amplios, RPC pública ni destinos editables. No se ofrece una reversión SQL que reabra esa exposición.

Los directorios temporales históricos se conservan. Los nuevos directorios de bootstrap/build permanecen fuera del repositorio y se informan en evidencia. No hay staging, commit, push, deploy ni escrituras remotas.
