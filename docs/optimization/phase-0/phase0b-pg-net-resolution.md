# pg_net: diagnóstico y resolución exclusivamente local

Fecha de acreditación: 2026-09-17. Las consultas remotas fueron BEGIN READ ONLY, statement_timeout=8s y lock_timeout=1s, con ROLLBACK. Solo se consultaron catálogos; no hubo invocaciones HTTP ni lectura de filas de negocio remotas.

## Causa comprobada

Ambos entornos ejecutan PostgreSQL 17.6 y pg_net 0.19.5. Ambos ofrecen las mismas 14 versiones de pg_net: 0.11.0, 0.12.0, 0.13.0, 0.14.0, 0.15.0, 0.16.0, 0.17.0, 0.18.0, 0.19.0, 0.19.1, 0.19.2, 0.19.3, 0.19.4 y 0.19.5. No era un desfase de versión de la extensión.

El remoto es aarch64, compilado con GCC 13.2.0. El local es x86_64, GCC 15.2.0, iniciado por Supabase CLI 2.75.0 con public.ecr.aws/supabase/postgres:17.6.1.075, image ID sha256:82a04ba6c05f60950a74ae46be3726abb18d06ee44da936276fd782e72e36855. Son diferencias de plataforma documentadas, no una prueba de equivalencia de rendimiento.

El arranque local contiene extensions.grant_pg_net_access(), activado por issue_pg_net_access ante CREATE EXTENSION. Su cuerpo aplica SECURITY DEFINER, search_path=net y ACL explícitas sin comprobar la versión. Coincide con el patrón de la plantilla inicial de CLI 2.75.0. El remoto conserva un hook con condición de versión: esas alteraciones solo se aplican a versiones anteriores a 0.12.0. Las definiciones completas, propietarios, ACL y event trigger están en bootstrap-net-diagnostic-local.json y bootstrap-net-diagnostic-remote.json. El origen último de cuándo se instaló el hook remoto no se deduce de los catálogos; su diferencia actual sí está acreditada.

Clasificación: configuración de plataforma introducida durante el arranque local, posterior a la instalación nativa de la extensión. No hay evidencia de un cambio del proyecto: la diferencia ya está presente antes de ejecutar cualquiera de sus 268 migraciones. La reinstalación nativa en la misma imagen produce el estado remoto, descartando que sea necesario cambiar el paquete binario o editar sus archivos internos.

Las dos funciones son miembros de pg_net y pertenecen a supabase_admin en ambos entornos. Sus cuerpos y firmas coinciden. Antes de resolverlo, authenticator carecía localmente de EXECUTE, aunque lo tiene en remoto; por eso la discrepancia no era inocua y no podía normalizarse por pertenencia a una extensión.

## Solución elegida: instalación nativa disponible localmente

Se utiliza la opción preferida, sin una capa que reescriba funciones de la extensión. En la base temporal vacía creada por el runner, después de aislar su red y detener cron, se reinstala pg_net 0.19.5 mediante DROP EXTENSION y CREATE EXTENSION WITH SCHEMA public VERSION '0.19.5'. No se usa CASCADE. Se exige que public no tenga tablas y que cola/respuestas estén vacías. Cualquier dependencia inesperada o versión no disponible aborta.

Solo esa transacción establece SET LOCAL event_triggers=false, mecanismo de PostgreSQL 17 que evita las alteraciones del hook antiguo al instalar. No se deshabilitan triggers durante las migraciones de aplicación. Al finalizar se acredita event_triggers=on. Se conserva el hook local original, sin modificar su definición ni sus permisos. La operación usa exclusivamente el administrador efímero de la instancia propia, por socket Unix; no admite destinos ni SQL proporcionados por argumentos.

El wrapper es idempotente: compara toda la referencia y no ejecuta DDL si la instalación ya coincide. Se comprueba ejecutándolo dos veces en cada reconstrucción. Se sellan los snapshots de diagnóstico y se rechaza cualquier hook, función, owner, ACL, privilegio o estado distinto del acreditado. El comparador verifica nuevamente el resultado después de las 268 migraciones.

No se editó ningún archivo de la extensión ni ninguna migración histórica. No se actualizó la extensión remota. La opción de compatibilidad manual no fue necesaria.

## Matriz de cinco roles, solo local y con rollback

Para anon, authenticated, authenticator, service_role y postgres se contrastan EXECUTE, USAGE/CREATE del esquema, todos los privilegios de tablas (incluido MAINTAIN), secuencia, ACL completas y atributos superuser/bypassrls/inherit contra la metadata remota.

