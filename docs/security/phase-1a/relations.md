# Inventario de relaciones — Fase 1A

60 tablas, una vista, diez secuencias. Metadata actual; no filas productivas. Grants no equivalen a visibilidad: también aplican RLS, permisos por columna, schema y contexto del llamador. Las secuencias no son tablas REST. Para el alcance hosted exacto de Data API falta confirmar configuración del servicio; no se infiere sólo de config.toml.

Las operaciones identificadas junto a .from son evidencia estática de la cadena local, no prueba exhaustiva de ejecución; métodos en variables/ramas pueden requerir privilegios adicionales. No retirar CRUD basándose sólo en ausencia de referencia. Backend en frontend/lib/tracking usa getSupabaseServerClient (service_role con fallback anon): no convertirlo en lector browser por su ubicación.

## Lote TRUNCATE propuesto

42 tablas con ambos grants explícitos anon/authenticated; PUBLIC no los concede sobre estas tablas en la captura. Sin revocación ejecutada:

- public.ai_assistant_usage_monthly
- public.ar_name_inferred_sex
- public.ar_phone_area_codes
- public.atrio_clients
- public.chatrace_client_configs
- public.chatrace_gerencias
- public.client_subscriptions
- public.conversion_inbox
- public.conversion_log_lead_backfill_replays
- public.conversion_logs
- public.conversion_view_preferences
- public.conversions
- public.conversions_config
- public.conversions_pixel_configs
- public.cron_config
- public.gerencia_phone_availability_snapshots
- public.gerencia_phones
- public.gerencia_work_group_members
- public.gerencia_work_groups
- public.gerencias
- public.hidden_contacts
- public.hidden_conversion_inbox
- public.hidden_conversion_logs
- public.hidden_conversions
- public.home_overview_stats_cache
- public.kommo_client_configs
- public.landing_phone_availability_demands
- public.landing_phone_cache
- public.landings
- public.landings_gerencias
- public.notification_bot_config
- public.notification_contact_alerts
- public.notification_settings
- public.notification_telegram_destinations
- public.profiles
- public.promotion_participants
- public.promotions
- public.settings
- public.tracking_queue
- public.whatsapp_cloud_api_gerencias
- public.whatsapp_cloud_api_redirects
- public.whatsapp_cloud_api_thread_reads

funnel_contacts también tiene ambos grants TRUNCATE; es una vista y no se puede truncar como una tabla. Limpiar ese grant no elimina una operación real. net.http_request_queue y net._http_response tienen TRUNCATE por PUBLIC fuera de este lote; plan separado de plataforma, sin afirmar que están expuestas por REST. Defaults afectados en public: creators postgres y supabase_admin, anon/authenticated TRUNCATE; ejecutar cambios futuros sólo con rol autorizado y preflight por owner, no mediante exclusiones genéricas.

## T01 public.ai_assistant_usage_monthly

Actual: tipo r; owner postgres; RLS=true; FORCE RLS=false; options=null. Grants (* indica grant option): anon=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; authenticated=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; postgres=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; service_role=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE.

Columnas con ACL específica: ninguna. Políticas: ai_assistant_usage_monthly_insert_own [public; INSERT]; ai_assistant_usage_monthly_select_own [public; SELECT]; ai_assistant_usage_monthly_update_own [public; UPDATE]. Expresiones con literales enmascarados y hashes anteriores en evidence.json.

Consumidores directos: ninguno localizado; no acredita desuso. Menciones SQL: public.consume_ai_assistant_quota(p_limit integer). Público por diseño: no acreditado; no revocar contratos desconocidos por ausencia de referencias.

Mínimo propuesto: contratos RLS existentes INSERT/SELECT/UPDATE a conservar hasta cerrar caminos dinámicos. Owner/service_role sólo operaciones de sus consumidores; ningún TRUNCATE de anon/authenticated. Tratamiento: Retirar TRUNCATE si figura. CRUD/ACL adicional sólo tras resolver diferencias entre operaciones observadas y policies; conservar reglas y resultados. Riesgo/tráfico: medio, consumidor indirecto/externo por confirmar. Qué podría romperse: Consumidores listados y funciones SQL dependientes; no ejecutar revocación general.

## T02 public.ar_name_inferred_sex

Actual: tipo r; owner postgres; RLS=true; FORCE RLS=false; options=null. Grants (* indica grant option): anon=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; authenticated=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; postgres=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; service_role=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE.

Columnas con ACL específica: ninguna. Políticas: ninguna. Expresiones con literales enmascarados y hashes anteriores en evidence.json.

Consumidores directos: edge: supabase/functions/conversions/index.ts:1658 [select]. Menciones SQL: ninguna detectada. Público por diseño: no.

Mínimo propuesto: Sin permisos directos anon/authenticated; owner/service_role según consumidor. No políticas de cliente nuevas. Tratamiento: Revocar TRUNCATE y, después de pruebas, grants redundantes no usados; conservar lecturas/escrituras backend actuales y RLS sin policies. Riesgo/tráfico: bajo/medio. Qué podría romperse: Inferencia/geo, scheduler o cola si se revoca backend en vez de cliente.

## T03 public.ar_phone_area_codes

Actual: tipo r; owner postgres; RLS=true; FORCE RLS=false; options=null. Grants (* indica grant option): anon=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; authenticated=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; postgres=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; service_role=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE.

Columnas con ACL específica: ninguna. Políticas: ninguna. Expresiones con literales enmascarados y hashes anteriores en evidence.json.

Consumidores directos: edge: supabase/functions/conversions/index.ts:2356 [select]. Menciones SQL: ninguna detectada. Público por diseño: no.

Mínimo propuesto: Sin permisos directos anon/authenticated; owner/service_role según consumidor. No políticas de cliente nuevas. Tratamiento: Revocar TRUNCATE y, después de pruebas, grants redundantes no usados; conservar lecturas/escrituras backend actuales y RLS sin policies. Riesgo/tráfico: bajo/medio. Qué podría romperse: Inferencia/geo, scheduler o cola si se revoca backend en vez de cliente.

## T04 public.atrio_assignment_scope_metrics

Actual: tipo r; owner postgres; RLS=true; FORCE RLS=false; options=null. Grants (* indica grant option): authenticated=SELECT; postgres=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; service_role=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE.

Columnas con ACL específica: ninguna. Políticas: Admins can read all atrio assignment scope metrics [authenticated; SELECT]; Users can read own atrio assignment scope metrics [authenticated; SELECT]. Expresiones con literales enmascarados y hashes anteriores en evidence.json.

Consumidores directos: ninguno localizado; no acredita desuso. Menciones SQL: public.atrio_assignment_scope_usage(p_scope_type text, p_scope_id uuid, p_atrio_client_id uuid); public.increment_atrio_assignment_scope_usage(p_atrio_client_id uuid, p_scope_type text, p_scope_id uuid, p_user_id uuid). Público por diseño: no acreditado; no revocar contratos desconocidos por ausencia de referencias.

Mínimo propuesto: contratos RLS existentes SELECT a conservar hasta cerrar caminos dinámicos. Owner/service_role sólo operaciones de sus consumidores; ningún TRUNCATE de anon/authenticated. Tratamiento: Retirar TRUNCATE si figura. CRUD/ACL adicional sólo tras resolver diferencias entre operaciones observadas y policies; conservar reglas y resultados. Riesgo/tráfico: medio, consumidor indirecto/externo por confirmar. Qué podría romperse: Consumidores listados y funciones SQL dependientes; no ejecutar revocación general.

## T05 public.atrio_clients

Actual: tipo r; owner postgres; RLS=true; FORCE RLS=false; options=null. Grants (* indica grant option): anon=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; authenticated=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; postgres=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; service_role=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE.

Columnas con ACL específica: ninguna. Políticas: atrio_clients_admin_manage [authenticated; ALL]; atrio_clients_owner_manage [authenticated; ALL]. Expresiones con literales enmascarados y hashes anteriores en evidence.json.

Consumidores directos: frontend: frontend/lib/atrio/atrioDb.ts:109 [select]; frontend: frontend/lib/atrio/atrioDb.ts:124 [select]; frontend: frontend/lib/atrio/atrioDb.ts:145 [insert/select]; frontend: frontend/lib/atrio/atrioDb.ts:167 [update/select]; frontend: frontend/lib/atrio/atrioDb.ts:181 [delete]. Menciones SQL: public.set_landings_atrio_clients_owner(); public.increment_atrio_assignment_scope_usage(p_atrio_client_id uuid, p_scope_type text, p_scope_id uuid, p_user_id uuid); public.get_atrio_for_landing(p_landing_name text). Público por diseño: no acreditado; no revocar contratos desconocidos por ausencia de referencias.

Mínimo propuesto: authenticated DELETE/INSERT/SELECT/UPDATE observados; contratos RLS existentes DELETE/INSERT/SELECT/UPDATE a conservar hasta cerrar caminos dinámicos. Owner/service_role sólo operaciones de sus consumidores; ningún TRUNCATE de anon/authenticated. Tratamiento: Retirar TRUNCATE si figura. CRUD/ACL adicional sólo tras resolver diferencias entre operaciones observadas y policies; conservar reglas y resultados. Riesgo/tráfico: medio. Qué podría romperse: Consumidores listados y funciones SQL dependientes; no ejecutar revocación general.

## T06 public.auth_signup_approvals

Actual: tipo r; owner postgres; RLS=true; FORCE RLS=false; options=null. Grants (* indica grant option): postgres=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; service_role=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE.

Columnas con ACL específica: ninguna. Políticas: ninguna. Expresiones con literales enmascarados y hashes anteriores en evidence.json.

Consumidores directos: edge: supabase/functions/create-client/index.ts:70 [delete]; edge: supabase/functions/create-client/index.ts:279 [upsert]. Menciones SQL: public.prevent_unapproved_auth_user(); public.handle_new_user(). Público por diseño: no acreditado; no revocar contratos desconocidos por ausencia de referencias.

Mínimo propuesto: Sin policy de cliente: acceso directo de usuario no acreditado. Owner/service_role sólo operaciones de sus consumidores; ningún TRUNCATE de anon/authenticated. Tratamiento: Retirar TRUNCATE si figura. CRUD/ACL adicional sólo tras resolver diferencias entre operaciones observadas y policies; conservar reglas y resultados. Riesgo/tráfico: medio, consumidor indirecto/externo por confirmar. Qué podría romperse: Consumidores listados y funciones SQL dependientes; no ejecutar revocación general.

## T07 public.chatrace_client_configs

Actual: tipo r; owner postgres; RLS=true; FORCE RLS=false; options=null. Grants (* indica grant option): anon=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; authenticated=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; postgres=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; service_role=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE.

Columnas con ACL específica: ninguna. Políticas: Admins can delete all chatrace_client_configs [public; DELETE]; Admins can insert all chatrace_client_configs [public; INSERT]; Admins can read all chatrace_client_configs [public; SELECT]; Admins can update all chatrace_client_configs [public; UPDATE]; Users can delete own chatrace_client_configs [public; DELETE]; Users can insert own chatrace_client_configs [public; INSERT]; Users can read own chatrace_client_configs [public; SELECT]; Users can update own chatrace_client_configs [public; UPDATE]. Expresiones con literales enmascarados y hashes anteriores en evidence.json.

Consumidores directos: frontend: frontend/lib/chatraceDb.ts:27 [select]; frontend: frontend/lib/chatraceDb.ts:52 [upsert]; edge: supabase/functions/conversions/index.ts:3003 [select]; edge: supabase/functions/retry-failed-conversions/index.ts:206 [select]. Menciones SQL: public.get_phone_for_chatrace_client(p_client_name text). Público por diseño: no.

Mínimo propuesto: Propietario/admin según policies actuales: lectura de configuración sin secretos, edición autorizada y backend consumidor de credenciales. Sin TRUNCATE. Tratamiento: No revocar SELECT de columnas antes de adaptar lectores SELECT * y administración de secretos; mantener recepción/envío con la misma configuración. Riesgo/tráfico: alto. Qué podría romperse: Panel/integraciones/credenciales usadas por emisores; exige transición explícita.

## T08 public.chatrace_gerencias

Actual: tipo r; owner postgres; RLS=true; FORCE RLS=false; options=null. Grants (* indica grant option): anon=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; authenticated=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; postgres=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; service_role=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE.

Columnas con ACL específica: ninguna. Políticas: Admins can delete all chatrace_gerencias [public; DELETE]; Admins can insert all chatrace_gerencias [public; INSERT]; Admins can read all chatrace_gerencias [public; SELECT]; Admins can update all chatrace_gerencias [public; UPDATE]; Users can delete own chatrace_gerencias [public; DELETE]; Users can insert own chatrace_gerencias [public; INSERT]; Users can read own chatrace_gerencias [public; SELECT]; Users can update own chatrace_gerencias [public; UPDATE]. Expresiones con literales enmascarados y hashes anteriores en evidence.json.

Consumidores directos: frontend: frontend/components/integraciones/IntegracionesMetaCapi.tsx:334 [select]; frontend: frontend/components/integraciones/IntegracionesMetaCapi.tsx:548 [delete]; frontend: frontend/components/integraciones/IntegracionesMetaCapi.tsx:559 [insert]. Menciones SQL: public.get_phone_for_chatrace_client(p_client_name text). Público por diseño: no acreditado; no revocar contratos desconocidos por ausencia de referencias.

Mínimo propuesto: authenticated DELETE/INSERT/SELECT observados; contratos RLS existentes DELETE/INSERT/SELECT/UPDATE a conservar hasta cerrar caminos dinámicos. Owner/service_role sólo operaciones de sus consumidores; ningún TRUNCATE de anon/authenticated. Tratamiento: Retirar TRUNCATE si figura. CRUD/ACL adicional sólo tras resolver diferencias entre operaciones observadas y policies; conservar reglas y resultados. Riesgo/tráfico: medio. Qué podría romperse: Consumidores listados y funciones SQL dependientes; no ejecutar revocación general.

## T09 public.chatrace_gerencias_id_seq

Actual: tipo S; owner postgres; RLS=false; FORCE RLS=false; options=null. Grants (* indica grant option): anon=SELECT/UPDATE/USAGE; authenticated=SELECT/UPDATE/USAGE; postgres=SELECT/UPDATE/USAGE; service_role=SELECT/UPDATE/USAGE.

Columnas con ACL específica: ninguna. Políticas: ninguna. Expresiones con literales enmascarados y hashes anteriores en evidence.json.

Consumidores directos: ninguno localizado; no acredita desuso. Menciones SQL: ninguna detectada. Público por diseño: no por sí misma.

Mínimo propuesto: USAGE/SELECT sólo a insertadores legítimos acreditados del default/identity; owner/backend conservan lo necesario. UPDATE de secuencia no requerido por browser conocido. Tratamiento: No cambiar valor, mínimo ni siguiente ID. Identificar dependencia de tabla y ruta INSERT antes de revocar. Riesgo/tráfico: medio. Qué podría romperse: INSERT con IDs automáticos si se elimina USAGE necesario.

## T10 public.client_subscriptions

Actual: tipo r; owner postgres; RLS=true; FORCE RLS=false; options=null. Grants (* indica grant option): anon=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; authenticated=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; postgres=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; service_role=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE.

Columnas con ACL específica: ninguna. Políticas: Admins can insert client_subscriptions [public; INSERT]; Admins can read all client_subscriptions [public; SELECT]; Admins can update client_subscriptions [public; UPDATE]; Users can read own client_subscriptions [public; SELECT]. Expresiones con literales enmascarados y hashes anteriores en evidence.json.

Consumidores directos: frontend: frontend/app/(panel)/dashboard/landings/page.tsx:71 [select]; frontend: frontend/app/(panel)/dashboard/landings/page.tsx:110 [select]; frontend: frontend/app/(panel)/dashboard/landings/page.tsx:148 [select]; frontend: frontend/app/(panel)/dashboard/layout.tsx:368 [select]; frontend: frontend/app/(panel)/dashboard/plan/page.tsx:141 [select]; frontend: frontend/components/telefonos/TelefonosPageContent.tsx:188 [select]; edge: supabase/functions/create-client/index.ts:447 [upsert]; edge: supabase/functions/list-clients/index.ts:186 [select]; edge: supabase/functions/sync-phones/index.ts:394 [select]; edge: supabase/functions/update-client/index.ts:310 [upsert]; edge: supabase/functions/update-client/index.ts:334 [select]. Menciones SQL: public.get_client_plan_limits(p_user_id uuid); public.is_client_access_blocked(p_user_id uuid); public.enforce_landing_plan_limit(). Público por diseño: no acreditado; no revocar contratos desconocidos por ausencia de referencias.

Mínimo propuesto: authenticated SELECT observados; contratos RLS existentes INSERT/SELECT/UPDATE a conservar hasta cerrar caminos dinámicos. Owner/service_role sólo operaciones de sus consumidores; ningún TRUNCATE de anon/authenticated. Tratamiento: Retirar TRUNCATE si figura. CRUD/ACL adicional sólo tras resolver diferencias entre operaciones observadas y policies; conservar reglas y resultados. Riesgo/tráfico: medio. Qué podría romperse: Consumidores listados y funciones SQL dependientes; no ejecutar revocación general.

## T11 public.conversion_inbox

Actual: tipo r; owner postgres; RLS=true; FORCE RLS=false; options=null. Grants (* indica grant option): anon=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; authenticated=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; postgres=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; service_role=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE.

Columnas con ACL específica: ninguna. Políticas: conversion_inbox_select_own [authenticated; SELECT]. Expresiones con literales enmascarados y hashes anteriores en evidence.json.

Consumidores directos: frontend: frontend/lib/conversionsDb.ts:1497 [select]; frontend: frontend/lib/conversionsDb.ts:1530 [select]; edge: supabase/functions/conversions/index.ts:1946 [insert/select]; edge: supabase/functions/conversions/index.ts:2017 [select]; edge: supabase/functions/conversions/index.ts:2054 [select]; edge: supabase/functions/conversions/index.ts:2108 [update]; edge: supabase/functions/conversions/index.ts:2120 [select]; edge: supabase/functions/retry-failed-conversions/index.ts:934 [select]; edge: supabase/functions/retry-failed-conversions/index.ts:958 [update]; edge: supabase/functions/retry-failed-conversions/index.ts:1017 [select]; edge: supabase/functions/retry-failed-conversions/index.ts:1041 [update]; edge: supabase/functions/retry-failed-conversions/index.ts:1282 [select]. Menciones SQL: ninguna detectada. Público por diseño: no acreditado; no revocar contratos desconocidos por ausencia de referencias.

