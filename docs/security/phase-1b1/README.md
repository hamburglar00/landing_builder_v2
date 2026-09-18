# Fase 1B.1: permisos de profiles

Base: main, ba7b3d3f5e60eb0c2cb907a8c281d4462e15d4bb. Alcance exclusivamente local. Fecha de revisión y cierre: 2026-09-17 (hora argentina).

Estado actual: Fase 1B.1 cerrada en el checkpoint local que contiene esta documentación, con mensaje `fix(security): prevent profile privilege escalation`; auditoría final sin hallazgos, registrada en audit.json. Validación acumulada: 536 comprobaciones únicas aprobadas, cero fallidas y cero omitidas; TypeScript, build y ESLint terminaron con exit code 0. ESLint conserva 18 advertencias preexistentes en archivos sin cambios. El cierre autoriza únicamente este commit local; no hubo push, deploy ni escritura remota y no se inició la fase siguiente.

## Cierre y checkpoint local

La inspección Docker de solo lectura del 2026-09-18T00:18:48.223Z confirmó cero recursos propios residuales, contrastando los IDs del inventario final y los seis proyectos de los runners de Fase 1B.1. Hay cero contenedores activos; permanecen el contenedor ajeno codex-p8-mysql detenido, las redes bridge/host/none y los ocho volúmenes preexistentes. El cambio de ID de bridge no se considera un residuo propio. No se eliminó ni modificó ningún recurso Docker.

Los 35 archivos del inventario coinciden exactamente: tres modificados y 32 nuevos. Se verificaron los hashes de los reportes finales, las 268 migraciones históricas intactas y la única migración incremental 269. El cierre vuelve a ejecutar la auditoría de secretos/rutas, las comprobaciones de diff y el hook pre-commit, sin repetir las 536 pruebas ni las reconstrucciones. La auditoría se genera después de esta actualización documental; el commit solo se permite si todos los controles pasan y el hook no modifica archivos.

Los 22 directorios temporales del bootstrap permanecen fuera del repositorio y no se eliminan. .env permanece físicamente presente, ignorado y fuera del checkpoint. El identificador del checkpoint es el commit que contiene este cierre; no se almacena un hash autorreferencial. Los reportes históricos y los datos de la validación previa conservan sus resultados originales. Este cierre local no autoriza un despliegue.

## Evidencia de la validación previa al checkpoint

Las dos reconstrucciones 269/269 ya existentes fueron acreditadas por separado y no se repitieron. Coinciden el fingerprint de aplicación `ca7fe3870eb5798cd8afa91c9e7cfa0d4e18f7cbf2e0994bad2f313b21fadeba` y el de seguridad de profiles `298cfa463a05e1944d09fa724722116466db4b4b923621970c91f9a0a0f90fdf`. La migración 269 conserva su SHA256 `119b70e25ffea319e4f4decbdf37c4b5681be1427f09e3ada93f07b6c7c9da87`; las 268 históricas permanecen intactas.

El orquestador comprobó separadamente el reporte Auth/primera reconstrucción y el reporte de reconstrucción diagnóstica: hashes fijados, formatos históricos v1 explícitos, base Git, inventario de entrada, fuentes protegidas, orden/versiones/hashes de 269 migraciones, imagen/CLI, compatibilidad y fingerprints. El segundo reporte acredita su commit mediante la referencia SHA256 al primero. Ningún reporte histórico se reescribió. Los formatos antiguos no contienen un inventario de hashes del harness tomado al ejecutar: se acredita su correspondencia con el inventario auditado al inicio de esta validación y con las fuentes actuales; no se inventa un sello temporal retrospectivo. Véanse [evidence-validation.json](evidence-validation.json) y [validation-inputs.json](validation-inputs.json).

