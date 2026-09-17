# Inventario de funciones — Fase 1A

89 firmas en public/private; 65 SECURITY DEFINER. Estado remoto actual, propuestas no aplicadas. Los EXECUTE enumerados son ACL explícitas/default resueltas; PUBLIC beneficia a todos los roles y se deben verificar herencias antes del cambio. Owner postgres en las 89. Paths y modo se muestran por firma.

Las llamadas SDK se localizan por nombre: resolver argumentos/sobrecarga antes de emitir DDL. Las referencias textuales pueden ser URLs, documentación, tests o ramas dinámicas; no equivalen a tráfico. Las menciones SQL tampoco son un grafo exhaustivo de dependencias. Ausencia de referencia no prueba desuso. “Backend” en un archivo frontend/app/api es servidor, no browser.

SECURITY DEFINER no se elimina globalmente. Tratamiento común de paths: sólo después de comprobar resolución de nombres y tests, esquemas de confianza y pg_temp al final, o vacío con nombres totalmente calificados; preservar cuerpos/owner hasta prueba específica. Para firmas con path public, el riesgo incluye TEMP (roles de cliente tienen TEMP a nivel DB), sin afirmar que el gateway permita crear temporales arbitrariamente.

## F01 private.close_landing_phone_reservation_on_lead()

Actual: SECURITY DEFINER; owner postgres; resultado trigger; settings ["search_path=\"\""]; EXECUTE postgres.

Consumidor/canal: trigger, no RPC público. Llamadas SDK: ninguna localizada. Referencias adicionales: ninguna.

SQL entrante por nombre: ninguno detectado. Triggers: public.conversions.close_landing_phone_reservation_on_lead. Constraints: ninguna. Cron: ninguno identificado.

Mínimo propuesto: owner y rol que crea/restaura el trigger; retirar grants de cliente redundantes sólo con DML probado. Tratamiento: Conservar SECURITY DEFINER y efectos del trigger. Evaluar path por firma; no cambiar owner en el primer lote. Riesgo del cambio: medio. Al revocar incorrectamente: DML o reconstrucción de triggers si se omiten privilegios de instalación/dependencias.

Evidencia del cuerpo: supabase/migrations/20260905012831_fair_message_assignment_reservations.sql:145. MD5 de cuerpo: 0fefb642db0f304591d43a6253de9669. Tests/referencias de prueba: sin referencia nominal localizada; añadir matriz de roles y test de consumidor antes de modificar.

## F02 private.is_valid_meta_audience_fields(p_fields text[])

Actual: SECURITY INVOKER; owner postgres; resultado boolean; settings ["search_path=\"\""]; EXECUTE authenticated, postgres.

Consumidor/canal: CHECK de meta_audience_configs. Llamadas SDK: ninguna localizada. Referencias adicionales: ninguna.

SQL entrante por nombre: ninguno detectado. Triggers: ninguno detectado. Constraints: public.meta_audience_configs.meta_audience_configs_selected_fields_check. Cron: ninguno identificado.

Mínimo propuesto: authenticated EXECUTE y USAGE private actuales, además de owner; mantener fuera de schemas API. Tratamiento: Conservar INVOKER, path vacío y reglas de validación. Riesgo del cambio: alto si se revoca. Al revocar incorrectamente: INSERT/UPDATE de reglas o campos de Audiencias.

Evidencia del cuerpo: supabase/migrations/20260911213912_meta_audience_configs.sql:66. MD5 de cuerpo: a5db29ade2b0eac9917165f3b7ada95a. Tests/referencias de prueba: sin referencia nominal localizada; añadir matriz de roles y test de consumidor antes de modificar.

## F03 private.is_valid_meta_audience_rules(p_rules jsonb)

Actual: SECURITY INVOKER; owner postgres; resultado boolean; settings ["search_path=\"\""]; EXECUTE authenticated, postgres.

Consumidor/canal: CHECK de meta_audience_configs. Llamadas SDK: ninguna localizada. Referencias adicionales: ninguna.

SQL entrante por nombre: ninguno detectado. Triggers: ninguno detectado. Constraints: public.meta_audience_configs.meta_audience_configs_rules_check. Cron: ninguno identificado.

Mínimo propuesto: authenticated EXECUTE y USAGE private actuales, además de owner; mantener fuera de schemas API. Tratamiento: Conservar INVOKER, path vacío y reglas de validación. Riesgo del cambio: alto si se revoca. Al revocar incorrectamente: INSERT/UPDATE de reglas o campos de Audiencias.

Evidencia del cuerpo: supabase/migrations/20260911213912_meta_audience_configs.sql:1. MD5 de cuerpo: 74c1563d84da18c7eabee5be6164630a. Tests/referencias de prueba: sin referencia nominal localizada; añadir matriz de roles y test de consumidor antes de modificar.

## F04 private.landing_phone_message_load(p_landing_id uuid, p_gerencia_id integer, p_phone_kind text, p_owner_user_id uuid, p_phone_id bigint)

Actual: SECURITY INVOKER; owner postgres; resultado bigint; settings ["search_path=\"\""]; EXECUTE postgres.

Consumidor/canal: función SQL interna. Llamadas SDK: ninguna localizada. Referencias adicionales: ninguna.

SQL entrante por nombre: public.get_phone_for_landing(p_landing_name text, p_create_reservation boolean). Triggers: ninguno detectado. Constraints: ninguna. Cron: ninguno identificado.

Mínimo propuesto: owner actual; no añadir grants de usuario. Tratamiento: Conservar ACL, INVOKER y path vacío. Riesgo del cambio: bajo sin cambios. Al revocar incorrectamente: Asignación de teléfono desde el DEFINER que la utiliza.

Evidencia del cuerpo: supabase/migrations/20260905012831_fair_message_assignment_reservations.sql:61. MD5 de cuerpo: 075edab9745f59b538ada972537e41df. Tests/referencias de prueba: sin referencia nominal localizada; añadir matriz de roles y test de consumidor antes de modificar.

## F05 private.set_meta_audience_config_updated_at()

Actual: SECURITY INVOKER; owner postgres; resultado trigger; settings ["search_path=\"\""]; EXECUTE postgres.

Consumidor/canal: trigger, no RPC público. Llamadas SDK: ninguna localizada. Referencias adicionales: ninguna.

SQL entrante por nombre: ninguno detectado. Triggers: public.meta_audience_configs.meta_audience_configs_normalize. Constraints: ninguna. Cron: ninguno identificado.

Mínimo propuesto: owner y rol que crea/restaura el trigger; retirar grants de cliente redundantes sólo con DML probado. Tratamiento: Conservar SECURITY INVOKER y efectos del trigger. Evaluar path por firma; no cambiar owner en el primer lote. Riesgo del cambio: medio. Al revocar incorrectamente: DML o reconstrucción de triggers si se omiten privilegios de instalación/dependencias.

Evidencia del cuerpo: supabase/migrations/20260911213912_meta_audience_configs.sql:128. MD5 de cuerpo: 5694457e05bd9c75feac9a6c8299d2ee. Tests/referencias de prueba: sin referencia nominal localizada; añadir matriz de roles y test de consumidor antes de modificar.

## F06 public.atrio_assignment_scope_usage(p_scope_type text, p_scope_id uuid, p_atrio_client_id uuid)

Actual: SECURITY DEFINER; owner postgres; resultado bigint; settings ["search_path=public, pg_temp"]; EXECUTE postgres, service_role.

Consumidor/canal: backend service_role o función SQL interna. Llamadas SDK: ninguna localizada. Referencias adicionales: edge: supabase/functions/atrio-click/index.ts:84.

SQL entrante por nombre: public.get_atrio_for_landing(p_landing_name text). Triggers: ninguno detectado. Constraints: ninguna. Cron: ninguno identificado.

Mínimo propuesto: service_role y owner actuales; ejecución anidada bajo owner. No añadir acceso público. Tratamiento: Conservar modo de seguridad, cuerpos, grants necesarios y comportamiento. Auditar path antes de cualquier modificación. Riesgo del cambio: medio. Al revocar incorrectamente: Claims/envíos, reservas, contadores, redirect o cálculos internos indicados por consumidores/dependencias.

Evidencia del cuerpo: supabase/migrations/20260822162110_landing_atrio_redirect_assignments.sql:199. MD5 de cuerpo: 8575adfa53d72e55b2efdd53456bc3b4. Tests/referencias de prueba: sin referencia nominal localizada; añadir matriz de roles y test de consumidor antes de modificar.

## F07 public.calculate_home_overview_stats_by_currency(p_user_id uuid, p_hidden_by uuid, p_currency text)

Actual: SECURITY DEFINER; owner postgres; resultado jsonb; settings ["search_path=public"]; EXECUTE postgres, service_role.

Consumidor/canal: backend service_role o función SQL interna. Llamadas SDK: ninguna localizada. Referencias adicionales: ninguna.

SQL entrante por nombre: public.get_home_overview_stats_cached_by_currency(p_user_id uuid, p_hidden_by uuid, p_currency text); public.refresh_home_overview_stats_cache(p_user_id uuid, p_currency text). Triggers: ninguno detectado. Constraints: ninguna. Cron: ninguno identificado.

Mínimo propuesto: service_role y owner actuales; ejecución anidada bajo owner. No añadir acceso público. Tratamiento: Conservar modo de seguridad, cuerpos, grants necesarios y comportamiento. Auditar path antes de cualquier modificación. Riesgo del cambio: medio. Al revocar incorrectamente: Claims/envíos, reservas, contadores, redirect o cálculos internos indicados por consumidores/dependencias.

Evidencia del cuerpo: supabase/migrations/20260820020830_home_overview_meta_ads_full_summary.sql:1. MD5 de cuerpo: 091cb69a96d22eac471dbed5ecae196a. Tests/referencias de prueba: sin referencia nominal localizada; añadir matriz de roles y test de consumidor antes de modificar.

## F08 public.claim_purchase_event(p_user_id uuid, p_idempotency_keys text[], p_candidate_event_id text)

Actual: SECURITY DEFINER; owner postgres; resultado TABLE(claimed boolean, claim_id uuid, event_id text, conversion_id uuid, claim_status text); settings ["search_path=public, pg_temp"]; EXECUTE postgres, service_role.

Consumidor/canal: backend service_role o función SQL interna. Llamadas SDK: edge: supabase/functions/conversions/index.ts:1267. Referencias adicionales: ninguna.

SQL entrante por nombre: ninguno detectado. Triggers: ninguno detectado. Constraints: ninguna. Cron: ninguno identificado.

Mínimo propuesto: service_role y owner actuales; ejecución anidada bajo owner. No añadir acceso público. Tratamiento: Conservar modo de seguridad, cuerpos, grants necesarios y comportamiento. Auditar path antes de cualquier modificación. Riesgo del cambio: medio. Al revocar incorrectamente: Claims/envíos, reservas, contadores, redirect o cálculos internos indicados por consumidores/dependencias.

Evidencia del cuerpo: supabase/migrations/20260728163000_purchase_event_atomic_claims.sql:40. MD5 de cuerpo: d358ce6d7509f0d90bf250ef45353890. Tests/referencias de prueba: sin referencia nominal localizada; añadir matriz de roles y test de consumidor antes de modificar.

## F09 public.claim_whatsapp_cloud_api_retarget_candidates(p_limit integer, p_max_age_minutes integer, p_min_age_minutes integer)

Actual: SECURITY DEFINER; owner postgres; resultado TABLE(retarget_id uuid, retarget_kind text, contact_id uuid, config_id uuid, user_id uuid, assignment_id uuid, wa_id text, profile_name text, last_inbound_at timestamp with time zone, phone_number_id text, meta_access_token text, meta_api_version text, redirect_token text, promo_code text, retarget_message_template text); settings ["search_path=public, pg_temp"]; EXECUTE postgres, service_role.

Consumidor/canal: backend service_role o función SQL interna. Llamadas SDK: edge: supabase/functions/whatsapp-cloud-retarget/index.ts:297. Referencias adicionales: edge: supabase/functions/whatsapp-cloud-retarget/index.ts:298.

SQL entrante por nombre: ninguno detectado. Triggers: ninguno detectado. Constraints: ninguna. Cron: ninguno identificado.

Mínimo propuesto: service_role y owner actuales; ejecución anidada bajo owner. No añadir acceso público. Tratamiento: Conservar modo de seguridad, cuerpos, grants necesarios y comportamiento. Auditar path antes de cualquier modificación. Riesgo del cambio: medio. Al revocar incorrectamente: Claims/envíos, reservas, contadores, redirect o cálculos internos indicados por consumidores/dependencias.

Evidencia del cuerpo: supabase/migrations/20260825172003_whatsapp_cloud_api_retarget_config.sql:450. MD5 de cuerpo: 3dc34ea3f27b040ea3ab5933118574ef. Tests/referencias de prueba: sin referencia nominal localizada; añadir matriz de roles y test de consumidor antes de modificar.

## F10 public.complete_purchase_event_claim(p_claim_id uuid, p_conversion_id uuid, p_status text)

Actual: SECURITY DEFINER; owner postgres; resultado void; settings ["search_path=public, pg_temp"]; EXECUTE postgres, service_role.

Consumidor/canal: backend service_role o función SQL interna. Llamadas SDK: edge: supabase/functions/conversions/index.ts:1301. Referencias adicionales: ninguna.

SQL entrante por nombre: ninguno detectado. Triggers: ninguno detectado. Constraints: ninguna. Cron: ninguno identificado.

Mínimo propuesto: service_role y owner actuales; ejecución anidada bajo owner. No añadir acceso público. Tratamiento: Conservar modo de seguridad, cuerpos, grants necesarios y comportamiento. Auditar path antes de cualquier modificación. Riesgo del cambio: medio. Al revocar incorrectamente: Claims/envíos, reservas, contadores, redirect o cálculos internos indicados por consumidores/dependencias.

Evidencia del cuerpo: supabase/migrations/20260728163000_purchase_event_atomic_claims.sql:130. MD5 de cuerpo: 68dd8c77b087176903461e614f8ef87a. Tests/referencias de prueba: sin referencia nominal localizada; añadir matriz de roles y test de consumidor antes de modificar.

## F11 public.consume_ai_assistant_quota(p_limit integer)

Actual: SECURITY INVOKER; owner postgres; resultado TABLE(allowed boolean, used integer, limit_count integer, remaining integer); settings null; EXECUTE anon, authenticated, postgres, PUBLIC, service_role.

Consumidor/canal: Next.js stats-assistant con JWT del usuario. Llamadas SDK: ninguna localizada. Referencias adicionales: backend: frontend/app/api/stats-assistant/route.ts:104.

SQL entrante por nombre: ninguno detectado. Triggers: ninguno detectado. Constraints: ninguna. Cron: ninguno identificado.

Mínimo propuesto: authenticated EXECUTE y operaciones propias vía RLS; no necesita PUBLIC/anon. Tratamiento: Conservar INVOKER y límite actual; retirar ACL redundantes tras prueba. Riesgo del cambio: medio. Al revocar incorrectamente: Asistente si se trata su backend como service_role o se pierde sesión.

Evidencia del cuerpo: supabase/migrations/20260427150000_ai_assistant_monthly_quota.sql:30. MD5 de cuerpo: 65f58fecd52ca3983084fd3526bc4632. Tests/referencias de prueba: sin referencia nominal localizada; añadir matriz de roles y test de consumidor antes de modificar.

## F12 public.cron_match_promotion_participants()

Actual: SECURITY DEFINER; owner postgres; resultado void; settings ["search_path=public"]; EXECUTE anon, authenticated, postgres, PUBLIC, service_role.

Consumidor/canal: cron postgres; operación manual interna por confirmar. Llamadas SDK: ninguna localizada. Referencias adicionales: ninguna.

SQL entrante por nombre: ninguno detectado. Triggers: ninguno detectado. Constraints: ninguna. Cron: promotion-match-backfill-hourly (postgres, active=true).

Mínimo propuesto: postgres ejecutor/owner; service_role sólo si se acredita invocador interno adicional. Tratamiento: S-M03: retirar PUBLIC, anon y authenticated; conservar DEFINER, cuerpo y schedule. Riesgo del cambio: medio. Al revocar incorrectamente: Invocación manual con un rol de cliente; job postgres debe seguir funcionando.