Mínimo propuesto: authenticated SELECT observados; contratos RLS existentes SELECT a conservar hasta cerrar caminos dinámicos. Owner/service_role sólo operaciones de sus consumidores; ningún TRUNCATE de anon/authenticated. Tratamiento: Retirar TRUNCATE si figura. CRUD/ACL adicional sólo tras resolver diferencias entre operaciones observadas y policies; conservar reglas y resultados. Riesgo/tráfico: medio. Qué podría romperse: Consumidores listados y funciones SQL dependientes; no ejecutar revocación general.

## T12 public.conversion_journey_starts

Actual: tipo r; owner postgres; RLS=true; FORCE RLS=false; options=null. Grants (* indica grant option): authenticated=SELECT; postgres=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; service_role=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE.

Columnas con ACL específica: ninguna. Políticas: conversion_journey_starts_admin_read [authenticated; SELECT]; conversion_journey_starts_owner_read [authenticated; SELECT]. Expresiones con literales enmascarados y hashes anteriores en evidence.json.

Consumidores directos: frontend: frontend/lib/conversionsDb.ts:967 [select]. Menciones SQL: public.record_conversion_journey_start(p_user_id uuid, p_source_platform text, p_start_identity_key text, p_landing_id uuid, p_landing_name text, p_workspace_currency text, p_external_id text, p_phone text, p_wa_id text, p_email text, p_utm_campaign text, p_fbp text, p_fbc text, p_from_meta_ads boolean, p_meta_pixel_id text, p_dataset_id text, p_ctwa_clid text, p_telefono_asignado text, p_assigned_gerencia_id integer, p_assigned_gerencia_external_id integer, p_assigned_gerencia_name text, p_assigned_gerencia_label text, p_device_type text, p_event_source_url text, p_client_ip text, p_agent_user text, p_first_seen_at timestamp with time zone, p_last_seen_at timestamp with time zone). Público por diseño: no acreditado; no revocar contratos desconocidos por ausencia de referencias.

Mínimo propuesto: authenticated SELECT observados; contratos RLS existentes SELECT a conservar hasta cerrar caminos dinámicos. Owner/service_role sólo operaciones de sus consumidores; ningún TRUNCATE de anon/authenticated. Tratamiento: Retirar TRUNCATE si figura. CRUD/ACL adicional sólo tras resolver diferencias entre operaciones observadas y policies; conservar reglas y resultados. Riesgo/tráfico: medio. Qué podría romperse: Consumidores listados y funciones SQL dependientes; no ejecutar revocación general.

## T13 public.conversion_log_lead_backfill_replays

Actual: tipo r; owner postgres; RLS=true; FORCE RLS=false; options=null. Grants (* indica grant option): anon=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; authenticated=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; postgres=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; service_role=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE.

Columnas con ACL específica: ninguna. Políticas: ninguna. Expresiones con literales enmascarados y hashes anteriores en evidence.json.

Consumidores directos: edge: supabase/functions/retry-failed-conversions/index.ts:1197 [select]; edge: supabase/functions/retry-failed-conversions/index.ts:1245 [upsert]. Menciones SQL: ninguna detectada. Público por diseño: no acreditado; no revocar contratos desconocidos por ausencia de referencias.

Mínimo propuesto: Sin policy de cliente: acceso directo de usuario no acreditado. Owner/service_role sólo operaciones de sus consumidores; ningún TRUNCATE de anon/authenticated. Tratamiento: Retirar TRUNCATE si figura. CRUD/ACL adicional sólo tras resolver diferencias entre operaciones observadas y policies; conservar reglas y resultados. Riesgo/tráfico: medio, consumidor indirecto/externo por confirmar. Qué podría romperse: Consumidores listados y funciones SQL dependientes; no ejecutar revocación general.

## T14 public.conversion_logs

Actual: tipo r; owner postgres; RLS=true; FORCE RLS=false; options=null. Grants (* indica grant option): anon=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; authenticated=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; postgres=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; service_role=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE.

Columnas con ACL específica: ninguna. Políticas: admins_read_all_logs [public; SELECT]; users_read_own_logs [public; SELECT]. Expresiones con literales enmascarados y hashes anteriores en evidence.json.

Consumidores directos: frontend: frontend/lib/conversionsDb.ts:1357 [select]; frontend: frontend/lib/whatsappCloudApiDb.ts:642 [select]; edge: supabase/functions/conversions/index.ts:2181 [insert]; edge: supabase/functions/retry-failed-conversions/index.ts:1203 [select]; edge: supabase/functions/retry-failed-conversions/index.ts:2010 [insert]. Menciones SQL: ninguna detectada. Público por diseño: no acreditado; no revocar contratos desconocidos por ausencia de referencias.

Mínimo propuesto: authenticated SELECT observados; contratos RLS existentes SELECT a conservar hasta cerrar caminos dinámicos. Owner/service_role sólo operaciones de sus consumidores; ningún TRUNCATE de anon/authenticated. Tratamiento: Retirar TRUNCATE si figura. CRUD/ACL adicional sólo tras resolver diferencias entre operaciones observadas y policies; conservar reglas y resultados. Riesgo/tráfico: medio. Qué podría romperse: Consumidores listados y funciones SQL dependientes; no ejecutar revocación general.

## T15 public.conversion_logs_id_seq

Actual: tipo S; owner postgres; RLS=false; FORCE RLS=false; options=null. Grants (* indica grant option): anon=SELECT/UPDATE/USAGE; authenticated=SELECT/UPDATE/USAGE; postgres=SELECT/UPDATE/USAGE; service_role=SELECT/UPDATE/USAGE.

Columnas con ACL específica: ninguna. Políticas: ninguna. Expresiones con literales enmascarados y hashes anteriores en evidence.json.

Consumidores directos: ninguno localizado; no acredita desuso. Menciones SQL: ninguna detectada. Público por diseño: no por sí misma.

Mínimo propuesto: USAGE/SELECT sólo a insertadores legítimos acreditados del default/identity; owner/backend conservan lo necesario. UPDATE de secuencia no requerido por browser conocido. Tratamiento: No cambiar valor, mínimo ni siguiente ID. Identificar dependencia de tabla y ruta INSERT antes de revocar. Riesgo/tráfico: medio. Qué podría romperse: INSERT con IDs automáticos si se elimina USAGE necesario.

## T16 public.conversion_view_preferences

Actual: tipo r; owner postgres; RLS=true; FORCE RLS=false; options=null. Grants (* indica grant option): anon=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; authenticated=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; postgres=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; service_role=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE.

Columnas con ACL específica: ninguna. Políticas: Users manage own conversion_view_preferences [public; ALL]. Expresiones con literales enmascarados y hashes anteriores en evidence.json.

Consumidores directos: frontend: frontend/lib/conversionsDb.ts:530 [select]; frontend: frontend/lib/conversionsDb.ts:545 [upsert]. Menciones SQL: ninguna detectada. Público por diseño: no acreditado; no revocar contratos desconocidos por ausencia de referencias.

Mínimo propuesto: authenticated INSERT/SELECT/UPDATE observados; contratos RLS existentes DELETE/INSERT/SELECT/UPDATE a conservar hasta cerrar caminos dinámicos. Owner/service_role sólo operaciones de sus consumidores; ningún TRUNCATE de anon/authenticated. Tratamiento: Retirar TRUNCATE si figura. CRUD/ACL adicional sólo tras resolver diferencias entre operaciones observadas y policies; conservar reglas y resultados. Riesgo/tráfico: medio. Qué podría romperse: Consumidores listados y funciones SQL dependientes; no ejecutar revocación general.

## T17 public.conversions

Actual: tipo r; owner postgres; RLS=true; FORCE RLS=false; options=null. Grants (* indica grant option): anon=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; authenticated=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; postgres=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; service_role=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE.

Columnas con ACL específica: ninguna. Políticas: Admins can delete all conversions [public; DELETE]; Admins can read all conversions [public; SELECT]; Admins can update all conversions [public; UPDATE]; Users can delete own conversions [public; DELETE]; Users can read own conversions [public; SELECT]; Users can update own conversions [public; UPDATE]. Expresiones con literales enmascarados y hashes anteriores en evidence.json.

Consumidores directos: frontend: frontend/app/(panel)/dashboard/promociones/page.tsx:103 [select]; frontend: frontend/app/(panel)/dashboard/seguimiento/page.tsx:135 [select]; frontend: frontend/app/(panel)/dashboard/seguimiento/page.tsx:152 [delete]; frontend: frontend/lib/conversionsDb.ts:895 [select]; frontend: frontend/lib/conversionsDb.ts:925 [select]; frontend: frontend/lib/conversionsDb.ts:1731 [update]; frontend: frontend/lib/whatsappCloudApiDb.ts:666 [select]; edge: supabase/functions/conversions/index.ts:852 [select]; edge: supabase/functions/conversions/index.ts:886 [select]; edge: supabase/functions/conversions/index.ts:928 [select]; edge: supabase/functions/conversions/index.ts:989 [select]; edge: supabase/functions/conversions/index.ts:1021 [select]; edge: supabase/functions/conversions/index.ts:1075 [select]; edge: supabase/functions/conversions/index.ts:1327 [select]; edge: supabase/functions/conversions/index.ts:1336 [update]; edge: supabase/functions/conversions/index.ts:1529 [update]; edge: supabase/functions/conversions/index.ts:1678 [update]; edge: supabase/functions/conversions/index.ts:1687 [update]; edge: supabase/functions/conversions/index.ts:1694 [update]; edge: supabase/functions/conversions/index.ts:1901 [update]; edge: supabase/functions/conversions/index.ts:1977 [select]; edge: supabase/functions/conversions/index.ts:1985 [select]; edge: supabase/functions/conversions/index.ts:2087 [select]; edge: supabase/functions/conversions/index.ts:2220 [select]; edge: supabase/functions/conversions/index.ts:2443 [update]; edge: supabase/functions/conversions/index.ts:2452 [update]; edge: supabase/functions/conversions/index.ts:2481 [update]; edge: supabase/functions/conversions/index.ts:3129 [select]; edge: supabase/functions/conversions/index.ts:3132 [update]; edge: supabase/functions/conversions/index.ts:3168 [select]; edge: supabase/functions/conversions/index.ts:3180 [update]; edge: supabase/functions/conversions/index.ts:3218 [select]; edge: supabase/functions/conversions/index.ts:3227 [update]; edge: supabase/functions/conversions/index.ts:3320 [update]; edge: supabase/functions/conversions/index.ts:3363 [select]; edge: supabase/functions/conversions/index.ts:3376 [update]; edge: supabase/functions/conversions/index.ts:3407 [select]; edge: supabase/functions/conversions/index.ts:3410 [update]; edge: supabase/functions/conversions/index.ts:3444 [select]; edge: supabase/functions/conversions/index.ts:3454 [update]; edge: supabase/functions/conversions/index.ts:3489 [select]; edge: supabase/functions/conversions/index.ts:3498 [update]; edge: supabase/functions/conversions/index.ts:3554 [select]; edge: supabase/functions/conversions/index.ts:3563 [update]; edge: supabase/functions/conversions/index.ts:3615 [update]; edge: supabase/functions/conversions/index.ts:3646 [select]; edge: supabase/functions/conversions/index.ts:3655 [update]; edge: supabase/functions/conversions/index.ts:3691 [select]; edge: supabase/functions/conversions/index.ts:3700 [update]; edge: supabase/functions/conversions/index.ts:3838 [select]; edge: supabase/functions/conversions/index.ts:3848 [update]; edge: supabase/functions/conversions/index.ts:3918 [select]; edge: supabase/functions/conversions/index.ts:3928 [update]; edge: supabase/functions/conversions/index.ts:4062 [select]; edge: supabase/functions/conversions/index.ts:4076 [select]; edge: supabase/functions/conversions/index.ts:4180 [select]; edge: supabase/functions/conversions/index.ts:4358 [insert/select]; edge: supabase/functions/conversions/index.ts:4501 [select]; edge: supabase/functions/conversions/index.ts:4529 [select]; edge: supabase/functions/conversions/index.ts:4534 [update]; edge: supabase/functions/conversions/index.ts:4655 [select]; edge: supabase/functions/conversions/index.ts:4887 [select]; edge: supabase/functions/conversions/index.ts:5160 [insert/select]; edge: supabase/functions/conversions/index.ts:5168 [select]; edge: supabase/functions/conversions/index.ts:5304 [select]; edge: supabase/functions/conversions/index.ts:5417 [update]; edge: supabase/functions/conversions/index.ts:5421 [select]; edge: supabase/functions/conversions/index.ts:5452 [select]; edge: supabase/functions/conversions/index.ts:5597 [select]; edge: supabase/functions/conversions/index.ts:5633 [select]; edge: supabase/functions/conversions/index.ts:5718 [update]; edge: supabase/functions/conversions/index.ts:5744 [select]; edge: supabase/functions/conversions/index.ts:5875 [insert/select]; edge: supabase/functions/conversions/index.ts:5925 [select]; edge: supabase/functions/conversions/index.ts:6078 [select]; edge: supabase/functions/conversions/index.ts:6204 [select]; edge: supabase/functions/conversions/index.ts:6418 [select]; edge: supabase/functions/conversions/index.ts:6583 [update]; edge: supabase/functions/conversions/index.ts:6585 [select]; edge: supabase/functions/conversions/index.ts:6615 [select]; edge: supabase/functions/conversions/index.ts:6862 [insert/select]; edge: supabase/functions/conversions/index.ts:6873 [select]; edge: supabase/functions/conversions/index.ts:6902 [select]; edge: supabase/functions/conversions/index.ts:7164 [insert/select]; edge: supabase/functions/conversions/index.ts:7199 [select]; edge: supabase/functions/conversions/index.ts:7409 [select]; edge: supabase/functions/conversions/index.ts:7428 [select]; edge: supabase/functions/conversions/index.ts:7586 [insert/select]; edge: supabase/functions/conversions/index.ts:7618 [select]; edge: supabase/functions/conversions/pixel_attribution.ts:252 [select]; edge: supabase/functions/conversions/shared.ts:940 [select]; edge: supabase/functions/conversions/shared.ts:1012 [select]; edge: supabase/functions/notify-inactive-contacts/index.ts:171 [select]; edge: supabase/functions/promotion-draw-due/index.ts:135 [select]; edge: supabase/functions/promotion-draw/index.ts:113 [select]; edge: supabase/functions/promotion-match-backfill/index.ts:85 [select]; edge: supabase/functions/promotion-match-backfill/index.ts:102 [update]; edge: supabase/functions/promotion-participate/index.ts:70 [select]; edge: supabase/functions/promotion-participate/index.ts:85 [update]; edge: supabase/functions/retry-failed-conversions/index.ts:112 [select]; edge: supabase/functions/retry-failed-conversions/index.ts:131 [select]; edge: supabase/functions/retry-failed-conversions/index.ts:156 [select]; edge: supabase/functions/retry-failed-conversions/index.ts:284 [update]; edge: supabase/functions/retry-failed-conversions/index.ts:311 [update]; edge: supabase/functions/retry-failed-conversions/index.ts:387 [update]; edge: supabase/functions/retry-failed-conversions/index.ts:402 [update]; edge: supabase/functions/retry-failed-conversions/index.ts:444 [update]; edge: supabase/functions/retry-failed-conversions/index.ts:474 [update]; edge: supabase/functions/retry-failed-conversions/index.ts:520 [update]; edge: supabase/functions/retry-failed-conversions/index.ts:562 [select]; edge: supabase/functions/retry-failed-conversions/index.ts:598 [update]; edge: supabase/functions/retry-failed-conversions/index.ts:636 [update]; edge: supabase/functions/retry-failed-conversions/index.ts:691 [update]; edge: supabase/functions/retry-failed-conversions/index.ts:717 [update]; edge: supabase/functions/retry-failed-conversions/index.ts:862 [update]; edge: supabase/functions/retry-failed-conversions/index.ts:884 [update]; edge: supabase/functions/retry-failed-conversions/index.ts:906 [update]; edge: supabase/functions/retry-failed-conversions/index.ts:1100 [select]; edge: supabase/functions/retry-failed-conversions/index.ts:1129 [select]; edge: supabase/functions/retry-failed-conversions/index.ts:1176 [update]; edge: supabase/functions/retry-failed-conversions/index.ts:1179 [delete]; edge: supabase/functions/retry-failed-conversions/index.ts:1297 [select]; edge: supabase/functions/retry-failed-conversions/index.ts:1547 [update]; edge: supabase/functions/retry-failed-conversions/index.ts:1633 [update]; edge: supabase/functions/retry-failed-conversions/index.ts:1735 [update]; edge: supabase/functions/retry-failed-conversions/index.ts:1818 [update]; edge: supabase/functions/retry-failed-conversions/index.ts:1853 [update]; edge: supabase/functions/whatsapp-cloud-redirect/index.ts:200 [select]; edge: supabase/functions/whatsapp-cloud-redirect/index.ts:208 [select]. Menciones SQL: public.cron_retry_failed_conversions(); public.get_phone_for_whatsapp_cloud_api(p_config_id uuid); public.get_meta_audience_buyers_v2(p_currency text, p_as_of timestamp with time zone, p_period_start_at timestamp with time zone, p_period_end_at timestamp with time zone); public.get_home_overview_stats(p_user_id uuid, p_hidden_by uuid); public.get_phone_for_chatrace_client(p_client_name text); public.get_home_overview_stats_by_currency(p_user_id uuid, p_hidden_by uuid, p_currency text); public.get_whatsapp_cloud_api_contacts_page(p_limit integer, p_offset integer, p_workspace_currency text); public.set_conversion_log_workspace_currency(); public.refresh_phone_metrics(); public.get_whatsapp_cloud_api_inbox_threads_page(p_limit integer, p_offset integer, p_workspace_currency text, p_tag_filter text, p_unread_only boolean); public.mark_whatsapp_cloud_api_threads_read(p_workspace_currency text, p_tag_filter text); public.mark_whatsapp_cloud_api_threads_read(p_workspace_currency text, p_tag_filter text, p_from timestamp with time zone, p_to timestamp with time zone); public.refresh_home_overview_stats_cache(p_user_id uuid, p_currency text); public.calculate_home_overview_stats_by_currency(p_user_id uuid, p_hidden_by uuid, p_currency text); public.get_whatsapp_cloud_api_inbox_threads(p_limit integer, p_workspace_currency text); public.get_whatsapp_cloud_api_inbox_threads_page(p_limit integer, p_offset integer, p_workspace_currency text); public.get_atrio_for_landing(p_landing_name text); public.claim_whatsapp_cloud_api_retarget_candidates(p_limit integer, p_max_age_minutes integer, p_min_age_minutes integer); public.get_whatsapp_cloud_api_inbox_threads_page(p_limit integer, p_offset integer, p_workspace_currency text, p_tag_filter text, p_unread_only boolean, p_from timestamp with time zone, p_to timestamp with time zone); private.landing_phone_message_load(p_landing_id uuid, p_gerencia_id integer, p_phone_kind text, p_owner_user_id uuid, p_phone_id bigint); public.get_meta_audience_buyers(p_currency text, p_start_at timestamp with time zone, p_end_at timestamp with time zone, p_purchase_scope text, p_value_metric text). Público por diseño: no acreditado; no revocar contratos desconocidos por ausencia de referencias.

