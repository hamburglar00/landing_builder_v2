# Fase 1B.3: implementación local de administración de teléfonos

Estado: **Fase 1B.3 lista para checkpoint local; cambios sin staging ni commit**. La excepción de permisos de las dos funciones de cron fue autorizada expresamente después del diagnóstico. El fallo original se conserva en `database-validation.json`; el diagnóstico y la continuación se registran en `pending-validation.json`.

## Diagnóstico acreditado y corrección mínima

La reconstrucción completó **271/271** y se aprobaron **120 comprobaciones** antes del primer fallo: `Data API own manual insert and upsert contract`. Las ocho aserciones de pgTAP pasaron; su ejecución está incluida como una de esas 120 comprobaciones, no se suma como ocho comprobaciones independientes.

La captura nueva reproduce el fallo: el POST de inserción responde 201; el POST con `resolution=merge-duplicates` sobre la misma clave actualiza la fila y responde 200. El test exigía 201 en ambos pasos. La fila conserva su identificador, gerencia y propietario; cambia únicamente el comentario sintético solicitado. No hay error de PostgREST: código y mensaje son nulos. Esto coincide con la distinción entre filas insertadas y actualizadas en [PostgREST 14.1](https://github.com/PostgREST/postgrest/blob/v14.1/src/PostgREST/Response.hs).

La causa es **categoría 1: expectativa incorrecta del test**. Se corrigió sólo la expectativa del segundo POST a 200, tanto en el caso original como en el diagnóstico. Una corrección y un reintento bastaron: inserción, upsert, edición y eliminación propias pasaron con comprobaciones de identidad, propiedad y estado persistido. No se modificaron aplicación, grants, RLS ni migración para resolver este fallo.

La evidencia guarda método, endpoint relativo, status, código/mensaje de PostgREST, Content-Type, Prefer y headers de respuesta permitidos; distingue insert/upsert, conserva la aserción fallida y el antes/después de la fila sintética. El rol efectivo y `auth.uid()` se obtienen mediante una función de instrumentación SECURITY INVOKER con el mismo JWT efímero de cada petición. Esta función existe sólo en la base desechable, no accede a tablas y se retira antes del cierre. No se registran JWT, claves ni datos reales.

Pasaron el catálogo de alcance, los owners/ACL/ejecutores previos, la conservación de cuerpos, parámetros y propiedades de ambas funciones, los nombres/schedules/comandos/roles de jobs, las denegaciones SQL para anon/authenticated, la ausencia de EXECUTE de PUBLIC y la ejecución sintética como postgres. También pasó la comparación exacta de un resultado de asignación pública antes y después. Esos controles no sustituyen las pruebas restantes.

El runner de continuación omite las 120 comprobaciones ya aprobadas y conserva intacto su reporte. Como la instancia anterior había sido retirada, provisiona una base aislada con las mismas 271 migraciones y verifica el mismo fingerprint de catálogo; no vuelve a ejecutar las suites SQL acreditadas. La migración 271 mantiene su hash original. Las validaciones posteriores se registran por separado y sólo se consideran aprobadas cuando terminan.

El runner retiró sus dos contenedores, dos redes y volumen propios, con verificación de ausencia por identidad. Una consulta posterior de contenedores activos/detenidos, redes y volúmenes no encontró recursos del proyecto `phase0b-194697f7`; los recursos ajenos permanecen. Los temporales de reconstrucción quedan fuera del repositorio y no se eliminaron.

La continuación fue autorizada con un máximo de dos correcciones por causa de fixture/harness o permisos dentro del modelo aprobado. No se amplían permisos ni se cambian contratos para satisfacer expectativas incorrectas.

## Implementación

La CLI 2.75.0 creó `20260918140931_protect_phone_administration.sql` después de consultar `supabase migration --help` y `supabase migration new --help`. Es la migración 271; las 270 anteriores quedan intactas y el manifiesto incremental registra su hash.

`gerencia_phones` tiene cuatro políticas separadas de SELECT, INSERT, UPDATE y DELETE para `authenticated`. La propiedad se comprueba mediante la fila externa `gerencia_phones.gerencia_id`, su gerencia y el usuario de sesión. El administrador se reconoce por `profiles.role`, protegido por la migración 269. Se retiran la lectura global y la política que vinculaba por error dos columnas de la misma gerencia.

`anon` y `PUBLIC` pierden los permisos de CRUD de teléfonos. `authenticated` conserva SELECT y DELETE y sólo las columnas de escritura usadas por la administración manual: `gerencia_id`, `phone`, `status`, `last_seen_at`, `kind`, `comment`, `source_available` y `assignment_role`. Identidad de fila, fechas internas, contadores y reinicio de mensajes no son campos de escritura directa del navegador. La secuencia permite únicamente generar el identificador necesario al insertar.

Dos triggers privados, con `SECURITY INVOKER` y `search_path` vacío, rechazan cambios reales de `gerencia_phones.gerencia_id` y `gerencias.user_id`. Aceptan repetir el mismo valor durante un upsert. El error aborta la sentencia completa, incluidos otros campos de un payload mixto. No se agrega `SECURITY DEFINER` ni se modifica el cuerpo de ninguna función SQL existente.

Los tres handlers administrativos llaman a `authorizePhoneAdministration` antes de acceder a los teléfonos. El helper obtiene el usuario mediante `auth.getUser(token)`, consulta su rol protegido y verifica la gerencia. Para un cliente deriva la identidad de ese usuario verificado; para un administrador permite seleccionar otro propietario después de comprobar el rol. Un `user_id` ajeno de un cliente o un selector por query se rechaza antes de escribir. Los metadatos editables no intervienen en la decisión.

La pantalla de teléfonos envía el JWT de sesión y la gerencia opcional. Ya no transmite `user_id` para esos tres botones ni usa la clave pública como Bearer administrativo. La selección de una gerencia ajena por un administrador se resuelve en servidor. Los botones globales conservan el alcance del propio usuario. El test administrativo de sincronización también envía el JWT; las otras acciones de esa pantalla quedan intactas.

## Excepción de cron

La migración contiene únicamente estas dos operaciones sobre funciones existentes de cron:

```sql
REVOKE ALL ON FUNCTION public.cron_sync_phones_all() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cron_reset_phone_operational_daily() FROM PUBLIC, anon, authenticated;
```

En funciones, `ALL` corresponde al privilegio EXECUTE. Esta forma también es compatible con el analizador conservador de migraciones ya existente. No hay grants compensatorios. Se conservan el propietario, los parámetros, `SECURITY DEFINER`, `search_path`, cuerpos, jobs y horarios. No se modifica el camino programado del handler `sync-phones`.

Antes de aplicar la 271, el runner compara los owners, cuerpos, ACL y jobs de la base local reconstruida con el catálogo acreditado. Los consumidores conocidos de estas dos entradas son sus jobs ejecutados como `postgres`; no se encontró una dependencia de EXECUTE público en los consumidores de aplicación inventariados. El runner también busca referencias desde otras funciones SQL y se detiene ante un consumidor inesperado.

La verificación posterior compara cuerpos y definiciones, revocaciones exactas y las propiedades de los jobs, incluido el texto exacto de los dos comandos. Los demás jobs se comparan con el catálogo anterior. El runner no programa ni ejecuta jobs: su instancia desechable arranca con `cron.launch_active_jobs=off`, como barrera del entorno de pruebas existente. Eso no forma parte de la migración ni cambia la configuración del proyecto.

Las invocaciones explícitas de prueba como `postgres` usan únicamente filas sintéticas. La prueba de sincronización encola dentro de una transacción una solicitud a loopback deshabilitado y hace rollback: pg_net no puede observar esa fila sin commit. La prueba de reset también revierte sus datos y marcador diario. La red Docker es interna y se comprueba que no quedan solicitudes ni respuestas. No se leen ni sustituyen credenciales productivas.

## Contratos conservados

Los cuerpos de sincronización y reset posteriores a la autorización son los del commit base. La auditoría compara esos segmentos de código. No se modifican normalización, selección, límites, prioridades, estados, canales ni la configuración de reinicio diario del frontend.

`landing-phone`, `phone-click`, los RPC de asignación y reserva, la caché Next.js y los scripts públicos permanecen sin cambios. Sus permisos y contratos públicos existentes se conservan; esta migración no convierte la asignación pública legítima en administración autenticada. La propuesta inicial de revisar otros grants de RPC no se aplica: la autorización actual limita los cambios a las dos funciones de cron y la protección administrativa de teléfonos.

No se modifica el código de conversiones, CAPI, Contact, Lead, Purchase, revalidación, TRUNCATE ni otros cron. Las dependencias de confirmación de reserva se conservan para pruebas de regresión; no se cambia su lógica.

## Validación y límites

Resultados ejecutados:

| Evidencia | Resultado |
| --- | --- |
| Reconstrucción y suites iniciales | 271/271; 120 comprobaciones aprobadas reutilizadas sin repetir las suites SQL |
| Continuación Data API, perfiles, handlers y concurrencia | 65 comprobaciones adicionales aprobadas; total único de ambos reportes: 185 |
| pgTAP | 8 aserciones aprobadas dentro de una de las 120 comprobaciones iniciales |
| Frontend de teléfonos y handlers públicos | 13 pruebas aprobadas |
| Regresiones históricas de bootstrap y landings | 34 y 16 pruebas aprobadas |
| TypeScript y build | Exit code 0 en ambos |
| Assets cliente | 124 archivos de `.next/static`; ningún marcador privado sintético ni nombre de clave service-role |
| ESLint | 0 errores; 18 advertencias preexistentes en archivos ajenos a este cambio |
| Auditoría y whitespace | 30 archivos, sin hallazgos; `git diff --check` aprobado |

El caso original quedó resuelto con una sola corrección de expectativa. No quedan fallos funcionales pendientes en estos reportes. Los RPC públicos de ambas funciones de cron fueron denegados sin cambios en filas, configuración o cola; su ejecución legítima como postgres ya estaba acreditada. Los tres handlers rechazaron sesiones ausentes/inválidas, claves públicas como sesión, propietarios falsificados en body/query y metadatos administrativos editables. Los clientes y administradores autorizados conservaron los resultados históricos.

Las conexiones concurrentes produjeron ocho reservas distintas distribuidas 4/4, el warmup no agregó reservas, las confirmaciones conservaron la identidad de reserva y se preservaron los dieciséis incrementos de contadores. No se alteraron los algoritmos ni los contratos públicos para obtener estos resultados.

La inspección del bundle se limita a los assets cliente; `.next/server` contiene artefactos exclusivamente servidor y no se clasifica como contenido enviado al navegador. El build usó exclusivamente configuración sintética en una copia temporal sin archivos de entorno. `.env` permanece presente, ignorado, fuera de Git y sin lectura de su contenido.

La consulta final de Docker, sólo de lectura, acreditó cero contenedores, redes o volúmenes de ambos runners. Quedan un contenedor, tres redes y ocho volúmenes globales ajenos; no se modificaron ni se consideran residuos propios. Los directorios temporales permanecen fuera del repositorio.

El inventario exacto contiene **30 archivos: 6 modificados y 24 nuevos**, con hashes SHA-256 de bytes en `implementation-review.json`. La auditoría excluye su propio hash y el del manifiesto para evitar referencias circulares; el manifiesto final sí incorpora el hash del reporte de auditoría. Las 270 migraciones históricas y la 271 conservan sus hashes acreditados. No se ampliaron grants para resolver pruebas, no se modificó lógica de negocio y no hubo staging, commit, push, deploy, escrituras remotas ni cambios en el repositorio hermano.

El runner usa una reconstrucción completa, SQL y pgTAP, PostgREST real con JWT sintético, y concurrencia real entre conexiones de PostgreSQL. Las pruebas de handlers ejecutan el código TypeScript real y el SDK contra esa Data API; Auth y el proveedor de teléfonos se sustituyen por transportes sintéticos que no abren conexiones externas. Esa prueba acredita la orquestación de los handlers, no un despliegue en la plataforma Edge de Supabase.

Las comparaciones antes/después usan el mismo fixture sintético y los handlers del commit base. Los mocks históricos de `landing-phone` complementan la prueba real del RPC y de reservas; no se presentan como prueba de locks. TypeScript, build, ESLint, inspección de assets cliente, suites históricas relevantes y auditoría se ejecutan sólo si la fase anterior pasa. Los bundles se generan en una copia temporal fuera del repositorio, sin copiar archivos de entorno, y se buscan exclusivamente marcadores sintéticos.

El runner inicial conserva su detención sin reintentos. El runner de continuación pausa ante un fallo y registra su clasificación y corrección antes de admitir un reintento, con un máximo de dos correcciones por causa. Al cerrar libera sólo los recursos Docker cuya propiedad puede acreditar. No se borran directorios temporales ni recursos ajenos. El inventario y las verificaciones finales se registran en `implementation-review.json`.

## Rollout y rollback

No se realizó ni se autoriza aquí ningún despliegue. Tras aprobar todas las pruebas, un rollout futuro debe coordinar los clientes que envían sesión con los handlers que la exigen y aplicar la migración ensayada. La clave pública continúa siendo válida para las funciones públicas de asignación, pero no autoriza los botones administrativos. La ejecución programada continúa como `postgres`, sin grants adicionales, cambios de secreto ni reprogramación.

La implementación no mueve ni rota secretos. No propone modificar el repositorio hermano ni la configuración productiva.

Antes de cualquier despliegue, capturar las políticas y grants vigentes y ensayar el procedimiento de reversión en una copia local. Las migraciones históricas no se editan para revertir. Ante una regresión, suspender la administración afectada y conservar la asignación pública acreditada mientras se corrige; restaurar permisos públicos inseguros no es el rollback ordinario. Cualquier escritura remota o excepción adicional requiere una autorización separada.