Evidencia del cuerpo: supabase/migrations/20260627183000_promotion_match_backfill_cron.sql:14. MD5 de cuerpo: 280764a6c1c19c558eb0f6ed4c61b5e3. Tests/referencias de prueba: sin referencia nominal localizada; añadir matriz de roles y test de consumidor antes de modificar.

## F13 public.cron_notify_inactive_contacts()

Actual: SECURITY DEFINER; owner postgres; resultado void; settings ["search_path=public"]; EXECUTE anon, authenticated, postgres, PUBLIC, service_role.

Consumidor/canal: cron postgres; operación manual interna por confirmar. Llamadas SDK: ninguna localizada. Referencias adicionales: ninguna.

SQL entrante por nombre: ninguno detectado. Triggers: ninguno detectado. Constraints: ninguna. Cron: notify-inactive-contacts-every-5-min (postgres, active=true).

Mínimo propuesto: postgres ejecutor/owner; service_role sólo si se acredita invocador interno adicional. Tratamiento: S-M03: retirar PUBLIC, anon y authenticated; conservar DEFINER, cuerpo y schedule. Riesgo del cambio: medio. Al revocar incorrectamente: Invocación manual con un rol de cliente; job postgres debe seguir funcionando.

Evidencia del cuerpo: supabase/migrations/20260326133000_notifications_module.sql:135. MD5 de cuerpo: 4013d989e5f0c31eb936a8459cb54aea. Tests/referencias de prueba: sin referencia nominal localizada; añadir matriz de roles y test de consumidor antes de modificar.

## F14 public.cron_process_due_promotions()

Actual: SECURITY DEFINER; owner postgres; resultado void; settings ["search_path=public"]; EXECUTE anon, authenticated, postgres, PUBLIC, service_role.

Consumidor/canal: cron postgres; operación manual interna por confirmar. Llamadas SDK: ninguna localizada. Referencias adicionales: ninguna.

SQL entrante por nombre: ninguno detectado. Triggers: ninguno detectado. Constraints: ninguna. Cron: promotion-draw-due-hourly (postgres, active=true).

Mínimo propuesto: postgres ejecutor/owner; service_role sólo si se acredita invocador interno adicional. Tratamiento: S-M03: retirar PUBLIC, anon y authenticated; conservar DEFINER, cuerpo y schedule. Riesgo del cambio: medio. Al revocar incorrectamente: Invocación manual con un rol de cliente; job postgres debe seguir funcionando.

Evidencia del cuerpo: supabase/migrations/20260502163000_promotions_due_cron.sql:3. MD5 de cuerpo: 8d6ca62f5175de3836745097952fd547. Tests/referencias de prueba: sin referencia nominal localizada; añadir matriz de roles y test de consumidor antes de modificar.

## F15 public.cron_reset_phone_operational_daily()

Actual: SECURITY DEFINER; owner postgres; resultado void; settings ["search_path=public"]; EXECUTE anon, authenticated, postgres, PUBLIC, service_role.

Consumidor/canal: cron postgres; operación manual interna por confirmar. Llamadas SDK: ninguna localizada. Referencias adicionales: ninguna.

SQL entrante por nombre: ninguno detectado. Triggers: ninguno detectado. Constraints: ninguna. Cron: reset-phone-operational-daily-argentina-midnight (postgres, active=true).

Mínimo propuesto: postgres ejecutor/owner; service_role sólo si se acredita invocador interno adicional. Tratamiento: S-M03: retirar PUBLIC, anon y authenticated; conservar DEFINER, cuerpo y schedule. Riesgo del cambio: medio. Al revocar incorrectamente: Invocación manual con un rol de cliente; job postgres debe seguir funcionando.

Evidencia del cuerpo: supabase/migrations/20260829013755_reset_scoped_phone_counters.sql:1. MD5 de cuerpo: e70bcb929d325477032ed4253391e1e2. Tests/referencias de prueba: sin referencia nominal localizada; añadir matriz de roles y test de consumidor antes de modificar.

## F16 public.cron_retry_failed_conversions()

Actual: SECURITY DEFINER; owner postgres; resultado void; settings ["search_path=public"]; EXECUTE anon, authenticated, postgres, PUBLIC, service_role.

Consumidor/canal: cron postgres; operación manual interna por confirmar. Llamadas SDK: ninguna localizada. Referencias adicionales: ninguna.

SQL entrante por nombre: ninguno detectado. Triggers: ninguno detectado. Constraints: ninguna. Cron: retry-failed-conversions (postgres, active=true).

Mínimo propuesto: postgres ejecutor/owner; service_role sólo si se acredita invocador interno adicional. Tratamiento: S-M03: retirar PUBLIC, anon y authenticated; conservar DEFINER, cuerpo y schedule. Riesgo del cambio: medio. Al revocar incorrectamente: Invocación manual con un rol de cliente; job postgres debe seguir funcionando.

Evidencia del cuerpo: supabase/migrations/20260416100003_cron_retry_conversions.sql:4. MD5 de cuerpo: 4b67e6cec3af16db3051380b26592a76. Tests/referencias de prueba: sin referencia nominal localizada; añadir matriz de roles y test de consumidor antes de modificar.

## F17 public.cron_retry_tracking_queue()

Actual: SECURITY DEFINER; owner postgres; resultado void; settings ["search_path=public"]; EXECUTE anon, authenticated, postgres, PUBLIC, service_role.

Consumidor/canal: cron postgres; operación manual interna por confirmar. Llamadas SDK: ninguna localizada. Referencias adicionales: ninguna.

SQL entrante por nombre: ninguno detectado. Triggers: ninguno detectado. Constraints: ninguna. Cron: tracking-retry-every-5m (postgres, active=true).

Mínimo propuesto: postgres ejecutor/owner; service_role sólo si se acredita invocador interno adicional. Tratamiento: S-M03: retirar PUBLIC, anon y authenticated; conservar DEFINER, cuerpo y schedule. Riesgo del cambio: medio. Al revocar incorrectamente: Invocación manual con un rol de cliente; job postgres debe seguir funcionando.

Evidencia del cuerpo: supabase/migrations/20260629190000_constructor_tracking_queue.sql:76. MD5 de cuerpo: 253448255c5580795e65a4e7d1612944. Tests/referencias de prueba: sin referencia nominal localizada; añadir matriz de roles y test de consumidor antes de modificar.

## F18 public.cron_sync_phones_all()

Actual: SECURITY DEFINER; owner postgres; resultado void; settings ["search_path=public"]; EXECUTE anon, authenticated, postgres, PUBLIC, service_role.

Consumidor/canal: cron postgres; operación manual interna por confirmar. Llamadas SDK: ninguna localizada. Referencias adicionales: ninguna.

SQL entrante por nombre: ninguno detectado. Triggers: ninguno detectado. Constraints: ninguna. Cron: sync-phones-every-5min (postgres, active=true).

Mínimo propuesto: postgres ejecutor/owner; service_role sólo si se acredita invocador interno adicional. Tratamiento: S-M03: retirar PUBLIC, anon y authenticated; conservar DEFINER, cuerpo y schedule. Riesgo del cambio: medio. Al revocar incorrectamente: Invocación manual con un rol de cliente; job postgres debe seguir funcionando.

Evidencia del cuerpo: supabase/migrations/20260305120000_cron_sync_phones.sql:59. MD5 de cuerpo: cfbb40068e8bcea6da0f8f5e884bc2bb. Tests/referencias de prueba: sin referencia nominal localizada; añadir matriz de roles y test de consumidor antes de modificar.

## F19 public.cron_sync_telegram_connections()

Actual: SECURITY DEFINER; owner postgres; resultado void; settings ["search_path=public"]; EXECUTE anon, authenticated, postgres, PUBLIC, service_role.

Consumidor/canal: cron postgres; operación manual interna por confirmar. Llamadas SDK: ninguna localizada. Referencias adicionales: ninguna.

SQL entrante por nombre: ninguno detectado. Triggers: ninguno detectado. Constraints: ninguna. Cron: ninguno identificado.

Mínimo propuesto: postgres ejecutor/owner; service_role sólo si se acredita invocador interno adicional. Tratamiento: S-M03: retirar PUBLIC, anon y authenticated; conservar DEFINER, cuerpo y schedule. Riesgo del cambio: medio. Al revocar incorrectamente: Invocación manual con un rol de cliente; job postgres debe seguir funcionando.

Evidencia del cuerpo: supabase/migrations/20260327234000_cron_sync_telegram_connections.sql:5. MD5 de cuerpo: 108ab760d46bee9ee9051fb9d0229bc8. Tests/referencias de prueba: sin referencia nominal localizada; añadir matriz de roles y test de consumidor antes de modificar.

## F20 public.cron_warm_landing_phone()

Actual: SECURITY DEFINER; owner postgres; resultado void; settings ["search_path=public"]; EXECUTE anon, authenticated, postgres, PUBLIC, service_role.

Consumidor/canal: cron postgres; operación manual interna por confirmar. Llamadas SDK: ninguna localizada. Referencias adicionales: ninguna.

SQL entrante por nombre: ninguno detectado. Triggers: ninguno detectado. Constraints: ninguna. Cron: warm-landing-phone-8am-2am (postgres, active=true).

Mínimo propuesto: postgres ejecutor/owner; service_role sólo si se acredita invocador interno adicional. Tratamiento: S-M03: retirar PUBLIC, anon y authenticated; conservar DEFINER, cuerpo y schedule. Riesgo del cambio: medio. Al revocar incorrectamente: Invocación manual con un rol de cliente; job postgres debe seguir funcionando.

Evidencia del cuerpo: supabase/migrations/20260812143000_landing_phone_demand_availability.sql:261. MD5 de cuerpo: 2856519c163d640adb4e3750c7e2876b. Tests/referencias de prueba: sin referencia nominal localizada; añadir matriz de roles y test de consumidor antes de modificar.

## F21 public.cron_whatsapp_cloud_api_health()

Actual: SECURITY DEFINER; owner postgres; resultado void; settings ["search_path=public"]; EXECUTE anon, authenticated, postgres, PUBLIC, service_role.

Consumidor/canal: cron postgres; operación manual interna por confirmar. Llamadas SDK: ninguna localizada. Referencias adicionales: ninguna.

SQL entrante por nombre: ninguno detectado. Triggers: ninguno detectado. Constraints: ninguna. Cron: whatsapp-cloud-api-health (postgres, active=true).

Mínimo propuesto: postgres ejecutor/owner; service_role sólo si se acredita invocador interno adicional. Tratamiento: S-M03: retirar PUBLIC, anon y authenticated; conservar DEFINER, cuerpo y schedule. Riesgo del cambio: medio. Al revocar incorrectamente: Invocación manual con un rol de cliente; job postgres debe seguir funcionando.

Evidencia del cuerpo: supabase/migrations/20260812113000_whatsapp_cloud_api_resilience_health.sql:381. MD5 de cuerpo: 44c4ec7c7519620842f2f8bd8075d4eb. Tests/referencias de prueba: sin referencia nominal localizada; añadir matriz de roles y test de consumidor antes de modificar.

## F22 public.cron_whatsapp_cloud_api_retarget()

Actual: SECURITY DEFINER; owner postgres; resultado void; settings ["search_path=public"]; EXECUTE anon, authenticated, postgres, PUBLIC, service_role.

Consumidor/canal: cron postgres; operación manual interna por confirmar. Llamadas SDK: ninguna localizada. Referencias adicionales: ninguna.

SQL entrante por nombre: ninguno detectado. Triggers: ninguno detectado. Constraints: ninguna. Cron: whatsapp-cloud-api-retarget (postgres, active=true).

Mínimo propuesto: postgres ejecutor/owner; service_role sólo si se acredita invocador interno adicional. Tratamiento: S-M03: retirar PUBLIC, anon y authenticated; conservar DEFINER, cuerpo y schedule. Riesgo del cambio: medio. Al revocar incorrectamente: Invocación manual con un rol de cliente; job postgres debe seguir funcionando.

Evidencia del cuerpo: supabase/migrations/20260822172211_whatsapp_cloud_api_retarget_cron.sql:277. MD5 de cuerpo: 05df8534fab0f8978ee2a4278cbde77d. Tests/referencias de prueba: sin referencia nominal localizada; añadir matriz de roles y test de consumidor antes de modificar.

## F23 public.cron_whatsapp_cloud_api_worker()

Actual: SECURITY DEFINER; owner postgres; resultado void; settings ["search_path=public"]; EXECUTE anon, authenticated, postgres, PUBLIC, service_role.

Consumidor/canal: cron postgres; operación manual interna por confirmar. Llamadas SDK: ninguna localizada. Referencias adicionales: ninguna.

SQL entrante por nombre: ninguno detectado. Triggers: ninguno detectado. Constraints: ninguna. Cron: whatsapp-cloud-api-worker (postgres, active=true).

Mínimo propuesto: postgres ejecutor/owner; service_role sólo si se acredita invocador interno adicional. Tratamiento: S-M03: retirar PUBLIC, anon y authenticated; conservar DEFINER, cuerpo y schedule. Riesgo del cambio: medio. Al revocar incorrectamente: Invocación manual con un rol de cliente; job postgres debe seguir funcionando.

Evidencia del cuerpo: supabase/migrations/20260812113000_whatsapp_cloud_api_resilience_health.sql:349. MD5 de cuerpo: 281d01ddef91f3f40ec291a7fb15984e. Tests/referencias de prueba: sin referencia nominal localizada; añadir matriz de roles y test de consumidor antes de modificar.

## F24 public.enforce_landing_plan_limit()

Actual: SECURITY INVOKER; owner postgres; resultado trigger; settings null; EXECUTE anon, authenticated, postgres, PUBLIC, service_role.

Consumidor/canal: trigger, no RPC público. Llamadas SDK: ninguna localizada. Referencias adicionales: ninguna.

SQL entrante por nombre: ninguno detectado. Triggers: public.landings.trg_enforce_landing_plan_limit. Constraints: ninguna. Cron: ninguno identificado.

Mínimo propuesto: owner y rol que crea/restaura el trigger; retirar grants de cliente redundantes sólo con DML probado. Tratamiento: Conservar SECURITY INVOKER y efectos del trigger. Evaluar path por firma; no cambiar owner en el primer lote. Riesgo del cambio: medio. Al revocar incorrectamente: DML o reconstrucción de triggers si se omiten privilegios de instalación/dependencias.

Evidencia del cuerpo: supabase/migrations/20260403110000_client_subscriptions_plans.sql:135. MD5 de cuerpo: d91ad1a798afd6f8deb9e42c98548362. Tests/referencias de prueba: sin referencia nominal localizada; añadir matriz de roles y test de consumidor antes de modificar.

## F25 public.enforce_whatsapp_cloud_api_assignment_workspace()

Actual: SECURITY DEFINER; owner postgres; resultado trigger; settings ["search_path=public, pg_temp"]; EXECUTE postgres, service_role.

Consumidor/canal: trigger, no RPC público. Llamadas SDK: ninguna localizada. Referencias adicionales: ninguna.

SQL entrante por nombre: ninguno detectado. Triggers: public.whatsapp_cloud_api_gerencias.trg_whatsapp_cloud_api_assignment_workspace. Constraints: ninguna. Cron: ninguno identificado.

Mínimo propuesto: owner y rol que crea/restaura el trigger; retirar grants de cliente redundantes sólo con DML probado. Tratamiento: Conservar SECURITY DEFINER y efectos del trigger. Evaluar path por firma; no cambiar owner en el primer lote. Riesgo del cambio: medio. Al revocar incorrectamente: DML o reconstrucción de triggers si se omiten privilegios de instalación/dependencias.

Evidencia del cuerpo: supabase/migrations/20260815173613_scope_whatsapp_cloud_api_config_by_workspace.sql:21. MD5 de cuerpo: 4e6af453ab77b44a52735ac170e0c9e1. Tests/referencias de prueba: sin referencia nominal localizada; añadir matriz de roles y test de consumidor antes de modificar.

## F26 public.extend_landing_phone_assignment_reservation(p_reservation_id uuid, p_landing_id uuid, p_phone_id bigint, p_phone text)

Actual: SECURITY INVOKER; owner postgres; resultado boolean; settings ["search_path=\"\""]; EXECUTE postgres, service_role.