Mínimo propuesto: authenticated DELETE/SELECT/UPDATE observados; contratos RLS existentes DELETE/SELECT/UPDATE a conservar hasta cerrar caminos dinámicos. Owner/service_role sólo operaciones de sus consumidores; ningún TRUNCATE de anon/authenticated. Tratamiento: Retirar TRUNCATE si figura. CRUD/ACL adicional sólo tras resolver diferencias entre operaciones observadas y policies; conservar reglas y resultados. Riesgo/tráfico: medio. Qué podría romperse: Consumidores listados y funciones SQL dependientes; no ejecutar revocación general.

## T18 public.conversions_config

Actual: tipo r; owner postgres; RLS=true; FORCE RLS=false; options=null. Grants (* indica grant option): anon=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; authenticated=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; postgres=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; service_role=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE.

Columnas con ACL específica: ninguna. Políticas: Admins can insert all conversions_config [public; INSERT]; Admins can read all conversions_config [public; SELECT]; Admins can update all conversions_config [public; UPDATE]; Users can insert own conversions_config [public; INSERT]; Users can read own conversions_config [public; SELECT]; Users can update own conversions_config [public; UPDATE]. Expresiones con literales enmascarados y hashes anteriores en evidence.json.

Consumidores directos: frontend: frontend/app/(panel)/admin/landings/[id]/editar/page.tsx:306 [select]; frontend: frontend/app/(panel)/dashboard/landing/[id]/editar/page.tsx:290 [select]; frontend: frontend/app/(panel)/dashboard/layout.tsx:397 [select]; frontend: frontend/app/(panel)/dashboard/notificaciones/page.tsx:44 [select]; frontend: frontend/components/telefonos/TelefonosPageContent.tsx:195 [select]; frontend: frontend/components/telefonos/TelefonosPageContent.tsx:467 [upsert]; frontend: frontend/lib/conversionsDb.ts:620 [select]; frontend: frontend/lib/conversionsDb.ts:676 [upsert]; frontend: frontend/lib/conversionsDb.ts:830 [update]; frontend: frontend/lib/landing/landingsDb.ts:183 [select]; edge: supabase/functions/conversions/index.ts:7757 [select]; edge: supabase/functions/create-client/index.ts:374 [select]; edge: supabase/functions/create-client/index.ts:392 [upsert]; edge: supabase/functions/list-clients/index.ts:180 [select]; edge: supabase/functions/notify-inactive-contacts/index.ts:214 [select]; edge: supabase/functions/retry-failed-conversions/index.ts:192 [select]; edge: supabase/functions/update-client/index.ts:266 [upsert]. Menciones SQL: public.get_home_overview_stats(p_user_id uuid, p_hidden_by uuid); public.cron_reset_phone_operational_daily(); public.get_home_overview_stats_by_currency(p_user_id uuid, p_hidden_by uuid, p_currency text); public.get_whatsapp_cloud_api_contacts_page(p_limit integer, p_offset integer, p_workspace_currency text); public.get_whatsapp_cloud_api_inbox_threads_page(p_limit integer, p_offset integer, p_workspace_currency text, p_tag_filter text, p_unread_only boolean); public.mark_whatsapp_cloud_api_threads_read(p_workspace_currency text, p_tag_filter text); public.mark_whatsapp_cloud_api_threads_read(p_workspace_currency text, p_tag_filter text, p_from timestamp with time zone, p_to timestamp with time zone); public.calculate_home_overview_stats_by_currency(p_user_id uuid, p_hidden_by uuid, p_currency text); public.get_whatsapp_cloud_api_inbox_threads(p_limit integer, p_workspace_currency text); public.get_whatsapp_cloud_api_inbox_threads_page(p_limit integer, p_offset integer, p_workspace_currency text); public.get_whatsapp_cloud_api_inbox_threads_page(p_limit integer, p_offset integer, p_workspace_currency text, p_tag_filter text, p_unread_only boolean, p_from timestamp with time zone, p_to timestamp with time zone). Público por diseño: no.

Mínimo propuesto: Propietario/admin según policies actuales: lectura de configuración sin secretos, edición autorizada y backend consumidor de credenciales. Sin TRUNCATE. Tratamiento: No revocar SELECT de columnas antes de adaptar lectores SELECT * y administración de secretos; mantener recepción/envío con la misma configuración. Riesgo/tráfico: alto. Qué podría romperse: Panel/integraciones/credenciales usadas por emisores; exige transición explícita.

## T19 public.conversions_internal_id_seq

Actual: tipo S; owner postgres; RLS=false; FORCE RLS=false; options=null. Grants (* indica grant option): anon=SELECT/UPDATE/USAGE; authenticated=SELECT/UPDATE/USAGE; postgres=SELECT/UPDATE/USAGE; service_role=SELECT/UPDATE/USAGE.

Columnas con ACL específica: ninguna. Políticas: ninguna. Expresiones con literales enmascarados y hashes anteriores en evidence.json.

Consumidores directos: ninguno localizado; no acredita desuso. Menciones SQL: ninguna detectada. Público por diseño: no por sí misma.

Mínimo propuesto: USAGE/SELECT sólo a insertadores legítimos acreditados del default/identity; owner/backend conservan lo necesario. UPDATE de secuencia no requerido por browser conocido. Tratamiento: No cambiar valor, mínimo ni siguiente ID. Identificar dependencia de tabla y ruta INSERT antes de revocar. Riesgo/tráfico: medio. Qué podría romperse: INSERT con IDs automáticos si se elimina USAGE necesario.

## T20 public.conversions_pixel_configs

Actual: tipo r; owner postgres; RLS=true; FORCE RLS=false; options=null. Grants (* indica grant option): anon=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; authenticated=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; postgres=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; service_role=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE.

Columnas con ACL específica: ninguna. Políticas: Admins can delete all conversions_pixel_configs [public; DELETE]; Admins can insert all conversions_pixel_configs [public; INSERT]; Admins can read all conversions_pixel_configs [public; SELECT]; Admins can update all conversions_pixel_configs [public; UPDATE]; Users can delete own conversions_pixel_configs [public; DELETE]; Users can insert own conversions_pixel_configs [public; INSERT]; Users can read own conversions_pixel_configs [public; SELECT]; Users can update own conversions_pixel_configs [public; UPDATE]. Expresiones con literales enmascarados y hashes anteriores en evidence.json.

Consumidores directos: frontend: frontend/app/(panel)/admin/landings/[id]/editar/page.tsx:241 [select]; frontend: frontend/app/(panel)/dashboard/landing/[id]/editar/page.tsx:226 [select]; frontend: frontend/lib/conversionsDb.ts:726 [select]; frontend: frontend/lib/conversionsDb.ts:808 [upsert]; frontend: frontend/lib/conversionsDb.ts:819 [delete]; edge: supabase/functions/conversions/index.ts:7784 [select]; edge: supabase/functions/retry-failed-conversions/index.ts:198 [select]. Menciones SQL: ninguna detectada. Público por diseño: no.

Mínimo propuesto: Propietario/admin según policies actuales: lectura de configuración sin secretos, edición autorizada y backend consumidor de credenciales. Sin TRUNCATE. Tratamiento: No revocar SELECT de columnas antes de adaptar lectores SELECT * y administración de secretos; mantener recepción/envío con la misma configuración. Riesgo/tráfico: alto. Qué podría romperse: Panel/integraciones/credenciales usadas por emisores; exige transición explícita.

## T21 public.cron_config

Actual: tipo r; owner postgres; RLS=true; FORCE RLS=false; options=null. Grants (* indica grant option): anon=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; authenticated=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; postgres=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; service_role=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE.

Columnas con ACL específica: ninguna. Políticas: ninguna. Expresiones con literales enmascarados y hashes anteriores en evidence.json.

Consumidores directos: backend: frontend/app/api/track/retry/route.ts:14 [select]; edge: supabase/functions/bootstrap-cron-config/index.ts:81 [upsert]; edge: supabase/functions/notify-inactive-contacts/index.ts:110 [select]; edge: supabase/functions/promotion-draw-due/index.ts:302 [select]; edge: supabase/functions/promotion-match-backfill/index.ts:49 [select]; edge: supabase/functions/retry-failed-conversions/index.ts:94 [select]; edge: supabase/functions/sync-phones/index.ts:129 [select]; edge: supabase/functions/sync-telegram-connections/index.ts:147 [select]; edge: supabase/functions/whatsapp-cloud-retarget/index.ts:110 [select]; edge: supabase/functions/whatsapp-cloud-sync-health/index.ts:191 [select]; edge: supabase/functions/whatsapp-cloud-worker/index.ts:66 [select]. Menciones SQL: public.cron_retry_failed_conversions(); public.cron_notify_inactive_contacts(); public.cron_sync_telegram_connections(); public.cron_sync_phones_all(); public.cron_warm_landing_phone(); public.cron_whatsapp_cloud_api_worker(); public.cron_whatsapp_cloud_api_health(); public.cron_process_due_promotions(); public.cron_whatsapp_cloud_api_retarget(); public.cron_match_promotion_participants(); public.cron_retry_tracking_queue(). Público por diseño: no.

Mínimo propuesto: Sin permisos directos anon/authenticated; owner/service_role según consumidor. No políticas de cliente nuevas. Tratamiento: Revocar TRUNCATE y, después de pruebas, grants redundantes no usados; conservar lecturas/escrituras backend actuales y RLS sin policies. Riesgo/tráfico: bajo/medio. Qué podría romperse: Inferencia/geo, scheduler o cola si se revoca backend en vez de cliente.

## T22 public.funnel_contacts

Actual: tipo v; owner postgres; RLS=false; FORCE RLS=false; options=["security_invoker=true"]. Grants (* indica grant option): anon=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; authenticated=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; postgres=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; service_role=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE.

Columnas con ACL específica: ninguna. Políticas: ninguna. Expresiones con literales enmascarados y hashes anteriores en evidence.json.

Consumidores directos: ninguno localizado; no acredita desuso. Menciones SQL: ninguna detectada. Público por diseño: no.

Mínimo propuesto: authenticated SELECT según RLS de tablas base; backend si está acreditado. Sin grants de escritura inútiles ni TRUNCATE. Tratamiento: Conservar security_invoker=true y agrupación actual; no cambiar consulta de funnel. Riesgo/tráfico: medio. Qué podría romperse: Funnel/métricas si se retira SELECT base/vista.

## T23 public.gerencia_phone_availability_snapshots

Actual: tipo r; owner postgres; RLS=true; FORCE RLS=false; options=null. Grants (* indica grant option): anon=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; authenticated=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; postgres=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; service_role=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE.

Columnas con ACL específica: ninguna. Políticas: Admins read all gerencia phone availability snapshots [public; SELECT]; Users read own gerencia phone availability snapshots [public; SELECT]. Expresiones con literales enmascarados y hashes anteriores en evidence.json.

Consumidores directos: ninguno localizado; no acredita desuso. Menciones SQL: ninguna detectada. Público por diseño: no acreditado; no revocar contratos desconocidos por ausencia de referencias.

Mínimo propuesto: contratos RLS existentes SELECT a conservar hasta cerrar caminos dinámicos. Owner/service_role sólo operaciones de sus consumidores; ningún TRUNCATE de anon/authenticated. Tratamiento: Retirar TRUNCATE si figura. CRUD/ACL adicional sólo tras resolver diferencias entre operaciones observadas y policies; conservar reglas y resultados. Riesgo/tráfico: medio, consumidor indirecto/externo por confirmar. Qué podría romperse: Consumidores listados y funciones SQL dependientes; no ejecutar revocación general.

## T24 public.gerencia_phone_availability_snapshots_id_seq

Actual: tipo S; owner postgres; RLS=false; FORCE RLS=false; options=null. Grants (* indica grant option): anon=SELECT/UPDATE/USAGE; authenticated=SELECT/UPDATE/USAGE; postgres=SELECT/UPDATE/USAGE; service_role=SELECT/UPDATE/USAGE.

Columnas con ACL específica: ninguna. Políticas: ninguna. Expresiones con literales enmascarados y hashes anteriores en evidence.json.

Consumidores directos: ninguno localizado; no acredita desuso. Menciones SQL: ninguna detectada. Público por diseño: no por sí misma.

Mínimo propuesto: USAGE/SELECT sólo a insertadores legítimos acreditados del default/identity; owner/backend conservan lo necesario. UPDATE de secuencia no requerido por browser conocido. Tratamiento: No cambiar valor, mínimo ni siguiente ID. Identificar dependencia de tabla y ruta INSERT antes de revocar. Riesgo/tráfico: medio. Qué podría romperse: INSERT con IDs automáticos si se elimina USAGE necesario.

## T25 public.gerencia_phones

Actual: tipo r; owner postgres; RLS=true; FORCE RLS=false; options=null. Grants (* indica grant option): anon=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; authenticated=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; postgres=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; service_role=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE.

Columnas con ACL específica: ninguna. Políticas: Admins can read all gerencia phones [public; SELECT]; All users can select gerencia phones [authenticated; SELECT]; Users manage own gerencia phones [public; ALL]. Expresiones con literales enmascarados y hashes anteriores en evidence.json.

Consumidores directos: frontend: frontend/app/(panel)/admin/conversiones/page.tsx:880 [select]; frontend: frontend/app/(panel)/admin/seguimiento/page.tsx:128 [select]; frontend: frontend/app/(panel)/dashboard/conversiones/page.tsx:1259 [select]; frontend: frontend/app/(panel)/dashboard/promociones/page.tsx:136 [select]; frontend: frontend/app/(panel)/dashboard/seguimiento/page.tsx:209 [select]; frontend: frontend/components/telefonos/TelefonosPageContent.tsx:221 [select]; frontend: frontend/components/telefonos/TelefonosPageContent.tsx:506 [delete]; frontend: frontend/components/telefonos/TelefonosPageContent.tsx:587 [upsert]; frontend: frontend/components/telefonos/TelefonosPageContent.tsx:626 [update]; frontend: frontend/components/telefonos/TelefonosPageContent.tsx:665 [update]; frontend: frontend/components/telefonos/TelefonosPageContent.tsx:688 [update]; edge: supabase/functions/conversions/index.ts:482 [select]; edge: supabase/functions/conversions/index.ts:706 [select]; edge: supabase/functions/phone-click/index.ts:115 [select]; edge: supabase/functions/reset-phone-counters/index.ts:120 [select]; edge: supabase/functions/reset-phone-counters/index.ts:151 [update]; edge: supabase/functions/reset-phone-messages/index.ts:109 [select]; edge: supabase/functions/reset-phone-messages/index.ts:133 [update]; edge: supabase/functions/sync-phones/index.ts:281 [select]; edge: supabase/functions/sync-phones/index.ts:331 [upsert]; edge: supabase/functions/sync-phones/index.ts:357 [update]; edge: supabase/functions/sync-phones/index.ts:371 [update]; edge: supabase/functions/sync-phones/index.ts:402 [select]; edge: supabase/functions/sync-phones/index.ts:424 [update]. Menciones SQL: public.get_phone_for_whatsapp_cloud_api(p_config_id uuid); public.increment_gerencia_phone_usage(p_phone_id bigint); public.get_phone_for_chatrace_client(p_client_name text); public.cron_reset_phone_operational_daily(); public.refresh_phone_metrics(); public.record_landing_phone_availability_demand(p_landing_name text, p_request_id uuid, p_source text, p_result_status text, p_selected_gerencia_id integer, p_selected_phone_id bigint, p_selected_phone text); public.phone_assignment_scope_usage(p_scope_type text, p_scope_id uuid, p_gerencia_id integer, p_phone_kind text, p_phone_id bigint); public.increment_phone_assignment_scope_usage(p_phone_id bigint, p_scope_type text, p_scope_id uuid, p_user_id uuid, p_gerencia_id integer); private.landing_phone_message_load(p_landing_id uuid, p_gerencia_id integer, p_phone_kind text, p_owner_user_id uuid, p_phone_id bigint); public.get_phone_for_landing(p_landing_name text, p_create_reservation boolean). Público por diseño: no directo; entrega pública sólo por contrato de teléfono.

Mínimo propuesto: CRUD de propietario y SELECT admin/alcance entre tenants por aprobar. service_role conserva sincronización/contador. Sin TRUNCATE de clientes. Tratamiento: S-M05 pendiente de contrato: SELECT TRUE y policy ALL con g.id=g.gerencia_id; no modificar selección/asignación ni reservas. Riesgo/tráfico: alto. Qué podría romperse: Listado, cambio de estado/rol y sincronización de teléfonos.

## T26 public.gerencia_phones_id_seq

