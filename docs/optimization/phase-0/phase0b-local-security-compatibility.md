# Compatibilidad de seguridad local posterior al historial

<!-- phase0b-pg-net-current:start -->
## Estado vigente después de resolver pg_net

Fase 0B cerrada. Dos reconstrucciones de 268/268, fingerprints iguales, 446 comprobaciones distintas aprobadas y cero diferencias pendientes. pg_net 0.19.5 se instala nativamente en la base local vacía; sus funciones y permisos coinciden con remoto. Detalle: phase0b-bootstrap-report.md y phase0b-pg-net-resolution.md. No se inició Fase 0C ni Fase 1.

Los resultados inferiores son antecedentes históricos; no reemplazan este dictamen.
<!-- phase0b-pg-net-current:end -->


## Alcance y procedencia

Autorización: reproducir exclusivamente en bases temporales local/CI el estado de seguridad remoto acreditado, después de las 268 migraciones y antes de cualquier incremental. No se añadió una migración desplegable ni se modificó producción, los 268 SQL o el manifiesto histórico.

La definición completa se obtuvo de pg_get_functiondef y pg_event_trigger, en READ ONLY con statement_timeout 8 s y lock_timeout 1 s. Propietarios, ACL, flags y políticas de las cuatro tablas se guardan en `supabase/bootstrap/security-reference.json`; la consulta reproducible está en `scripts/phase0/bootstrap-security-reference.sql`. No incluye datos de aplicación.

El cuerpo remoto de rls_auto_enable coincide, ignorando únicamente whitespace, con el [patrón oficial de Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security#auto-enable-rls-for-new-tables). También coinciden SECURITY DEFINER, search_path=pg_catalog y los tres tags del evento. Se acredita equivalencia con el patrón documentado; no se identifica al actor que lo instaló en producción. Evidencia: `bootstrap-official-pattern.json`.

## Objetos reproducidos

- public.rls_auto_enable(): propietario postgres, SECURITY DEFINER, search_path=pg_catalog; cuerpo remoto exacto. EXECUTE para PUBLIC, postgres, anon, authenticated y service_role, como remoto.
- ensure_rls: propietario postgres, habilitado O, ddl_command_end; CREATE TABLE, CREATE TABLE AS y SELECT INTO; llama a public.rls_auto_enable().
- ar_name_inferred_sex, ar_phone_area_codes, cron_config y tracking_queue: propietario postgres; RLS=true; FORCE RLS=false; ninguna política. Sus grants históricos ya coinciden y se verifican íntegramente, sin sustituirlos.

La capa se almacena en `supabase/bootstrap/local-security-compatibility.sql`, fuera de migrations. Su manifiesto independiente sella el SQL y la referencia con SHA256. El runner valida esos hashes antes de crear recursos, exige ledger con exactamente 268 entradas y comprueba toda la referencia después de aplicar la capa. Si cambia una política, ACL, propietario o flag, aborta.

El marcador SQL y el socket Unix son controles adicionales, no una prueba suficiente de localidad por sí solos: la barrera principal es el runner, que crea su propio contenedor, verifica ID/labels, daemon local y única red interna y rechaza destinos arbitrarios. Cron permanece globalmente detenido durante todo el proceso. La capa no se registra como migración histórica y se aplica una sola vez en cada reconstrucción.

## Acceso y riesgo preservado

La metadata remota muestra anon/authenticated sin BYPASSRLS, service_role con BYPASSRLS, y permisos de tabla para los tres. No hay políticas, por lo que las operaciones por fila de anon/authenticated quedan denegadas por defecto. EXPLAIN remoto sin ANALYZE confirma cuatro filtros constantes falsos para cada uno; service_role no tiene esos filtros. No se ejecutaron scans ni comandos de escritura remotos. Planes y consultas: `bootstrap-remote-access-plans.json`.

Las pruebas locales usan las tablas del esquema completo. Cada escenario vacía temporalmente solo la tabla local, introduce una fila sintética, ejecuta SET LOCAL ROLE y verifica SELECT, INSERT, UPDATE, DELETE y TRUNCATE. Siempre finaliza con ROLLBACK o rollback implícito de la conexión tras el error esperado. Las filas y configuraciones anteriores nunca se retornan ni se copian a fixtures. Se comprueba además que una tabla futura en public reciba RLS por el event trigger.

**Riesgo confirmado para la futura fase de seguridad:** anon y authenticated tienen TRUNCATE en las cuatro tablas. Según las [reglas de PostgreSQL](https://www.postgresql.org/docs/17/ddl-rowsecurity.html), TRUNCATE no está sujeto a RLS. Se caracteriza esa capacidad únicamente en transacciones locales sintéticas. No se revoca en local ni en producción y no se afirma que el estado sea seguro. Tampoco se afirma haber demostrado una vía de explotación HTTP: la evidencia es el permiso SQL y su ejercicio local. Los grants amplios restantes y el EXECUTE de la función se conservan fielmente para revisión posterior.

## Comparación y límites

El fingerprint bruto de cada reconstrucción sigue conservando el orden físico de columnas para verificar repetibilidad. El comparador semántico ignora solo ese orden: compara todos los atributos de cada columna por nombre.

Las únicas excepciones de plataforma son cinco entradas exactas selladas en `platform-exceptions.json`: pg_graphql 1.5.11 local, sus dos event triggers y las dos entradas que representan el extnamespace diferente de pg_net 0.19.5. Para aceptar estas últimas deben coincidir las doce funciones miembro de pg_net, incluidas definiciones, propietarios y ACL. Para los triggers GraphQL se exige acreditar pertenencia a pg_graphql. No se detectaron llamadas GraphQL en frontend/app, frontend/lib o supabase/functions. Se acepta la capacidad opcional adicional del proveedor local, sin presentarla como una API productiva idéntica.

Una versión diferente, otro objeto, un cambio de propietario/permisos o una definición distinta no coincide con la excepción y queda pendiente. Los estados del comparador son identical, normalized_with_evidence y pending. Los resultados efectivos se guardan en bootstrap-schema-diff.json. No se normalizan diferencias de seguridad.

El catálogo principal cubre public/private y metadata de extensiones, cron y colas. La evidencia adicional cubre funciones miembro de pg_net y los triggers GraphQL enumerados. No se certifica el stack completo de Auth/Storage/Edge ni todos los componentes internos del proveedor.

## Advisors y rollback

La ayuda real de Supabase CLI 2.75.0 no ofrece db advisors. No se ejecutó un advisor remoto como sustituto ni se confundió db lint con una revisión de seguridad. Queda documentado como no disponible, según la condición del usuario; no como chequeo aprobado.

Rollback: descartar exclusivamente la base temporal y sus recursos identificados por el runner. No hay cambios remotos que revertir. Retirar la capa de una futura reconstrucción requeriría actualizar explícitamente su contrato y su evidencia; nunca aplicarla mediante db push ni copiarla a migrations.