Consumidor/canal: backend service_role o función SQL interna. Llamadas SDK: edge: supabase/functions/phone-click/index.ts:175. Referencias adicionales: ninguna.

SQL entrante por nombre: ninguno detectado. Triggers: ninguno detectado. Constraints: ninguna. Cron: ninguno identificado.

Mínimo propuesto: service_role y owner actuales; ejecución anidada bajo owner. No añadir acceso público. Tratamiento: Conservar modo de seguridad, cuerpos, grants necesarios y comportamiento. Auditar path antes de cualquier modificación. Riesgo del cambio: medio. Al revocar incorrectamente: Claims/envíos, reservas, contadores, redirect o cálculos internos indicados por consumidores/dependencias.

Evidencia del cuerpo: supabase/migrations/20260905012831_fair_message_assignment_reservations.sql:109. MD5 de cuerpo: dc89e987fc553a4dcd026849d5faf0b5. Tests/referencias de prueba: frontend/tests/phase0PhoneHandlers.test.ts:87; frontend/tests/phase0PhoneHandlers.test.ts:90.

## F27 public.get_atrio_for_landing(p_landing_name text)

Actual: SECURITY DEFINER; owner postgres; resultado jsonb; settings ["search_path=public, pg_temp"]; EXECUTE postgres, service_role.

Consumidor/canal: backend service_role o función SQL interna. Llamadas SDK: edge: supabase/functions/landing-atrio/index.ts:91. Referencias adicionales: edge: supabase/functions/landing-atrio/index.ts:95.

SQL entrante por nombre: ninguno detectado. Triggers: ninguno detectado. Constraints: ninguna. Cron: ninguno identificado.

Mínimo propuesto: service_role y owner actuales; ejecución anidada bajo owner. No añadir acceso público. Tratamiento: Conservar modo de seguridad, cuerpos, grants necesarios y comportamiento. Auditar path antes de cualquier modificación. Riesgo del cambio: medio. Al revocar incorrectamente: Claims/envíos, reservas, contadores, redirect o cálculos internos indicados por consumidores/dependencias.

Evidencia del cuerpo: supabase/migrations/20260822162110_landing_atrio_redirect_assignments.sql:286. MD5 de cuerpo: 198c5d29a25c6419d256d0261e5f1eb9. Tests/referencias de prueba: sin referencia nominal localizada; añadir matriz de roles y test de consumidor antes de modificar.

## F28 public.get_cached_constructor_landing_phone(p_landing_name text)

Actual: SECURITY DEFINER; owner postgres; resultado jsonb; settings ["search_path=public"]; EXECUTE anon, authenticated, postgres, service_role.

Consumidor/canal: SSR de landing con anon. Llamadas SDK: ninguna localizada. Referencias adicionales: backend: frontend/components/public-landing/getCachedLandingPhone.ts:18.

SQL entrante por nombre: ninguno detectado. Triggers: ninguno detectado. Constraints: ninguna. Cron: ninguno identificado.

Mínimo propuesto: anon EXECUTE actual, authenticated si participa en el mismo contrato, owner/backend actuales. Tratamiento: Mantener DEFINER para leer cache protegida; no revocar acceso anónimo que usa SSR. Riesgo del cambio: alto si se revoca. Al revocar incorrectamente: getCachedLandingPhone pierde teléfono inicial/cache.

Evidencia del cuerpo: supabase/migrations/20260614133000_cached_constructor_landing_phone_rpc.sql:1. MD5 de cuerpo: cd96516e60fb601049c68e2d4daa1d82. Tests/referencias de prueba: sin referencia nominal localizada; añadir matriz de roles y test de consumidor antes de modificar.

## F29 public.get_client_plan_limits(p_user_id uuid)

Actual: SECURITY INVOKER; owner postgres; resultado TABLE(plan_code text, max_landings integer, max_phones integer, status text, expires_at timestamp with time zone, grace_days integer); settings null; EXECUTE anon, authenticated, postgres, PUBLIC, service_role.

Consumidor/canal: helpers de planes, Edge/funciones anidadas. Llamadas SDK: ninguna localizada. Referencias adicionales: ninguna.

SQL entrante por nombre: ninguno detectado. Triggers: ninguno detectado. Constraints: ninguna. Cron: ninguno identificado.

Mínimo propuesto: authenticated/service_role según camino; anon y PUBLIC no retirar hasta acreditar callers indirectos y fallback público. Tratamiento: Conservar INVOKER y evaluación actual. No cambiar bloqueo ni cuotas. Riesgo del cambio: medio. Al revocar incorrectamente: Límites de planes, creación y carga pública según rol efectivo.

Evidencia del cuerpo: supabase/migrations/20260403110000_client_subscriptions_plans.sql:81. MD5 de cuerpo: 250cf7a30aff347fbcd67d6d9a319399. Tests/referencias de prueba: sin referencia nominal localizada; añadir matriz de roles y test de consumidor antes de modificar.

## F30 public.get_gerencia_availability_summaries(p_user_id uuid, p_start timestamp with time zone, p_end timestamp with time zone, p_workspace_currency text)

Actual: SECURITY DEFINER; owner postgres; resultado TABLE(gerencia_id integer, gerencia_external_id integer, label text, sample_count integer, active_sample_count integer, availability_pct numeric); settings ["search_path=public"]; EXECUTE anon, authenticated, postgres, PUBLIC, service_role.

Consumidor/canal: panel authenticated, propietario/admin. Llamadas SDK: frontend: frontend/lib/conversionsDb.ts:1686. Referencias adicionales: frontend: frontend/lib/conversionsDb.ts:1687.

SQL entrante por nombre: ninguno detectado. Triggers: ninguno detectado. Constraints: ninguna. Cron: ninguno identificado.

Mínimo propuesto: authenticated EXECUTE con autorización tenant; service_role sólo cuando el contrato admite principal de servicio; owner. Tratamiento: Conservar DEFINER, wrappers y resultados; mantener/corroborar guardas por overload. Eliminar PUBLIC/anon residual sólo donde existe. Riesgo del cambio: alto. Al revocar incorrectamente: Inicio, disponibilidad, inbox/configuración WhatsApp o marcados de lectura; cambios de INVOKER rompen acceso interno.

Evidencia del cuerpo: supabase/migrations/20260817233335_availability_summary_workspace_ids.sql:3. MD5 de cuerpo: f959c22b6d2f5be87e42ade8ea740577. Tests/referencias de prueba: sin referencia nominal localizada; añadir matriz de roles y test de consumidor antes de modificar.

## F31 public.get_home_overview_stats(p_user_id uuid, p_hidden_by uuid)

Actual: SECURITY DEFINER; owner postgres; resultado jsonb; settings ["search_path=public"]; EXECUTE anon, authenticated, postgres, PUBLIC, service_role.

Consumidor/canal: reporting legacy; sin llamada directa vigente identificada. Llamadas SDK: ninguna localizada. Referencias adicionales: frontend: frontend/lib/conversionsDb.ts:1644.

SQL entrante por nombre: ninguno detectado. Triggers: ninguno detectado. Constraints: ninguna. Cron: ninguno identificado.

Mínimo propuesto: authenticated con propietario/admin; postgres y backend acreditado. Ningún PUBLIC/anon. Tratamiento: S-M03: revocar acceso anónimo. Guardar resultados; evaluar guarda de principal nulo sólo como autorización. Riesgo del cambio: medio. Al revocar incorrectamente: Integradores legacy sin sesión aún no censados; frontend actual usa cached_by_currency.

Evidencia del cuerpo: supabase/migrations/20260514183000_home_overview_inferred_leads.sql:1. MD5 de cuerpo: 316fe4cb3672f1a79c0eb1f74951be64. Tests/referencias de prueba: sin referencia nominal localizada; añadir matriz de roles y test de consumidor antes de modificar.

## F32 public.get_home_overview_stats_by_currency(p_user_id uuid, p_hidden_by uuid, p_currency text)

Actual: SECURITY DEFINER; owner postgres; resultado jsonb; settings ["search_path=public"]; EXECUTE authenticated, postgres, service_role.

Consumidor/canal: panel authenticated, propietario/admin. Llamadas SDK: ninguna localizada. Referencias adicionales: ninguna.

SQL entrante por nombre: ninguno detectado. Triggers: ninguno detectado. Constraints: ninguna. Cron: ninguno identificado.

Mínimo propuesto: authenticated EXECUTE con autorización tenant; service_role sólo cuando el contrato admite principal de servicio; owner. Tratamiento: Conservar DEFINER, wrappers y resultados; mantener/corroborar guardas por overload. Eliminar PUBLIC/anon residual sólo donde existe. Riesgo del cambio: alto. Al revocar incorrectamente: Inicio, disponibilidad, inbox/configuración WhatsApp o marcados de lectura; cambios de INVOKER rompen acceso interno.

Evidencia del cuerpo: supabase/migrations/20260727223000_currency_scoped_reporting.sql:55. MD5 de cuerpo: e1fb7a3a705eadd21d59c5838b7869a9. Tests/referencias de prueba: sin referencia nominal localizada; añadir matriz de roles y test de consumidor antes de modificar.

## F33 public.get_home_overview_stats_cached_by_currency(p_user_id uuid, p_hidden_by uuid, p_currency text)

Actual: SECURITY DEFINER; owner postgres; resultado jsonb; settings ["search_path=public"]; EXECUTE authenticated, postgres, service_role.

Consumidor/canal: panel authenticated, propietario/admin. Llamadas SDK: frontend: frontend/lib/conversionsDb.ts:1644. Referencias adicionales: ninguna.

SQL entrante por nombre: ninguno detectado. Triggers: ninguno detectado. Constraints: ninguna. Cron: ninguno identificado.

Mínimo propuesto: authenticated EXECUTE con autorización tenant; service_role sólo cuando el contrato admite principal de servicio; owner. Tratamiento: Conservar DEFINER, wrappers y resultados; mantener/corroborar guardas por overload. Eliminar PUBLIC/anon residual sólo donde existe. Riesgo del cambio: alto. Al revocar incorrectamente: Inicio, disponibilidad, inbox/configuración WhatsApp o marcados de lectura; cambios de INVOKER rompen acceso interno.

Evidencia del cuerpo: supabase/migrations/20260819175021_home_overview_stats_cache_hourly.sql:332. MD5 de cuerpo: a86066b2991839ba802c5d9a3a7af9a5. Tests/referencias de prueba: sin referencia nominal localizada; añadir matriz de roles y test de consumidor antes de modificar.

## F34 public.get_meta_audience_buyers(p_currency text, p_start_at timestamp with time zone, p_end_at timestamp with time zone, p_purchase_scope text, p_value_metric text)

Actual: SECURITY INVOKER; owner postgres; resultado TABLE(customer_key text, phone text, email text, fn text, ln text, ct text, st text, zip text, country text, currency text, purchase_count bigint, first_purchase_count bigint, reload_count bigint, total_value numeric, average_purchase_value numeric, max_purchase_value numeric, first_purchase_at timestamp with time zone, last_purchase_at timestamp with time zone); settings ["search_path=\"\""]; EXECUTE authenticated, postgres, service_role.

Consumidor/canal: panel autenticado; versiones antiguas como compatibilidad. Llamadas SDK: ninguna localizada. Referencias adicionales: frontend: frontend/lib/metaAudienceDb.ts:59.

SQL entrante por nombre: ninguno detectado. Triggers: ninguno detectado. Constraints: ninguna. Cron: ninguno identificado.

Mínimo propuesto: authenticated y service_role actuales; owner. Mantener tablas base bajo RLS. Tratamiento: Conservar INVOKER/path vacío, firmas, percentiles, periodos y resultados; no eliminar overload/versiones legacy. Riesgo del cambio: alto si se revoca. Al revocar incorrectamente: Audiencias/CSV y clientes legacy.

Evidencia del cuerpo: supabase/migrations/20260911180712_speed_up_meta_audience_buyers_rpc.sql:5. MD5 de cuerpo: cb9b55214b770596a30ae03e53034852. Tests/referencias de prueba: sin referencia nominal localizada; añadir matriz de roles y test de consumidor antes de modificar.

## F35 public.get_meta_audience_buyers_v2(p_currency text, p_as_of timestamp with time zone, p_period_start_at timestamp with time zone, p_period_end_at timestamp with time zone)

Actual: SECURITY INVOKER; owner postgres; resultado TABLE(customer_key text, phone text, email text, fn text, ln text, ct text, st text, zip text, country text, currency text, historical_purchase_count bigint, historical_first_purchase_count bigint, historical_reload_count bigint, historical_total_value numeric, historical_average_purchase_value numeric, historical_max_purchase_value numeric, historical_first_purchase_value numeric, historical_first_purchase_at timestamp with time zone, last_historical_purchase_at timestamp with time zone, days_since_last_purchase bigint, period_purchase_count bigint, period_first_purchase_count bigint, period_reload_count bigint, period_total_value numeric, period_first_purchase_total_value numeric, period_reload_total_value numeric, period_average_purchase_value numeric, period_max_purchase_value numeric); settings ["search_path=\"\""]; EXECUTE authenticated, postgres, service_role.

Consumidor/canal: panel autenticado; versiones antiguas como compatibilidad. Llamadas SDK: ninguna localizada. Referencias adicionales: frontend: frontend/lib/metaAudienceDb.ts:59.

SQL entrante por nombre: public.get_meta_audience_buyers_v2_payload(p_currency text, p_as_of timestamp with time zone, p_period_start_at timestamp with time zone, p_period_end_at timestamp with time zone). Triggers: ninguno detectado. Constraints: ninguna. Cron: ninguno identificado.

Mínimo propuesto: authenticated y service_role actuales; owner. Mantener tablas base bajo RLS. Tratamiento: Conservar INVOKER/path vacío, firmas, percentiles, periodos y resultados; no eliminar overload/versiones legacy. Riesgo del cambio: alto si se revoca. Al revocar incorrectamente: Audiencias/CSV y clientes legacy.

Evidencia del cuerpo: supabase/migrations/20260911200034_meta_audience_buyers_v2.sql:6. MD5 de cuerpo: 4a39c88c96e3770ca28c2781ac291f22. Tests/referencias de prueba: sin referencia nominal localizada; añadir matriz de roles y test de consumidor antes de modificar.

## F36 public.get_meta_audience_buyers_v2_payload(p_currency text, p_as_of timestamp with time zone, p_period_start_at timestamp with time zone, p_period_end_at timestamp with time zone)

Actual: SECURITY INVOKER; owner postgres; resultado jsonb; settings ["search_path=\"\""]; EXECUTE authenticated, postgres, service_role.

Consumidor/canal: panel autenticado; versiones antiguas como compatibilidad. Llamadas SDK: frontend: frontend/lib/metaAudienceDb.ts:59. Referencias adicionales: ninguna.

SQL entrante por nombre: ninguno detectado. Triggers: ninguno detectado. Constraints: ninguna. Cron: ninguno identificado.

Mínimo propuesto: authenticated y service_role actuales; owner. Mantener tablas base bajo RLS. Tratamiento: Conservar INVOKER/path vacío, firmas, percentiles, periodos y resultados; no eliminar overload/versiones legacy. Riesgo del cambio: alto si se revoca. Al revocar incorrectamente: Audiencias/CSV y clientes legacy.

Evidencia del cuerpo: supabase/migrations/20260911201101_compact_meta_audience_buyers_v2_payload.sql:5. MD5 de cuerpo: 2c21755119f66066c5c80d25530d73d5. Tests/referencias de prueba: sin referencia nominal localizada; añadir matriz de roles y test de consumidor antes de modificar.

## F37 public.get_notification_bot_username()

Actual: SECURITY DEFINER; owner postgres; resultado text; settings ["search_path=public"]; EXECUTE anon, authenticated, postgres, PUBLIC, service_role.

Consumidor/canal: panel de notificaciones. Llamadas SDK: frontend: frontend/lib/notificationsDb.ts:69. Referencias adicionales: ninguna.

SQL entrante por nombre: ninguno detectado. Triggers: ninguno detectado. Constraints: ninguna. Cron: ninguno identificado.

Mínimo propuesto: authenticated EXECUTE; anon pendiente de confirmar links/clientes públicos; mantener owner/backend. Tratamiento: Conservar DEFINER y salida username; no conceder SELECT del token del bot. Riesgo del cambio: bajo/medio. Al revocar incorrectamente: Obtención de nombre público del bot en panel/integraciones externas.

