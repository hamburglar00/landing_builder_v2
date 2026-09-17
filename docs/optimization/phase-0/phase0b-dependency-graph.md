# Grafo e inventario estático de dependencias

Estado operativo: dos reconstrucciones completas, 268/268 y fingerprint id?ntico, conforme al manifiesto aprobado. Las dependencias adicionales y barreras de tablas vac?as est?n en phase0b-pixel-dependency.md. El grafo inferior es est?tico; la evidencia ejecutada y el bloqueo restante de seguridad est?n en phase0b-bootstrap-report.md.

No ejecuta ni reordena SQL. Las referencias dentro de funciones/DO requieren revisión semántica; no son todas bloqueos al crear la función. Fuente completa: phase0b-dependencies.json.

## Referencias a conversions antes de crearla

| Orden | Migración |
| ---: | --- |
| 29 | 20260323201000_conversions_add_test_event_code.sql |
| 33 | 20260325201000_add_internal_id_to_conversions.sql |
| 39 | 20260326235900_conversion_inbox.sql |
| 51 | 20260330193500_conversions_add_meta_pixel_id.sql |
| 55 | 20260401102000_conversions_delete_policy.sql |
| 57 | 20260404000100_rename_send_contact_pixel_to_sendContactPixel.sql |
| 64 | 20260407190000_get_phone_for_chatrace_client.sql |
| 66 | 20260407205000_get_phone_for_chatrace_client_with_selection_mode.sql |
| 68 | 20260408213000_fair_gerencia_counter_include_inactive.sql |
| 69 | 20260408220000_fair_gerencia_messages_include_inactive.sql |
| 70 | 20260415113000_from_meta_ads_fbc_or_valid_promo_code.sql |

## Aristas de relaciones creadas más tarde

| Prerrequisito | Consumidor anterior | Objeto | Tipo |
| --- | --- | --- | --- |
| 20260416100000_conversions_config.sql | 20260323183000_drop_test_event_code_from_conversions_config.sql | conversions_config | potential/conditional |
| 20260416100001_conversions.sql | 20260323201000_conversions_add_test_event_code.sql | conversions | potential/conditional |
| 20260416100001_conversions.sql | 20260323201000_conversions_add_test_event_code.sql | conversions | direct-SQL |
| 20260416200000_conversion_logs.sql | 20260325190000_add_meta_payload_response_to_conversion_logs.sql | conversion_logs | potential/conditional |
| 20260416100000_conversions_config.sql | 20260325193000_add_show_logs_to_conversions_config.sql | conversions_config | direct-SQL |
| 20260416100000_conversions_config.sql | 20260325193500_backfill_conversions_config_show_logs.sql | conversions_config | direct-SQL |
| 20260416100001_conversions.sql | 20260325201000_add_internal_id_to_conversions.sql | conversions | potential/conditional |
| 20260416100001_conversions.sql | 20260325201000_add_internal_id_to_conversions.sql | conversions | direct-SQL |
| 20260416100000_conversions_config.sql | 20260326121000_add_tracking_ranking_config.sql | conversions_config | direct-SQL |
| 20260416100001_conversions.sql | 20260326235900_conversion_inbox.sql | conversions | direct-SQL |
| 20260416100000_conversions_config.sql | 20260330160000_conversions_multi_pixel_configs.sql | conversions_config | direct-SQL |
| 20260416100000_conversions_config.sql | 20260330193000_conversions_pixel_configs_add_delivery_flags.sql | conversions_config | direct-SQL |
| 20260416100001_conversions.sql | 20260330193500_conversions_add_meta_pixel_id.sql | conversions | direct-SQL |
| 20260416100000_conversions_config.sql | 20260330193500_conversions_add_meta_pixel_id.sql | conversions_config | direct-SQL |
| 20260416100001_conversions.sql | 20260401102000_conversions_delete_policy.sql | conversions | direct-SQL |
| 20260416100001_conversions.sql | 20260404000100_rename_send_contact_pixel_to_sendContactPixel.sql | conversions | potential/conditional |
| 20260416100000_conversions_config.sql | 20260404000100_rename_send_contact_pixel_to_sendContactPixel.sql | conversions_config | direct-SQL |
| 20260416100000_conversions_config.sql | 20260404000200_restore_default_visible_columns_after_sendContactPixel.sql | conversions_config | direct-SQL |
| 20260416200000_conversion_logs.sql | 20260406203000_hidden_conversion_logs.sql | conversion_logs | direct-SQL |
| 20260416200000_conversion_logs.sql | 20260406235900_logs_payload_received_result.sql | conversion_logs | potential/conditional |
| 20260416200000_conversion_logs.sql | 20260406235900_logs_payload_received_result.sql | conversion_logs | direct-SQL |
| 20260416200000_conversion_logs.sql | 20260407001000_backfill_latency_payload_received.sql | conversion_logs | direct-SQL |
| 20260416100001_conversions.sql | 20260407190000_get_phone_for_chatrace_client.sql | conversions | potential/conditional |
| 20260426009000_chatrace_client_configs.sql | 20260407203000_chatrace_gerencia_selection_mode.sql | chatrace_client_configs | direct-SQL |
| 20260416100001_conversions.sql | 20260407205000_get_phone_for_chatrace_client_with_selection_mode.sql | conversions | potential/conditional |
| 20260416100001_conversions.sql | 20260408213000_fair_gerencia_counter_include_inactive.sql | conversions | potential/conditional |
| 20260416100001_conversions.sql | 20260408220000_fair_gerencia_messages_include_inactive.sql | conversions | potential/conditional |
| 20260416100001_conversions.sql | 20260415113000_from_meta_ads_fbc_or_valid_promo_code.sql | conversions | direct-SQL |
| 20260426130000_create_ar_phone_area_codes.sql | 20260424222000_sanitize_phone_prefix_localidad.sql | ar_phone_area_codes | direct-SQL |

