# Plan de migraciones 269–274

Las 268 versiones remotas coinciden exactamente con el conjunto legado. Aplicar sólo las seis entradas de [incremental-manifest.json](../../../supabase/bootstrap/incremental-manifest.json), en este orden:

| Número | Versión y archivo |
| --- | --- |
| 269 | 20260917183837_protect_profile_administrative_fields.sql |
| 270 | 20260918010532_protect_settings_revalidation_secret.sql |
| 271 | 20260918140931_protect_phone_administration.sql |
| 272 | 20260918152656_restrict_internal_database_privileges.sql |
| 273 | 20260918161631_remove_remaining_client_truncate_privileges.sql |
| 274 | 20260918194918_optimize_whatsapp_cloud_api_inbox_loading.sql |

Los hashes completos están en [review.json](review.json) y [release-inventory.json](release-inventory.json). No hay backfills, copias/rotaciones de secretos, reescrituras de filas ni creación de índices en estas seis migraciones. Cambian catálogos, privilegios y definiciones. **Cero filas de negocio modificadas por su SQL**, aunque las nuevas restricciones afectan operaciones futuras.

## 269 — Profiles

- Objetos: grants de tabla/columnas y política Update own profile; RLS habilitada.
- Dependencias: profiles(id, role, created_at, nombre), Auth y política existente. Nombre físico: nombre; no una columna name.
- Antes/después: editor legítimo del nombre y create-client siguen funcionando. service_role conserva INSERT/UPDATE explícitos de id, role, nombre; no DELETE directo de profiles ni escritura de created_at. Borrado Auth y su cascada acreditados localmente.
- Locks/volumen: ENABLE RLS y ALTER POLICY pueden tomar ACCESS EXCLUSIVE sobre profiles; grants actualizan catálogos. Tabla estimada en 15 filas/64 KiB, sin escaneo de backfill.
- Riesgo: bajo-medio operativo; no restaura roles que hubieran sido alterados antes de este endurecimiento.
- Validar: nombre propio, denegación de id/role/created_at, payload mixto atómico y ACL efectivos; pruebas 1B.1 más regresión de perfiles en 1B.3.
- Reversión: forward-fix del consumidor o columna autorizada. No devolver UPDATE amplio para salvar una pantalla.

## 270 — Settings y revalidación

- Objetos: grants de settings y EXECUTE de verify_revalidate_secret(text). authenticated sólo lee id/url_base/show_client_landing_preview y actualiza las dos últimas con RLS; service_role sólo SELECT explícito de las seis columnas.
- Dependencias: seis columnas acreditadas, políticas actuales y variable servidor REVALIDATION_ENV. La credencial queda en su fila; no se mueve ni reemplaza.
- Frontend antiguo: **incompatible**. Pide la columna sensible y el receptor constructor antiguo usa la RPC revocada. Habrá denegaciones; no son fallos silenciosos admisibles.
- Frontend nuevo: compatible, usa proyección explícita y rutas servidor. La ruta nueva puede leer el esquema previo, pero la seguridad sólo se completa con la revocación. No conviene promover todo el candidato antes de 274 porque el Inbox llama RPC nuevas.
- Locks/volumen: ALTER TABLE ENABLE RLS toma ACCESS EXCLUSIVE aunque ya esté habilitado; ACL de catálogo, sin reescritura ni lectura del valor secreto. Tamaño físico observado: 32 KiB; la estadística de filas no era válida.
- Riesgo: alto de coordinación. Se notifica recarga de schema a PostgREST.
- Validar: SELECT seguro funciona; columna sensible/select=* fallan cerrados; navegador no recibe/envía secreto; estado configurado, autorización y destinos fijos; publicación clásica/constructor con fixture controlado.
- Reversión: aplicación servidor compatible o suspensión temporal de revalidación. No restaurar la RPC-oráculo, columna pública ni input de secreto. Rotación coordinada separada tras cerrar acceso.

## 271 — Administración de teléfonos

- Objetos: gerencia_phones, su secuencia, cuatro políticas owner/admin, dos triggers privados de inmutabilidad sobre gerencia_id y gerencias.user_id; EXECUTE de cron_sync_phones_all() y cron_reset_phone_operational_daily().
- Dependencias: 269 protege el rol administrativo. El esquema private existe remotamente; las tres políticas que se eliminan coinciden con sus nombres esperados.
- Código anterior: listados propios/DML permitido pueden continuar; los botones con clave pública dejan de autorizarse cuando cambian los handlers. Código nuevo frente a handlers antiguos: faltaría user_id y devolverían 400. Deben coordinarse.
- Código nuevo: identidad de sesión verificada; admin comprobado en profiles. El modo cron de sync conserva la credencial y fallback existentes. reset-phone-messages mantiene verify_jwt=true; sync-phones y reset-phone-counters false, con autorización dentro del handler.
- Locks/volumen: RLS/policies requieren locks DDL; los triggers requieren SHARE ROW EXCLUSIVE en su creación. Presupuestar el ACCESS EXCLUSIVE de gerencia_phones y bloqueo breve de escrituras sobre gerencias. Estimaciones: 379/72 filas, sin backfill.
- Riesgo: medio de locks, alto de coexistencia de clientes. Asignación pública, reservas, normalización, contadores y canales no cambian.
- Validar: acceso A/B/admin, propietarios inmutables, payload mixto, tres handlers y contratos de landing-phone; roles/jobs/command hashes idénticos. No invocar cron real como prueba.
- Reversión: forward-fix acotado; conservar RLS/ACL/inmutabilidad. Los handlers viejos reabren el defecto y no son rollback normal.