Evidencia del cuerpo: supabase/migrations/20260326133000_notifications_module.sql:176. MD5 de cuerpo: 37dec63dbf31b49a0c8cd3c9a7e5db9c. Tests/referencias de prueba: sin referencia nominal localizada; añadir matriz de roles y test de consumidor antes de modificar.

## F38 public.get_phone_for_chatrace_client(p_client_name text)

Actual: SECURITY DEFINER; owner postgres; resultado jsonb; settings ["search_path=public"]; EXECUTE anon, authenticated, postgres, PUBLIC, service_role.

Consumidor/canal: Edge landing-phone y posibles clientes directos legacy. Llamadas SDK: ninguna localizada. Referencias adicionales: edge: supabase/functions/landing-phone/index.ts:263.

SQL entrante por nombre: ninguno detectado. Triggers: ninguno detectado. Constraints: ninguna. Cron: ninguno identificado.

Mínimo propuesto: service_role acreditado; conservar anon/authenticated hasta cerrar consumidores directos; mínimo final pendiente. Tratamiento: No cambiar asignación/reserva. PUBLIC puede retirarse sólo sustituyendo primero por grants explícitos de roles legítimos. Riesgo del cambio: alto. Al revocar incorrectamente: RPC directo y fallback de landing si se revoca antes del censo.

Evidencia del cuerpo: sin match directo del extractor; hash coincide con catálogo remoto acreditado de Fase 0; requiere revisar transformaciones/capa antes de DDL. MD5 de cuerpo: 3c67f01f5e3dbf3fe3078a47669c70cc. Tests/referencias de prueba: sin referencia nominal localizada; añadir matriz de roles y test de consumidor antes de modificar.

## F39 public.get_phone_for_landing(p_landing_name text)

Actual: SECURITY DEFINER; owner postgres; resultado jsonb; settings ["search_path=\"\""]; EXECUTE anon, authenticated, postgres, PUBLIC, service_role.

Consumidor/canal: Edge landing-phone y posibles clientes directos legacy. Llamadas SDK: ninguna localizada. Referencias adicionales: edge: supabase/functions/landing-phone/index.ts:109; edge: supabase/functions/landing-phone/index.ts:264.

SQL entrante por nombre: public.refresh_constructor_landing_phone_cache(); public.get_phone_for_landing(p_landing_name text). Triggers: ninguno detectado. Constraints: ninguna. Cron: ninguno identificado.

Mínimo propuesto: service_role acreditado; conservar anon/authenticated hasta cerrar consumidores directos; mínimo final pendiente. Tratamiento: No cambiar asignación/reserva. PUBLIC puede retirarse sólo sustituyendo primero por grants explícitos de roles legítimos. Riesgo del cambio: alto. Al revocar incorrectamente: RPC directo y fallback de landing si se revoca antes del censo.

Evidencia del cuerpo: supabase/migrations/20260905012831_fair_message_assignment_reservations.sql:509. MD5 de cuerpo: 0616b0126da59b5984cdd4e1e8769ae3. Tests/referencias de prueba: frontend/tests/phase0PhoneHandlers.test.ts:61; frontend/tests/phase0PhoneHandlers.test.ts:70; frontend/tests/phase0PhoneHandlers.test.ts:78; frontend/tests/phase0PhoneHandlers.test.ts:79.

## F40 public.get_phone_for_landing(p_landing_name text, p_create_reservation boolean)

Actual: SECURITY DEFINER; owner postgres; resultado jsonb; settings ["search_path=public"]; EXECUTE postgres, service_role.

Consumidor/canal: backend service_role o función SQL interna. Llamadas SDK: ninguna localizada. Referencias adicionales: edge: supabase/functions/landing-phone/index.ts:109; edge: supabase/functions/landing-phone/index.ts:264.

SQL entrante por nombre: public.refresh_constructor_landing_phone_cache(); public.get_phone_for_landing(p_landing_name text). Triggers: ninguno detectado. Constraints: ninguna. Cron: ninguno identificado.

Mínimo propuesto: service_role y owner actuales; ejecución anidada bajo owner. No añadir acceso público. Tratamiento: Conservar modo de seguridad, cuerpos, grants necesarios y comportamiento. Auditar path antes de cualquier modificación. Riesgo del cambio: medio. Al revocar incorrectamente: Claims/envíos, reservas, contadores, redirect o cálculos internos indicados por consumidores/dependencias.

Evidencia del cuerpo: supabase/migrations/20260905012831_fair_message_assignment_reservations.sql:198. MD5 de cuerpo: 78f4d47add31bb52c9014fcc25d9a75e. Tests/referencias de prueba: frontend/tests/phase0PhoneHandlers.test.ts:61; frontend/tests/phase0PhoneHandlers.test.ts:70; frontend/tests/phase0PhoneHandlers.test.ts:78; frontend/tests/phase0PhoneHandlers.test.ts:79.

## F41 public.get_phone_for_whatsapp_cloud_api(p_config_id uuid)

Actual: SECURITY DEFINER; owner postgres; resultado jsonb; settings ["search_path=public, pg_temp"]; EXECUTE postgres, service_role.

Consumidor/canal: backend service_role o función SQL interna. Llamadas SDK: edge: supabase/functions/whatsapp-cloud-worker/index.ts:794. Referencias adicionales: edge: supabase/functions/whatsapp-cloud-worker/index.ts:795.

SQL entrante por nombre: ninguno detectado. Triggers: ninguno detectado. Constraints: ninguna. Cron: ninguno identificado.

Mínimo propuesto: service_role y owner actuales; ejecución anidada bajo owner. No añadir acceso público. Tratamiento: Conservar modo de seguridad, cuerpos, grants necesarios y comportamiento. Auditar path antes de cualquier modificación. Riesgo del cambio: medio. Al revocar incorrectamente: Claims/envíos, reservas, contadores, redirect o cálculos internos indicados por consumidores/dependencias.

Evidencia del cuerpo: sin match directo del extractor; hash coincide con catálogo remoto acreditado de Fase 0; requiere revisar transformaciones/capa antes de DDL. MD5 de cuerpo: faa946180acda9b6ab4e45d6ca55fa1c. Tests/referencias de prueba: sin referencia nominal localizada; añadir matriz de roles y test de consumidor antes de modificar.

## F42 public.get_public_landing_routing()

Actual: SECURITY DEFINER; owner postgres; resultado TABLE(public_landing_runtime text, public_landing_legacy_base_url text); settings ["search_path=public"]; EXECUTE anon, authenticated, postgres, service_role.

Consumidor/canal: routing público por contrato histórico; consumidor externo/legacy pendiente. Llamadas SDK: ninguna localizada. Referencias adicionales: ninguna.

SQL entrante por nombre: ninguno detectado. Triggers: ninguno detectado. Constraints: ninguna. Cron: ninguno identificado.

Mínimo propuesto: anon/authenticated EXECUTE explícito; no acceso directo ampliado a settings. Tratamiento: Mantener DEFINER y proyección limitada; no retirar por ausencia de llamada local. Riesgo del cambio: alto si se revoca. Al revocar incorrectamente: Routing/fallback de landing de consumidores antiguos.

Evidencia del cuerpo: supabase/migrations/20260613090000_public_landing_runtime_switch.sql:24. MD5 de cuerpo: d7855aa74ecb82bcf073ccd28669fba9. Tests/referencias de prueba: sin referencia nominal localizada; añadir matriz de roles y test de consumidor antes de modificar.

## F43 public.get_whatsapp_cloud_api_config(p_user_id uuid)

Actual: SECURITY DEFINER; owner postgres; resultado TABLE(id uuid, user_id uuid, name text, active boolean, workspace_currency text, phone_number_id text, whatsapp_business_account_id text, display_phone_number text, meta_access_token text, meta_app_secret text, has_meta_access_token boolean, has_meta_app_secret boolean, meta_api_version text, webhook_verify_token text, meta_messaging_dataset_id text, enrich_business_messaging_user_data boolean, send_business_messaging_purchase_type_capi boolean, retargeting_enabled boolean, retarget_message_template text, retarget_delay_minutes integer, landing_tag text, gerencia_selection_mode text, gerencia_fair_criterion text, send_contact_capi boolean, redirect_message_template text, fallback_message_template text, redirect_use_cta_button boolean, redirect_cta_button_title text, phone_number_status text, quality_rating text, messaging_limit_tier text, health_checked_at timestamp with time zone, health_last_error text, created_at timestamp with time zone, updated_at timestamp with time zone); settings ["search_path=public, pg_temp"]; EXECUTE authenticated, postgres, service_role.

Consumidor/canal: panel authenticated, propietario/admin. Llamadas SDK: frontend: frontend/lib/whatsappCloudApiDb.ts:140. Referencias adicionales: ninguna.

SQL entrante por nombre: public.get_whatsapp_cloud_api_config(p_user_id uuid). Triggers: ninguno detectado. Constraints: ninguna. Cron: ninguno identificado.

Mínimo propuesto: authenticated EXECUTE con autorización tenant; service_role sólo cuando el contrato admite principal de servicio; owner. Tratamiento: Conservar DEFINER, wrappers y resultados; mantener/corroborar guardas por overload. Eliminar PUBLIC/anon residual sólo donde existe. Riesgo del cambio: alto. Al revocar incorrectamente: Inicio, disponibilidad, inbox/configuración WhatsApp o marcados de lectura; cambios de INVOKER rompen acceso interno.

Evidencia del cuerpo: supabase/migrations/20260815173613_scope_whatsapp_cloud_api_config_by_workspace.sql:180; supabase/migrations/20260821193606_whatsapp_cloud_api_user_data_enrichment_switch.sql:120; supabase/migrations/20260822004552_whatsapp_cloud_api_business_messaging_purchase_type_switch.sql:122; supabase/migrations/20260822192456_whatsapp_cloud_api_retargeting_switch.sql:118; supabase/migrations/20260825172003_whatsapp_cloud_api_retarget_config.sql:150. MD5 de cuerpo: f09f04b8b53586e3d17c05d9b7a499ae. Tests/referencias de prueba: sin referencia nominal localizada; añadir matriz de roles y test de consumidor antes de modificar.

## F44 public.get_whatsapp_cloud_api_config(p_user_id uuid, p_workspace_currency text)

Actual: SECURITY DEFINER; owner postgres; resultado TABLE(id uuid, user_id uuid, name text, active boolean, workspace_currency text, phone_number_id text, whatsapp_business_account_id text, display_phone_number text, meta_access_token text, meta_app_secret text, has_meta_access_token boolean, has_meta_app_secret boolean, meta_api_version text, webhook_verify_token text, meta_messaging_dataset_id text, enrich_business_messaging_user_data boolean, send_business_messaging_purchase_type_capi boolean, retargeting_enabled boolean, retarget_message_template text, retarget_delay_minutes integer, landing_tag text, gerencia_selection_mode text, gerencia_fair_criterion text, send_contact_capi boolean, redirect_message_template text, fallback_message_template text, redirect_use_cta_button boolean, redirect_cta_button_title text, phone_number_status text, quality_rating text, messaging_limit_tier text, health_checked_at timestamp with time zone, health_last_error text, created_at timestamp with time zone, updated_at timestamp with time zone); settings ["search_path=public, pg_temp"]; EXECUTE authenticated, postgres, service_role.

Consumidor/canal: panel authenticated, propietario/admin. Llamadas SDK: frontend: frontend/lib/whatsappCloudApiDb.ts:140. Referencias adicionales: ninguna.

SQL entrante por nombre: public.get_whatsapp_cloud_api_config(p_user_id uuid). Triggers: ninguno detectado. Constraints: ninguna. Cron: ninguno identificado.

Mínimo propuesto: authenticated EXECUTE con autorización tenant; service_role sólo cuando el contrato admite principal de servicio; owner. Tratamiento: Conservar DEFINER, wrappers y resultados; mantener/corroborar guardas por overload. Eliminar PUBLIC/anon residual sólo donde existe. Riesgo del cambio: alto. Al revocar incorrectamente: Inicio, disponibilidad, inbox/configuración WhatsApp o marcados de lectura; cambios de INVOKER rompen acceso interno.

Evidencia del cuerpo: supabase/migrations/20260825172003_whatsapp_cloud_api_retarget_config.sql:38. MD5 de cuerpo: d878831c0ec9a954c8f121669e14d5c6. Tests/referencias de prueba: sin referencia nominal localizada; añadir matriz de roles y test de consumidor antes de modificar.

## F45 public.get_whatsapp_cloud_api_contacts_page(p_limit integer, p_offset integer, p_workspace_currency text)

Actual: SECURITY DEFINER; owner postgres; resultado TABLE(contact_id uuid, config_id uuid, config_name text, wa_id text, phone text, profile_name text, last_message_at timestamp with time zone, tag text, total_contacts bigint); settings ["search_path=public, pg_temp"]; EXECUTE authenticated, postgres, service_role.

Consumidor/canal: panel authenticated, propietario/admin. Llamadas SDK: frontend: frontend/lib/whatsappCloudApiDb.ts:883. Referencias adicionales: frontend: frontend/lib/whatsappCloudApiDb.ts:884; frontend: frontend/lib/whatsappCloudApiDb.ts:893.

SQL entrante por nombre: ninguno detectado. Triggers: ninguno detectado. Constraints: ninguna. Cron: ninguno identificado.

Mínimo propuesto: authenticated EXECUTE con autorización tenant; service_role sólo cuando el contrato admite principal de servicio; owner. Tratamiento: Conservar DEFINER, wrappers y resultados; mantener/corroborar guardas por overload. Eliminar PUBLIC/anon residual sólo donde existe. Riesgo del cambio: alto. Al revocar incorrectamente: Inicio, disponibilidad, inbox/configuración WhatsApp o marcados de lectura; cambios de INVOKER rompen acceso interno.

Evidencia del cuerpo: sin match directo del extractor; hash coincide con catálogo remoto acreditado de Fase 0; requiere revisar transformaciones/capa antes de DDL. MD5 de cuerpo: ed79a60a3d78080022a3fcc49c146265. Tests/referencias de prueba: sin referencia nominal localizada; añadir matriz de roles y test de consumidor antes de modificar.

## F46 public.get_whatsapp_cloud_api_inbox_threads(p_limit integer, p_workspace_currency text)

Actual: SECURITY DEFINER; owner postgres; resultado TABLE(contact_id uuid, config_id uuid, config_name text, user_id uuid, wa_id text, phone text, profile_name text, first_message_at timestamp with time zone, last_message_at timestamp with time zone, last_message_text text, last_message_direction text, last_message_status text, assigned_phone text, assigned_gerencia_id integer, assigned_gerencia_label text, promo_code text, ctwa_clid text, source_url text, source_type text, headline text, conversion_id uuid, lead_count integer, purchase_count integer, repeat_purchase_count integer, total_loaded numeric, last_purchase_at timestamp with time zone, tag text, redirect_clicked boolean, redirect_click_count integer, redirect_last_clicked_at timestamp with time zone, unread_count integer, unread_last_message_at timestamp with time zone, messages jsonb); settings ["search_path=public, pg_temp"]; EXECUTE authenticated, postgres, service_role.

Consumidor/canal: panel authenticated, propietario/admin. Llamadas SDK: ninguna localizada. Referencias adicionales: frontend: frontend/lib/whatsappCloudApiDb.ts:776; frontend: frontend/lib/whatsappCloudApiDb.ts:789.

SQL entrante por nombre: ninguno detectado. Triggers: ninguno detectado. Constraints: ninguna. Cron: ninguno identificado.

Mínimo propuesto: authenticated EXECUTE con autorización tenant; service_role sólo cuando el contrato admite principal de servicio; owner. Tratamiento: Conservar DEFINER, wrappers y resultados; mantener/corroborar guardas por overload. Eliminar PUBLIC/anon residual sólo donde existe. Riesgo del cambio: alto. Al revocar incorrectamente: Inicio, disponibilidad, inbox/configuración WhatsApp o marcados de lectura; cambios de INVOKER rompen acceso interno.