Se ejecutaron ahora 422 assertions; 70 repiten casos previamente acreditados y se cuentan una sola vez. El total combina las 183 anteriores admitidas, esas 422 ejecuciones y una comparación de fingerprints: 183 + 422 - 70 + 1 = 536. De las 446 históricas, 338 se ejecutaron ahora y 108 se reutilizan del reporte admitido de la reconstrucción completa (61 acceso, 46 pg_net, una idempotencia). Las 90 restantes son 75 de profiles, una del registro incremental, 10 del auditor/traza, tres controles nuevos de equivalencia de la fixture acotada y una comparación de fingerprints. Los controles de integridad, comandos de compilación y limpieza no inflan ese total.

| Suite | Resultado | Procedencia |
| --- | --- | --- |
| Bootstrap | 34 aprobadas | Ahora; 33 históricas y una incremental |
| Collector | 5 aprobadas | Ahora |
| Deno | 41 aprobadas | Ahora |
| Frontend | 99 aprobadas | Ahora; la integración se ejecuta en la fila siguiente |
| SQL/pgTAP e integración | 112 aprobadas | Ahora; 111 SQL y una integración real |
| Concurrencia histórica | 22 aprobadas | Ahora |
| Handler concurrente simulado | 20 aprobadas | Ahora |
| Secuencias | 6 aprobadas | Ahora |
| Acceso/pg_net/idempotencia | 108 aprobadas | Evidencia previa validada, sin nueva reconstrucción |
| Profiles/grants/Auth/Data API | 75 acreditadas y 73 ejecuciones nuevas | 70 repetidas, tres nuevos controles de fixture; 78 únicas |
| Auditor de rutas y traza | 10 aprobadas | Ahora |
| Comparación de fingerprints | Una aprobada | Evidencia previa validada |
| TypeScript / build / ESLint | Exit code 0 / 0 / 0 | Ahora; ESLint cero errores y 18 warnings |

El único skip de la invocación genérica frontend corresponde a la integración que pasó por separado; hay cero casos únicos omitidos. Advisors locales no disponibles en CLI 2.75.0, confirmado con su ayuda; no se ejecutó un advisor remoto ni se actualizó la CLI.

Se conservan sin sobrescribir los resultados anteriores: primera reconstrucción 269/269 y segundo intento interrumpido en 11/269 con `Local command failed`. La nueva reconstrucción fue una ejecución diagnóstica autorizada aparte; no hubo reintentos automáticos ni correcciones de migraciones, permisos o código productivo.

En la ejecución anterior pasaron 183 comprobaciones únicas: 75 del runner de profiles y 108 históricas (61 de acceso, 46 de pg_net y una de idempotencia). Hubo cero assertions fallidas y un fallo operativo. El error se produjo después de registrar 20260228120000; la siguiente entrada era 20260228130000_landings_tracking_fields.sql. Aquella evidencia no distingue si falló su ejecución o una comprobación Docker previa: el helper descartó stderr y no conservó subcomando, código de salida ni señal. No se atribuye la causa a esa migración ni a profiles. Estas 183 pruebas no se reejecutaron en el diagnóstico posterior.

Pasaron SQL, grants efectivos, RLS, todas las pruebas HTTP de profiles, el alta mediante Auth Admin, el upsert backend y la eliminación mediante Auth Admin con ON DELETE CASCADE. authenticated solo pudo actualizar nombre propio; role, id y created_at quedaron protegidos. anon, otro usuario y el payload mixto fueron rechazados según el contrato. DELETE directo sobre auth.users fue denegado para service_role, authenticated y anon, y se comprobó además la ausencia de sus grants DELETE. No se agregaron membresías ni permisos para ejecutar la prueba.

Las suites que estaban pendientes terminaron en esta validación final. Se conserva el fallo operativo anterior como historial: no se reprodujo y su causa original sigue sin acreditarse. No se atribuye a una migración ni a profiles. La reconstrucción diagnóstica válida y las pruebas finales lo suceden sin borrar esa evidencia.

La limpieza corregida pasó en ambas reconstrucciones: cero contenedores, redes y volúmenes propios residuales. La red global bridge volvió a cambiar de ID y quedó registrada únicamente como diagnóstico; no produjo un falso fallo ni se modificó para forzar igualdad. Los recursos ajenos se conservaron. Las colas/respuestas HTTP estaban vacías y el cron detenido al finalizar la primera base. Las bases y APIs temporales fueron eliminadas incluso tras el bloqueo.