## 272 — Privilegios internos

- Objetos: TRUNCATE en 13 tablas; CRUD/REFERENCES/TRIGGER/MAINTAIN de cron_config; ocho funciones trigger, cron_process_due_promotions(), consume_ai_assistant_quota(integer), get_notification_bot_username() y get_home_overview_stats(uuid,uuid).
- Dependencias: objetos/owners existentes; postgres y backend conservan permisos. No cambian horarios, cuerpos de triggers ni cálculos. El RPC legacy de estadísticas agrega rechazo de auth.uid() null; backend sin contexto de usuario ya no puede usar esa variante como bypass.
- Compatibilidad: consumidores autenticados acreditados y sobrecargas actuales conservados; la migración no requiere un nuevo frontend. EXECUTE de funciones trigger no se confunde con su ejecución automática por el trigger.
- Locks/volumen: privilegios y CREATE OR REPLACE FUNCTION afectan catálogos/invalidation; no TRUNCATE ejecutado ni escaneo de tablas. No se midió la espera de locks de producción.
- Riesgo: medio. Validar matriz ACL, RPC null/anon, resultado propio/admin, cron legítimo y DML disparador. 82 controles y ocho aserciones pgTAP incluidos en la evidencia.
- Reversión: corregir firma/consumidor concreto; no grants públicos generales ni eliminación de la guarda.

## 273 — TRUNCATE restante

- Objetos: las 29 tablas enumeradas literalmente en el archivo; unión de 42 con 272.
- Preflight actual: existen las 42, owner postgres; anon y authenticated tienen TRUNCATE en las 42. PUBLIC no tiene grant explícito, pero revocarlo sigue siendo defensa necesaria.
- Compatibilidad: SELECT/INSERT/UPDATE/DELETE, RLS, funciones, triggers y owners permanecen iguales; no dependencia de frontend/Edge. Postgres conserva mantenimiento.
- Locks/volumen: sólo REVOKE de catálogo; **no ejecutar TRUNCATE**. El volumen de datos de las tablas no implica un backfill. Riesgo bajo-medio.
- Validar: las 42 denegaciones efectivas y comparación del resto de ACL. Evidencia: 93 controles, con 169 aserciones pgTAP dentro de un control; cero permisos ampliados.
- Reversión: forward-fix sólo si se acredita un consumidor legítimo; nunca TRUNCATE cliente general.

## 274 — Inbox

- Objetos: cuerpo optimizado del RPC histórico de siete argumentos; esquema inbox_private, dos helpers y wrappers invoker get_whatsapp_cloud_api_inbox_summaries/get_whatsapp_cloud_api_inbox_messages.
- Dependencias: tablas/columnas existentes e índices parciales de conversions, mensajes, asignación/atribución y redirects. Once índices relevantes se acreditaron válidos/listos; ver baseline. No se agrega un índice ni se toca ingestión.
- Compatibilidad: el lector viejo conserva firma/proyección y se beneficia del SQL corregido. El nuevo requiere las dos RPC y sus permisos antes de promover Vercel. Confirmar esquema privado no expuesto.
- Locks/volumen: creación/reemplazo de funciones y ACL de catálogo; sin backfill, CREATE INDEX ni cambio de tablas. El SQL SELECT optimizado se evalúa en las llamadas posteriores, no durante la migración.
- Riesgo: medio de planificación/regresión; no usar aumento del timeout. Histórico local: timeout de 8 s → 98 ms; resumen 94,5 ms; detalle 12,3 ms. Son tiempos de SELECT sintético, **no duración de aplicar la migración** ni SLA.
- Validar: 274/274, equivalencia, aislamiento, páginas/empates, filtros, leído/no leído, detalle y datos transferidos; smoke del flujo desplegado.
- Reversión: restaurar el frontend compatible pre-Inbox de ad436ff1 manteniendo SQL optimizado; preparar ese artefacto con toda la seguridad. Retirar wrappers sólo en una futura migración si ya no hay consumidores.

## Ejecución operativa y duración

No se midió DDL productivo ni hay estimación temporal defendible por archivo. Sin espera se prevén operaciones breves de catálogo; una transacción larga puede dominar la duración. Al consultar había cero sesiones esperando locks y cero idle in transaction, sólo una fotografía.

Antes de ejecutar, consultar --help de la CLI, verificar proyecto/ledger y dry-run: deben aparecer exactamente seis versiones. No usar --include-all, db reset, repair, bootstrap local ni cambios de extensiones. Exigir transacciones por migración, límite de espera de lock de 5 segundos y presupuesto acotado de ejecución mediante el ejecutor aprobado; si no puede garantizarlos, no iniciar la ventana. Ante timeout, abortar esa transacción y revisar; no ampliar límites ni cancelar sesiones ajenas automáticamente.

No reaplicar los tres históricos modificados en Fase 0: 20260325201000 corrige secuencia vacía; 20260427180000 recupera statements faltantes; 20260427190000 parametriza el endpoint/credencial del runner. Su ledger remoto ya existe. Tampoco desplegar local-security-compatibility.sql, manifiestos, pg_net local o fixtures.

Locks contrastados con [ALTER TABLE PostgreSQL 17](https://www.postgresql.org/docs/17/sql-altertable.html), [policy.c](https://github.com/postgres/postgres/blob/REL_17_STABLE/src/backend/commands/policy.c) y [trigger.c](https://github.com/postgres/postgres/blob/REL_17_STABLE/src/backend/commands/trigger.c). Acceso: [grants y RLS de Supabase](https://supabase.com/docs/guides/api/securing-your-api). Es evaluación estática, no ensayo remoto de locks.