Evidencia del cuerpo: supabase/migrations/20260818134748_whatsapp_cloud_api_contact_on_redirect.sql:76. MD5 de cuerpo: 411507000b579833c0ce81268046c9ad. Tests/referencias de prueba: sin referencia nominal localizada; añadir matriz de roles y test de consumidor antes de modificar.

## F47 public.get_whatsapp_cloud_api_inbox_threads_page(p_limit integer, p_offset integer, p_workspace_currency text)

Actual: SECURITY DEFINER; owner postgres; resultado TABLE(contact_id uuid, config_id uuid, config_name text, user_id uuid, wa_id text, phone text, profile_name text, first_message_at timestamp with time zone, last_message_at timestamp with time zone, last_message_text text, last_message_direction text, last_message_status text, assigned_phone text, assigned_gerencia_id integer, assigned_gerencia_label text, promo_code text, ctwa_clid text, source_url text, source_type text, headline text, conversion_id uuid, lead_count integer, purchase_count integer, repeat_purchase_count integer, total_loaded numeric, last_purchase_at timestamp with time zone, tag text, redirect_clicked boolean, redirect_click_count integer, redirect_last_clicked_at timestamp with time zone, unread_count integer, unread_last_message_at timestamp with time zone, messages jsonb); settings ["search_path=public, pg_temp"]; EXECUTE authenticated, postgres, service_role.

Consumidor/canal: panel authenticated, propietario/admin. Llamadas SDK: frontend: frontend/lib/whatsappCloudApiDb.ts:775. Referencias adicionales: frontend: frontend/lib/whatsappCloudApiDb.ts:776; frontend: frontend/lib/whatsappCloudApiDb.ts:789.

SQL entrante por nombre: ninguno detectado. Triggers: ninguno detectado. Constraints: ninguna. Cron: ninguno identificado.

Mínimo propuesto: authenticated EXECUTE con autorización tenant; service_role sólo cuando el contrato admite principal de servicio; owner. Tratamiento: Conservar DEFINER, wrappers y resultados; mantener/corroborar guardas por overload. Eliminar PUBLIC/anon residual sólo donde existe. Riesgo del cambio: alto. Al revocar incorrectamente: Inicio, disponibilidad, inbox/configuración WhatsApp o marcados de lectura; cambios de INVOKER rompen acceso interno.

Evidencia del cuerpo: sin match directo del extractor; hash coincide con catálogo remoto acreditado de Fase 0; requiere revisar transformaciones/capa antes de DDL. MD5 de cuerpo: ab346e501d0e9405703410d969225c1d. Tests/referencias de prueba: sin referencia nominal localizada; añadir matriz de roles y test de consumidor antes de modificar.

## F48 public.get_whatsapp_cloud_api_inbox_threads_page(p_limit integer, p_offset integer, p_workspace_currency text, p_tag_filter text, p_unread_only boolean)

Actual: SECURITY DEFINER; owner postgres; resultado TABLE(contact_id uuid, config_id uuid, config_name text, user_id uuid, wa_id text, phone text, profile_name text, first_message_at timestamp with time zone, last_message_at timestamp with time zone, last_message_text text, last_message_direction text, last_message_status text, assigned_phone text, assigned_gerencia_id integer, assigned_gerencia_label text, promo_code text, ctwa_clid text, source_url text, source_type text, headline text, conversion_id uuid, lead_count integer, purchase_count integer, repeat_purchase_count integer, total_loaded numeric, last_purchase_at timestamp with time zone, tag text, redirect_clicked boolean, redirect_click_count integer, redirect_last_clicked_at timestamp with time zone, unread_count integer, unread_last_message_at timestamp with time zone, messages jsonb, total_threads bigint); settings ["search_path=public, pg_temp"]; EXECUTE authenticated, postgres, service_role.

Consumidor/canal: panel authenticated, propietario/admin. Llamadas SDK: frontend: frontend/lib/whatsappCloudApiDb.ts:775. Referencias adicionales: frontend: frontend/lib/whatsappCloudApiDb.ts:776; frontend: frontend/lib/whatsappCloudApiDb.ts:789.

SQL entrante por nombre: ninguno detectado. Triggers: ninguno detectado. Constraints: ninguna. Cron: ninguno identificado.

Mínimo propuesto: authenticated EXECUTE con autorización tenant; service_role sólo cuando el contrato admite principal de servicio; owner. Tratamiento: Conservar DEFINER, wrappers y resultados; mantener/corroborar guardas por overload. Eliminar PUBLIC/anon residual sólo donde existe. Riesgo del cambio: alto. Al revocar incorrectamente: Inicio, disponibilidad, inbox/configuración WhatsApp o marcados de lectura; cambios de INVOKER rompen acceso interno.

Evidencia del cuerpo: supabase/migrations/20260823202650_fix_wca_retarget_inbox_filters.sql:311. MD5 de cuerpo: 64967808143dfc90ebec553744cf3f58. Tests/referencias de prueba: sin referencia nominal localizada; añadir matriz de roles y test de consumidor antes de modificar.

## F49 public.get_whatsapp_cloud_api_inbox_threads_page(p_limit integer, p_offset integer, p_workspace_currency text, p_tag_filter text, p_unread_only boolean, p_from timestamp with time zone, p_to timestamp with time zone)

Actual: SECURITY DEFINER; owner postgres; resultado TABLE(contact_id uuid, config_id uuid, config_name text, user_id uuid, wa_id text, phone text, profile_name text, first_message_at timestamp with time zone, last_message_at timestamp with time zone, last_message_text text, last_message_direction text, last_message_status text, assigned_phone text, assigned_gerencia_id integer, assigned_gerencia_label text, promo_code text, ctwa_clid text, source_url text, source_type text, headline text, conversion_id uuid, lead_count integer, purchase_count integer, repeat_purchase_count integer, total_loaded numeric, last_purchase_at timestamp with time zone, tag text, redirect_clicked boolean, redirect_click_count integer, redirect_last_clicked_at timestamp with time zone, unread_count integer, unread_last_message_at timestamp with time zone, messages jsonb, total_threads bigint); settings ["search_path=public, pg_temp"]; EXECUTE authenticated, postgres, service_role.

Consumidor/canal: panel authenticated, propietario/admin. Llamadas SDK: frontend: frontend/lib/whatsappCloudApiDb.ts:775. Referencias adicionales: frontend: frontend/lib/whatsappCloudApiDb.ts:776; frontend: frontend/lib/whatsappCloudApiDb.ts:789.

SQL entrante por nombre: ninguno detectado. Triggers: ninguno detectado. Constraints: ninguna. Cron: ninguno identificado.

Mínimo propuesto: authenticated EXECUTE con autorización tenant; service_role sólo cuando el contrato admite principal de servicio; owner. Tratamiento: Conservar DEFINER, wrappers y resultados; mantener/corroborar guardas por overload. Eliminar PUBLIC/anon residual sólo donde existe. Riesgo del cambio: alto. Al revocar incorrectamente: Inicio, disponibilidad, inbox/configuración WhatsApp o marcados de lectura; cambios de INVOKER rompen acceso interno.

Evidencia del cuerpo: supabase/migrations/20260825192821_whatsapp_cloud_api_inbox_date_filter.sql:1. MD5 de cuerpo: 793e4ed5e583d31ce9c63857d83649d9. Tests/referencias de prueba: sin referencia nominal localizada; añadir matriz de roles y test de consumidor antes de modificar.

## F50 public.handle_new_user()

Actual: SECURITY DEFINER; owner postgres; resultado trigger; settings ["search_path=public"]; EXECUTE postgres, service_role.

Consumidor/canal: trigger, no RPC público. Llamadas SDK: ninguna localizada. Referencias adicionales: ninguna.

SQL entrante por nombre: ninguno detectado. Triggers: auth.users.on_auth_user_created. Constraints: ninguna. Cron: ninguno identificado.

Mínimo propuesto: owner y rol que crea/restaura el trigger; retirar grants de cliente redundantes sólo con DML probado. Tratamiento: Conservar SECURITY DEFINER y efectos del trigger. Evaluar path por firma; no cambiar owner en el primer lote. Riesgo del cambio: medio. Al revocar incorrectamente: DML o reconstrucción de triggers si se omiten privilegios de instalación/dependencias.

Evidencia del cuerpo: supabase/migrations/20260902154745_admin_signup_approvals.sql:48. MD5 de cuerpo: 163e988752675aa06f2eae46f3377b2b. Tests/referencias de prueba: sin referencia nominal localizada; añadir matriz de roles y test de consumidor antes de modificar.

## F51 public.increment_atrio_assignment_scope_usage(p_atrio_client_id uuid, p_scope_type text, p_scope_id uuid, p_user_id uuid)

Actual: SECURITY DEFINER; owner postgres; resultado void; settings ["search_path=public, pg_temp"]; EXECUTE postgres, service_role.

Consumidor/canal: backend service_role o función SQL interna. Llamadas SDK: edge: supabase/functions/atrio-click/index.ts:83. Referencias adicionales: edge: supabase/functions/atrio-click/index.ts:84.

SQL entrante por nombre: ninguno detectado. Triggers: ninguno detectado. Constraints: ninguna. Cron: ninguno identificado.

Mínimo propuesto: service_role y owner actuales; ejecución anidada bajo owner. No añadir acceso público. Tratamiento: Conservar modo de seguridad, cuerpos, grants necesarios y comportamiento. Auditar path antes de cualquier modificación. Riesgo del cambio: medio. Al revocar incorrectamente: Claims/envíos, reservas, contadores, redirect o cálculos internos indicados por consumidores/dependencias.

Evidencia del cuerpo: supabase/migrations/20260822162110_landing_atrio_redirect_assignments.sql:225. MD5 de cuerpo: c60823d59d3fb5c69dc3b1347f39079d. Tests/referencias de prueba: sin referencia nominal localizada; añadir matriz de roles y test de consumidor antes de modificar.

## F52 public.increment_gerencia_phone_usage(p_phone_id bigint)

Actual: SECURITY DEFINER; owner postgres; resultado void; settings ["search_path=public, pg_temp"]; EXECUTE postgres, service_role.

Consumidor/canal: backend service_role o función SQL interna. Llamadas SDK: ninguna localizada. Referencias adicionales: ninguna.

SQL entrante por nombre: ninguno detectado. Triggers: ninguno detectado. Constraints: ninguna. Cron: ninguno identificado.

Mínimo propuesto: service_role y owner actuales; ejecución anidada bajo owner. No añadir acceso público. Tratamiento: Conservar modo de seguridad, cuerpos, grants necesarios y comportamiento. Auditar path antes de cualquier modificación. Riesgo del cambio: medio. Al revocar incorrectamente: Claims/envíos, reservas, contadores, redirect o cálculos internos indicados por consumidores/dependencias.

Evidencia del cuerpo: supabase/migrations/20260810181000_whatsapp_cloud_api_increment_phone_usage.sql:4. MD5 de cuerpo: 2ba6b6f4b4fa061c0a58d927d40407fb. Tests/referencias de prueba: sin referencia nominal localizada; añadir matriz de roles y test de consumidor antes de modificar.

## F53 public.increment_phone_assignment_scope_usage(p_phone_id bigint, p_scope_type text, p_scope_id uuid, p_user_id uuid, p_gerencia_id integer)

Actual: SECURITY DEFINER; owner postgres; resultado void; settings ["search_path=public, pg_temp"]; EXECUTE postgres, service_role.

Consumidor/canal: backend service_role o función SQL interna. Llamadas SDK: edge: supabase/functions/landing-phone/index.ts:69; edge: supabase/functions/phone-click/index.ts:184; edge: supabase/functions/whatsapp-cloud-worker/index.ts:977. Referencias adicionales: edge: supabase/functions/phone-click/index.ts:185; edge: supabase/functions/whatsapp-cloud-worker/index.ts:978.

SQL entrante por nombre: ninguno detectado. Triggers: ninguno detectado. Constraints: ninguna. Cron: ninguno identificado.

Mínimo propuesto: service_role y owner actuales; ejecución anidada bajo owner. No añadir acceso público. Tratamiento: Conservar modo de seguridad, cuerpos, grants necesarios y comportamiento. Auditar path antes de cualquier modificación. Riesgo del cambio: medio. Al revocar incorrectamente: Claims/envíos, reservas, contadores, redirect o cálculos internos indicados por consumidores/dependencias.

Evidencia del cuerpo: supabase/migrations/20260821232500_scoped_phone_assignment_metrics.sql:87. MD5 de cuerpo: 99c8c45f69529b31c1a4c3c565eaf578. Tests/referencias de prueba: frontend/tests/phase0PhoneHandlers.test.ts:89; frontend/tests/phase0PhoneHandlers.test.ts:91.

## F54 public.invalidate_landing_phone_cache_for_assignment_role()

Actual: SECURITY DEFINER; owner postgres; resultado trigger; settings ["search_path=public, pg_temp"]; EXECUTE anon, authenticated, postgres, PUBLIC, service_role.

Consumidor/canal: trigger, no RPC público. Llamadas SDK: ninguna localizada. Referencias adicionales: ninguna.

SQL entrante por nombre: ninguno detectado. Triggers: public.gerencia_phones.gerencia_phones_assignment_role_cache_invalidation. Constraints: ninguna. Cron: ninguno identificado.

Mínimo propuesto: owner y rol que crea/restaura el trigger; retirar grants de cliente redundantes sólo con DML probado. Tratamiento: Conservar SECURITY DEFINER y efectos del trigger. Evaluar path por firma; no cambiar owner en el primer lote. Riesgo del cambio: medio. Al revocar incorrectamente: DML o reconstrucción de triggers si se omiten privilegios de instalación/dependencias.

Evidencia del cuerpo: supabase/migrations/20260811120000_gerencia_phone_assignment_role.sql:133. MD5 de cuerpo: f534ad18bd8f3eed2a62d0e16a7236c6. Tests/referencias de prueba: sin referencia nominal localizada; añadir matriz de roles y test de consumidor antes de modificar.

## F55 public.is_client_access_blocked(p_user_id uuid)

Actual: SECURITY INVOKER; owner postgres; resultado boolean; settings null; EXECUTE anon, authenticated, postgres, PUBLIC, service_role.

Consumidor/canal: helpers de planes, Edge/funciones anidadas. Llamadas SDK: edge: supabase/functions/landing-atrio/index.ts:77; edge: supabase/functions/landing-phone/index.ts:199. Referencias adicionales: edge: supabase/functions/landing-atrio/index.ts:78; edge: supabase/functions/landing-phone/index.ts:200.

SQL entrante por nombre: ninguno detectado. Triggers: ninguno detectado. Constraints: ninguna. Cron: ninguno identificado.

Mínimo propuesto: authenticated/service_role según camino; anon y PUBLIC no retirar hasta acreditar callers indirectos y fallback público. Tratamiento: Conservar INVOKER y evaluación actual. No cambiar bloqueo ni cuotas. Riesgo del cambio: medio. Al revocar incorrectamente: Límites de planes, creación y carga pública según rol efectivo.

Evidencia del cuerpo: supabase/migrations/20260403110000_client_subscriptions_plans.sql:104. MD5 de cuerpo: d224edead1e7223a59e63c90c727d54d. Tests/referencias de prueba: frontend/tests/phase0PhoneHandlers.test.ts:29.

## F56 public.mark_whatsapp_cloud_api_thread_read(p_contact_id uuid)

Actual: SECURITY DEFINER; owner postgres; resultado void; settings ["search_path=public, pg_temp"]; EXECUTE authenticated, postgres, service_role.

Consumidor/canal: panel authenticated, propietario/admin. Llamadas SDK: frontend: frontend/lib/whatsappCloudApiDb.ts:933. Referencias adicionales: ninguna.

SQL entrante por nombre: ninguno detectado. Triggers: ninguno detectado. Constraints: ninguna. Cron: ninguno identificado.

Mínimo propuesto: authenticated EXECUTE con autorización tenant; service_role sólo cuando el contrato admite principal de servicio; owner. Tratamiento: Conservar DEFINER, wrappers y resultados; mantener/corroborar guardas por overload. Eliminar PUBLIC/anon residual sólo donde existe. Riesgo del cambio: alto. Al revocar incorrectamente: Inicio, disponibilidad, inbox/configuración WhatsApp o marcados de lectura; cambios de INVOKER rompen acceso interno.