Actual: tipo S; owner postgres; RLS=false; FORCE RLS=false; options=null. Grants (* indica grant option): anon=SELECT/UPDATE/USAGE; authenticated=SELECT/UPDATE/USAGE; postgres=SELECT/UPDATE/USAGE; service_role=SELECT/UPDATE/USAGE.

Columnas con ACL específica: ninguna. Políticas: ninguna. Expresiones con literales enmascarados y hashes anteriores en evidence.json.

Consumidores directos: ninguno localizado; no acredita desuso. Menciones SQL: ninguna detectada. Público por diseño: no por sí misma.

Mínimo propuesto: USAGE/SELECT sólo a insertadores legítimos acreditados del default/identity; owner/backend conservan lo necesario. UPDATE de secuencia no requerido por browser conocido. Tratamiento: No cambiar valor, mínimo ni siguiente ID. Identificar dependencia de tabla y ruta INSERT antes de revocar. Riesgo/tráfico: medio. Qué podría romperse: INSERT con IDs automáticos si se elimina USAGE necesario.

## T27 public.gerencia_work_group_members

Actual: tipo r; owner postgres; RLS=true; FORCE RLS=false; options=null. Grants (* indica grant option): anon=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; authenticated=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; postgres=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; service_role=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE.

Columnas con ACL específica: ninguna. Políticas: Users manage own gerencia work group members [public; ALL]; Users read own gerencia work group members [public; SELECT]. Expresiones con literales enmascarados y hashes anteriores en evidence.json.

Consumidores directos: frontend: frontend/lib/gerencias/gerenciasDb.ts:285 [delete]; frontend: frontend/lib/gerencias/gerenciasDb.ts:293 [insert]. Menciones SQL: ninguna detectada. Público por diseño: no acreditado; no revocar contratos desconocidos por ausencia de referencias.

Mínimo propuesto: authenticated DELETE/INSERT observados; contratos RLS existentes DELETE/INSERT/SELECT/UPDATE a conservar hasta cerrar caminos dinámicos. Owner/service_role sólo operaciones de sus consumidores; ningún TRUNCATE de anon/authenticated. Tratamiento: Retirar TRUNCATE si figura. CRUD/ACL adicional sólo tras resolver diferencias entre operaciones observadas y policies; conservar reglas y resultados. Riesgo/tráfico: medio. Qué podría romperse: Consumidores listados y funciones SQL dependientes; no ejecutar revocación general.

## T28 public.gerencia_work_group_members_id_seq

Actual: tipo S; owner postgres; RLS=false; FORCE RLS=false; options=null. Grants (* indica grant option): anon=SELECT/UPDATE/USAGE; authenticated=SELECT/UPDATE/USAGE; postgres=SELECT/UPDATE/USAGE; service_role=SELECT/UPDATE/USAGE.

Columnas con ACL específica: ninguna. Políticas: ninguna. Expresiones con literales enmascarados y hashes anteriores en evidence.json.

Consumidores directos: ninguno localizado; no acredita desuso. Menciones SQL: ninguna detectada. Público por diseño: no por sí misma.

Mínimo propuesto: USAGE/SELECT sólo a insertadores legítimos acreditados del default/identity; owner/backend conservan lo necesario. UPDATE de secuencia no requerido por browser conocido. Tratamiento: No cambiar valor, mínimo ni siguiente ID. Identificar dependencia de tabla y ruta INSERT antes de revocar. Riesgo/tráfico: medio. Qué podría romperse: INSERT con IDs automáticos si se elimina USAGE necesario.

## T29 public.gerencia_work_groups

Actual: tipo r; owner postgres; RLS=true; FORCE RLS=false; options=null. Grants (* indica grant option): anon=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; authenticated=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; postgres=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; service_role=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE.

Columnas con ACL específica: ninguna. Políticas: Users manage own gerencia work groups [public; ALL]; Users read own gerencia work groups [public; SELECT]. Expresiones con literales enmascarados y hashes anteriores en evidence.json.

Consumidores directos: frontend: frontend/lib/gerencias/gerenciasDb.ts:218 [select]; frontend: frontend/lib/gerencias/gerenciasDb.ts:248 [insert/select]; frontend: frontend/lib/gerencias/gerenciasDb.ts:265 [update]; frontend: frontend/lib/gerencias/gerenciasDb.ts:275 [delete]. Menciones SQL: ninguna detectada. Público por diseño: no acreditado; no revocar contratos desconocidos por ausencia de referencias.

Mínimo propuesto: authenticated DELETE/INSERT/SELECT/UPDATE observados; contratos RLS existentes DELETE/INSERT/SELECT/UPDATE a conservar hasta cerrar caminos dinámicos. Owner/service_role sólo operaciones de sus consumidores; ningún TRUNCATE de anon/authenticated. Tratamiento: Retirar TRUNCATE si figura. CRUD/ACL adicional sólo tras resolver diferencias entre operaciones observadas y policies; conservar reglas y resultados. Riesgo/tráfico: medio. Qué podría romperse: Consumidores listados y funciones SQL dependientes; no ejecutar revocación general.

## T30 public.gerencia_work_groups_id_seq

Actual: tipo S; owner postgres; RLS=false; FORCE RLS=false; options=null. Grants (* indica grant option): anon=SELECT/UPDATE/USAGE; authenticated=SELECT/UPDATE/USAGE; postgres=SELECT/UPDATE/USAGE; service_role=SELECT/UPDATE/USAGE.

Columnas con ACL específica: ninguna. Políticas: ninguna. Expresiones con literales enmascarados y hashes anteriores en evidence.json.

Consumidores directos: ninguno localizado; no acredita desuso. Menciones SQL: ninguna detectada. Público por diseño: no por sí misma.

Mínimo propuesto: USAGE/SELECT sólo a insertadores legítimos acreditados del default/identity; owner/backend conservan lo necesario. UPDATE de secuencia no requerido por browser conocido. Tratamiento: No cambiar valor, mínimo ni siguiente ID. Identificar dependencia de tabla y ruta INSERT antes de revocar. Riesgo/tráfico: medio. Qué podría romperse: INSERT con IDs automáticos si se elimina USAGE necesario.

## T31 public.gerencias

Actual: tipo r; owner postgres; RLS=true; FORCE RLS=false; options=null. Grants (* indica grant option): anon=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; authenticated=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; postgres=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; service_role=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE.

Columnas con ACL específica: ninguna. Políticas: Admins can read all gerencias [public; SELECT]; Admins can update all gerencias [public; UPDATE]; Users manage own gerencias [public; ALL]. Expresiones con literales enmascarados y hashes anteriores en evidence.json.

Consumidores directos: frontend: frontend/app/(panel)/admin/conversiones/page.tsx:865 [select]; frontend: frontend/app/(panel)/admin/seguimiento/page.tsx:116 [select]; frontend: frontend/app/(panel)/dashboard/conversiones/page.tsx:1239 [select]; frontend: frontend/app/(panel)/dashboard/promociones/page.tsx:119 [select]; frontend: frontend/app/(panel)/dashboard/seguimiento/page.tsx:196 [select]; frontend: frontend/components/telefonos/TelefonosPageContent.tsx:532 [update]; frontend: frontend/lib/gerencias/gerenciasDb.ts:68 [select]; frontend: frontend/lib/gerencias/gerenciasDb.ts:90 [select]; frontend: frontend/lib/gerencias/gerenciasDb.ts:127 [select]; frontend: frontend/lib/gerencias/gerenciasDb.ts:138 [insert/select]; frontend: frontend/lib/gerencias/gerenciasDb.ts:175 [update]; frontend: frontend/lib/gerencias/gerenciasDb.ts:198 [delete]; frontend: frontend/lib/gerencias/gerenciasDb.ts:345 [select]; edge: supabase/functions/conversions/index.ts:507 [select]; edge: supabase/functions/conversions/index.ts:598 [select]; edge: supabase/functions/conversions/index.ts:690 [select]; edge: supabase/functions/conversions/index.ts:2668 [select]; edge: supabase/functions/reset-phone-counters/index.ts:74 [select]; edge: supabase/functions/reset-phone-messages/index.ts:69 [select]; edge: supabase/functions/sync-phones/index.ts:152 [select]; edge: supabase/functions/sync-phones/index.ts:410 [select]. Menciones SQL: public.get_phone_for_whatsapp_cloud_api(p_config_id uuid); public.get_phone_for_chatrace_client(p_client_name text); public.cron_reset_phone_operational_daily(); public.validate_landing_gerencia_workspace_assignment(); public.validate_landing_workspace_update(); public.refresh_phone_metrics(); public.record_landing_phone_availability_demand(p_landing_name text, p_request_id uuid, p_source text, p_result_status text, p_selected_gerencia_id integer, p_selected_phone_id bigint, p_selected_phone text); public.enforce_whatsapp_cloud_api_assignment_workspace(); public.get_whatsapp_cloud_api_inbox_threads_page(p_limit integer, p_offset integer, p_workspace_currency text, p_tag_filter text, p_unread_only boolean); public.get_gerencia_availability_summaries(p_user_id uuid, p_start timestamp with time zone, p_end timestamp with time zone, p_workspace_currency text); public.get_whatsapp_cloud_api_inbox_threads(p_limit integer, p_workspace_currency text); public.get_whatsapp_cloud_api_inbox_threads_page(p_limit integer, p_offset integer, p_workspace_currency text); public.increment_phone_assignment_scope_usage(p_phone_id bigint, p_scope_type text, p_scope_id uuid, p_user_id uuid, p_gerencia_id integer); public.record_whatsapp_cloud_api_redirect_click(p_token text, p_ip text, p_user_agent text); public.get_whatsapp_cloud_api_inbox_threads_page(p_limit integer, p_offset integer, p_workspace_currency text, p_tag_filter text, p_unread_only boolean, p_from timestamp with time zone, p_to timestamp with time zone); public.get_phone_for_landing(p_landing_name text, p_create_reservation boolean). Público por diseño: no acreditado; no revocar contratos desconocidos por ausencia de referencias.

Mínimo propuesto: authenticated DELETE/INSERT/SELECT/UPDATE observados; contratos RLS existentes DELETE/INSERT/SELECT/UPDATE a conservar hasta cerrar caminos dinámicos. Owner/service_role sólo operaciones de sus consumidores; ningún TRUNCATE de anon/authenticated. Tratamiento: Retirar TRUNCATE si figura. CRUD/ACL adicional sólo tras resolver diferencias entre operaciones observadas y policies; conservar reglas y resultados. Riesgo/tráfico: medio. Qué podría romperse: Consumidores listados y funciones SQL dependientes; no ejecutar revocación general.

## T32 public.gerencias_id_seq

Actual: tipo S; owner postgres; RLS=false; FORCE RLS=false; options=null. Grants (* indica grant option): anon=SELECT/UPDATE/USAGE; authenticated=SELECT/UPDATE/USAGE; postgres=SELECT/UPDATE/USAGE; service_role=SELECT/UPDATE/USAGE.

Columnas con ACL específica: ninguna. Políticas: ninguna. Expresiones con literales enmascarados y hashes anteriores en evidence.json.

Consumidores directos: ninguno localizado; no acredita desuso. Menciones SQL: ninguna detectada. Público por diseño: no por sí misma.

Mínimo propuesto: USAGE/SELECT sólo a insertadores legítimos acreditados del default/identity; owner/backend conservan lo necesario. UPDATE de secuencia no requerido por browser conocido. Tratamiento: No cambiar valor, mínimo ni siguiente ID. Identificar dependencia de tabla y ruta INSERT antes de revocar. Riesgo/tráfico: medio. Qué podría romperse: INSERT con IDs automáticos si se elimina USAGE necesario.

## T33 public.hidden_contacts

Actual: tipo r; owner postgres; RLS=true; FORCE RLS=false; options=null. Grants (* indica grant option): anon=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; authenticated=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; postgres=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; service_role=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE.

Columnas con ACL específica: ninguna. Políticas: Users manage own hidden_contacts [public; ALL]. Expresiones con literales enmascarados y hashes anteriores en evidence.json.

Consumidores directos: frontend: frontend/lib/conversionsDb.ts:1778 [select]; frontend: frontend/lib/conversionsDb.ts:1816 [upsert]. Menciones SQL: ninguna detectada. Público por diseño: no acreditado; no revocar contratos desconocidos por ausencia de referencias.

Mínimo propuesto: authenticated INSERT/SELECT/UPDATE observados; contratos RLS existentes DELETE/INSERT/SELECT/UPDATE a conservar hasta cerrar caminos dinámicos. Owner/service_role sólo operaciones de sus consumidores; ningún TRUNCATE de anon/authenticated. Tratamiento: Retirar TRUNCATE si figura. CRUD/ACL adicional sólo tras resolver diferencias entre operaciones observadas y policies; conservar reglas y resultados. Riesgo/tráfico: medio. Qué podría romperse: Consumidores listados y funciones SQL dependientes; no ejecutar revocación general.

## T34 public.hidden_conversion_inbox

Actual: tipo r; owner postgres; RLS=true; FORCE RLS=false; options=null. Grants (* indica grant option): anon=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; authenticated=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; postgres=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; service_role=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE.

Columnas con ACL específica: ninguna. Políticas: Users manage own hidden_conversion_inbox [public; ALL]. Expresiones con literales enmascarados y hashes anteriores en evidence.json.

Consumidores directos: frontend: frontend/lib/conversionsDb.ts:1863 [select]; frontend: frontend/lib/conversionsDb.ts:1909 [upsert]. Menciones SQL: ninguna detectada. Público por diseño: no acreditado; no revocar contratos desconocidos por ausencia de referencias.

Mínimo propuesto: authenticated INSERT/SELECT/UPDATE observados; contratos RLS existentes DELETE/INSERT/SELECT/UPDATE a conservar hasta cerrar caminos dinámicos. Owner/service_role sólo operaciones de sus consumidores; ningún TRUNCATE de anon/authenticated. Tratamiento: Retirar TRUNCATE si figura. CRUD/ACL adicional sólo tras resolver diferencias entre operaciones observadas y policies; conservar reglas y resultados. Riesgo/tráfico: medio. Qué podría romperse: Consumidores listados y funciones SQL dependientes; no ejecutar revocación general.

## T35 public.hidden_conversion_logs

Actual: tipo r; owner postgres; RLS=true; FORCE RLS=false; options=null. Grants (* indica grant option): anon=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; authenticated=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; postgres=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; service_role=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE.

Columnas con ACL específica: ninguna. Políticas: Users manage own hidden_conversion_logs [public; ALL]. Expresiones con literales enmascarados y hashes anteriores en evidence.json.

Consumidores directos: frontend: frontend/lib/conversionsDb.ts:1836 [select]; frontend: frontend/lib/conversionsDb.ts:1891 [upsert]. Menciones SQL: ninguna detectada. Público por diseño: no acreditado; no revocar contratos desconocidos por ausencia de referencias.

Mínimo propuesto: authenticated INSERT/SELECT/UPDATE observados; contratos RLS existentes DELETE/INSERT/SELECT/UPDATE a conservar hasta cerrar caminos dinámicos. Owner/service_role sólo operaciones de sus consumidores; ningún TRUNCATE de anon/authenticated. Tratamiento: Retirar TRUNCATE si figura. CRUD/ACL adicional sólo tras resolver diferencias entre operaciones observadas y policies; conservar reglas y resultados. Riesgo/tráfico: medio. Qué podría romperse: Consumidores listados y funciones SQL dependientes; no ejecutar revocación general.

## T36 public.hidden_conversions

Actual: tipo r; owner postgres; RLS=true; FORCE RLS=false; options=null. Grants (* indica grant option): anon=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; authenticated=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; postgres=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; service_role=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE.

Columnas con ACL específica: ninguna. Políticas: Users manage own hidden_conversions [public; ALL]. Expresiones con literales enmascarados y hashes anteriores en evidence.json.

Consumidores directos: frontend: frontend/lib/conversionsDb.ts:1759 [select]; frontend: frontend/lib/conversionsDb.ts:1797 [upsert]. Menciones SQL: public.get_home_overview_stats(p_user_id uuid, p_hidden_by uuid); public.get_home_overview_stats_by_currency(p_user_id uuid, p_hidden_by uuid, p_currency text); public.refresh_phone_metrics(); public.calculate_home_overview_stats_by_currency(p_user_id uuid, p_hidden_by uuid, p_currency text). Público por diseño: no acreditado; no revocar contratos desconocidos por ausencia de referencias.

Mínimo propuesto: authenticated INSERT/SELECT/UPDATE observados; contratos RLS existentes DELETE/INSERT/SELECT/UPDATE a conservar hasta cerrar caminos dinámicos. Owner/service_role sólo operaciones de sus consumidores; ningún TRUNCATE de anon/authenticated. Tratamiento: Retirar TRUNCATE si figura. CRUD/ACL adicional sólo tras resolver diferencias entre operaciones observadas y policies; conservar reglas y resultados. Riesgo/tráfico: medio. Qué podría romperse: Consumidores listados y funciones SQL dependientes; no ejecutar revocación general.

## T37 public.home_overview_stats_cache

Actual: tipo r; owner postgres; RLS=true; FORCE RLS=false; options=null. Grants (* indica grant option): anon=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; authenticated=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; postgres=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; service_role=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE.

Columnas con ACL específica: ninguna. Políticas: home_overview_stats_cache_admin_read [authenticated; SELECT]; home_overview_stats_cache_owner_read [authenticated; SELECT]. Expresiones con literales enmascarados y hashes anteriores en evidence.json.

Consumidores directos: ninguno localizado; no acredita desuso. Menciones SQL: public.get_home_overview_stats_cached_by_currency(p_user_id uuid, p_hidden_by uuid, p_currency text); public.refresh_home_overview_stats_cache(p_user_id uuid, p_currency text). Público por diseño: no acreditado; no revocar contratos desconocidos por ausencia de referencias.

Mínimo propuesto: contratos RLS existentes SELECT a conservar hasta cerrar caminos dinámicos. Owner/service_role sólo operaciones de sus consumidores; ningún TRUNCATE de anon/authenticated. Tratamiento: Retirar TRUNCATE si figura. CRUD/ACL adicional sólo tras resolver diferencias entre operaciones observadas y policies; conservar reglas y resultados. Riesgo/tráfico: medio, consumidor indirecto/externo por confirmar. Qué podría romperse: Consumidores listados y funciones SQL dependientes; no ejecutar revocación general.