## Objetos locales que referencian conversions

| Migración | Objetos declarados en el statement |
| --- | --- |
| 20260325201000_add_internal_id_to_conversions.sql | index:conversions_internal_id_key |
| 20260326235900_conversion_inbox.sql | table:conversion_inbox |
| 20260401102000_conversions_delete_policy.sql | policy:Users can delete own conversions |
| 20260401102000_conversions_delete_policy.sql | policy:Admins can delete all conversions |
| 20260407190000_get_phone_for_chatrace_client.sql | function:get_phone_for_chatrace_client |
| 20260407205000_get_phone_for_chatrace_client_with_selection_mode.sql | function:get_phone_for_chatrace_client |
| 20260408213000_fair_gerencia_counter_include_inactive.sql | function:get_phone_for_landing |
| 20260408213000_fair_gerencia_counter_include_inactive.sql | function:get_phone_for_chatrace_client |
| 20260408220000_fair_gerencia_messages_include_inactive.sql | function:get_phone_for_landing |
| 20260408220000_fair_gerencia_messages_include_inactive.sql | function:get_phone_for_chatrace_client |
| 20260416100001_conversions.sql | table:conversions |
| 20260416100001_conversions.sql | policy:Users can read own conversions |
| 20260416100001_conversions.sql | policy:Admins can read all conversions |
| 20260416100001_conversions.sql | index:idx_conversions_user_id |
| 20260416100001_conversions.sql | index:idx_conversions_landing_id |
| 20260416100001_conversions.sql | index:idx_conversions_phone |
| 20260416100001_conversions.sql | index:idx_conversions_promo_code |
| 20260416100001_conversions.sql | index:idx_conversions_retry |
| 20260416100001_conversions.sql | index:idx_conversions_created_at |
| 20260416200000_conversion_logs.sql | table:conversion_logs |
| 20260416400000_conversions_update_policy.sql | policy:Users can update own conversions |
| 20260416400000_conversions_update_policy.sql | policy:Admins can update all conversions |
| 20260416500000_funnel_view.sql | view:funnel_contacts |
| 20260416600000_funnel_reached_indicators.sql | view:funnel_contacts |
| 20260418200000_hidden_conversions.sql | table:hidden_conversions |
| 20260419000000_funnel_contacts_telefono_asignado.sql | view:funnel_contacts |
| 20260419100000_revert_funnel_telefono_asignado.sql | view:funnel_contacts |
| 20260420000000_funnel_reached_repeat_by_purchase_count.sql | view:funnel_contacts |
| 20260421000000_funnel_only_leads_and_beyond.sql | view:funnel_contacts |
| 20260422000000_gerencias_fair_criterion.sql | function:get_phone_for_landing |
| 20260423000000_landing_gerencia_selection_mode.sql | function:get_phone_for_landing |
| 20260425000000_conversions_purchase_type.sql | index:idx_conversions_user_purchase_type |
| 20260426120000_conversions_add_from_meta_ads.sql | trigger:trg_set_conversions_from_meta_ads |
| 20260427120000_conversions_add_inferred_sex.sql | trigger:trg_set_conversions_inferred_sex |
| 20260427140000_conversions_add_sex_source.sql | trigger:trg_set_conversions_sex_fields |
| 20260427200000_conversions_contact_dedupe_unique_indexes.sql | index:conversions_user_contact_event_id_uidx |
| 20260427200000_conversions_contact_dedupe_unique_indexes.sql | index:conversions_user_promo_code_contact_uidx |
| 20260430203000_home_overview_stats.sql | function:get_home_overview_stats |
| 20260504174500_home_overview_match_stats_logic.sql | function:get_home_overview_stats |
| 20260506103000_purchase_coelsa_id_dedupe.sql | index:conversions_purchase_coelsa_id_uidx |
| 20260507193000_phone_messages_operational_reset.sql | index:conversions_user_assigned_phone_lead_time_idx |
| 20260507193000_phone_messages_operational_reset.sql | function:get_phone_for_landing |
| 20260507193000_phone_messages_operational_reset.sql | function:get_phone_for_chatrace_client |
| 20260514120000_purchase_transaction_id_dedupe.sql | index:conversions_purchase_transaction_id_uidx |
| 20260514183000_home_overview_inferred_leads.sql | function:get_home_overview_stats |
| 20260519172000_conversions_assigned_gerencia_snapshot.sql | index:conversions_user_assigned_gerencia_idx |
| 20260519172000_conversions_assigned_gerencia_snapshot.sql | index:conversions_assigned_gerencia_label_idx |
| 20260610203000_conversions_main_promo_unique.sql | index:conversions_user_main_promo_code_uidx |
| 20260613120000_contact_lead_capi_retry_flags.sql | index:idx_conversions_contact_capi_retry |
| 20260613120000_contact_lead_capi_retry_flags.sql | index:idx_conversions_lead_capi_retry |
| 20260627183000_promotion_match_backfill_cron.sql | index:idx_conversions_phone_empty_email |
| 20260727220000_conversions_currency.sql | index:idx_conversions_user_currency_created_at |
| 20260727223000_currency_scoped_reporting.sql | function:get_home_overview_stats_by_currency |
| 20260728010000_purchase_pixel_attribution.sql | index:idx_conversions_pixel_attribution_conversion |
| 20260728163000_purchase_event_atomic_claims.sql | table:purchase_event_claims |
| 20260731120000_conversion_event_gerencia_attribution.sql | index:conversions_user_phone_lead_gerencia_idx |
| 20260731120000_conversion_event_gerencia_attribution.sql | index:conversions_user_phone_purchase_gerencia_idx |
| 20260801163000_conversion_player_username.sql | index:idx_conversions_lead_player_username |
| 20260801163000_conversion_player_username.sql | index:idx_conversions_registration_player_username |
| 20260801163000_conversion_player_username.sql | index:idx_conversions_purchase_player_username |
| 20260803110000_phone_metrics_summary.sql | index:conversions_phone_metrics_contacts_idx |
| 20260803110000_phone_metrics_summary.sql | index:conversions_phone_metrics_leads_idx |
| 20260803110000_phone_metrics_summary.sql | function:refresh_phone_metrics |
| 20260805212000_optimize_message_based_phone_assignment.sql | index:conversions_assignment_messages_lookup_idx |
| 20260805213000_add_fk_and_inbox_hot_path_indexes.sql | index:conversions_lead_attribution_conversion_id_idx |
| 20260805213000_add_fk_and_inbox_hot_path_indexes.sql | index:conversions_purchase_attribution_conversion_id_idx |
| 20260805215000_optimize_pg_stat_top_queries.sql | index:conversions_purchase_coelsa_lookup_idx |
| 20260805215000_optimize_pg_stat_top_queries.sql | index:conversions_purchase_transaction_lookup_idx |
| 20260805215000_optimize_pg_stat_top_queries.sql | index:conversions_purchase_retry_created_idx |
| 20260805215000_optimize_pg_stat_top_queries.sql | index:conversions_user_created_at_lookup_idx |
| 20260805215000_optimize_pg_stat_top_queries.sql | index:conversions_phone_metrics_contacts_normalized_idx |
| 20260805215000_optimize_pg_stat_top_queries.sql | index:conversions_phone_metrics_leads_normalized_idx |
| 20260806103000_optimize_phone_metrics_refresh_30min.sql | function:refresh_phone_metrics |
| 20260810172000_whatsapp_cloud_api_module.sql | table:whatsapp_cloud_api_assignments |
| 20260810172000_whatsapp_cloud_api_module.sql | function:get_phone_for_whatsapp_cloud_api |
| 20260811223000_whatsapp_cloud_api_inbox_rpc.sql | function:get_whatsapp_cloud_api_inbox_threads |
| 20260811230000_whatsapp_cloud_api_inbox_inbound_and_labels.sql | function:get_whatsapp_cloud_api_inbox_threads |
| 20260812190000_conversions_dataset_id.sql | index:conversions_dataset_id_idx |
| 20260815161719_workspace_isolation_conversions_inbox.sql | index:conversions_user_currency_created_idx |
| 20260815161719_workspace_isolation_conversions_inbox.sql | function:get_whatsapp_cloud_api_inbox_threads |
| 20260815163940_scope_conversion_logs_by_workspace.sql | function:set_conversion_log_workspace_currency |
| 20260815212157_whatsapp_cloud_api_inbox_interactive_messages.sql | function:get_whatsapp_cloud_api_inbox_threads |
| 20260818031119_whatsapp_cloud_api_redirect_tracking.sql | function:get_whatsapp_cloud_api_inbox_threads |
| 20260818032740_whatsapp_cloud_api_unread_state.sql | function:get_whatsapp_cloud_api_inbox_threads |
| 20260818134748_whatsapp_cloud_api_contact_on_redirect.sql | function:get_whatsapp_cloud_api_inbox_threads |
| 20260818141444_whatsapp_cloud_api_contact_phone_fallback_index.sql | index:conversions_wca_contact_phone_fallback_idx |
| 20260819013754_atrio_conversion_identifiers.sql | index:conversions_user_atrio_promo_idx |
| 20260819013754_atrio_conversion_identifiers.sql | index:conversions_user_atrio_phone_created_idx |
| 20260819013754_atrio_conversion_identifiers.sql | index:conversions_user_lead_atrio_phone_created_idx |
| 20260819013754_atrio_conversion_identifiers.sql | index:conversions_user_purchase_atrio_phone_created_idx |
| 20260819025607_atrio_players_id_tracking.sql | index:conversions_user_atrio_players_idx |
| 20260819025607_atrio_players_id_tracking.sql | index:conversions_user_lead_atrio_players_idx |
| 20260819025607_atrio_players_id_tracking.sql | index:conversions_user_purchase_atrio_players_idx |
| 20260819175021_home_overview_stats_cache_hourly.sql | function:calculate_home_overview_stats_by_currency |
| 20260819175021_home_overview_stats_cache_hourly.sql | function:refresh_home_overview_stats_cache |
| 20260820015442_home_overview_meta_ads_revenue.sql | function:calculate_home_overview_stats_by_currency |
| 20260820020527_home_overview_meta_ads_load_rate.sql | function:calculate_home_overview_stats_by_currency |
| 20260820020830_home_overview_meta_ads_full_summary.sql | function:calculate_home_overview_stats_by_currency |
| 20260821233000_whatsapp_cloud_api_inbox_contacts_pagination.sql | function:get_whatsapp_cloud_api_inbox_threads_page |
| 20260821233000_whatsapp_cloud_api_inbox_contacts_pagination.sql | function:get_whatsapp_cloud_api_contacts_page |
| 20260821235015_optimize_whatsapp_cloud_api_inbox_contacts_queries.sql | index:conversions_wca_external_match_idx |
| 20260821235015_optimize_whatsapp_cloud_api_inbox_contacts_queries.sql | index:conversions_wca_promo_match_idx |
| 20260821235015_optimize_whatsapp_cloud_api_inbox_contacts_queries.sql | function:get_whatsapp_cloud_api_inbox_threads_page |
| 20260821235015_optimize_whatsapp_cloud_api_inbox_contacts_queries.sql | function:get_whatsapp_cloud_api_contacts_page |
| 20260821235359_add_wca_conversion_expression_indexes.sql | index:conversions_wca_external_currency_expr_idx |
| 20260821235359_add_wca_conversion_expression_indexes.sql | index:conversions_wca_promo_currency_expr_idx |
| 20260821235823_add_wca_promo_first_conversion_index.sql | index:conversions_wca_user_promo_currency_expr_idx |
| 20260821235823_add_wca_promo_first_conversion_index.sql | index:conversions_wca_user_external_currency_expr_idx |
| 20260822162110_landing_atrio_redirect_assignments.sql | function:get_atrio_for_landing |
| 20260822172211_whatsapp_cloud_api_retarget_cron.sql | function:claim_whatsapp_cloud_api_retarget_candidates |
| 20260822173226_whatsapp_cloud_api_retarget_once_per_contact.sql | function:claim_whatsapp_cloud_api_retarget_candidates |
| 20260822192456_whatsapp_cloud_api_retargeting_switch.sql | function:claim_whatsapp_cloud_api_retarget_candidates |
| 20260823202650_fix_wca_retarget_inbox_filters.sql | function:claim_whatsapp_cloud_api_retarget_candidates |
| 20260823202650_fix_wca_retarget_inbox_filters.sql | function:get_whatsapp_cloud_api_inbox_threads_page |
| 20260823202650_fix_wca_retarget_inbox_filters.sql | function:mark_whatsapp_cloud_api_threads_read |
| 20260823203423_enforce_wca_retarget_min_age.sql | function:claim_whatsapp_cloud_api_retarget_candidates |
| 20260825172003_whatsapp_cloud_api_retarget_config.sql | function:claim_whatsapp_cloud_api_retarget_candidates |
| 20260825192821_whatsapp_cloud_api_inbox_date_filter.sql | function:get_whatsapp_cloud_api_inbox_threads_page |
| 20260825192821_whatsapp_cloud_api_inbox_date_filter.sql | function:mark_whatsapp_cloud_api_threads_read |
| 20260905012831_fair_message_assignment_reservations.sql | table:landing_phone_assignment_reservations |
| 20260905012831_fair_message_assignment_reservations.sql | index:conversions_landing_assignment_messages_lookup_idx |
| 20260905012831_fair_message_assignment_reservations.sql | function:private.landing_phone_message_load |
| 20260905012831_fair_message_assignment_reservations.sql | trigger:close_landing_phone_reservation_on_lead |
| 20260911175635_meta_audience_buyers_rpc.sql | index:conversions_meta_audience_purchase_idx |
| 20260911175635_meta_audience_buyers_rpc.sql | function:get_meta_audience_buyers |
| 20260911180151_optimize_meta_audience_buyers_rpc.sql | function:get_meta_audience_buyers |
| 20260911180712_speed_up_meta_audience_buyers_rpc.sql | function:get_meta_audience_buyers |
| 20260911200034_meta_audience_buyers_v2.sql | function:get_meta_audience_buyers_v2 |
| 20260915190657_optimize_purchase_capi_retry_queue.sql | index:conversions_purchase_capi_retryable_created_idx |