Cada GET y POST permitido debe encolar exactamente una fila visible únicamente dentro de la transacción, avanzar su secuencia, mantener el rol invocador y no crear respuestas de red. Una columna temporal con DEFAULT current_user demuestra el rol efectivo que inserta la fila. Tanto esa columna como la fila se revierten. Las secuencias PostgreSQL pueden avanzar aunque se haga rollback; no se restauran artificialmente y la base se descarta al terminar.

Para cada rol y función también se revoca separadamente INSERT sobre la cola, USAGE/UPDATE de la secuencia y EXECUTE de la función, exclusivamente en la transacción de prueba. Debe fallar con SQLSTATE 42501. Esto verifica que no se eludan esos permisos usando los privilegios del propietario. Cada conexión se cierra con ROLLBACK o, ante error, con reversión automática. Solo se usa http://127.0.0.1:1/phase0-disabled; la red Docker es interna y ninguna solicitud se confirma.

Son 46 casos de acceso distintos por reconstrucción (45 casos de roles más uno de ausencia de residuos), una comprobación de idempotencia y ocho pruebas unitarias adicionales. Los resultados definitivos y tiempos están en bootstrap-validation.json y bootstrap-unit-results.json; este documento describe el procedimiento, no sustituye sus resultados.

## Comparación y límite de la diferencia de plataforma

La instalación final debe igualar exactamente versión, namespace public, owner, definiciones, ACL, search_path, SECURITY INVOKER, pertenencia a la extensión, tablas/secuencia y privilegios efectivos de los cinco roles. Además se comparan las doce funciones miembro en bootstrap-platform-catalog.sql.

La diferencia restante del hook de instalación está enumerada individualmente, con definiciones exactas y hashes sellados. Es una diferencia de ciclo de instalación de plataforma, no una exclusión de funciones de extensiones. No interviene al invocar GET/POST. Se comprueba el esquema resultante después del replay y los cinco roles. Una futura reinstalación o actualización de pg_net fuera del bootstrap podría volver a aplicar el hook antiguo; esa operación exige repetir el comparador y queda fuera del contrato aprobado. No se afirma equivalencia general de toda la plataforma ni de futuros cambios de extensiones.

## Hallazgos reservados para la futura fase de seguridad

Se conserva TRUNCATE para anon/authenticated en ar_name_inferred_sex, ar_phone_area_codes, cron_config y tracking_queue. También se documenta que upstream y remoto conceden ALL a PUBLIC sobre las tablas y secuencias internas de net, incluido TRUNCATE/MAINTAIN de las tablas. Coincidir no vuelve segura esa configuración. No se revocaron permisos persistentes localmente ni se cambiaron permisos remotos.

## Documentación pública frente a código actual

La guía pública de Supabase describe las funciones HTTP como SECURITY DEFINER. El SQL upstream v0.19.5 y master consultado no declara SECURITY DEFINER para GET/POST: usa el INVOKER predeterminado y concede acceso a las relaciones internas mediante PUBLIC. El remoto coincide con ese código. Por tanto se usaron catálogos y código acreditado para verificar la seguridad, no la descripción general de la guía.

Fuentes y hashes: bootstrap-net-provenance.json.

- Guía: https://supabase.com/docs/guides/database/extensions/pg_net
- Código versionado: https://github.com/supabase/pg_net/blob/v0.19.5/sql/pg_net.sql
- Código actual consultado: https://github.com/supabase/pg_net/blob/master/sql/pg_net.sql
- Plantilla CLI: https://github.com/supabase/cli/blob/v2.75.0/internal/utils/templates/initial_schemas/14.sql
- Mecanismo PostgreSQL: https://www.postgresql.org/docs/17/runtime-config-client.html#GUC-EVENT-TRIGGERS
- Cambio hosted sobre pinning: https://supabase.com/changelog/extension-version-pinning-ignored (no aplica a esta instalación local como superusuario; se verifica la versión efectiva de todos modos).

Reproducción: node scripts/phase0/run-net-diagnostic.mjs para el diagnóstico aislado; node scripts/phase0/run-bootstrap-validation.mjs para dos replays completos y matrices; node scripts/phase0/compare-schema-metadata.mjs para comparación contra los snapshots remotos de lectura acreditados. El diagnóstico no sobrescribe las referencias selladas.