## T38 public.kommo_client_configs

Actual: tipo r; owner postgres; RLS=true; FORCE RLS=false; options=null. Grants (* indica grant option): anon=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; authenticated=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; postgres=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; service_role=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE.

Columnas con ACL específica: ninguna. Políticas: Admins can delete all kommo_client_configs [public; DELETE]; Admins can insert all kommo_client_configs [public; INSERT]; Admins can read all kommo_client_configs [public; SELECT]; Admins can update all kommo_client_configs [public; UPDATE]; Users can delete own kommo_client_configs [public; DELETE]; Users can insert own kommo_client_configs [public; INSERT]; Users can read own kommo_client_configs [public; SELECT]; Users can update own kommo_client_configs [public; UPDATE]. Expresiones con literales enmascarados y hashes anteriores en evidence.json.

Consumidores directos: frontend: frontend/lib/kommoDb.ts:23 [select]; frontend: frontend/lib/kommoDb.ts:42 [upsert]. Menciones SQL: ninguna detectada. Público por diseño: no.

Mínimo propuesto: Propietario/admin según policies actuales: lectura de configuración sin secretos, edición autorizada y backend consumidor de credenciales. Sin TRUNCATE. Tratamiento: No revocar SELECT de columnas antes de adaptar lectores SELECT * y administración de secretos; mantener recepción/envío con la misma configuración. Riesgo/tráfico: alto. Qué podría romperse: Panel/integraciones/credenciales usadas por emisores; exige transición explícita.

## T39 public.landing_phone_assignment_reservations

Actual: tipo r; owner postgres; RLS=true; FORCE RLS=false; options=null. Grants (* indica grant option): postgres=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; service_role=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE.

Columnas con ACL específica: ninguna. Políticas: ninguna. Expresiones con literales enmascarados y hashes anteriores en evidence.json.

Consumidores directos: ninguno localizado; no acredita desuso. Menciones SQL: private.landing_phone_message_load(p_landing_id uuid, p_gerencia_id integer, p_phone_kind text, p_owner_user_id uuid, p_phone_id bigint); public.extend_landing_phone_assignment_reservation(p_reservation_id uuid, p_landing_id uuid, p_phone_id bigint, p_phone text); private.close_landing_phone_reservation_on_lead(); public.get_phone_for_landing(p_landing_name text, p_create_reservation boolean). Público por diseño: no acreditado; no revocar contratos desconocidos por ausencia de referencias.

Mínimo propuesto: Sin policy de cliente: acceso directo de usuario no acreditado. Owner/service_role sólo operaciones de sus consumidores; ningún TRUNCATE de anon/authenticated. Tratamiento: Retirar TRUNCATE si figura. CRUD/ACL adicional sólo tras resolver diferencias entre operaciones observadas y policies; conservar reglas y resultados. Riesgo/tráfico: medio, consumidor indirecto/externo por confirmar. Qué podría romperse: Consumidores listados y funciones SQL dependientes; no ejecutar revocación general.

## T40 public.landing_phone_availability_demands

Actual: tipo r; owner postgres; RLS=true; FORCE RLS=false; options=null. Grants (* indica grant option): anon=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; authenticated=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; postgres=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; service_role=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE.

Columnas con ACL específica: ninguna. Políticas: Admins read all landing phone availability demands [public; SELECT]; Users read own landing phone availability demands [public; SELECT]. Expresiones con literales enmascarados y hashes anteriores en evidence.json.

Consumidores directos: ninguno localizado; no acredita desuso. Menciones SQL: public.record_landing_phone_availability_demand(p_landing_name text, p_request_id uuid, p_source text, p_result_status text, p_selected_gerencia_id integer, p_selected_phone_id bigint, p_selected_phone text); public.get_gerencia_availability_summaries(p_user_id uuid, p_start timestamp with time zone, p_end timestamp with time zone, p_workspace_currency text). Público por diseño: no acreditado; no revocar contratos desconocidos por ausencia de referencias.

Mínimo propuesto: contratos RLS existentes SELECT a conservar hasta cerrar caminos dinámicos. Owner/service_role sólo operaciones de sus consumidores; ningún TRUNCATE de anon/authenticated. Tratamiento: Retirar TRUNCATE si figura. CRUD/ACL adicional sólo tras resolver diferencias entre operaciones observadas y policies; conservar reglas y resultados. Riesgo/tráfico: medio, consumidor indirecto/externo por confirmar. Qué podría romperse: Consumidores listados y funciones SQL dependientes; no ejecutar revocación general.

## T41 public.landing_phone_availability_demands_id_seq

Actual: tipo S; owner postgres; RLS=false; FORCE RLS=false; options=null. Grants (* indica grant option): anon=SELECT/UPDATE/USAGE; authenticated=SELECT/UPDATE/USAGE; postgres=SELECT/UPDATE/USAGE; service_role=SELECT/UPDATE/USAGE.

Columnas con ACL específica: ninguna. Políticas: ninguna. Expresiones con literales enmascarados y hashes anteriores en evidence.json.

Consumidores directos: ninguno localizado; no acredita desuso. Menciones SQL: ninguna detectada. Público por diseño: no por sí misma.

Mínimo propuesto: USAGE/SELECT sólo a insertadores legítimos acreditados del default/identity; owner/backend conservan lo necesario. UPDATE de secuencia no requerido por browser conocido. Tratamiento: No cambiar valor, mínimo ni siguiente ID. Identificar dependencia de tabla y ruta INSERT antes de revocar. Riesgo/tráfico: medio. Qué podría romperse: INSERT con IDs automáticos si se elimina USAGE necesario.

## T42 public.landing_phone_cache

Actual: tipo r; owner postgres; RLS=true; FORCE RLS=false; options=null. Grants (* indica grant option): anon=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; authenticated=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; postgres=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; service_role=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE.

Columnas con ACL específica: ninguna. Políticas: ninguna. Expresiones con literales enmascarados y hashes anteriores en evidence.json.

Consumidores directos: edge: supabase/functions/landing-phone/index.ts:219 [select]. Menciones SQL: public.invalidate_landing_phone_cache_for_assignment_role(); public.get_cached_constructor_landing_phone(p_landing_name text); public.refresh_constructor_landing_phone_cache(). Público por diseño: no acreditado; no revocar contratos desconocidos por ausencia de referencias.

Mínimo propuesto: Sin policy de cliente: acceso directo de usuario no acreditado. Owner/service_role sólo operaciones de sus consumidores; ningún TRUNCATE de anon/authenticated. Tratamiento: Retirar TRUNCATE si figura. CRUD/ACL adicional sólo tras resolver diferencias entre operaciones observadas y policies; conservar reglas y resultados. Riesgo/tráfico: medio, consumidor indirecto/externo por confirmar. Qué podría romperse: Consumidores listados y funciones SQL dependientes; no ejecutar revocación general.

## T43 public.landings

Actual: tipo r; owner postgres; RLS=true; FORCE RLS=false; options=null. Grants (* indica grant option): anon=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; authenticated=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; postgres=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; service_role=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE.

Columnas con ACL específica: ninguna. Políticas: Admins can delete all landings [public; DELETE]; Admins can read all landings [public; SELECT]; Admins can update all landings [public; UPDATE]; Users manage own landings [public; ALL]. Expresiones con literales enmascarados y hashes anteriores en evidence.json.

Consumidores directos: frontend: frontend/app/(panel)/admin/conversiones/page.tsx:905 [select]; frontend: frontend/app/(panel)/admin/landings/[id]/editar/page.tsx:202 [select]; frontend: frontend/app/(panel)/dashboard/conversiones/page.tsx:1284 [select]; backend: frontend/app/api/journey-start/route.ts:70 [select]; frontend: frontend/lib/gerencias/gerenciasDb.ts:336 [select]; frontend: frontend/lib/landing/landingsDb.ts:88 [select]; frontend: frontend/lib/landing/landingsDb.ts:113 [select]; frontend: frontend/lib/landing/landingsDb.ts:140 [select]; frontend: frontend/lib/landing/landingsDb.ts:194 [insert]; frontend: frontend/lib/landing/landingsDb.ts:286 [update]; frontend: frontend/lib/landing/landingsDb.ts:297 [delete]; edge: supabase/functions/atrio-click/index.ts:55 [select]; edge: supabase/functions/builder-config/index.ts:193 [select]; edge: supabase/functions/conversions/index.ts:2615 [select]; edge: supabase/functions/conversions/index.ts:2642 [select]; edge: supabase/functions/conversions/index.ts:2967 [select]; edge: supabase/functions/conversions/index.ts:2977 [select]; edge: supabase/functions/conversions/pixel_attribution.ts:266 [select]; edge: supabase/functions/conversions/pixel_attribution.ts:277 [select]; edge: supabase/functions/landing-atrio/index.ts:57 [select]; edge: supabase/functions/landing-phone/index.ts:181 [select]; edge: supabase/functions/phone-click/index.ts:88 [select]. Menciones SQL: public.sync_pixel_to_landings(); public.enforce_landing_plan_limit(); public.cron_warm_landing_phone(); public.get_home_overview_stats(p_user_id uuid, p_hidden_by uuid); public.get_cached_constructor_landing_phone(p_landing_name text); public.get_home_overview_stats_by_currency(p_user_id uuid, p_hidden_by uuid, p_currency text); public.refresh_constructor_landing_phone_cache(); public.validate_landing_gerencia_workspace_assignment(); public.validate_gerencia_workspace_update(); public.record_landing_phone_availability_demand(p_landing_name text, p_request_id uuid, p_source text, p_result_status text, p_selected_gerencia_id integer, p_selected_phone_id bigint, p_selected_phone text); public.refresh_home_overview_stats_cache(p_user_id uuid, p_currency text); public.calculate_home_overview_stats_by_currency(p_user_id uuid, p_hidden_by uuid, p_currency text); public.set_landings_atrio_clients_owner(); public.get_atrio_for_landing(p_landing_name text); public.get_phone_for_landing(p_landing_name text, p_create_reservation boolean). Público por diseño: no acreditado; no revocar contratos desconocidos por ausencia de referencias.

Mínimo propuesto: authenticated DELETE/INSERT/SELECT/UPDATE observados; contratos RLS existentes DELETE/INSERT/SELECT/UPDATE a conservar hasta cerrar caminos dinámicos. Owner/service_role sólo operaciones de sus consumidores; ningún TRUNCATE de anon/authenticated. Tratamiento: Retirar TRUNCATE si figura. CRUD/ACL adicional sólo tras resolver diferencias entre operaciones observadas y policies; conservar reglas y resultados. Riesgo/tráfico: medio. Qué podría romperse: Consumidores listados y funciones SQL dependientes; no ejecutar revocación general.

## T44 public.landings_atrio_clients

Actual: tipo r; owner postgres; RLS=true; FORCE RLS=false; options=null. Grants (* indica grant option): authenticated=DELETE/INSERT/SELECT/UPDATE; postgres=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; service_role=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE.

Columnas con ACL específica: ninguna. Políticas: Admins can manage all landing atrio clients [authenticated; ALL]; Users can manage own landing atrio clients [authenticated; ALL]. Expresiones con literales enmascarados y hashes anteriores en evidence.json.

Consumidores directos: frontend: frontend/lib/atrio/atrioDb.ts:189 [select]; frontend: frontend/lib/atrio/atrioDb.ts:205 [delete]; frontend: frontend/lib/atrio/atrioDb.ts:219 [insert]; edge: supabase/functions/atrio-click/index.ts:66 [select]. Menciones SQL: public.get_atrio_for_landing(p_landing_name text). Público por diseño: no acreditado; no revocar contratos desconocidos por ausencia de referencias.

Mínimo propuesto: authenticated DELETE/INSERT/SELECT observados; contratos RLS existentes DELETE/INSERT/SELECT/UPDATE a conservar hasta cerrar caminos dinámicos. Owner/service_role sólo operaciones de sus consumidores; ningún TRUNCATE de anon/authenticated. Tratamiento: Retirar TRUNCATE si figura. CRUD/ACL adicional sólo tras resolver diferencias entre operaciones observadas y policies; conservar reglas y resultados. Riesgo/tráfico: medio. Qué podría romperse: Consumidores listados y funciones SQL dependientes; no ejecutar revocación general.

## T45 public.landings_gerencias

Actual: tipo r; owner postgres; RLS=true; FORCE RLS=false; options=null. Grants (* indica grant option): anon=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; authenticated=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; postgres=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; service_role=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE.

Columnas con ACL específica: ninguna. Políticas: Admins can delete landings_gerencias [public; DELETE]; Admins can insert landings_gerencias [public; INSERT]; Admins can read landings_gerencias [public; SELECT]; Users manage own landing gerencia assignments [public; ALL]. Expresiones con literales enmascarados y hashes anteriores en evidence.json.

Consumidores directos: frontend: frontend/app/(panel)/admin/conversiones/page.tsx:914 [select]; frontend: frontend/app/(panel)/dashboard/conversiones/page.tsx:1294 [select]; frontend: frontend/lib/gerencias/gerenciasDb.ts:381 [select]; frontend: frontend/lib/gerencias/gerenciasDb.ts:418 [delete]; frontend: frontend/lib/gerencias/gerenciasDb.ts:446 [insert]; edge: supabase/functions/conversions/index.ts:541 [select]; edge: supabase/functions/phone-click/index.ts:142 [select]. Menciones SQL: public.invalidate_landing_phone_cache_for_assignment_role(); public.validate_landing_workspace_update(); public.validate_gerencia_workspace_update(); public.record_landing_phone_availability_demand(p_landing_name text, p_request_id uuid, p_source text, p_result_status text, p_selected_gerencia_id integer, p_selected_phone_id bigint, p_selected_phone text); public.get_phone_for_landing(p_landing_name text, p_create_reservation boolean). Público por diseño: no acreditado; no revocar contratos desconocidos por ausencia de referencias.

Mínimo propuesto: authenticated DELETE/INSERT/SELECT observados; contratos RLS existentes DELETE/INSERT/SELECT/UPDATE a conservar hasta cerrar caminos dinámicos. Owner/service_role sólo operaciones de sus consumidores; ningún TRUNCATE de anon/authenticated. Tratamiento: Retirar TRUNCATE si figura. CRUD/ACL adicional sólo tras resolver diferencias entre operaciones observadas y policies; conservar reglas y resultados. Riesgo/tráfico: medio. Qué podría romperse: Consumidores listados y funciones SQL dependientes; no ejecutar revocación general.

## T46 public.meta_audience_configs

Actual: tipo r; owner postgres; RLS=true; FORCE RLS=false; options=null. Grants (* indica grant option): authenticated=DELETE/INSERT/SELECT/UPDATE; postgres=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; service_role=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE.

Columnas con ACL específica: ninguna. Políticas: Users delete own meta audience configs [authenticated; DELETE]; Users insert own meta audience configs [authenticated; INSERT]; Users select own meta audience configs [authenticated; SELECT]; Users update own meta audience configs [authenticated; UPDATE]. Expresiones con literales enmascarados y hashes anteriores en evidence.json.

Consumidores directos: frontend: frontend/lib/metaAudienceConfigDb.ts:104 [select]; frontend: frontend/lib/metaAudienceConfigDb.ts:117 [insert/select]; frontend: frontend/lib/metaAudienceConfigDb.ts:129 [update/select]; frontend: frontend/lib/metaAudienceConfigDb.ts:136 [update/select]; frontend: frontend/lib/metaAudienceConfigDb.ts:147 [delete/select]. Menciones SQL: ninguna detectada. Público por diseño: no acreditado; no revocar contratos desconocidos por ausencia de referencias.

Mínimo propuesto: authenticated DELETE/INSERT/SELECT/UPDATE observados; contratos RLS existentes DELETE/INSERT/SELECT/UPDATE a conservar hasta cerrar caminos dinámicos. Owner/service_role sólo operaciones de sus consumidores; ningún TRUNCATE de anon/authenticated. Tratamiento: Retirar TRUNCATE si figura. CRUD/ACL adicional sólo tras resolver diferencias entre operaciones observadas y policies; conservar reglas y resultados. Riesgo/tráfico: medio. Qué podría romperse: Consumidores listados y funciones SQL dependientes; no ejecutar revocación general.

## T47 public.notification_bot_config

Actual: tipo r; owner postgres; RLS=true; FORCE RLS=false; options=null. Grants (* indica grant option): anon=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; authenticated=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; postgres=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; service_role=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE.

Columnas con ACL específica: ninguna. Políticas: Admins can insert bot config [public; INSERT]; Admins can read bot config [public; SELECT]; Admins can update bot config [public; UPDATE]. Expresiones con literales enmascarados y hashes anteriores en evidence.json.

Consumidores directos: frontend: frontend/lib/notificationsDb.ts:57 [select]; frontend: frontend/lib/notificationsDb.ts:82 [update]; frontend: frontend/lib/notificationsDb.ts:89 [insert]; edge: supabase/functions/configure-telegram-webhook/index.ts:31 [select]; edge: supabase/functions/notify-inactive-contacts/index.ts:124 [select]; edge: supabase/functions/promotion-draw-due/index.ts:312 [select]; edge: supabase/functions/promotion-draw/index.ts:369 [select]; edge: supabase/functions/sync-telegram-connections/index.ts:157 [select]; edge: supabase/functions/sync-telegram-connections/index.ts:247 [update]; edge: supabase/functions/telegram-webhook/index.ts:153 [select]; edge: supabase/functions/whatsapp-cloud-sync-health/index.ts:103 [select]. Menciones SQL: public.get_notification_bot_username(). Público por diseño: no.

Mínimo propuesto: Propietario/admin según policies actuales: lectura de configuración sin secretos, edición autorizada y backend consumidor de credenciales. Sin TRUNCATE. Tratamiento: No revocar SELECT de columnas antes de adaptar lectores SELECT * y administración de secretos; mantener recepción/envío con la misma configuración. Riesgo/tráfico: alto. Qué podría romperse: Panel/integraciones/credenciales usadas por emisores; exige transición explícita.

## T48 public.notification_contact_alerts