Evidencia del cuerpo: supabase/migrations/20260818032740_whatsapp_cloud_api_unread_state.sql:44. MD5 de cuerpo: 078c6dcd0f24b444591b387629ee66e7. Tests/referencias de prueba: sin referencia nominal localizada; añadir matriz de roles y test de consumidor antes de modificar.

## F57 public.mark_whatsapp_cloud_api_threads_read(p_workspace_currency text, p_tag_filter text)

Actual: SECURITY DEFINER; owner postgres; resultado integer; settings ["search_path=public, pg_temp"]; EXECUTE authenticated, postgres, service_role.

Consumidor/canal: panel authenticated, propietario/admin. Llamadas SDK: frontend: frontend/lib/whatsappCloudApiDb.ts:944. Referencias adicionales: frontend: frontend/lib/whatsappCloudApiDb.ts:945.

SQL entrante por nombre: ninguno detectado. Triggers: ninguno detectado. Constraints: ninguna. Cron: ninguno identificado.

Mínimo propuesto: authenticated EXECUTE con autorización tenant; service_role sólo cuando el contrato admite principal de servicio; owner. Tratamiento: Conservar DEFINER, wrappers y resultados; mantener/corroborar guardas por overload. Eliminar PUBLIC/anon residual sólo donde existe. Riesgo del cambio: alto. Al revocar incorrectamente: Inicio, disponibilidad, inbox/configuración WhatsApp o marcados de lectura; cambios de INVOKER rompen acceso interno.

Evidencia del cuerpo: supabase/migrations/20260823202650_fix_wca_retarget_inbox_filters.sql:796. MD5 de cuerpo: 9194def86eb60b3ea41f6d3f6ceab4b8. Tests/referencias de prueba: sin referencia nominal localizada; añadir matriz de roles y test de consumidor antes de modificar.

## F58 public.mark_whatsapp_cloud_api_threads_read(p_workspace_currency text, p_tag_filter text, p_from timestamp with time zone, p_to timestamp with time zone)

Actual: SECURITY DEFINER; owner postgres; resultado integer; settings ["search_path=public, pg_temp"]; EXECUTE authenticated, postgres, service_role.

Consumidor/canal: panel authenticated, propietario/admin. Llamadas SDK: frontend: frontend/lib/whatsappCloudApiDb.ts:944. Referencias adicionales: frontend: frontend/lib/whatsappCloudApiDb.ts:945.

SQL entrante por nombre: ninguno detectado. Triggers: ninguno detectado. Constraints: ninguna. Cron: ninguno identificado.

Mínimo propuesto: authenticated EXECUTE con autorización tenant; service_role sólo cuando el contrato admite principal de servicio; owner. Tratamiento: Conservar DEFINER, wrappers y resultados; mantener/corroborar guardas por overload. Eliminar PUBLIC/anon residual sólo donde existe. Riesgo del cambio: alto. Al revocar incorrectamente: Inicio, disponibilidad, inbox/configuración WhatsApp o marcados de lectura; cambios de INVOKER rompen acceso interno.

Evidencia del cuerpo: supabase/migrations/20260825192821_whatsapp_cloud_api_inbox_date_filter.sql:502. MD5 de cuerpo: d82561ff143d00512b11eb8a3ec4a046. Tests/referencias de prueba: sin referencia nominal localizada; añadir matriz de roles y test de consumidor antes de modificar.

## F59 public.phone_assignment_scope_usage(p_scope_type text, p_scope_id uuid, p_gerencia_id integer, p_phone_kind text, p_phone_id bigint)

Actual: SECURITY DEFINER; owner postgres; resultado bigint; settings ["search_path=public, pg_temp"]; EXECUTE postgres, service_role.

Consumidor/canal: backend service_role o función SQL interna. Llamadas SDK: ninguna localizada. Referencias adicionales: edge: supabase/functions/landing-phone/index.ts:69; edge: supabase/functions/phone-click/index.ts:185; edge: supabase/functions/whatsapp-cloud-worker/index.ts:978.

SQL entrante por nombre: public.get_phone_for_whatsapp_cloud_api(p_config_id uuid); public.get_phone_for_chatrace_client(p_client_name text); public.get_phone_for_landing(p_landing_name text, p_create_reservation boolean). Triggers: ninguno detectado. Constraints: ninguna. Cron: ninguno identificado.

Mínimo propuesto: service_role y owner actuales; ejecución anidada bajo owner. No añadir acceso público. Tratamiento: Conservar modo de seguridad, cuerpos, grants necesarios y comportamiento. Auditar path antes de cualquier modificación. Riesgo del cambio: medio. Al revocar incorrectamente: Claims/envíos, reservas, contadores, redirect o cálculos internos indicados por consumidores/dependencias.

Evidencia del cuerpo: supabase/migrations/20260821232500_scoped_phone_assignment_metrics.sql:55. MD5 de cuerpo: e0024aa98394bd755eb47ce713e393c3. Tests/referencias de prueba: frontend/tests/phase0PhoneHandlers.test.ts:89; frontend/tests/phase0PhoneHandlers.test.ts:91.

## F60 public.prevent_landing_name_change()

Actual: SECURITY INVOKER; owner postgres; resultado trigger; settings null; EXECUTE anon, authenticated, postgres, PUBLIC, service_role.

Consumidor/canal: trigger, no RPC público. Llamadas SDK: ninguna localizada. Referencias adicionales: ninguna.

SQL entrante por nombre: ninguno detectado. Triggers: public.landings.prevent_landing_name_change. Constraints: ninguna. Cron: ninguno identificado.

Mínimo propuesto: owner y rol que crea/restaura el trigger; retirar grants de cliente redundantes sólo con DML probado. Tratamiento: Conservar SECURITY INVOKER y efectos del trigger. Evaluar path por firma; no cambiar owner en el primer lote. Riesgo del cambio: medio. Al revocar incorrectamente: DML o reconstrucción de triggers si se omiten privilegios de instalación/dependencias.

Evidencia del cuerpo: supabase/migrations/20260306130000_lock_landing_name.sql:5. MD5 de cuerpo: 09f989afd4b6a9b43a826ace89b2f16a. Tests/referencias de prueba: sin referencia nominal localizada; añadir matriz de roles y test de consumidor antes de modificar.

## F61 public.prevent_landing_tag_change()

Actual: SECURITY INVOKER; owner postgres; resultado trigger; settings null; EXECUTE anon, authenticated, postgres, PUBLIC, service_role.

Consumidor/canal: trigger, no RPC público. Llamadas SDK: ninguna localizada. Referencias adicionales: ninguna.

SQL entrante por nombre: ninguno detectado. Triggers: public.landings.prevent_landing_tag_change. Constraints: ninguna. Cron: ninguno identificado.

Mínimo propuesto: owner y rol que crea/restaura el trigger; retirar grants de cliente redundantes sólo con DML probado. Tratamiento: Conservar SECURITY INVOKER y efectos del trigger. Evaluar path por firma; no cambiar owner en el primer lote. Riesgo del cambio: medio. Al revocar incorrectamente: DML o reconstrucción de triggers si se omiten privilegios de instalación/dependencias.

Evidencia del cuerpo: supabase/migrations/20260408200000_lock_landing_tag.sql:5. MD5 de cuerpo: 0db3523ca1669e6fa8de847457ed0ede. Tests/referencias de prueba: sin referencia nominal localizada; añadir matriz de roles y test de consumidor antes de modificar.

## F62 public.prevent_unapproved_auth_user()

Actual: SECURITY DEFINER; owner postgres; resultado trigger; settings ["search_path=public"]; EXECUTE postgres, service_role.

Consumidor/canal: trigger, no RPC público. Llamadas SDK: ninguna localizada. Referencias adicionales: ninguna.

SQL entrante por nombre: ninguno detectado. Triggers: auth.users.prevent_public_auth_signup. Constraints: ninguna. Cron: ninguno identificado.

Mínimo propuesto: owner y rol que crea/restaura el trigger; retirar grants de cliente redundantes sólo con DML probado. Tratamiento: Conservar SECURITY DEFINER y efectos del trigger. Evaluar path por firma; no cambiar owner en el primer lote. Riesgo del cambio: medio. Al revocar incorrectamente: DML o reconstrucción de triggers si se omiten privilegios de instalación/dependencias.

Evidencia del cuerpo: supabase/migrations/20260902154745_admin_signup_approvals.sql:18. MD5 de cuerpo: 90afe08081a2854b8468750e1a1e273d. Tests/referencias de prueba: sin referencia nominal localizada; añadir matriz de roles y test de consumidor antes de modificar.

## F63 public.record_conversion_journey_start(p_user_id uuid, p_source_platform text, p_start_identity_key text, p_landing_id uuid, p_landing_name text, p_workspace_currency text, p_external_id text, p_phone text, p_wa_id text, p_email text, p_utm_campaign text, p_fbp text, p_fbc text, p_from_meta_ads boolean, p_meta_pixel_id text, p_dataset_id text, p_ctwa_clid text, p_telefono_asignado text, p_assigned_gerencia_id integer, p_assigned_gerencia_external_id integer, p_assigned_gerencia_name text, p_assigned_gerencia_label text, p_device_type text, p_event_source_url text, p_client_ip text, p_agent_user text, p_first_seen_at timestamp with time zone, p_last_seen_at timestamp with time zone)

Actual: SECURITY INVOKER; owner postgres; resultado uuid; settings ["search_path=public, pg_temp"]; EXECUTE postgres, service_role.

Consumidor/canal: backend service_role o función SQL interna. Llamadas SDK: backend: frontend/app/api/journey-start/route.ts:88; edge: supabase/functions/whatsapp-cloud-worker/index.ts:176. Referencias adicionales: ninguna.

SQL entrante por nombre: ninguno detectado. Triggers: ninguno detectado. Constraints: ninguna. Cron: ninguno identificado.

Mínimo propuesto: service_role y owner actuales; ejecución anidada bajo owner. No añadir acceso público. Tratamiento: Conservar modo de seguridad, cuerpos, grants necesarios y comportamiento. Auditar path antes de cualquier modificación. Riesgo del cambio: medio. Al revocar incorrectamente: Claims/envíos, reservas, contadores, redirect o cálculos internos indicados por consumidores/dependencias.

Evidencia del cuerpo: supabase/migrations/20260826011620_landing_pageview_ttl_remove_backfill.sql:9. MD5 de cuerpo: c2def6ed16dc51bc276f2124bf810000. Tests/referencias de prueba: sin referencia nominal localizada; añadir matriz de roles y test de consumidor antes de modificar.

## F64 public.record_landing_phone_availability_demand(p_landing_name text, p_request_id uuid, p_source text, p_result_status text, p_selected_gerencia_id integer, p_selected_phone_id bigint, p_selected_phone text)

Actual: SECURITY DEFINER; owner postgres; resultado jsonb; settings ["search_path=public"]; EXECUTE anon, authenticated, postgres, service_role.

Consumidor/canal: Edge landing-phone. Llamadas SDK: edge: supabase/functions/landing-phone/index.ts:91. Referencias adicionales: ninguna.

SQL entrante por nombre: ninguno detectado. Triggers: ninguno detectado. Constraints: ninguna. Cron: ninguno identificado.

Mínimo propuesto: service_role EXECUTE y owner; anon/authenticated a retirar tras acreditar consumidores externos. Tratamiento: Restringir ACL, conservar captura de demanda y métricas. Riesgo del cambio: medio. Al revocar incorrectamente: Instrumentación de demanda si existe emisor directo no inventariado.

Evidencia del cuerpo: supabase/migrations/20260812143000_landing_phone_demand_availability.sql:66. MD5 de cuerpo: 341a7526be357d6bf8e1aaa26c90ae54. Tests/referencias de prueba: frontend/tests/phase0PhoneHandlers.test.ts:71.

## F65 public.record_whatsapp_cloud_api_redirect_click(p_token text, p_ip text, p_user_agent text)

Actual: SECURITY DEFINER; owner postgres; resultado TABLE(wa_link text, redirect_id uuid, config_id uuid, user_id uuid, contact_id uuid, assignment_id uuid, conversion_id uuid, phone_number_id text, config_name text, workspace_currency text, meta_messaging_dataset_id text, assigned_phone text, assigned_gerencia_id integer, assigned_gerencia_external_id integer, assigned_gerencia_label text, promo_code text, wa_id text, profile_name text, first_message_id text, first_message_at timestamp with time zone, ctwa_clid text, referral jsonb, first_click boolean); settings ["search_path=public, pg_temp"]; EXECUTE postgres, service_role.

Consumidor/canal: backend service_role o función SQL interna. Llamadas SDK: edge: supabase/functions/whatsapp-cloud-redirect/index.ts:266. Referencias adicionales: edge: supabase/functions/whatsapp-cloud-redirect/index.ts:267.

SQL entrante por nombre: ninguno detectado. Triggers: ninguno detectado. Constraints: ninguna. Cron: ninguno identificado.

Mínimo propuesto: service_role y owner actuales; ejecución anidada bajo owner. No añadir acceso público. Tratamiento: Conservar modo de seguridad, cuerpos, grants necesarios y comportamiento. Auditar path antes de cualquier modificación. Riesgo del cambio: medio. Al revocar incorrectamente: Claims/envíos, reservas, contadores, redirect o cálculos internos indicados por consumidores/dependencias.

Evidencia del cuerpo: supabase/migrations/20260823202650_fix_wca_retarget_inbox_filters.sql:3. MD5 de cuerpo: 07b6045a14161a7dc71549a16f9384aa. Tests/referencias de prueba: sin referencia nominal localizada; añadir matriz de roles y test de consumidor antes de modificar.

## F66 public.refresh_constructor_landing_phone_cache()

Actual: SECURITY DEFINER; owner postgres; resultado jsonb; settings ["search_path=public"]; EXECUTE anon, authenticated, postgres, service_role.

Consumidor/canal: cron postgres. Llamadas SDK: ninguna localizada. Referencias adicionales: ninguna.

SQL entrante por nombre: ninguno detectado. Triggers: ninguno detectado. Constraints: ninguna. Cron: refresh-constructor-landing-phone-cache-every-minute (postgres, active=true).

Mínimo propuesto: postgres; backend explícito sólo si se acredita. Tratamiento: Retirar anon/authenticated; preservar DEFINER y cálculo/cache. Riesgo del cambio: medio. Al revocar incorrectamente: Refresco manual público; carga pública usa otro RPC y debe conservarse.

Evidencia del cuerpo: supabase/migrations/20260614130000_constructor_landing_phone_cache.sql:22. MD5 de cuerpo: b7b830679263ec2bab6d727104c1586b. Tests/referencias de prueba: sin referencia nominal localizada; añadir matriz de roles y test de consumidor antes de modificar.

## F67 public.refresh_home_overview_stats_cache(p_user_id uuid, p_currency text)

Actual: SECURITY DEFINER; owner postgres; resultado jsonb; settings ["search_path=public"]; EXECUTE postgres, service_role.

Consumidor/canal: backend service_role o función SQL interna. Llamadas SDK: ninguna localizada. Referencias adicionales: ninguna.

SQL entrante por nombre: ninguno detectado. Triggers: ninguno detectado. Constraints: ninguna. Cron: refresh-home-overview-stats-cache-hourly (postgres, active=true).

Mínimo propuesto: service_role y owner actuales; ejecución anidada bajo owner. No añadir acceso público. Tratamiento: Conservar modo de seguridad, cuerpos, grants necesarios y comportamiento. Auditar path antes de cualquier modificación. Riesgo del cambio: medio. Al revocar incorrectamente: Claims/envíos, reservas, contadores, redirect o cálculos internos indicados por consumidores/dependencias.

Evidencia del cuerpo: supabase/migrations/20260819175021_home_overview_stats_cache_hourly.sql:255. MD5 de cuerpo: ee4da58fdc22114bd3fc2b9de4ce503a. Tests/referencias de prueba: sin referencia nominal localizada; añadir matriz de roles y test de consumidor antes de modificar.

## F68 public.refresh_phone_metrics()

Actual: SECURITY DEFINER; owner postgres; resultado void; settings ["search_path=public"]; EXECUTE postgres, service_role.

Consumidor/canal: backend service_role o función SQL interna. Llamadas SDK: ninguna localizada. Referencias adicionales: ninguna.