## Contrato acreditado

profiles contiene id, role, created_at y nombre. No existe user_id: la identidad real que se protege es id, FK a auth.users. No se agrega ni se renombra ninguna columna.

| Campo | Lectores y escritores actuales | Acceso cliente previsto |
| --- | --- | --- |
| id | Filtros, joins, resolución de cliente; alta Auth y upsert create-client | Lectura propia; escritura prohibida |
| role | Autorización en panel, Edge Functions, funciones y políticas; asignación backend | Lectura propia; escritura prohibida, incluso para un admin conectado como authenticated |
| created_at | Default de PostgreSQL; sin uso explícito acreditado desde la aplicación | Lectura propia preservada; escritura prohibida |
| nombre | Etiqueta e identificador de rutas/integraciones; edición propia en admin/settings; alta backend | UPDATE exclusivamente de la propia fila |

nombre no se redefine como un nombre personal: también se usa para resolver clientes. Se conservan su significado, validación y UX. La única actualización del navegador, admin/settings, ya envía únicamente nombre. Ningún archivo del frontend necesita adaptación.

[consumers.json](consumers.json) enumera 32 llamadas SDK, una lectura REST desde Kommo, 18 funciones SQL y 71 políticas lectoras. La evidencia de funciones incluye las referencias a las migraciones que definen su versión actual; las políticas y sus expresiones están acreditadas en [Fase 1A](../phase-1a/evidence.json). Solo handle_new_user escribe profiles desde SQL. No se encontró una pantalla ni endpoint legítimo para promover usuarios existentes a admin desde un JWT authenticated.

La asignación vigente procede de auth_signup_approvals o raw_app_meta_data gestionada por backend. create-client verifica al solicitante con getUser y profiles.role, crea una aprobación para client, llama Auth Admin y hace upsert de id, role y nombre. Su upsert actualiza también id cuando hay conflicto. delete-client elimina el usuario de Auth; la FK elimina profiles en cascada. No se usa raw_user_meta_data/user_metadata editable para autorizar estos flujos. No se copia allí ningún rol.

Se conserva handle_new_user, incluido su SECURITY DEFINER existente y su owner postgres. No se crea ni modifica ninguna función o trigger, ni se añade SECURITY DEFINER. Su endurecimiento general pertenece a otro alcance.

## Antes y cambio local

[remote-profile-metadata.json](remote-profile-metadata.json) proviene de una única consulta remota a catálogos: columnas, ACL, grants efectivos, políticas y hashes de funciones. No contiene filas de la aplicación. [profile-metadata.sql](../../../scripts/security/profile-metadata.sql) reproduce esa consulta de lectura.

Antes: RLS activo, dos políticas propias SELECT/UPDATE para PUBLIC y UPDATE de tabla para anon/authenticated/service_role. La política permite editar la propia fila, pero no distingue role de nombre; el CHECK admite admin. No existen grants por columna ni un trigger que proteja role.

Migración nueva, creada con `supabase migration new` después de consultar `--help`: [20260917183837_protect_profile_administrative_fields.sql](../../../supabase/migrations/20260917183837_protect_profile_administrative_fields.sql).

| Rol | DML resultante sobre profiles |
| --- | --- |
| PUBLIC / anon | Sin INSERT, UPDATE ni DELETE |
| authenticated | UPDATE(nombre), solo fila propia por USING y WITH CHECK; sin INSERT ni DELETE |
| service_role | INSERT/UPDATE(id, role, nombre) para el backend existente; sin escritura de created_at ni DELETE directo |
| postgres / servicio y triggers Auth | Alta autorizada y baja mediante API Admin comprobadas; cascada intacta, sin nuevos permisos |

Se revocan primero los grants de DML de tabla y columna para que un permiso amplio no invalide la restricción. Los SELECT, owners, FORCE RLS, constraints, defaults, funciones y triggers permanecen iguales. Los demás privilegios, incluido TRUNCATE, quedan intactos por restricción expresa: este cambio no acredita la seguridad completa de profiles ni resuelve los demás hallazgos de Fase 1A.

