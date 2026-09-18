# Diagnóstico acotado de eliminación Auth

Fecha: 2026-09-17. Base: main, ba7b3d3f5e60eb0c2cb907a8c281d4462e15d4bb. Este informe agrega evidencia; no modifica ni sustituye los 16 artefactos anteriores. No se implementa una corrección ni se declara completada Fase 1B.1.

## Causa acreditada

El 42501 aparece en `SET LOCAL ROLE supabase_auth_admin`, antes del DELETE. El proceso psql se conecta como postgres, que no es superusuario ni tiene permiso SET sobre supabase_auth_admin. El mensaje completo identifica:

```text
ERROR:  42501: permission denied to set role "supabase_auth_admin"
LOCATION:  call_string_check_hook, guc.c:6938
STATEMENT:  SET LOCAL ROLE supabase_auth_admin;
```

Por lo tanto, la prueba llamada `SQL legitimate Auth deletion still cascades` no llega a evaluar la eliminación ni la cascada. No la rechaza una política de profiles, un trigger de negocio ni la FK. El permiso rechazado es asumir el rol de base de datos supabase_auth_admin desde la sesión postgres.

Esta restricción ya existe al reconstruir los 268 archivos de HEAD. Es una premisa incorrecta del test nuevo frente a los roles existentes de la plataforma; no demuestra un defecto productivo de eliminación ni una regresión introducida por la migración de profiles. PostgreSQL exige permiso SET mediante membresía o una sesión de superusuario para ese cambio de rol. [Documentación de SET ROLE](https://www.postgresql.org/docs/17/sql-set-role.html).

## Método y resultados

[auth-delete-diagnostic.mjs](auth-delete-diagnostic.mjs) es el reproductor diagnóstico. Reutiliza el bootstrap existente, con su validación de hashes, cron detenido, propiedad de recursos y red interna. Acredita que los 268 SQL históricos coinciden con HEAD, normalizando únicamente CRLF/LF en la comparación con Git. Los hashes del manifiesto original se validan sin normalización.

Reconstruye dos bases nuevas y separadas, con la misma CLI e imagen. No ejecuta las suites completas ni la Data API: importa únicamente el fixture sintético del test existente y reproduce el caso fallido y las sondas de roles solicitadas. Los fixtures están dentro de transacciones con ROLLBACK; cuando psql aborta por error, el cierre de la conexión revierte la transacción y otra conexión verifica que no quedaron los usuarios sintéticos.

Los resultados completos, grants, constraints, triggers, identidades y errores sanitizados están en [auth-delete-diagnostic.json](auth-delete-diagnostic.json). Ambas reconstrucciones terminaron: 268/268 sin el incremento y 269/269 con él. Usaron CLI 2.75.0, PostgreSQL 17.6 e imagen public.ecr.aws/supabase/postgres:17.6.1.075 con el mismo imageId.

| Sonda | HEAD sin incremento | Estado con incremento |
| --- | --- | --- |
| Test original | 42501 en SET ROLE, antes del DELETE | Mismo error y sentencia |
| SET ROLE supabase_auth_admin instrumentado | Denegado; sesión postgres, sin claims | Igual |
| DELETE como postgres | Auth y profile eliminados antes de ROLLBACK | Igual |
| DELETE como service_role | 42501: sin permiso sobre auth.users | Igual |
| DELETE como authenticated | 42501: sin permiso sobre auth.users | Igual |
| Login Auth directo por socket, sin credenciales | Rechazo de autenticación peer; no sesión | Igual |
| RESET ROLE, ROLLBACK y conexión siguiente | Identidad y claims aislados | Igual |

Son 14 sondas diagnósticas: ocho reproducciones de denegaciones SQL, cuatro sondas exitosas y dos intentos de conexión limitados por peer. No son una reejecución ni una sustitución de las suites pendientes. Se verificó la reversión de fixtures después de cada sonda y cero solicitudes/respuestas en net al finalizar cada base. El cron permaneció detenido.

## Identidad y contaminación de sesión

Justo antes de la sentencia fallida: current_user=postgres, session_user=postgres, active_role=none, claim_sub=null y claims=null. El marcador anterior al DELETE no se alcanza en la sonda que intenta SET ROLE supabase_auth_admin.

El cuerpo original del test fallido no incluye la variable subject que establece claims en otros casos. Cada `db.sql()` del runner inicia un psql separado con `-U postgres`; una sesión terminada por 42501 no transmite su rol o sus GUC a la siguiente.

La sonda de aislamiento demuestra tres momentos diferentes: como authenticated, current_user cambia mientras session_user sigue siendo postgres; después de RESET ROLE, current_user vuelve a postgres pero los claims siguen presentes dentro de la transacción; después de ROLLBACK, los claims quedan vacíos. La siguiente conexión independiente comienza como postgres, role=none y sin claims. No se encontró contaminación del runner bajo authenticated.

## Objetos y permisos revisados

auth.users pertenece a supabase_auth_admin; profiles pertenece a postgres. Ambas tienen RLS activo y FORCE RLS desactivado. La FK `profiles_id_fkey` es `FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE`.

Los únicos triggers de aplicación sobre auth.users son prevent_public_auth_signup (BEFORE INSERT) y on_auth_user_created (AFTER INSERT). Ejecutan prevent_unapproved_auth_user() y handle_new_user(), respectivamente, ambas con owner postgres y search_path=public. No son triggers DELETE. No hay trigger DELETE de aplicación sobre profiles. Las definiciones, owners y hashes están registrados en el catálogo diagnóstico.

La cascada correspondiente a profiles utiliza el trigger interno RI_ConstraintTrigger_a_17766, AFTER DELETE ON auth.users FROM profiles, NOT DEFERRABLE INITIALLY IMMEDIATE, y la función `RI_FKey_cascade_del()` de PostgreSQL (owner supabase_admin, SECURITY INVOKER, sin search_path específico). Es idéntico en ambas bases. Con postgres se elimina la fila Auth sintética y se comprueba que desaparece su profile dentro de la misma transacción, antes del ROLLBACK. En el test fallido, ninguna función de la cascada llega a ejecutarse porque SET ROLE ya abortó. Las comprobaciones internas de integridad referencial tienen un tratamiento distinto de las consultas explícitas respecto de RLS. [Documentación de RLS](https://www.postgresql.org/docs/17/ddl-rowsecurity.html).

Los roles, membresías y constraints asociados son iguales en ambas bases. Otros triggers internos tienen sufijos numéricos diferentes en sus nombres generados; se conserva el catálogo crudo y se compara aparte el contenido completo normalizando solo el sufijo de nombres RI_ConstraintTrigger con internal=true. No se omiten funciones, owners, flags, cuerpos, estados ni definiciones de constraints. El resultado de esa comprobación documental consta en auth-delete-diagnostic-audit.json.

En auth.users, postgres y supabase_auth_admin tienen SELECT/DELETE; service_role y authenticated no los tienen. Estos dos últimos roles tienen USAGE del esquema auth, pero reciben `permission denied for table users`, también 42501, al intentar el DELETE directo. Su rechazo es de tabla, diferente del rechazo de SET ROLE del test original.

El endpoint legítimo `supabase/functions/delete-client/index.ts:136` llama `supabaseAdmin.auth.admin.deleteUser(userId)`. La clave backend autoriza la API Auth; eso no significa que un SQL directo como service_role tenga DELETE sobre auth.users. Supabase documenta supabase_auth_admin como el rol de conexión del servicio Auth. [Roles de Supabase](https://supabase.com/docs/guides/database/postgres/roles).

Una conexión de diagnóstico directa con `psql -U supabase_auth_admin` sin credenciales por el socket local fue rechazada por autenticación peer antes de abrir una sesión. No se cambiaron credenciales, pg_hba, membresías ni permisos para sortearlo. Esto limita esa sonda adicional; no altera la identificación exacta del 42501 original ni equivale a un fallo de DELETE.

## Comparación global de limpieza

Se instrumentaron en memoria los comandos de limpieza del bootstrap, sin cambiar su implementación. En la reconstrucción de referencia, close() retornó correctamente y todos los rm de recursos propios terminaron con código 0. Contenedores y volúmenes globales quedaron idénticos.

La comparación global de IDs sí encontró un cambio: ec35097afbab dejó de aparecer y se agregó 17760a979cef, que corresponde a la red predeterminada bridge. Las redes host y none conservaron sus IDs. La red bridge observada fue creada a las 19:04:32 UTC; la red interna del proyecto y la red creada por la CLI se eliminaron correctamente. La variación ajena se acredita en [auth-delete-network-events.json](auth-delete-network-events.json).

El runner anterior agrupa close() y la igualdad del inventario global en un único try/catch, descartando el error. Por eso informa genéricamente `failed; inspect runner resources` aun cuando la limpieza propia terminó. La causa inmediata del aviso se reprodujo: desigualdad del ID global de bridge, no un fallo SQL durante la eliminación de usuarios.

No se acredita qué componente de Docker recreó bridge. Los eventos filtrados retrospectivos no conservaron ese evento; Docker solo devuelve los últimos 256 eventos. Se conoce la discrepancia que dispara la comparación, pero no se atribuye sin evidencia a Resource Saver, a un reinicio ni a una acción de la CLI. [Documentación de Docker events](https://docs.docker.com/reference/cli/docker/system/events/).

En la segunda ejecución, close() también terminó correctamente y el inventario global completo quedó idéntico, a pesar de reproducirse el mismo 42501. La inspección final confirmó cero contenedores, redes o volúmenes propios de ambos proyectos temporales. Solo permanecen los recursos ajenos anteriores y las redes bridge/host/none.

Los dos problemas tienen causas diferentes: autorización de SET ROLE en PostgreSQL y una comparación de IDs globales de Docker. No se eliminaron recursos ajenos ni se modificó la configuración de Docker para obtener igualdad. El evento preciso del aviso de la ejecución anterior no puede recuperarse porque su runner descartó el detalle; esta ejecución sí acredita el mismo mecanismo de falsa alarma por inventario global.

## Corrección mínima propuesta, sin implementar

Para la prueba Auth: cambiar únicamente el mecanismo local de ejecución del test. Usar una sesión administrativa exclusiva de la base temporal, validada por el runner, que esté autorizada a asumir supabase_auth_admin. Dentro de una sola transacción: preparar fixtures sintéticos, verificar identidad, SET LOCAL ROLE supabase_auth_admin, DELETE, RESET ROLE, comprobar con el rol de preparación la ausencia de Auth/profile y finalmente ROLLBACK. La credencial, si hace falta, debe ser efímera de ese contenedor, mantenerse en memoria y nunca provenir del .env del proyecto. No otorgar membresía adicional a postgres ni restaurar grants amplios de profiles para hacer pasar el test.

Impacto esperado: solo harness/prueba local; cero cambios en permisos o comportamiento productivos. La prueba debe demostrar explícitamente que se alcanzó el DELETE como supabase_auth_admin y que el resultado de la cascada se verificó en la misma transacción. Antes de incorporarla, hay que acreditar el mecanismo de conexión local autorizado: el intento por peer ya mostró que cambiar solo `-U` no alcanza.

Alternativa mínima de una línea: ejecutar el DELETE como postgres y renombrar la comprobación como prueba de cascada del propietario. Esa variante ya funciona, pero no cubre la identidad real del servicio Auth; no satisface por sí sola el objetivo administrativo original.

Alternativa más completa: probar Auth Admin contra GoTrue local, con el backend simulado y datos sintéticos. Acreditaría también el transporte HTTP y el servicio Auth, pero requiere más infraestructura y autorización de otra ejecución; no se realizó aquí.

Para la limpieza: separar el resultado de cada eliminación del resultado del inventario global; conservar comando, código y diferencia sanitizados. La condición de limpieza debe comprobar que no quedan los IDs/nombres y labels propios del runner. Los cambios ajenos deben seguir registrados como diferencias externas, sin ocultarlos ni convertirlos automáticamente en residuos del runner. Mantener intactas las verificaciones de propiedad y red interna.

Validación necesaria después de autorizar una corrección: comparar el mismo DELETE administrativo antes/después; comprobar fila Auth y profile eliminadas dentro de la transacción, ROLLBACK y conexión nueva sin claims; repetir las denegaciones directas de service_role/authenticated; acreditar la eliminación de recursos propios y la clasificación explícita de diferencias externas. Las suites pendientes de Fase 1B.1 seguirán pendientes hasta una autorización posterior. No se modificó la migración basándose en este diagnóstico.