Actual: tipo r; owner postgres; RLS=true; FORCE RLS=false; options=null. Grants (* indica grant option): anon=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; authenticated=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; postgres=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; service_role=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE.

Columnas con ACL específica: ninguna. Políticas: Admins can read all notification alerts [public; SELECT]; Users can read own notification alerts [public; SELECT]. Expresiones con literales enmascarados y hashes anteriores en evidence.json.

Consumidores directos: frontend: frontend/app/(panel)/dashboard/seguimiento/page.tsx:165 [delete]; edge: supabase/functions/notify-inactive-contacts/index.ts:191 [select]; edge: supabase/functions/notify-inactive-contacts/index.ts:347 [upsert]. Menciones SQL: ninguna detectada. Público por diseño: no acreditado; no revocar contratos desconocidos por ausencia de referencias.

Mínimo propuesto: authenticated DELETE observados; contratos RLS existentes SELECT a conservar hasta cerrar caminos dinámicos. Owner/service_role sólo operaciones de sus consumidores; ningún TRUNCATE de anon/authenticated. Tratamiento: Retirar TRUNCATE si figura. CRUD/ACL adicional sólo tras resolver diferencias entre operaciones observadas y policies; conservar reglas y resultados. Riesgo/tráfico: medio. Qué podría romperse: Consumidores listados y funciones SQL dependientes; no ejecutar revocación general.

## T49 public.notification_settings

Actual: tipo r; owner postgres; RLS=true; FORCE RLS=false; options=null. Grants (* indica grant option): anon=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; authenticated=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; postgres=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; service_role=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE.

Columnas con ACL específica: ninguna. Políticas: Admins can read all notification settings [public; SELECT]; Admins can update all notification settings [public; UPDATE]; Users can insert own notification settings [public; INSERT]; Users can read own notification settings [public; SELECT]; Users can update own notification settings [public; UPDATE]. Expresiones con literales enmascarados y hashes anteriores en evidence.json.

Consumidores directos: frontend: frontend/lib/notificationsDb.ts:96 [select]; frontend: frontend/lib/notificationsDb.ts:112 [update]; frontend: frontend/lib/notificationsDb.ts:121 [upsert]; frontend: frontend/lib/notificationsDb.ts:129 [select]; frontend: frontend/lib/notificationsDb.ts:147 [upsert]; frontend: frontend/lib/notificationsDb.ts:204 [select]; frontend: frontend/lib/notificationsDb.ts:218 [update]; edge: supabase/functions/notify-inactive-contacts/index.ts:144 [select]; edge: supabase/functions/promotion-draw-due/index.ts:164 [select]; edge: supabase/functions/promotion-draw/index.ts:378 [select]; edge: supabase/functions/sync-telegram-connections/index.ts:198 [select]; edge: supabase/functions/sync-telegram-connections/index.ts:206 [update]; edge: supabase/functions/telegram-webhook/index.ts:117 [select]; edge: supabase/functions/telegram-webhook/index.ts:188 [update]; edge: supabase/functions/whatsapp-cloud-sync-health/index.ts:111 [select]. Menciones SQL: ninguna detectada. Público por diseño: no acreditado; no revocar contratos desconocidos por ausencia de referencias.

Mínimo propuesto: authenticated INSERT/SELECT/UPDATE observados; contratos RLS existentes INSERT/SELECT/UPDATE a conservar hasta cerrar caminos dinámicos. Owner/service_role sólo operaciones de sus consumidores; ningún TRUNCATE de anon/authenticated. Tratamiento: Retirar TRUNCATE si figura. CRUD/ACL adicional sólo tras resolver diferencias entre operaciones observadas y policies; conservar reglas y resultados. Riesgo/tráfico: medio. Qué podría romperse: Consumidores listados y funciones SQL dependientes; no ejecutar revocación general.

## T50 public.notification_telegram_destinations

Actual: tipo r; owner postgres; RLS=true; FORCE RLS=false; options=null. Grants (* indica grant option): anon=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; authenticated=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; postgres=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; service_role=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE.

Columnas con ACL específica: ninguna. Políticas: Admins can read all telegram destinations [public; SELECT]; Admins can update all telegram destinations [public; UPDATE]; Users can read own telegram destinations [public; SELECT]; Users can update own telegram destinations [public; UPDATE]. Expresiones con literales enmascarados y hashes anteriores en evidence.json.

Consumidores directos: frontend: frontend/lib/notificationsDb.ts:173 [select]; frontend: frontend/lib/notificationsDb.ts:189 [select]; frontend: frontend/lib/notificationsDb.ts:197 [update]; edge: supabase/functions/notify-inactive-contacts/index.ts:160 [select]; edge: supabase/functions/promotion-draw-due/index.ts:172 [select]; edge: supabase/functions/promotion-draw/index.ts:387 [select]; edge: supabase/functions/sync-telegram-connections/index.ts:112 [upsert/select]; edge: supabase/functions/sync-telegram-connections/index.ts:217 [update]; edge: supabase/functions/sync-telegram-connections/index.ts:228 [select]; edge: supabase/functions/sync-telegram-connections/index.ts:238 [update]; edge: supabase/functions/sync-telegram-connections/index.ts:253 [select]; edge: supabase/functions/sync-telegram-connections/index.ts:267 [update]; edge: supabase/functions/telegram-webhook/index.ts:89 [upsert/select]; edge: supabase/functions/telegram-webhook/index.ts:197 [update]; edge: supabase/functions/telegram-webhook/index.ts:213 [update]; edge: supabase/functions/telegram-webhook/index.ts:228 [select]; edge: supabase/functions/telegram-webhook/index.ts:238 [update]; edge: supabase/functions/whatsapp-cloud-sync-health/index.ts:127 [select]. Menciones SQL: ninguna detectada. Público por diseño: no acreditado; no revocar contratos desconocidos por ausencia de referencias.

Mínimo propuesto: authenticated SELECT/UPDATE observados; contratos RLS existentes SELECT/UPDATE a conservar hasta cerrar caminos dinámicos. Owner/service_role sólo operaciones de sus consumidores; ningún TRUNCATE de anon/authenticated. Tratamiento: Retirar TRUNCATE si figura. CRUD/ACL adicional sólo tras resolver diferencias entre operaciones observadas y policies; conservar reglas y resultados. Riesgo/tráfico: medio. Qué podría romperse: Consumidores listados y funciones SQL dependientes; no ejecutar revocación general.

## T51 public.notification_telegram_destinations_id_seq

Actual: tipo S; owner postgres; RLS=false; FORCE RLS=false; options=null. Grants (* indica grant option): anon=SELECT/UPDATE/USAGE; authenticated=SELECT/UPDATE/USAGE; postgres=SELECT/UPDATE/USAGE; service_role=SELECT/UPDATE/USAGE.

Columnas con ACL específica: ninguna. Políticas: ninguna. Expresiones con literales enmascarados y hashes anteriores en evidence.json.

Consumidores directos: ninguno localizado; no acredita desuso. Menciones SQL: ninguna detectada. Público por diseño: no por sí misma.

Mínimo propuesto: USAGE/SELECT sólo a insertadores legítimos acreditados del default/identity; owner/backend conservan lo necesario. UPDATE de secuencia no requerido por browser conocido. Tratamiento: No cambiar valor, mínimo ni siguiente ID. Identificar dependencia de tabla y ruta INSERT antes de revocar. Riesgo/tráfico: medio. Qué podría romperse: INSERT con IDs automáticos si se elimina USAGE necesario.

## T52 public.phone_assignment_scope_metrics

Actual: tipo r; owner postgres; RLS=true; FORCE RLS=false; options=null. Grants (* indica grant option): authenticated=SELECT; postgres=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; service_role=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE.

Columnas con ACL específica: ninguna. Políticas: Admins can read all phone assignment scope metrics [authenticated; SELECT]; Users can read own phone assignment scope metrics [authenticated; SELECT]. Expresiones con literales enmascarados y hashes anteriores en evidence.json.

Consumidores directos: edge: supabase/functions/reset-phone-counters/index.ts:168 [update]. Menciones SQL: public.cron_reset_phone_operational_daily(); public.phone_assignment_scope_usage(p_scope_type text, p_scope_id uuid, p_gerencia_id integer, p_phone_kind text, p_phone_id bigint); public.increment_phone_assignment_scope_usage(p_phone_id bigint, p_scope_type text, p_scope_id uuid, p_user_id uuid, p_gerencia_id integer). Público por diseño: no acreditado; no revocar contratos desconocidos por ausencia de referencias.

Mínimo propuesto: contratos RLS existentes SELECT a conservar hasta cerrar caminos dinámicos. Owner/service_role sólo operaciones de sus consumidores; ningún TRUNCATE de anon/authenticated. Tratamiento: Retirar TRUNCATE si figura. CRUD/ACL adicional sólo tras resolver diferencias entre operaciones observadas y policies; conservar reglas y resultados. Riesgo/tráfico: medio, consumidor indirecto/externo por confirmar. Qué podría romperse: Consumidores listados y funciones SQL dependientes; no ejecutar revocación general.

## T53 public.phone_metrics

Actual: tipo r; owner postgres; RLS=true; FORCE RLS=false; options=null. Grants (* indica grant option): authenticated=SELECT; postgres=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; service_role=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE.

Columnas con ACL específica: ninguna. Políticas: phone_metrics_select_own_or_admin [public; SELECT]. Expresiones con literales enmascarados y hashes anteriores en evidence.json.

Consumidores directos: frontend: frontend/components/telefonos/TelefonosPageContent.tsx:247 [select]; edge: supabase/functions/reset-phone-messages/index.ts:148 [update]. Menciones SQL: public.refresh_phone_metrics(). Público por diseño: no acreditado; no revocar contratos desconocidos por ausencia de referencias.

Mínimo propuesto: authenticated SELECT observados; contratos RLS existentes SELECT a conservar hasta cerrar caminos dinámicos. Owner/service_role sólo operaciones de sus consumidores; ningún TRUNCATE de anon/authenticated. Tratamiento: Retirar TRUNCATE si figura. CRUD/ACL adicional sólo tras resolver diferencias entre operaciones observadas y policies; conservar reglas y resultados. Riesgo/tráfico: medio. Qué podría romperse: Consumidores listados y funciones SQL dependientes; no ejecutar revocación general.

## T54 public.profiles

Actual: tipo r; owner postgres; RLS=true; FORCE RLS=false; options=null. Grants (* indica grant option): anon=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; authenticated=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; postgres=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; service_role=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE.

Columnas con ACL específica: ninguna. Políticas: Read own profile [public; SELECT]; Update own profile [public; UPDATE]. Expresiones con literales enmascarados y hashes anteriores en evidence.json.

Consumidores directos: frontend: frontend/app/(panel)/admin/clientes/[id]/landings/page.tsx:37 [select]; frontend: frontend/app/(panel)/admin/conversiones/page.tsx:860 [select]; frontend: frontend/app/(panel)/admin/landings/[id]/editar/page.tsx:235 [select]; frontend: frontend/app/(panel)/admin/layout.tsx:395 [select]; frontend: frontend/app/(panel)/admin/settings/page.tsx:36 [select]; frontend: frontend/app/(panel)/admin/settings/page.tsx:65 [update]; frontend: frontend/app/(panel)/dashboard/conversiones/page.tsx:1234 [select]; frontend: frontend/app/(panel)/dashboard/landing/[id]/editar/page.tsx:201 [select]; frontend: frontend/app/(panel)/dashboard/layout.tsx:352 [select]; frontend: frontend/app/(panel)/login/page.tsx:37 [select]; frontend: frontend/components/integraciones/IntegracionesMetaCapi.tsx:295 [select]; frontend: frontend/components/whatsapp-cloud-api/WhatsAppCloudApiPageContent.tsx:534 [select]; frontend: frontend/lib/landing/landingsDb.ts:182 [select]; edge: supabase/functions/builder-config/index.ts:233 [select]; edge: supabase/functions/conversions/index.ts:7738 [select]; edge: supabase/functions/create-client/index.ts:175 [select]; edge: supabase/functions/create-client/index.ts:342 [upsert]; edge: supabase/functions/delete-client/index.ts:99 [select]; edge: supabase/functions/landing-phone/index.ts:180 [select]; edge: supabase/functions/list-clients/index.ts:116 [select]; edge: supabase/functions/list-clients/index.ts:175 [select]; edge: supabase/functions/promotion-draw/index.ts:239 [select]; edge: supabase/functions/retry-failed-conversions/index.ts:946 [select]; edge: supabase/functions/retry-failed-conversions/index.ts:1029 [select]; edge: supabase/functions/retry-failed-conversions/index.ts:1217 [select]; edge: supabase/functions/telegram-webhook/index.ts:124 [select]; edge: supabase/functions/update-client/index.ts:131 [select]; edge: supabase/functions/update-client/index.ts:329 [select]; edge: supabase/functions/whatsapp-cloud-ensure-dataset/index.ts:58 [select]; edge: supabase/functions/whatsapp-cloud-redirect/index.ts:124 [select]; edge: supabase/functions/whatsapp-cloud-send-message/index.ts:68 [select]; edge: supabase/functions/whatsapp-cloud-sync-health/index.ts:180 [select]. Menciones SQL: public.enforce_landing_plan_limit(); public.get_home_overview_stats(p_user_id uuid, p_hidden_by uuid); public.get_phone_for_chatrace_client(p_client_name text); public.get_home_overview_stats_by_currency(p_user_id uuid, p_hidden_by uuid, p_currency text); public.get_whatsapp_cloud_api_contacts_page(p_limit integer, p_offset integer, p_workspace_currency text); public.get_home_overview_stats_cached_by_currency(p_user_id uuid, p_hidden_by uuid, p_currency text); public.get_whatsapp_cloud_api_inbox_threads_page(p_limit integer, p_offset integer, p_workspace_currency text, p_tag_filter text, p_unread_only boolean); public.mark_whatsapp_cloud_api_threads_read(p_workspace_currency text, p_tag_filter text); public.mark_whatsapp_cloud_api_threads_read(p_workspace_currency text, p_tag_filter text, p_from timestamp with time zone, p_to timestamp with time zone); public.get_gerencia_availability_summaries(p_user_id uuid, p_start timestamp with time zone, p_end timestamp with time zone, p_workspace_currency text); public.mark_whatsapp_cloud_api_thread_read(p_contact_id uuid); public.refresh_home_overview_stats_cache(p_user_id uuid, p_currency text); public.get_whatsapp_cloud_api_inbox_threads(p_limit integer, p_workspace_currency text); public.get_whatsapp_cloud_api_inbox_threads_page(p_limit integer, p_offset integer, p_workspace_currency text); public.get_whatsapp_cloud_api_config(p_user_id uuid, p_workspace_currency text); public.upsert_whatsapp_cloud_api_config_secure(p_id uuid, p_user_id uuid, p_name text, p_active boolean, p_workspace_currency text, p_phone_number_id text, p_whatsapp_business_account_id text, p_display_phone_number text, p_meta_access_token text, p_meta_app_secret text, p_meta_api_version text, p_webhook_verify_token text, p_meta_messaging_dataset_id text, p_landing_tag text, p_gerencia_selection_mode text, p_gerencia_fair_criterion text, p_redirect_message_template text, p_fallback_message_template text, p_redirect_use_cta_button boolean, p_redirect_cta_button_title text, p_enrich_business_messaging_user_data boolean, p_send_business_messaging_purchase_type_capi boolean, p_retargeting_enabled boolean, p_retarget_message_template text, p_retarget_delay_minutes integer); public.get_whatsapp_cloud_api_inbox_threads_page(p_limit integer, p_offset integer, p_workspace_currency text, p_tag_filter text, p_unread_only boolean, p_from timestamp with time zone, p_to timestamp with time zone); public.handle_new_user(). Público por diseño: no.

Mínimo propuesto: authenticated SELECT propio y UPDATE(nombre) acreditado en admin/settings; sin UPDATE(role,id,created_at). Backend de administración conserva operaciones actuales. Tratamiento: S-M01: retirar UPDATE de tabla antes de otorgar por columna; RLS de propiedad preservada. Confirmar contrato de edición adicional. Riesgo/tráfico: medio. Qué podría romperse: Edición de nombre/altas si se revoca UPDATE/INSERT al principal equivocado.

## T55 public.promotion_participants

Actual: tipo r; owner postgres; RLS=true; FORCE RLS=false; options=null. Grants (* indica grant option): anon=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; authenticated=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; postgres=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; service_role=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE.

Columnas con ACL específica: ninguna. Políticas: Admins can delete all promotion participants [public; DELETE]; Admins can read all promotion participants [public; SELECT]; Users can delete own promotion participants [public; DELETE]; Users can read own promotion participants [public; SELECT]. Expresiones con literales enmascarados y hashes anteriores en evidence.json.

Consumidores directos: frontend: frontend/app/(panel)/dashboard/promociones/page.tsx:504 [select]; frontend: frontend/lib/promotionsDb.ts:81 [select]; frontend: frontend/lib/promotionsDb.ts:148 [delete/select]; frontend: frontend/lib/promotionsDb.ts:161 [select]; edge: supabase/functions/promotion-draw-due/index.ts:97 [select]; edge: supabase/functions/promotion-draw/index.ts:75 [select]; edge: supabase/functions/promotion-match-backfill/index.ts:65 [select]; edge: supabase/functions/promotion-match-backfill/index.ts:121 [update]; edge: supabase/functions/promotion-participate/index.ts:142 [select]; edge: supabase/functions/promotion-participate/index.ts:155 [update]; edge: supabase/functions/promotion-participate/index.ts:176 [insert/select]. Menciones SQL: ninguna detectada. Público por diseño: no acreditado; no revocar contratos desconocidos por ausencia de referencias.

Mínimo propuesto: authenticated DELETE/SELECT observados; contratos RLS existentes DELETE/SELECT a conservar hasta cerrar caminos dinámicos. Owner/service_role sólo operaciones de sus consumidores; ningún TRUNCATE de anon/authenticated. Tratamiento: Retirar TRUNCATE si figura. CRUD/ACL adicional sólo tras resolver diferencias entre operaciones observadas y policies; conservar reglas y resultados. Riesgo/tráfico: medio. Qué podría romperse: Consumidores listados y funciones SQL dependientes; no ejecutar revocación general.