SQL entrante por nombre: ninguno detectado. Triggers: ninguno detectado. Constraints: ninguna. Cron: refresh-phone-metrics-every-5min (postgres, active=true).

Mínimo propuesto: service_role y owner actuales; ejecución anidada bajo owner. No añadir acceso público. Tratamiento: Conservar modo de seguridad, cuerpos, grants necesarios y comportamiento. Auditar path antes de cualquier modificación. Riesgo del cambio: medio. Al revocar incorrectamente: Claims/envíos, reservas, contadores, redirect o cálculos internos indicados por consumidores/dependencias.

Evidencia del cuerpo: supabase/migrations/20260806103000_optimize_phone_metrics_refresh_30min.sql:7. MD5 de cuerpo: 75823e3e1d59ce10d9bda0677058388c. Tests/referencias de prueba: sin referencia nominal localizada; añadir matriz de roles y test de consumidor antes de modificar.

## F69 public.rls_auto_enable()

Actual: SECURITY DEFINER; owner postgres; resultado event_trigger; settings ["search_path=pg_catalog"]; EXECUTE anon, authenticated, postgres, PUBLIC, service_role.

Consumidor/canal: plataforma / ensure_rls. Llamadas SDK: ninguna localizada. Referencias adicionales: ninguna.

SQL entrante por nombre: ninguno detectado. Triggers: ninguno detectado. Constraints: ninguna. Cron: ninguno identificado.

Mínimo propuesto: owner postgres; conservar mecanismo de plataforma. ACL de cliente pendiente de prueba y aprobación específica. Tratamiento: No cambiar cuerpo, owner ni pg_catalog; no confundir event_trigger con RPC ordinaria. Riesgo del cambio: medio. Al revocar incorrectamente: DDL de futuras tablas si se altera el mecanismo.

Evidencia del cuerpo: sin match directo del extractor; hash coincide con catálogo remoto acreditado de Fase 0; requiere revisar transformaciones/capa antes de DDL. MD5 de cuerpo: 99be20677b456ea8d3be47bdd44fb369. Tests/referencias de prueba: sin referencia nominal localizada; añadir matriz de roles y test de consumidor antes de modificar.

## F70 public.set_atrio_clients_updated_at()

Actual: SECURITY INVOKER; owner postgres; resultado trigger; settings ["search_path=public, pg_temp"]; EXECUTE anon, authenticated, postgres, PUBLIC, service_role.

Consumidor/canal: trigger, no RPC público. Llamadas SDK: ninguna localizada. Referencias adicionales: ninguna.

SQL entrante por nombre: ninguno detectado. Triggers: public.atrio_clients.atrio_clients_updated_at. Constraints: ninguna. Cron: ninguno identificado.

Mínimo propuesto: owner y rol que crea/restaura el trigger; retirar grants de cliente redundantes sólo con DML probado. Tratamiento: Conservar SECURITY INVOKER y efectos del trigger. Evaluar path por firma; no cambiar owner en el primer lote. Riesgo del cambio: medio. Al revocar incorrectamente: DML o reconstrucción de triggers si se omiten privilegios de instalación/dependencias.

Evidencia del cuerpo: supabase/migrations/20260427180000_remote_sync_placeholder.sql:22; supabase/migrations/20260502160000_promotions_module.sql:127; supabase/migrations/20260519160000_gerencia_work_groups.sql:31; supabase/migrations/20260629190000_constructor_tracking_queue.sql:43; supabase/migrations/20260810172000_whatsapp_cloud_api_module.sql:196; supabase/migrations/20260818223130_atrio_clients_module.sql:25; supabase/migrations/20260825180041_conversion_journey_starts.sql:58. MD5 de cuerpo: 9b1889f56258bf9d6554213c05019c76. Tests/referencias de prueba: sin referencia nominal localizada; añadir matriz de roles y test de consumidor antes de modificar.

## F71 public.set_client_subscriptions_updated_at()

Actual: SECURITY INVOKER; owner postgres; resultado trigger; settings null; EXECUTE anon, authenticated, postgres, PUBLIC, service_role.

Consumidor/canal: trigger, no RPC público. Llamadas SDK: ninguna localizada. Referencias adicionales: ninguna.

SQL entrante por nombre: ninguno detectado. Triggers: public.client_subscriptions.trg_client_subscriptions_updated_at. Constraints: ninguna. Cron: ninguno identificado.

Mínimo propuesto: owner y rol que crea/restaura el trigger; retirar grants de cliente redundantes sólo con DML probado. Tratamiento: Conservar SECURITY INVOKER y efectos del trigger. Evaluar path por firma; no cambiar owner en el primer lote. Riesgo del cambio: medio. Al revocar incorrectamente: DML o reconstrucción de triggers si se omiten privilegios de instalación/dependencias.

Evidencia del cuerpo: supabase/migrations/20260403110000_client_subscriptions_plans.sql:65. MD5 de cuerpo: 1c4318bee4240d4113d86fad7eb15623. Tests/referencias de prueba: sin referencia nominal localizada; añadir matriz de roles y test de consumidor antes de modificar.

## F72 public.set_conversion_journey_starts_updated_at()

Actual: SECURITY DEFINER; owner postgres; resultado trigger; settings ["search_path=public, pg_temp"]; EXECUTE anon, authenticated, postgres, PUBLIC, service_role.

Consumidor/canal: trigger, no RPC público. Llamadas SDK: ninguna localizada. Referencias adicionales: ninguna.

SQL entrante por nombre: ninguno detectado. Triggers: public.conversion_journey_starts.conversion_journey_starts_updated_at. Constraints: ninguna. Cron: ninguno identificado.

Mínimo propuesto: owner y rol que crea/restaura el trigger; retirar grants de cliente redundantes sólo con DML probado. Tratamiento: Conservar SECURITY DEFINER y efectos del trigger. Evaluar path por firma; no cambiar owner en el primer lote. Riesgo del cambio: medio. Al revocar incorrectamente: DML o reconstrucción de triggers si se omiten privilegios de instalación/dependencias.

Evidencia del cuerpo: supabase/migrations/20260427180000_remote_sync_placeholder.sql:22; supabase/migrations/20260502160000_promotions_module.sql:127; supabase/migrations/20260519160000_gerencia_work_groups.sql:31; supabase/migrations/20260629190000_constructor_tracking_queue.sql:43; supabase/migrations/20260810172000_whatsapp_cloud_api_module.sql:196; supabase/migrations/20260818223130_atrio_clients_module.sql:25; supabase/migrations/20260825180041_conversion_journey_starts.sql:58. MD5 de cuerpo: 9b1889f56258bf9d6554213c05019c76. Tests/referencias de prueba: sin referencia nominal localizada; añadir matriz de roles y test de consumidor antes de modificar.

## F73 public.set_conversion_log_workspace_currency()

Actual: SECURITY INVOKER; owner postgres; resultado trigger; settings ["search_path=public"]; EXECUTE anon, authenticated, postgres, PUBLIC, service_role.

Consumidor/canal: trigger, no RPC público. Llamadas SDK: ninguna localizada. Referencias adicionales: ninguna.

SQL entrante por nombre: ninguno detectado. Triggers: public.conversion_logs.trg_conversion_logs_workspace_currency. Constraints: ninguna. Cron: ninguno identificado.

Mínimo propuesto: owner y rol que crea/restaura el trigger; retirar grants de cliente redundantes sólo con DML probado. Tratamiento: Conservar SECURITY INVOKER y efectos del trigger. Evaluar path por firma; no cambiar owner en el primer lote. Riesgo del cambio: medio. Al revocar incorrectamente: DML o reconstrucción de triggers si se omiten privilegios de instalación/dependencias.

Evidencia del cuerpo: supabase/migrations/20260815163940_scope_conversion_logs_by_workspace.sql:21. MD5 de cuerpo: 2d5f9518a7e98963e9faa140e58aa7b7. Tests/referencias de prueba: sin referencia nominal localizada; añadir matriz de roles y test de consumidor antes de modificar.

## F74 public.set_conversions_from_meta_ads()

Actual: SECURITY INVOKER; owner postgres; resultado trigger; settings null; EXECUTE anon, authenticated, postgres, PUBLIC, service_role.

Consumidor/canal: trigger, no RPC público. Llamadas SDK: ninguna localizada. Referencias adicionales: ninguna.

SQL entrante por nombre: ninguno detectado. Triggers: public.conversions.trg_set_conversions_from_meta_ads. Constraints: ninguna. Cron: ninguno identificado.

Mínimo propuesto: owner y rol que crea/restaura el trigger; retirar grants de cliente redundantes sólo con DML probado. Tratamiento: Conservar SECURITY INVOKER y efectos del trigger. Evaluar path por firma; no cambiar owner en el primer lote. Riesgo del cambio: medio. Al revocar incorrectamente: DML o reconstrucción de triggers si se omiten privilegios de instalación/dependencias.

Evidencia del cuerpo: supabase/migrations/20260821220917_include_ctwa_in_meta_ads_origin.sql:1. MD5 de cuerpo: f1a0aa5a98b2767ae0c8becde61bb79b. Tests/referencias de prueba: sin referencia nominal localizada; añadir matriz de roles y test de consumidor antes de modificar.

## F75 public.set_conversions_inferred_sex()

Actual: SECURITY INVOKER; owner postgres; resultado trigger; settings null; EXECUTE anon, authenticated, postgres, PUBLIC, service_role.

Consumidor/canal: trigger, no RPC público. Llamadas SDK: ninguna localizada. Referencias adicionales: ninguna.

SQL entrante por nombre: ninguno detectado. Triggers: ninguno detectado. Constraints: ninguna. Cron: ninguno identificado.

Mínimo propuesto: owner y rol que crea/restaura el trigger; retirar grants de cliente redundantes sólo con DML probado. Tratamiento: Conservar SECURITY INVOKER y efectos del trigger. Evaluar path por firma; no cambiar owner en el primer lote. Riesgo del cambio: medio. Al revocar incorrectamente: DML o reconstrucción de triggers si se omiten privilegios de instalación/dependencias.

Evidencia del cuerpo: supabase/migrations/20260427120000_conversions_add_inferred_sex.sql:20. MD5 de cuerpo: 45cea5bcd2c3876ec0fb160bf45ce456. Tests/referencias de prueba: sin referencia nominal localizada; añadir matriz de roles y test de consumidor antes de modificar.

## F76 public.set_conversions_sex_fields()

Actual: SECURITY INVOKER; owner postgres; resultado trigger; settings null; EXECUTE anon, authenticated, postgres, PUBLIC, service_role.

Consumidor/canal: trigger, no RPC público. Llamadas SDK: ninguna localizada. Referencias adicionales: ninguna.

SQL entrante por nombre: ninguno detectado. Triggers: public.conversions.trg_set_conversions_sex_fields. Constraints: ninguna. Cron: ninguno identificado.

Mínimo propuesto: owner y rol que crea/restaura el trigger; retirar grants de cliente redundantes sólo con DML probado. Tratamiento: Conservar SECURITY INVOKER y efectos del trigger. Evaluar path por firma; no cambiar owner en el primer lote. Riesgo del cambio: medio. Al revocar incorrectamente: DML o reconstrucción de triggers si se omiten privilegios de instalación/dependencias.

Evidencia del cuerpo: supabase/migrations/20260427140000_conversions_add_sex_source.sql:20. MD5 de cuerpo: 768b9e7183789409ea5ca17144025044. Tests/referencias de prueba: sin referencia nominal localizada; añadir matriz de roles y test de consumidor antes de modificar.

## F77 public.set_gerencia_phones_updated_at()

Actual: SECURITY DEFINER; owner postgres; resultado trigger; settings ["search_path=public"]; EXECUTE anon, authenticated, postgres, PUBLIC, service_role.

Consumidor/canal: trigger, no RPC público. Llamadas SDK: ninguna localizada. Referencias adicionales: ninguna.

SQL entrante por nombre: ninguno detectado. Triggers: public.gerencia_phones.gerencia_phones_updated_at. Constraints: ninguna. Cron: ninguno identificado.

Mínimo propuesto: owner y rol que crea/restaura el trigger; retirar grants de cliente redundantes sólo con DML probado. Tratamiento: Conservar SECURITY DEFINER y efectos del trigger. Evaluar path por firma; no cambiar owner en el primer lote. Riesgo del cambio: medio. Al revocar incorrectamente: DML o reconstrucción de triggers si se omiten privilegios de instalación/dependencias.

Evidencia del cuerpo: supabase/migrations/20260227100000_landings.sql:41; supabase/migrations/20260228131000_phone_mode_and_gerencia_phones.sql:36. MD5 de cuerpo: 98c445da624def56331f5e3b2700a76c. Tests/referencias de prueba: sin referencia nominal localizada; añadir matriz de roles y test de consumidor antes de modificar.

## F78 public.set_gerencia_work_groups_updated_at()

Actual: SECURITY INVOKER; owner postgres; resultado trigger; settings null; EXECUTE anon, authenticated, postgres, PUBLIC, service_role.

Consumidor/canal: trigger, no RPC público. Llamadas SDK: ninguna localizada. Referencias adicionales: ninguna.

SQL entrante por nombre: ninguno detectado. Triggers: public.gerencia_work_groups.trg_gerencia_work_groups_updated_at. Constraints: ninguna. Cron: ninguno identificado.

Mínimo propuesto: owner y rol que crea/restaura el trigger; retirar grants de cliente redundantes sólo con DML probado. Tratamiento: Conservar SECURITY INVOKER y efectos del trigger. Evaluar path por firma; no cambiar owner en el primer lote. Riesgo del cambio: medio. Al revocar incorrectamente: DML o reconstrucción de triggers si se omiten privilegios de instalación/dependencias.

Evidencia del cuerpo: supabase/migrations/20260427180000_remote_sync_placeholder.sql:22; supabase/migrations/20260502160000_promotions_module.sql:127; supabase/migrations/20260519160000_gerencia_work_groups.sql:31; supabase/migrations/20260629190000_constructor_tracking_queue.sql:43; supabase/migrations/20260810172000_whatsapp_cloud_api_module.sql:196; supabase/migrations/20260818223130_atrio_clients_module.sql:25; supabase/migrations/20260825180041_conversion_journey_starts.sql:58. MD5 de cuerpo: 9b1889f56258bf9d6554213c05019c76. Tests/referencias de prueba: sin referencia nominal localizada; añadir matriz de roles y test de consumidor antes de modificar.

## F79 public.set_landings_atrio_clients_owner()

Actual: SECURITY DEFINER; owner postgres; resultado trigger; settings ["search_path=public, pg_temp"]; EXECUTE anon, authenticated, postgres, PUBLIC, service_role.

Consumidor/canal: trigger, no RPC público. Llamadas SDK: ninguna localizada. Referencias adicionales: ninguna.

SQL entrante por nombre: ninguno detectado. Triggers: public.landings_atrio_clients.landings_atrio_clients_owner. Constraints: ninguna. Cron: ninguno identificado.

Mínimo propuesto: owner y rol que crea/restaura el trigger; retirar grants de cliente redundantes sólo con DML probado. Tratamiento: Conservar SECURITY DEFINER y efectos del trigger. Evaluar path por firma; no cambiar owner en el primer lote. Riesgo del cambio: medio. Al revocar incorrectamente: DML o reconstrucción de triggers si se omiten privilegios de instalación/dependencias.

Evidencia del cuerpo: supabase/migrations/20260822162110_landing_atrio_redirect_assignments.sql:62. MD5 de cuerpo: b87ea3565c1e945c0b91c22e9e3591bb. Tests/referencias de prueba: sin referencia nominal localizada; añadir matriz de roles y test de consumidor antes de modificar.

## F80 public.set_landings_updated_at()

Actual: SECURITY DEFINER; owner postgres; resultado trigger; settings ["search_path=public"]; EXECUTE anon, authenticated, postgres, PUBLIC, service_role.

Consumidor/canal: trigger, no RPC público. Llamadas SDK: ninguna localizada. Referencias adicionales: ninguna.

SQL entrante por nombre: ninguno detectado. Triggers: public.landings.landings_updated_at. Constraints: ninguna. Cron: ninguno identificado.