Las 268 migraciones y sus hashes históricos no cambian. La nueva entrada se registra en incremental-manifest.json. El bootstrap aplica el historial, la compatibilidad local aprobada y luego el incremento 269. La prueba histórica de integridad usa solo sus 268 archivos como fixture; una prueba adicional verifica el directorio completo con los incrementos registrados.

## Fundamento vigente

RLS controla filas y los grants controlan acceso a objetos/columnas; se necesitan ambos. Un permiso UPDATE de tabla prevalece sobre restricciones por columna. Se mantiene SELECT porque las actualizaciones filtradas y sus respuestas lo requieren. Véanse [columnas](https://supabase.com/docs/guides/database/postgres/column-level-security) y [Data API](https://supabase.com/docs/guides/api/securing-your-api).

La identidad procede del JWT autenticado; user_metadata es editable por el usuario y no es una fuente de autorización. El flujo acreditado usa profiles.role y app_metadata de backend. Véanse [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) y [JWT](https://supabase.com/docs/guides/auth/jwts).

Se consultó el [changelog actual](https://supabase.com/changelog), incluida la transición anunciada de grants automáticos de Data API a exposición explícita. No se depende de ese default ni se actualiza la plataforma. La URL changelog.md no fue servida por la herramienta; se consultó la página oficial HTML.

## Reproducción y cobertura

Desde la raíz, con Docker local y sin variables que redirijan conexiones:

```sh
node scripts/security/run-profile-regressions.mjs --evidence-only
node scripts/security/run-profile-regressions.mjs
node scripts/security/audit-profile-artifacts.mjs
```

El orquestador primero verifica ambas evidencias independientemente; no acepta el intento incompleto ni suma resultados si falla una condición. El runner original run-profile-security.mjs queda conservado para futuras reconstrucciones autorizadas, pero NO se invocó en este cierre. Los reportes previos contienen la comparación del catálogo completo, limitada a los DML y la política de profiles, y los atributos/membresías de roles.

Las bases reconstruidas ya habían sido eliminadas. Para repetir Auth y Data API se inició una base temporal vacía con la misma imagen/CLI y solo la fixture de profiles/Auth: seis fuentes validadas y sin editar (0001, 20260228000000, 20260808120000, 20260818170134, 20260902154745 y 20260917183837). No se fabricó un ledger de 269 ni se aplicó otra reconstrucción completa. Antes y después de la migración se compararon columnas, owner, RLS, políticas, ACL de columnas, grants efectivos y definiciones de triggers con la metadata acreditada; la referencia de handle_new_user también coincide. Las funciones de otros módulos están fuera de esa fixture y siguen cubiertas por las reconstrucciones completas admitidas. La equivalencia del catálogo completo no se atribuye a esta fixture. Su fingerprint acotado, fuentes, 73 resultados y limpieza están en [profile-repeat-validation.json](profile-repeat-validation.json).

Las pruebas SQL usan transacciones revertidas. Cubren edición propia, role, id, user_id inexistente, created_at, otra fila, anon, payload mixto atómico, alta aprobada, rechazo de metadata editable y upsert backend en sus dos caminos. Las pruebas HTTP usan PostgREST v14.1 real en una red Docker interna, sin puertos API publicados, con JWT generados en memoria y exclusivamente perfiles sintéticos. La conexión de prueba de PostgREST usa postgres y cambia al rol del JWT por solicitud; no valida el login de authenticator.

La prueba inválida de SET ROLE fue reemplazada por [profile-auth-api.mjs](../../../scripts/security/profile-auth-api.mjs): GoTrue v2.189.0 real, desde una imagen local ya disponible y sin descargas durante la prueba. Usa el login supabase_auth_admin y la contraseña ya provistos por la base temporal; no se amplían sus permisos. El JWT administrativo es efímero y solo local. El alta usa la aprobación previa acreditada, luego se verifica el upsert actual y la baja real por `/admin/users/{id}` con hard delete. La FK se comprueba explícitamente y deben desaparecer ambas filas. No se ejecuta el handler Edge create-client/delete-client completo: se prueban sus operaciones de Auth y profiles acreditadas.

Las referencias consultadas son la [API Admin de eliminación](https://supabase.com/docs/reference/javascript/auth-admin-deleteuser), la [implementación Auth v2.189.0](https://github.com/supabase/auth/blob/v2.189.0/internal/api/admin.go) y la [configuración de la CLI 2.75.0](https://github.com/supabase/cli/blob/v2.75.0/internal/start/start.go). Auth puede ejecutar sus propias migraciones de plataforma al arrancar; el test confirma que no cambian el catálogo de aplicación, sus permisos ni las membresías. No se modifican migraciones del proyecto.

El bootstrap entrega únicamente identificadores de recursos propios y vuelve a verificar aislamiento. La limpieza acredita propiedad antes de eliminar y compara los IDs/nombres exactos eliminados con los recursos vivos. Los cambios globales ajenos se registran, sin usarlos como criterio de fallo. No acepta URL externa. El cron sigue detenido mediante el mecanismo previamente aprobado; no se llama a Meta ni a APIs externas. Auth y PostgREST tienen cero puertos publicados y solo la red interna. Los directorios temporales de configuración que conserva el bootstrap no se presentan como recursos Docker residuales ni se borran en esta tarea.

El orquestador terminó las suites secuenciales, TypeScript, build y ESLint; captura los reportes históricos en memoria para preservar los archivos de Fase 0. No modifica sus assertions ni código productivo. Se detiene ante el primer fallo y verifica exclusivamente recursos propios. El test de secuencia usa HEAD, que ya contiene la corrección histórica: sus seis escenarios revalidan la versión corregida, sin atribuirles una nueva demostración del fallo pre-corrección.

La CLI disponible es 2.75.0. Se consultó su ayuda: no ofrece advisors locales. No se ejecuta un comando supuesto ni se usa un advisor remoto como evidencia de la base modificada. La cobertura local usa catálogos, SQL y Data API.

Los resultados originales permanecen en [local-validation.json](local-validation.json). [regression-validation.json](regression-validation.json) acredita las suites finales y el recuento sin duplicados; [review.json](review.json), el dictamen e inventario; [audit.json](audit.json), el escaneo final. Los cinco artefactos auth-delete-diagnostic conservan el diagnóstico anterior: sus hashes describen aquel estado anterior a las correcciones autorizadas y no se usan como reporte exitoso del harness actual.

## Rollout propuesto, no ejecutado

1. Revisar diff, grants y resultado completo local antes de autorizar otra etapa. Confirmar que no hay un escritor administrativo externo adicional al repositorio que requiera created_at o DELETE directo.
2. En staging autorizado, aplicar solo la nueva migración con el mecanismo normal, en transacción, sin reset del historial ni de datos. No ejecutar el bootstrap sobre un proyecto existente.
3. Repetir las pruebas de perfil propio y alta/baja de clientes con cuentas sintéticas. Verificar errores 42501 esperados para campos protegidos y ausencia de nuevos errores en admin/settings/create-client.
4. Requerir autorización específica antes de producción. La modificación de permisos es inmediata y puede afectar a consumidores que envíen campos extra; el frontend acreditado no lo hace. No cambia ningún payload de eventos ni flujo de negocio.

Riesgo de tráfico: bajo para lecturas y edición propia acreditadas; medio para consumidores backend no inventariados, porque se recortan DML de tabla, created_at y DELETE directo. Los rechazos de intentos de promoción son el efecto de seguridad buscado.

## Rollback propuesto, no ejecutado

En local se descarta exclusivamente la base creada por el runner. El historial fuente permanece intacto. Para una reversión posterior de permisos, el siguiente SQL reproduce los DML y la política anteriores, sin alterar datos ni otros grants; requiere aprobación porque vuelve a permitir la escalada original:

```sql
BEGIN;
REVOKE UPDATE (nombre) ON public.profiles FROM authenticated;
REVOKE INSERT (id, role, nombre), UPDATE (id, role, nombre)
  ON public.profiles FROM service_role;
GRANT INSERT, UPDATE, DELETE ON public.profiles
  TO anon, authenticated, service_role;
ALTER POLICY "Update own profile" ON public.profiles TO PUBLIC
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);
COMMIT;
```

No se propone ejecutar automáticamente ese rollback inseguro. Ante un consumidor legítimo faltante se debe acreditar primero su necesidad y revisar un ajuste mínimo backend; no se ampliará authenticated para resolverlo.

## Límites y decisiones

El 42501 de SET ROLE y el falso fallo de limpieza fueron corregidos únicamente en el harness. El diagnóstico posterior agregó trazabilidad y una reconstrucción equivalente. La validación final acredita los dos reportes por separado y completó las suites pendientes. No hay una decisión funcional pendiente para este checkpoint; un despliegue sigue requiriendo autorización independiente. La causa del fallo operativo anterior permanece desconocida y documentada.

No se inspeccionaron usuarios productivos ni se determina si existieron promociones abusivas anteriores. Una revisión de roles ya asignados requeriría una autorización y un procedimiento propios; la migración no los modifica.

TRUNCATE, permisos de otras tablas, SECURITY DEFINER ajenos, exposición de conversions y problemas de concurrencia siguen pendientes y no se presentan como corregidos. Tampoco se cambian eventos, atribución, moneda, teléfonos, audiencias, cron productivo ni secretos. Las pruebas de Auth acreditan un servicio Auth local real, sus triggers y grants, no un E2E de la consola, Edge Functions o Auth productivo. No se comprobó el login de authenticator: PostgREST usa postgres y cambia al rol JWT por solicitud. Estas limitaciones no se presentan como cobertura completa de producción.

## Auditoría y conservación del historial

La auditoría anterior revisó 23 archivos, excluyendo su propio reporte, dentro de un inventario de 24 cambios. Terminó con exit code 1 por dos coincidencias de la regla de rutas personales: esta documentación (línea 75 de aquel snapshot) y profile-security-tests.mjs (línea 82). Ambas eran referencias al endpoint administrativo Auth. El diagnóstico posterior acreditó la clasificación sintáctica, la probó con casos positivos y negativos y ajustó únicamente el reconocimiento de raíces. No se agregaron exclusiones de archivos ni de líneas; las reglas de secretos permanecen intactas.

El mismo comando confirmó hashes de las 269 migraciones, integridad de las 268 históricas, git diff --check y .env presente, ignorado y no rastreado. No encontró coincidencias de las reglas de JWT literal, Bearer literal, claves privadas, patrones de credenciales, direcciones de proyecto productivo ni emails no sintéticos en los archivos revisados. Esto es un escaneo estático acotado, no una certificación universal de ausencia de secretos o datos.

audit.json se regenera sobre el inventario final, después de actualizar esta documentación; sus resultados no se sustituyen por una declaración manual. Revisa 34 archivos y excluye únicamente su propio reporte del hash, dentro de 35 cambios: tres rastreados modificados y 32 nuevos. review.json enumera cada archivo y conserva los bloqueos anteriores como historial. En esta continuación se agregaron cinco archivos y se actualizaron el orquestador, el auditor, README.md, review.json y los reportes finales correspondientes. Cero eliminados, staging o conflictos; .env sigue físicamente local, ignorado y sin seguimiento.

La verificación final por IDs propios abarcó 15 contenedores, 12 redes y cuatro volúmenes de las ejecuciones admitidas y finales: todos ausentes. No se exigió igualdad del inventario global ni se eliminaron recursos ajenos. La fixture nueva terminó con cron detenido y cero filas en profiles, aprobaciones, auth.users, cola HTTP o respuestas. No hubo tráfico externo desde las APIs aisladas. No se afirma que se hayan eliminado los directorios temporales de configuración conservados por el bootstrap.