## T56 public.promotions

Actual: tipo r; owner postgres; RLS=true; FORCE RLS=false; options=null. Grants (* indica grant option): anon=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; authenticated=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; postgres=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; service_role=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE.

Columnas con ACL específica: ninguna. Políticas: Admins can read all promotions [public; SELECT]; Admins can update all promotions [public; UPDATE]; Public can read active promotions [public; SELECT]; Users can delete own promotions [public; DELETE]; Users can insert own promotions [public; INSERT]; Users can read own promotions [public; SELECT]; Users can update own promotions [public; UPDATE]. Expresiones con literales enmascarados y hashes anteriores en evidence.json.

Consumidores directos: frontend: frontend/lib/promotionsDb.ts:93 [select]; frontend: frontend/lib/promotionsDb.ts:110 [select]; frontend: frontend/lib/promotionsDb.ts:122 [insert/select]; frontend: frontend/lib/promotionsDb.ts:132 [update/select]; frontend: frontend/lib/promotionsDb.ts:142 [delete]; edge: supabase/functions/promotion-draw-due/index.ts:198 [update]; edge: supabase/functions/promotion-draw-due/index.ts:211 [update]; edge: supabase/functions/promotion-draw-due/index.ts:232 [update]; edge: supabase/functions/promotion-draw-due/index.ts:253 [update/select]; edge: supabase/functions/promotion-draw-due/index.ts:319 [select]; edge: supabase/functions/promotion-draw/index.ts:200 [select]; edge: supabase/functions/promotion-draw/index.ts:282 [update]; edge: supabase/functions/promotion-draw/index.ts:305 [update]; edge: supabase/functions/promotion-draw/index.ts:330 [update/select]; edge: supabase/functions/promotion-draw/index.ts:349 [select]; edge: supabase/functions/promotion-draw/index.ts:413 [update]; edge: supabase/functions/promotion-participate/index.ts:125 [select]. Menciones SQL: ninguna detectada. Público por diseño: sí, lectura de activas.

Mínimo propuesto: anon SELECT de promociones activas conforme policy actual; authenticated operaciones propias/admin; backend sorteo/participación. Sin TRUNCATE. Tratamiento: Preservar contrato público de promoción y policy temporal actual; no imponer login al participante. Riesgo/tráfico: alto si se revoca SELECT. Qué podría romperse: Página/imagen/participación/sorteo público previsto.

## T57 public.purchase_event_claim_keys

Actual: tipo r; owner postgres; RLS=true; FORCE RLS=false; options=null. Grants (* indica grant option): postgres=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; service_role=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE.

Columnas con ACL específica: ninguna. Políticas: ninguna. Expresiones con literales enmascarados y hashes anteriores en evidence.json.

Consumidores directos: ninguno localizado; no acredita desuso. Menciones SQL: public.claim_purchase_event(p_user_id uuid, p_idempotency_keys text[], p_candidate_event_id text). Público por diseño: no acreditado; no revocar contratos desconocidos por ausencia de referencias.

Mínimo propuesto: Sin policy de cliente: acceso directo de usuario no acreditado. Owner/service_role sólo operaciones de sus consumidores; ningún TRUNCATE de anon/authenticated. Tratamiento: Retirar TRUNCATE si figura. CRUD/ACL adicional sólo tras resolver diferencias entre operaciones observadas y policies; conservar reglas y resultados. Riesgo/tráfico: medio, consumidor indirecto/externo por confirmar. Qué podría romperse: Consumidores listados y funciones SQL dependientes; no ejecutar revocación general.

## T58 public.purchase_event_claims

Actual: tipo r; owner postgres; RLS=true; FORCE RLS=false; options=null. Grants (* indica grant option): postgres=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; service_role=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE.

Columnas con ACL específica: ninguna. Políticas: ninguna. Expresiones con literales enmascarados y hashes anteriores en evidence.json.

Consumidores directos: ninguno localizado; no acredita desuso. Menciones SQL: public.claim_purchase_event(p_user_id uuid, p_idempotency_keys text[], p_candidate_event_id text); public.complete_purchase_event_claim(p_claim_id uuid, p_conversion_id uuid, p_status text). Público por diseño: no acreditado; no revocar contratos desconocidos por ausencia de referencias.

Mínimo propuesto: Sin policy de cliente: acceso directo de usuario no acreditado. Owner/service_role sólo operaciones de sus consumidores; ningún TRUNCATE de anon/authenticated. Tratamiento: Retirar TRUNCATE si figura. CRUD/ACL adicional sólo tras resolver diferencias entre operaciones observadas y policies; conservar reglas y resultados. Riesgo/tráfico: medio, consumidor indirecto/externo por confirmar. Qué podría romperse: Consumidores listados y funciones SQL dependientes; no ejecutar revocación general.

## T59 public.settings

Actual: tipo r; owner postgres; RLS=true; FORCE RLS=false; options=null. Grants (* indica grant option): anon=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; authenticated=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; postgres=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; service_role=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE.

Columnas con ACL específica: ninguna. Políticas: Admins can insert settings [authenticated; INSERT]; Admins can read settings [authenticated; SELECT]; Admins can update settings [authenticated; UPDATE]; Authenticated can read settings [authenticated; SELECT]. Expresiones con literales enmascarados y hashes anteriores en evidence.json.

Consumidores directos: frontend: frontend/lib/settingsDb.ts:17 [select]; frontend: frontend/lib/settingsDb.ts:49 [update]; edge: supabase/functions/conversions/index.ts:4048 [select]. Menciones SQL: public.get_public_landing_routing(); public.verify_revalidate_secret(p_secret text). Público por diseño: sólo proyección del RPC de routing.

Mínimo propuesto: authenticated SELECT de configuración no secreta; administración de configuración y secreto por principal verificado. Public routing usa su RPC, no SELECT libre. Tratamiento: Separar grants por columna/lectura segura antes de quitar SELECT general; adaptar SELECT * existente sólo para acceso a credenciales. No retornar revalidate_secret a todos los usuarios. Riesgo/tráfico: alto. Qué podría romperse: Settings, editor y revalidate si el lector sigue pidiendo columnas revocadas.

## T60 public.tracking_queue

Actual: tipo r; owner postgres; RLS=true; FORCE RLS=false; options=null. Grants (* indica grant option): anon=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; authenticated=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; postgres=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; service_role=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE.

Columnas con ACL específica: ninguna. Políticas: ninguna. Expresiones con literales enmascarados y hashes anteriores en evidence.json.

Consumidores directos: backend: frontend/lib/tracking/queue.ts:64 [select]; backend: frontend/lib/tracking/queue.ts:98 [insert/select]; backend: frontend/lib/tracking/queue.ts:145 [update]; backend: frontend/lib/tracking/queue.ts:159 [insert]; backend: frontend/lib/tracking/queue.ts:178 [select]; backend: frontend/lib/tracking/queue.ts:190 [update/select]; backend: frontend/lib/tracking/queue.ts:213 [update]; backend: frontend/lib/tracking/queue.ts:234 [update]. Menciones SQL: ninguna detectada. Público por diseño: no.

Mínimo propuesto: Sin permisos directos anon/authenticated; owner/service_role según consumidor. No políticas de cliente nuevas. Tratamiento: Revocar TRUNCATE y, después de pruebas, grants redundantes no usados; conservar lecturas/escrituras backend actuales y RLS sin policies. Riesgo/tráfico: bajo/medio. Qué podría romperse: Inferencia/geo, scheduler o cola si se revoca backend en vez de cliente.

## T61 public.whatsapp_cloud_api_assignments

Actual: tipo r; owner postgres; RLS=true; FORCE RLS=false; options=null. Grants (* indica grant option): authenticated=SELECT; postgres=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; service_role=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE.

Columnas con ACL específica: ninguna. Políticas: whatsapp_cloud_api_assignments_admin_read [authenticated; SELECT]; whatsapp_cloud_api_assignments_owner_read [authenticated; SELECT]. Expresiones con literales enmascarados y hashes anteriores en evidence.json.

Consumidores directos: frontend: frontend/lib/whatsappCloudApiDb.ts:475 [select]; edge: supabase/functions/conversions/index.ts:574 [select]; edge: supabase/functions/conversions/index.ts:1062 [select]; edge: supabase/functions/conversions/index.ts:1220 [update]; edge: supabase/functions/whatsapp-cloud-redirect/index.ts:231 [update]; edge: supabase/functions/whatsapp-cloud-worker/index.ts:692 [select]; edge: supabase/functions/whatsapp-cloud-worker/index.ts:739 [select]; edge: supabase/functions/whatsapp-cloud-worker/index.ts:808 [insert]; edge: supabase/functions/whatsapp-cloud-worker/index.ts:840 [insert/select]; edge: supabase/functions/whatsapp-cloud-worker/index.ts:963 [update]. Menciones SQL: public.get_phone_for_whatsapp_cloud_api(p_config_id uuid); public.get_whatsapp_cloud_api_contacts_page(p_limit integer, p_offset integer, p_workspace_currency text); public.get_whatsapp_cloud_api_inbox_threads_page(p_limit integer, p_offset integer, p_workspace_currency text, p_tag_filter text, p_unread_only boolean); public.mark_whatsapp_cloud_api_threads_read(p_workspace_currency text, p_tag_filter text); public.mark_whatsapp_cloud_api_threads_read(p_workspace_currency text, p_tag_filter text, p_from timestamp with time zone, p_to timestamp with time zone); public.get_whatsapp_cloud_api_inbox_threads(p_limit integer, p_workspace_currency text); public.get_whatsapp_cloud_api_inbox_threads_page(p_limit integer, p_offset integer, p_workspace_currency text); public.record_whatsapp_cloud_api_redirect_click(p_token text, p_ip text, p_user_agent text); public.claim_whatsapp_cloud_api_retarget_candidates(p_limit integer, p_max_age_minutes integer, p_min_age_minutes integer); public.get_whatsapp_cloud_api_inbox_threads_page(p_limit integer, p_offset integer, p_workspace_currency text, p_tag_filter text, p_unread_only boolean, p_from timestamp with time zone, p_to timestamp with time zone). Público por diseño: no acreditado; no revocar contratos desconocidos por ausencia de referencias.

Mínimo propuesto: authenticated SELECT observados; contratos RLS existentes SELECT a conservar hasta cerrar caminos dinámicos. Owner/service_role sólo operaciones de sus consumidores; ningún TRUNCATE de anon/authenticated. Tratamiento: Retirar TRUNCATE si figura. CRUD/ACL adicional sólo tras resolver diferencias entre operaciones observadas y policies; conservar reglas y resultados. Riesgo/tráfico: medio. Qué podría romperse: Consumidores listados y funciones SQL dependientes; no ejecutar revocación general.

## T62 public.whatsapp_cloud_api_attribution_sessions

Actual: tipo r; owner postgres; RLS=true; FORCE RLS=false; options=null. Grants (* indica grant option): authenticated=SELECT; postgres=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; service_role=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE.

Columnas con ACL específica: ninguna. Políticas: whatsapp_cloud_api_attr_admin_read [authenticated; SELECT]; whatsapp_cloud_api_attr_owner_read [authenticated; SELECT]. Expresiones con literales enmascarados y hashes anteriores en evidence.json.

Consumidores directos: edge: supabase/functions/conversions/index.ts:1106 [select]; edge: supabase/functions/whatsapp-cloud-worker/index.ts:757 [insert/select]. Menciones SQL: public.get_whatsapp_cloud_api_inbox_threads_page(p_limit integer, p_offset integer, p_workspace_currency text, p_tag_filter text, p_unread_only boolean); public.get_whatsapp_cloud_api_inbox_threads(p_limit integer, p_workspace_currency text); public.get_whatsapp_cloud_api_inbox_threads_page(p_limit integer, p_offset integer, p_workspace_currency text); public.record_whatsapp_cloud_api_redirect_click(p_token text, p_ip text, p_user_agent text); public.get_whatsapp_cloud_api_inbox_threads_page(p_limit integer, p_offset integer, p_workspace_currency text, p_tag_filter text, p_unread_only boolean, p_from timestamp with time zone, p_to timestamp with time zone). Público por diseño: no acreditado; no revocar contratos desconocidos por ausencia de referencias.

Mínimo propuesto: contratos RLS existentes SELECT a conservar hasta cerrar caminos dinámicos. Owner/service_role sólo operaciones de sus consumidores; ningún TRUNCATE de anon/authenticated. Tratamiento: Retirar TRUNCATE si figura. CRUD/ACL adicional sólo tras resolver diferencias entre operaciones observadas y policies; conservar reglas y resultados. Riesgo/tráfico: medio, consumidor indirecto/externo por confirmar. Qué podría romperse: Consumidores listados y funciones SQL dependientes; no ejecutar revocación general.

## T63 public.whatsapp_cloud_api_configs

Actual: tipo r; owner postgres; RLS=true; FORCE RLS=false; options=null. Grants (* indica grant option): postgres=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; service_role=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE.

Columnas con ACL específica: id {authenticated=r/postgres}; user_id {authenticated=r/postgres}; name {authenticated=r/postgres}; active {authenticated=r/postgres}; workspace_currency {authenticated=r/postgres}; phone_number_id {authenticated=r/postgres}; whatsapp_business_account_id {authenticated=r/postgres}; display_phone_number {authenticated=r/postgres}; meta_api_version {authenticated=r/postgres}; webhook_verify_token {authenticated=r/postgres}; pixel_id {authenticated=r/postgres}; landing_tag {authenticated=r/postgres}; gerencia_selection_mode {authenticated=r/postgres}; gerencia_fair_criterion {authenticated=r/postgres}; send_contact_capi {authenticated=r/postgres}; redirect_message_template {authenticated=r/postgres}; fallback_message_template {authenticated=r/postgres}; created_at {authenticated=r/postgres}; updated_at {authenticated=r/postgres}; redirect_use_cta_button {authenticated=r/postgres}; redirect_cta_button_title {authenticated=r/postgres}; phone_number_status {authenticated=r/postgres}; quality_rating {authenticated=r/postgres}; messaging_limit_tier {authenticated=r/postgres}; health_checked_at {authenticated=r/postgres}; health_last_error {authenticated=r/postgres}; meta_messaging_dataset_id {authenticated=r/postgres}. Políticas: whatsapp_cloud_api_configs_admin [authenticated; ALL]; whatsapp_cloud_api_configs_owner [authenticated; ALL]. Expresiones con literales enmascarados y hashes anteriores en evidence.json.

Consumidores directos: frontend: frontend/lib/whatsappCloudApiDb.ts:445 [select]; edge: supabase/functions/conversions/index.ts:1091 [select]; edge: supabase/functions/conversions/index.ts:3027 [select]; edge: supabase/functions/retry-failed-conversions/index.ts:214 [select]; edge: supabase/functions/whatsapp-cloud-ensure-dataset/index.ts:131 [select]; edge: supabase/functions/whatsapp-cloud-send-message/index.ts:195 [select]; edge: supabase/functions/whatsapp-cloud-sync-health/index.ts:300 [select]; edge: supabase/functions/whatsapp-cloud-sync-health/index.ts:332 [update]; edge: supabase/functions/whatsapp-cloud-webhook/index.ts:123 [select]; edge: supabase/functions/whatsapp-cloud-webhook/index.ts:171 [select]; edge: supabase/functions/whatsapp-cloud-webhook/index.ts:186 [select]; edge: supabase/functions/whatsapp-cloud-webhook/index.ts:206 [select]; edge: supabase/functions/whatsapp-cloud-worker/index.ts:379 [select]; edge: supabase/functions/whatsapp-cloud-worker/index.ts:644 [update]. Menciones SQL: public.get_phone_for_whatsapp_cloud_api(p_config_id uuid); public.get_whatsapp_cloud_api_contacts_page(p_limit integer, p_offset integer, p_workspace_currency text); public.enforce_whatsapp_cloud_api_assignment_workspace(); public.get_whatsapp_cloud_api_inbox_threads_page(p_limit integer, p_offset integer, p_workspace_currency text, p_tag_filter text, p_unread_only boolean); public.mark_whatsapp_cloud_api_threads_read(p_workspace_currency text, p_tag_filter text); public.mark_whatsapp_cloud_api_threads_read(p_workspace_currency text, p_tag_filter text, p_from timestamp with time zone, p_to timestamp with time zone); public.get_whatsapp_cloud_api_inbox_threads(p_limit integer, p_workspace_currency text); public.get_whatsapp_cloud_api_inbox_threads_page(p_limit integer, p_offset integer, p_workspace_currency text); public.record_whatsapp_cloud_api_redirect_click(p_token text, p_ip text, p_user_agent text); public.get_whatsapp_cloud_api_config(p_user_id uuid, p_workspace_currency text); public.upsert_whatsapp_cloud_api_config_secure(p_id uuid, p_user_id uuid, p_name text, p_active boolean, p_workspace_currency text, p_phone_number_id text, p_whatsapp_business_account_id text, p_display_phone_number text, p_meta_access_token text, p_meta_app_secret text, p_meta_api_version text, p_webhook_verify_token text, p_meta_messaging_dataset_id text, p_landing_tag text, p_gerencia_selection_mode text, p_gerencia_fair_criterion text, p_redirect_message_template text, p_fallback_message_template text, p_redirect_use_cta_button boolean, p_redirect_cta_button_title text, p_enrich_business_messaging_user_data boolean, p_send_business_messaging_purchase_type_capi boolean, p_retargeting_enabled boolean, p_retarget_message_template text, p_retarget_delay_minutes integer); public.claim_whatsapp_cloud_api_retarget_candidates(p_limit integer, p_max_age_minutes integer, p_min_age_minutes integer); public.get_whatsapp_cloud_api_inbox_threads_page(p_limit integer, p_offset integer, p_workspace_currency text, p_tag_filter text, p_unread_only boolean, p_from timestamp with time zone, p_to timestamp with time zone). Público por diseño: no.

Mínimo propuesto: authenticated SELECT sólo de las columnas ya permitidas; escritura autenticada por RPC secure; meta_access_token/meta_app_secret sólo backend; revisar permiso de webhook_verify_token. Tratamiento: Conservar protección por columna y RPC actuales. No ampliar a SELECT tabla al simplificar grants. Riesgo/tráfico: alto. Qué podría romperse: Configuración/inbox y token de verificación si no se prueba la administración.