Mínimo propuesto: owner y rol que crea/restaura el trigger; retirar grants de cliente redundantes sólo con DML probado. Tratamiento: Conservar SECURITY DEFINER y efectos del trigger. Evaluar path por firma; no cambiar owner en el primer lote. Riesgo del cambio: medio. Al revocar incorrectamente: DML o reconstrucción de triggers si se omiten privilegios de instalación/dependencias.

Evidencia del cuerpo: supabase/migrations/20260227100000_landings.sql:41; supabase/migrations/20260228131000_phone_mode_and_gerencia_phones.sql:36. MD5 de cuerpo: 98c445da624def56331f5e3b2700a76c. Tests/referencias de prueba: sin referencia nominal localizada; añadir matriz de roles y test de consumidor antes de modificar.

## F81 public.set_promotions_updated_at()

Actual: SECURITY INVOKER; owner postgres; resultado trigger; settings null; EXECUTE anon, authenticated, postgres, PUBLIC, service_role.

Consumidor/canal: trigger, no RPC público. Llamadas SDK: ninguna localizada. Referencias adicionales: ninguna.

SQL entrante por nombre: ninguno detectado. Triggers: public.promotions.trg_promotions_updated_at. Constraints: ninguna. Cron: ninguno identificado.

Mínimo propuesto: owner y rol que crea/restaura el trigger; retirar grants de cliente redundantes sólo con DML probado. Tratamiento: Conservar SECURITY INVOKER y efectos del trigger. Evaluar path por firma; no cambiar owner en el primer lote. Riesgo del cambio: medio. Al revocar incorrectamente: DML o reconstrucción de triggers si se omiten privilegios de instalación/dependencias.

Evidencia del cuerpo: supabase/migrations/20260427180000_remote_sync_placeholder.sql:22; supabase/migrations/20260502160000_promotions_module.sql:127; supabase/migrations/20260519160000_gerencia_work_groups.sql:31; supabase/migrations/20260629190000_constructor_tracking_queue.sql:43; supabase/migrations/20260810172000_whatsapp_cloud_api_module.sql:196; supabase/migrations/20260818223130_atrio_clients_module.sql:25; supabase/migrations/20260825180041_conversion_journey_starts.sql:58. MD5 de cuerpo: 9b1889f56258bf9d6554213c05019c76. Tests/referencias de prueba: sin referencia nominal localizada; añadir matriz de roles y test de consumidor antes de modificar.

## F82 public.set_tracking_queue_updated_at()

Actual: SECURITY INVOKER; owner postgres; resultado trigger; settings null; EXECUTE anon, authenticated, postgres, PUBLIC, service_role.

Consumidor/canal: trigger, no RPC público. Llamadas SDK: ninguna localizada. Referencias adicionales: ninguna.

SQL entrante por nombre: ninguno detectado. Triggers: public.tracking_queue.trg_tracking_queue_updated_at. Constraints: ninguna. Cron: ninguno identificado.

Mínimo propuesto: owner y rol que crea/restaura el trigger; retirar grants de cliente redundantes sólo con DML probado. Tratamiento: Conservar SECURITY INVOKER y efectos del trigger. Evaluar path por firma; no cambiar owner en el primer lote. Riesgo del cambio: medio. Al revocar incorrectamente: DML o reconstrucción de triggers si se omiten privilegios de instalación/dependencias.

Evidencia del cuerpo: supabase/migrations/20260427180000_remote_sync_placeholder.sql:22; supabase/migrations/20260502160000_promotions_module.sql:127; supabase/migrations/20260519160000_gerencia_work_groups.sql:31; supabase/migrations/20260629190000_constructor_tracking_queue.sql:43; supabase/migrations/20260810172000_whatsapp_cloud_api_module.sql:196; supabase/migrations/20260818223130_atrio_clients_module.sql:25; supabase/migrations/20260825180041_conversion_journey_starts.sql:58. MD5 de cuerpo: 9b1889f56258bf9d6554213c05019c76. Tests/referencias de prueba: sin referencia nominal localizada; añadir matriz de roles y test de consumidor antes de modificar.

## F83 public.set_whatsapp_cloud_api_updated_at()

Actual: SECURITY DEFINER; owner postgres; resultado trigger; settings ["search_path=public"]; EXECUTE anon, authenticated, postgres, PUBLIC, service_role.

Consumidor/canal: trigger, no RPC público. Llamadas SDK: ninguna localizada. Referencias adicionales: ninguna.

SQL entrante por nombre: ninguno detectado. Triggers: public.whatsapp_cloud_api_configs.whatsapp_cloud_api_configs_updated_at; public.whatsapp_cloud_api_contacts.whatsapp_cloud_api_contacts_updated_at; public.whatsapp_cloud_api_assignments.whatsapp_cloud_api_assignments_updated_at; public.whatsapp_cloud_api_outbound_messages.whatsapp_cloud_api_outbound_updated_at; public.whatsapp_cloud_api_redirects.whatsapp_cloud_api_redirects_updated_at; public.whatsapp_cloud_api_thread_reads.whatsapp_cloud_api_thread_reads_updated_at; public.whatsapp_cloud_api_retarget_messages.whatsapp_cloud_api_retarget_updated_at. Constraints: ninguna. Cron: ninguno identificado.

Mínimo propuesto: owner y rol que crea/restaura el trigger; retirar grants de cliente redundantes sólo con DML probado. Tratamiento: Conservar SECURITY DEFINER y efectos del trigger. Evaluar path por firma; no cambiar owner en el primer lote. Riesgo del cambio: medio. Al revocar incorrectamente: DML o reconstrucción de triggers si se omiten privilegios de instalación/dependencias.

Evidencia del cuerpo: supabase/migrations/20260427180000_remote_sync_placeholder.sql:22; supabase/migrations/20260502160000_promotions_module.sql:127; supabase/migrations/20260519160000_gerencia_work_groups.sql:31; supabase/migrations/20260629190000_constructor_tracking_queue.sql:43; supabase/migrations/20260810172000_whatsapp_cloud_api_module.sql:196; supabase/migrations/20260818223130_atrio_clients_module.sql:25; supabase/migrations/20260825180041_conversion_journey_starts.sql:58. MD5 de cuerpo: 9b1889f56258bf9d6554213c05019c76. Tests/referencias de prueba: sin referencia nominal localizada; añadir matriz de roles y test de consumidor antes de modificar.

## F84 public.sync_pixel_to_landings()

Actual: SECURITY DEFINER; owner postgres; resultado trigger; settings ["search_path=public"]; EXECUTE anon, authenticated, postgres, PUBLIC, service_role.

Consumidor/canal: trigger, no RPC público. Llamadas SDK: ninguna localizada. Referencias adicionales: ninguna.

SQL entrante por nombre: ninguno detectado. Triggers: public.conversions_config.on_conversions_config_pixel_change. Constraints: ninguna. Cron: ninguno identificado.

Mínimo propuesto: owner y rol que crea/restaura el trigger; retirar grants de cliente redundantes sólo con DML probado. Tratamiento: Conservar SECURITY DEFINER y efectos del trigger. Evaluar path por firma; no cambiar owner en el primer lote. Riesgo del cambio: medio. Al revocar incorrectamente: DML o reconstrucción de triggers si se omiten privilegios de instalación/dependencias.

Evidencia del cuerpo: supabase/migrations/20260416100002_sync_pixel_trigger.sql:4. MD5 de cuerpo: b2c389dc88bef478e864c8a160de978c. Tests/referencias de prueba: sin referencia nominal localizada; añadir matriz de roles y test de consumidor antes de modificar.

## F85 public.upsert_whatsapp_cloud_api_config_secure(p_id uuid, p_user_id uuid, p_name text, p_active boolean, p_workspace_currency text, p_phone_number_id text, p_whatsapp_business_account_id text, p_display_phone_number text, p_meta_access_token text, p_meta_app_secret text, p_meta_api_version text, p_webhook_verify_token text, p_meta_messaging_dataset_id text, p_landing_tag text, p_gerencia_selection_mode text, p_gerencia_fair_criterion text, p_redirect_message_template text, p_fallback_message_template text, p_redirect_use_cta_button boolean, p_redirect_cta_button_title text, p_enrich_business_messaging_user_data boolean, p_send_business_messaging_purchase_type_capi boolean, p_retargeting_enabled boolean, p_retarget_message_template text, p_retarget_delay_minutes integer)

Actual: SECURITY DEFINER; owner postgres; resultado uuid; settings ["search_path=public, pg_temp"]; EXECUTE authenticated, postgres, service_role.

Consumidor/canal: panel authenticated, propietario/admin. Llamadas SDK: frontend: frontend/lib/whatsappCloudApiDb.ts:177. Referencias adicionales: frontend: frontend/lib/whatsappCloudApiDb.ts:178.

SQL entrante por nombre: ninguno detectado. Triggers: ninguno detectado. Constraints: ninguna. Cron: ninguno identificado.

Mínimo propuesto: authenticated EXECUTE con autorización tenant; service_role sólo cuando el contrato admite principal de servicio; owner. Tratamiento: Conservar DEFINER, wrappers y resultados; mantener/corroborar guardas por overload. Eliminar PUBLIC/anon residual sólo donde existe. Riesgo del cambio: alto. Al revocar incorrectamente: Inicio, disponibilidad, inbox/configuración WhatsApp o marcados de lectura; cambios de INVOKER rompen acceso interno.

Evidencia del cuerpo: supabase/migrations/20260825172003_whatsapp_cloud_api_retarget_config.sql:209. MD5 de cuerpo: e4b4c5392e345ea4a9fe89f3d857a9d9. Tests/referencias de prueba: sin referencia nominal localizada; añadir matriz de roles y test de consumidor antes de modificar.

## F86 public.validate_gerencia_workspace_update()

Actual: SECURITY DEFINER; owner postgres; resultado trigger; settings ["search_path=public"]; EXECUTE anon, authenticated, postgres, PUBLIC, service_role.

Consumidor/canal: trigger, no RPC público. Llamadas SDK: ninguna localizada. Referencias adicionales: ninguna.

SQL entrante por nombre: ninguno detectado. Triggers: public.gerencias.trg_gerencias_workspace_guard. Constraints: ninguna. Cron: ninguno identificado.

Mínimo propuesto: owner y rol que crea/restaura el trigger; retirar grants de cliente redundantes sólo con DML probado. Tratamiento: Conservar SECURITY DEFINER y efectos del trigger. Evaluar path por firma; no cambiar owner en el primer lote. Riesgo del cambio: medio. Al revocar incorrectamente: DML o reconstrucción de triggers si se omiten privilegios de instalación/dependencias.

Evidencia del cuerpo: supabase/migrations/20260801190000_workspace_currency_scope.sql:161. MD5 de cuerpo: 4ee78c2db64d3834d7d9c40161fd512f. Tests/referencias de prueba: sin referencia nominal localizada; añadir matriz de roles y test de consumidor antes de modificar.

## F87 public.validate_landing_gerencia_workspace_assignment()

Actual: SECURITY DEFINER; owner postgres; resultado trigger; settings ["search_path=public"]; EXECUTE anon, authenticated, postgres, PUBLIC, service_role.

Consumidor/canal: trigger, no RPC público. Llamadas SDK: ninguna localizada. Referencias adicionales: ninguna.

SQL entrante por nombre: ninguno detectado. Triggers: public.landings_gerencias.trg_landings_gerencias_workspace_guard. Constraints: ninguna. Cron: ninguno identificado.

Mínimo propuesto: owner y rol que crea/restaura el trigger; retirar grants de cliente redundantes sólo con DML probado. Tratamiento: Conservar SECURITY DEFINER y efectos del trigger. Evaluar path por firma; no cambiar owner en el primer lote. Riesgo del cambio: medio. Al revocar incorrectamente: DML o reconstrucción de triggers si se omiten privilegios de instalación/dependencias.

Evidencia del cuerpo: supabase/migrations/20260801190000_workspace_currency_scope.sql:58. MD5 de cuerpo: c64a89815fdbc39d442a334a6ef3edc4. Tests/referencias de prueba: sin referencia nominal localizada; añadir matriz de roles y test de consumidor antes de modificar.

## F88 public.validate_landing_workspace_update()

Actual: SECURITY DEFINER; owner postgres; resultado trigger; settings ["search_path=public"]; EXECUTE anon, authenticated, postgres, PUBLIC, service_role.

Consumidor/canal: trigger, no RPC público. Llamadas SDK: ninguna localizada. Referencias adicionales: ninguna.

SQL entrante por nombre: ninguno detectado. Triggers: public.landings.trg_landings_workspace_guard. Constraints: ninguna. Cron: ninguno identificado.

Mínimo propuesto: owner y rol que crea/restaura el trigger; retirar grants de cliente redundantes sólo con DML probado. Tratamiento: Conservar SECURITY DEFINER y efectos del trigger. Evaluar path por firma; no cambiar owner en el primer lote. Riesgo del cambio: medio. Al revocar incorrectamente: DML o reconstrucción de triggers si se omiten privilegios de instalación/dependencias.

Evidencia del cuerpo: supabase/migrations/20260801190000_workspace_currency_scope.sql:115. MD5 de cuerpo: a9b1f9a116a093ae7795bdf876941c61. Tests/referencias de prueba: sin referencia nominal localizada; añadir matriz de roles y test de consumidor antes de modificar.

## F89 public.verify_revalidate_secret(p_secret text)

Actual: SECURITY DEFINER; owner postgres; resultado boolean; settings ["search_path=public"]; EXECUTE anon, authenticated, postgres, service_role.

Consumidor/canal: Next.js /api/revalidate usando anon. Llamadas SDK: ninguna localizada. Referencias adicionales: backend: frontend/app/api/revalidate/route.ts:68.

SQL entrante por nombre: ninguno detectado. Triggers: ninguno detectado. Constraints: ninguna. Cron: ninguno identificado.

Mínimo propuesto: anon necesario hoy; objetivo service_role/backend sólo tras adaptar su credencial, sin alterar comparación del secreto. Tratamiento: No revocar primero. Corregir lectura de settings.revalidate_secret por separado; luego cerrar el oráculo público si se aprueba. Riesgo del cambio: alto. Al revocar incorrectamente: Revalidación, publicación/warm de landings.

Evidencia del cuerpo: supabase/migrations/20260613090000_public_landing_runtime_switch.sql:44. MD5 de cuerpo: bcb759814f209614c2538431f83b7dc7. Tests/referencias de prueba: sin referencia nominal localizada; añadir matriz de roles y test de consumidor antes de modificar.

## Procedencia de los cinco cuerpos sin match directo

get_phone_for_chatrace_client y get_phone_for_whatsapp_cloud_api se modifican mediante pg_get_functiondef/replace en 20260811120000_gerencia_phone_assignment_role.sql y 20260821232500_scoped_phone_assignment_metrics.sql. get_whatsapp_cloud_api_contacts_page y la sobrecarga de tres argumentos de get_whatsapp_cloud_api_inbox_threads_page se transforman en 20260821235712_optimize_wca_conversion_lateral_matches.sql. rls_auto_enable proviene de la capa local de compatibilidad acreditada en supabase/bootstrap/security-reference.json y scripts/phase0/bootstrap-security-reference.sql. No son cinco funciones ausentes de la reconstrucción: los hashes remotos coinciden con Fase 0. Antes de cambiar esos cuerpos se debe revisar la definición final reconstruida, no editar una definición histórica anterior a esas transformaciones.

# Funciones de extensión y gateway

No incluidas en el conteo de 89: net y graphql_public. Metadata exacta en evidence.json. pg_net 0.19.5: las 12 funciones inventariadas son SECURITY INVOKER, owner supabase_admin, sin settings propios y proacl NULL (EXECUTE PUBLIC por default); esto no certifica ejecución efectiva de operaciones administrativas internas. No ejecutar ninguna en remoto para comprobarlo. http_get/http_post pueden usar tablas/secuencia con grants PUBLIC amplios; la exposición del schema net por Data API hosted no está acreditada. Propuesta: mantener para cron mientras se diseña/revisa con plataforma una matriz de roles en local; no editar objetos de extensión ni incluir un REVOKE global inadvertido. graphql_public.graphql es INVOKER y EXECUTE PUBLIC más grants explícitos; confirmar servicio/extensión y consumidores reales antes de cambiar ACL. Riesgo alto si se revoca sin comprobar consumidores. Preservar el baseline de paridad de Fase 0.