## T64 public.whatsapp_cloud_api_contacts

Actual: tipo r; owner postgres; RLS=true; FORCE RLS=false; options=null. Grants (* indica grant option): authenticated=SELECT; postgres=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; service_role=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE.

Columnas con ACL específica: ninguna. Políticas: whatsapp_cloud_api_contacts_admin_read [authenticated; SELECT]; whatsapp_cloud_api_contacts_owner_read [authenticated; SELECT]. Expresiones con literales enmascarados y hashes anteriores en evidence.json.

Consumidores directos: edge: supabase/functions/conversions/index.ts:1099 [select]; edge: supabase/functions/whatsapp-cloud-send-message/index.ts:177 [select]; edge: supabase/functions/whatsapp-cloud-worker/index.ts:708 [upsert/select]. Menciones SQL: public.get_whatsapp_cloud_api_contacts_page(p_limit integer, p_offset integer, p_workspace_currency text); public.get_whatsapp_cloud_api_inbox_threads_page(p_limit integer, p_offset integer, p_workspace_currency text, p_tag_filter text, p_unread_only boolean); public.mark_whatsapp_cloud_api_threads_read(p_workspace_currency text, p_tag_filter text); public.mark_whatsapp_cloud_api_threads_read(p_workspace_currency text, p_tag_filter text, p_from timestamp with time zone, p_to timestamp with time zone); public.mark_whatsapp_cloud_api_thread_read(p_contact_id uuid); public.get_whatsapp_cloud_api_inbox_threads(p_limit integer, p_workspace_currency text); public.get_whatsapp_cloud_api_inbox_threads_page(p_limit integer, p_offset integer, p_workspace_currency text); public.record_whatsapp_cloud_api_redirect_click(p_token text, p_ip text, p_user_agent text); public.claim_whatsapp_cloud_api_retarget_candidates(p_limit integer, p_max_age_minutes integer, p_min_age_minutes integer); public.get_whatsapp_cloud_api_inbox_threads_page(p_limit integer, p_offset integer, p_workspace_currency text, p_tag_filter text, p_unread_only boolean, p_from timestamp with time zone, p_to timestamp with time zone). Público por diseño: no acreditado; no revocar contratos desconocidos por ausencia de referencias.

Mínimo propuesto: contratos RLS existentes SELECT a conservar hasta cerrar caminos dinámicos. Owner/service_role sólo operaciones de sus consumidores; ningún TRUNCATE de anon/authenticated. Tratamiento: Retirar TRUNCATE si figura. CRUD/ACL adicional sólo tras resolver diferencias entre operaciones observadas y policies; conservar reglas y resultados. Riesgo/tráfico: medio, consumidor indirecto/externo por confirmar. Qué podría romperse: Consumidores listados y funciones SQL dependientes; no ejecutar revocación general.

## T65 public.whatsapp_cloud_api_gerencias

Actual: tipo r; owner postgres; RLS=true; FORCE RLS=false; options=null. Grants (* indica grant option): anon=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; authenticated=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; postgres=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; service_role=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE.

Columnas con ACL específica: ninguna. Políticas: whatsapp_cloud_api_gerencias_admin [authenticated; ALL]; whatsapp_cloud_api_gerencias_owner [authenticated; ALL]. Expresiones con literales enmascarados y hashes anteriores en evidence.json.

Consumidores directos: frontend: frontend/lib/whatsappCloudApiDb.ts:265 [select]; frontend: frontend/lib/whatsappCloudApiDb.ts:287 [delete]; frontend: frontend/lib/whatsappCloudApiDb.ts:304 [insert]. Menciones SQL: public.get_phone_for_whatsapp_cloud_api(p_config_id uuid). Público por diseño: no acreditado; no revocar contratos desconocidos por ausencia de referencias.

Mínimo propuesto: authenticated DELETE/INSERT/SELECT observados; contratos RLS existentes DELETE/INSERT/SELECT/UPDATE a conservar hasta cerrar caminos dinámicos. Owner/service_role sólo operaciones de sus consumidores; ningún TRUNCATE de anon/authenticated. Tratamiento: Retirar TRUNCATE si figura. CRUD/ACL adicional sólo tras resolver diferencias entre operaciones observadas y policies; conservar reglas y resultados. Riesgo/tráfico: medio. Qué podría romperse: Consumidores listados y funciones SQL dependientes; no ejecutar revocación general.

## T66 public.whatsapp_cloud_api_outbound_messages

Actual: tipo r; owner postgres; RLS=true; FORCE RLS=false; options=null. Grants (* indica grant option): authenticated=SELECT; postgres=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; service_role=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE.

Columnas con ACL específica: ninguna. Políticas: whatsapp_cloud_api_outbound_admin_read [authenticated; SELECT]; whatsapp_cloud_api_outbound_owner_read [authenticated; SELECT]. Expresiones con literales enmascarados y hashes anteriores en evidence.json.

Consumidores directos: frontend: frontend/lib/whatsappCloudApiDb.ts:485 [select]; edge: supabase/functions/whatsapp-cloud-retarget/index.ts:351 [insert/select]; edge: supabase/functions/whatsapp-cloud-send-message/index.ts:211 [insert]; edge: supabase/functions/whatsapp-cloud-send-message/index.ts:224 [insert]; edge: supabase/functions/whatsapp-cloud-send-message/index.ts:237 [insert]; edge: supabase/functions/whatsapp-cloud-worker/index.ts:598 [update]; edge: supabase/functions/whatsapp-cloud-worker/index.ts:926 [insert]. Menciones SQL: public.get_whatsapp_cloud_api_inbox_threads_page(p_limit integer, p_offset integer, p_workspace_currency text, p_tag_filter text, p_unread_only boolean); public.get_whatsapp_cloud_api_inbox_threads(p_limit integer, p_workspace_currency text); public.get_whatsapp_cloud_api_inbox_threads_page(p_limit integer, p_offset integer, p_workspace_currency text); public.get_whatsapp_cloud_api_inbox_threads_page(p_limit integer, p_offset integer, p_workspace_currency text, p_tag_filter text, p_unread_only boolean, p_from timestamp with time zone, p_to timestamp with time zone). Público por diseño: no acreditado; no revocar contratos desconocidos por ausencia de referencias.

Mínimo propuesto: authenticated SELECT observados; contratos RLS existentes SELECT a conservar hasta cerrar caminos dinámicos. Owner/service_role sólo operaciones de sus consumidores; ningún TRUNCATE de anon/authenticated. Tratamiento: Retirar TRUNCATE si figura. CRUD/ACL adicional sólo tras resolver diferencias entre operaciones observadas y policies; conservar reglas y resultados. Riesgo/tráfico: medio. Qué podría romperse: Consumidores listados y funciones SQL dependientes; no ejecutar revocación general.

## T67 public.whatsapp_cloud_api_redirects

Actual: tipo r; owner postgres; RLS=true; FORCE RLS=false; options=null. Grants (* indica grant option): anon=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; authenticated=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; postgres=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; service_role=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE.

Columnas con ACL específica: ninguna. Políticas: whatsapp_cloud_api_redirects_admin_read [authenticated; SELECT]; whatsapp_cloud_api_redirects_owner_read [authenticated; SELECT]. Expresiones con literales enmascarados y hashes anteriores en evidence.json.

Consumidores directos: edge: supabase/functions/whatsapp-cloud-worker/index.ts:886 [insert]. Menciones SQL: public.get_whatsapp_cloud_api_contacts_page(p_limit integer, p_offset integer, p_workspace_currency text); public.get_whatsapp_cloud_api_inbox_threads_page(p_limit integer, p_offset integer, p_workspace_currency text, p_tag_filter text, p_unread_only boolean); public.mark_whatsapp_cloud_api_threads_read(p_workspace_currency text, p_tag_filter text); public.mark_whatsapp_cloud_api_threads_read(p_workspace_currency text, p_tag_filter text, p_from timestamp with time zone, p_to timestamp with time zone); public.get_whatsapp_cloud_api_inbox_threads(p_limit integer, p_workspace_currency text); public.get_whatsapp_cloud_api_inbox_threads_page(p_limit integer, p_offset integer, p_workspace_currency text); public.record_whatsapp_cloud_api_redirect_click(p_token text, p_ip text, p_user_agent text); public.claim_whatsapp_cloud_api_retarget_candidates(p_limit integer, p_max_age_minutes integer, p_min_age_minutes integer); public.get_whatsapp_cloud_api_inbox_threads_page(p_limit integer, p_offset integer, p_workspace_currency text, p_tag_filter text, p_unread_only boolean, p_from timestamp with time zone, p_to timestamp with time zone). Público por diseño: no acreditado; no revocar contratos desconocidos por ausencia de referencias.

Mínimo propuesto: contratos RLS existentes SELECT a conservar hasta cerrar caminos dinámicos. Owner/service_role sólo operaciones de sus consumidores; ningún TRUNCATE de anon/authenticated. Tratamiento: Retirar TRUNCATE si figura. CRUD/ACL adicional sólo tras resolver diferencias entre operaciones observadas y policies; conservar reglas y resultados. Riesgo/tráfico: medio, consumidor indirecto/externo por confirmar. Qué podría romperse: Consumidores listados y funciones SQL dependientes; no ejecutar revocación general.

## T68 public.whatsapp_cloud_api_retarget_messages

Actual: tipo r; owner postgres; RLS=true; FORCE RLS=false; options=null. Grants (* indica grant option): authenticated=SELECT; postgres=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; service_role=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE.

Columnas con ACL específica: ninguna. Políticas: whatsapp_cloud_api_retarget_admin_read [authenticated; SELECT]; whatsapp_cloud_api_retarget_owner_read [authenticated; SELECT]. Expresiones con literales enmascarados y hashes anteriores en evidence.json.

Consumidores directos: edge: supabase/functions/whatsapp-cloud-retarget/index.ts:260 [update]. Menciones SQL: public.claim_whatsapp_cloud_api_retarget_candidates(p_limit integer, p_max_age_minutes integer, p_min_age_minutes integer). Público por diseño: no acreditado; no revocar contratos desconocidos por ausencia de referencias.

Mínimo propuesto: contratos RLS existentes SELECT a conservar hasta cerrar caminos dinámicos. Owner/service_role sólo operaciones de sus consumidores; ningún TRUNCATE de anon/authenticated. Tratamiento: Retirar TRUNCATE si figura. CRUD/ACL adicional sólo tras resolver diferencias entre operaciones observadas y policies; conservar reglas y resultados. Riesgo/tráfico: medio, consumidor indirecto/externo por confirmar. Qué podría romperse: Consumidores listados y funciones SQL dependientes; no ejecutar revocación general.

## T69 public.whatsapp_cloud_api_thread_reads

Actual: tipo r; owner postgres; RLS=true; FORCE RLS=false; options=null. Grants (* indica grant option): anon=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; authenticated=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; postgres=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; service_role=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE.

Columnas con ACL específica: ninguna. Políticas: whatsapp_cloud_api_thread_reads_owner_insert [authenticated; INSERT]; whatsapp_cloud_api_thread_reads_owner_select [authenticated; SELECT]; whatsapp_cloud_api_thread_reads_owner_update [authenticated; UPDATE]. Expresiones con literales enmascarados y hashes anteriores en evidence.json.

Consumidores directos: ninguno localizado; no acredita desuso. Menciones SQL: public.get_whatsapp_cloud_api_inbox_threads_page(p_limit integer, p_offset integer, p_workspace_currency text, p_tag_filter text, p_unread_only boolean); public.mark_whatsapp_cloud_api_threads_read(p_workspace_currency text, p_tag_filter text); public.mark_whatsapp_cloud_api_threads_read(p_workspace_currency text, p_tag_filter text, p_from timestamp with time zone, p_to timestamp with time zone); public.mark_whatsapp_cloud_api_thread_read(p_contact_id uuid); public.get_whatsapp_cloud_api_inbox_threads(p_limit integer, p_workspace_currency text); public.get_whatsapp_cloud_api_inbox_threads_page(p_limit integer, p_offset integer, p_workspace_currency text); public.get_whatsapp_cloud_api_inbox_threads_page(p_limit integer, p_offset integer, p_workspace_currency text, p_tag_filter text, p_unread_only boolean, p_from timestamp with time zone, p_to timestamp with time zone). Público por diseño: no acreditado; no revocar contratos desconocidos por ausencia de referencias.

Mínimo propuesto: contratos RLS existentes INSERT/SELECT/UPDATE a conservar hasta cerrar caminos dinámicos. Owner/service_role sólo operaciones de sus consumidores; ningún TRUNCATE de anon/authenticated. Tratamiento: Retirar TRUNCATE si figura. CRUD/ACL adicional sólo tras resolver diferencias entre operaciones observadas y policies; conservar reglas y resultados. Riesgo/tráfico: medio, consumidor indirecto/externo por confirmar. Qué podría romperse: Consumidores listados y funciones SQL dependientes; no ejecutar revocación general.

## T70 public.whatsapp_cloud_api_webhook_events

Actual: tipo r; owner postgres; RLS=true; FORCE RLS=false; options=null. Grants (* indica grant option): authenticated=SELECT; postgres=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; service_role=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE.

Columnas con ACL específica: ninguna. Políticas: whatsapp_cloud_api_events_admin_read [authenticated; SELECT]; whatsapp_cloud_api_events_owner_read [authenticated; SELECT]. Expresiones con literales enmascarados y hashes anteriores en evidence.json.

Consumidores directos: frontend: frontend/lib/whatsappCloudApiDb.ts:322 [select]; frontend: frontend/lib/whatsappCloudApiDb.ts:465 [select]; edge: supabase/functions/whatsapp-cloud-send-message/index.ts:83 [select]; edge: supabase/functions/whatsapp-cloud-webhook/index.ts:288 [insert]; edge: supabase/functions/whatsapp-cloud-worker/index.ts:300 [update/select]; edge: supabase/functions/whatsapp-cloud-worker/index.ts:321 [update/select]; edge: supabase/functions/whatsapp-cloud-worker/index.ts:340 [update]; edge: supabase/functions/whatsapp-cloud-worker/index.ts:365 [update]; edge: supabase/functions/whatsapp-cloud-worker/index.ts:1008 [select]; edge: supabase/functions/whatsapp-cloud-worker/index.ts:1036 [select]. Menciones SQL: public.get_whatsapp_cloud_api_inbox_threads_page(p_limit integer, p_offset integer, p_workspace_currency text, p_tag_filter text, p_unread_only boolean); public.mark_whatsapp_cloud_api_threads_read(p_workspace_currency text, p_tag_filter text); public.mark_whatsapp_cloud_api_threads_read(p_workspace_currency text, p_tag_filter text, p_from timestamp with time zone, p_to timestamp with time zone); public.mark_whatsapp_cloud_api_thread_read(p_contact_id uuid); public.get_whatsapp_cloud_api_inbox_threads(p_limit integer, p_workspace_currency text); public.get_whatsapp_cloud_api_inbox_threads_page(p_limit integer, p_offset integer, p_workspace_currency text); public.get_whatsapp_cloud_api_inbox_threads_page(p_limit integer, p_offset integer, p_workspace_currency text, p_tag_filter text, p_unread_only boolean, p_from timestamp with time zone, p_to timestamp with time zone). Público por diseño: no acreditado; no revocar contratos desconocidos por ausencia de referencias.

Mínimo propuesto: authenticated SELECT observados; contratos RLS existentes SELECT a conservar hasta cerrar caminos dinámicos. Owner/service_role sólo operaciones de sus consumidores; ningún TRUNCATE de anon/authenticated. Tratamiento: Retirar TRUNCATE si figura. CRUD/ACL adicional sólo tras resolver diferencias entre operaciones observadas y policies; conservar reglas y resultados. Riesgo/tráfico: medio. Qué podría romperse: Consumidores listados y funciones SQL dependientes; no ejecutar revocación general.

## T71 public.whatsapp_cloud_api_webhook_request_logs

Actual: tipo r; owner postgres; RLS=true; FORCE RLS=false; options=null. Grants (* indica grant option): authenticated=SELECT; postgres=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE; service_role=DELETE/INSERT/MAINTAIN/REFERENCES/SELECT/TRIGGER/TRUNCATE/UPDATE.

Columnas con ACL específica: ninguna. Políticas: whatsapp_cloud_api_request_logs_admin_read [authenticated; SELECT]; whatsapp_cloud_api_request_logs_owner_read [authenticated; SELECT]. Expresiones con literales enmascarados y hashes anteriores en evidence.json.

Consumidores directos: frontend: frontend/lib/whatsappCloudApiDb.ts:495 [select]; edge: supabase/functions/whatsapp-cloud-webhook/index.ts:256 [insert]. Menciones SQL: ninguna detectada. Público por diseño: no acreditado; no revocar contratos desconocidos por ausencia de referencias.

Mínimo propuesto: authenticated SELECT observados; contratos RLS existentes SELECT a conservar hasta cerrar caminos dinámicos. Owner/service_role sólo operaciones de sus consumidores; ningún TRUNCATE de anon/authenticated. Tratamiento: Retirar TRUNCATE si figura. CRUD/ACL adicional sólo tras resolver diferencias entre operaciones observadas y policies; conservar reglas y resultados. Riesgo/tráfico: medio. Qué podría romperse: Consumidores listados y funciones SQL dependientes; no ejecutar revocación general.

## Precauciones específicas de policies

profiles.role editable convierte checks de admin de otras tablas en controles insuficientes; remediar primero esa frontera. gerencia_phones combina policies permissive: SELECT TRUE no se restringe agregando otra policy de propietario; la subconsulta ALL usa una igualdad interna g.id=g.gerencia_id. El alcance deseado debe aprobarse antes de reemplazar policies. settings.SELECT TRUE para authenticated alcanza revalidate_secret porque el grant de tabla incluye esa columna. En las otras tablas con tokens, ACL de SELECT no significa lectura anónima efectiva: las policies pueden bloquear todas las filas de anon y permitir filas propias a authenticated. Ninguno de estos hallazgos se comprobó leyendo una fila real.
