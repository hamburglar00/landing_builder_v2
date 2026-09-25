-- Sanitized DBA review package. Read-only hosted catalog snapshot.
-- captured_at_utc=2026-09-25 16:51:31.875254
-- ledger_last=20260925023009
-- No table rows, most-common values, credentials, endpoints, or personal data are included.

-- Table public.conversion_journey_starts (hosted metadata, no row data)
-- approximate_rows=12615; table_bytes=11911168; indexes_bytes=25272320; total_bytes=37224448; last_analyze=2026-09-25 14:47:47.294495+00
-- rls_enabled=t; force_rls=f
CREATE TABLE public.conversion_journey_starts (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  source_platform text NOT NULL,
  start_identity_key text NOT NULL,
  landing_id uuid,
  landing_name text DEFAULT ''::text NOT NULL,
  workspace_currency text DEFAULT 'ARS'::text NOT NULL,
  external_id text DEFAULT ''::text NOT NULL,
  phone text DEFAULT ''::text NOT NULL,
  wa_id text DEFAULT ''::text NOT NULL,
  email text DEFAULT ''::text NOT NULL,
  utm_campaign text DEFAULT ''::text NOT NULL,
  fbp text DEFAULT ''::text NOT NULL,
  fbc text DEFAULT ''::text NOT NULL,
  from_meta_ads boolean DEFAULT false NOT NULL,
  meta_pixel_id text DEFAULT ''::text NOT NULL,
  dataset_id text DEFAULT ''::text NOT NULL,
  ctwa_clid text DEFAULT ''::text NOT NULL,
  telefono_asignado text DEFAULT ''::text NOT NULL,
  assigned_gerencia_id integer,
  assigned_gerencia_external_id integer,
  assigned_gerencia_name text,
  assigned_gerencia_label text,
  device_type text DEFAULT ''::text NOT NULL,
  event_source_url text DEFAULT ''::text NOT NULL,
  client_ip text DEFAULT ''::text NOT NULL,
  agent_user text DEFAULT ''::text NOT NULL,
  first_seen_at timestamp with time zone DEFAULT now() NOT NULL,
  last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL);


ALTER TABLE ONLY public.conversion_journey_starts ADD CONSTRAINT conversion_journey_starts_assigned_gerencia_id_fkey FOREIGN KEY (assigned_gerencia_id) REFERENCES gerencias(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.conversion_journey_starts ADD CONSTRAINT conversion_journey_starts_identity_unique UNIQUE (user_id, source_platform, start_identity_key);
ALTER TABLE ONLY public.conversion_journey_starts ADD CONSTRAINT conversion_journey_starts_landing_id_fkey FOREIGN KEY (landing_id) REFERENCES landings(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.conversion_journey_starts ADD CONSTRAINT conversion_journey_starts_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.conversion_journey_starts ADD CONSTRAINT conversion_journey_starts_source_platform_check CHECK (source_platform = ANY (ARRAY['landing'::text, 'whatsapp_cloud_api'::text]));
ALTER TABLE ONLY public.conversion_journey_starts ADD CONSTRAINT conversion_journey_starts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.conversion_journey_starts ADD CONSTRAINT conversion_journey_starts_workspace_currency_check CHECK (workspace_currency = ANY (ARRAY['ARS'::text, 'PYG'::text]));

CREATE INDEX conversion_journey_starts_external_idx ON public.conversion_journey_starts USING btree (user_id, source_platform, external_id) WHERE (external_id <> ''::text);
CREATE UNIQUE INDEX conversion_journey_starts_identity_unique ON public.conversion_journey_starts USING btree (user_id, source_platform, start_identity_key);
CREATE INDEX conversion_journey_starts_landing_seen_idx ON public.conversion_journey_starts USING btree (landing_id, first_seen_at DESC) WHERE (landing_id IS NOT NULL);
CREATE INDEX conversion_journey_starts_phone_idx ON public.conversion_journey_starts USING btree (user_id, source_platform, phone) WHERE (phone <> ''::text);
CREATE UNIQUE INDEX conversion_journey_starts_pkey ON public.conversion_journey_starts USING btree (id);
CREATE INDEX conversion_journey_starts_source_seen_idx ON public.conversion_journey_starts USING btree (source_platform, first_seen_at DESC);
CREATE INDEX conversion_journey_starts_user_seen_idx ON public.conversion_journey_starts USING btree (user_id, first_seen_at DESC);



-- Table public.conversion_view_preferences (hosted metadata, no row data)
-- approximate_rows=-1; table_bytes=8192; indexes_bytes=16384; total_bytes=24576; last_analyze=unknown
-- rls_enabled=t; force_rls=f
CREATE TABLE public.conversion_view_preferences (
  hidden_by uuid NOT NULL,
  visible_from timestamp with time zone,
  updated_at timestamp with time zone DEFAULT now() NOT NULL);


ALTER TABLE ONLY public.conversion_view_preferences ADD CONSTRAINT conversion_view_preferences_hidden_by_fkey FOREIGN KEY (hidden_by) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.conversion_view_preferences ADD CONSTRAINT conversion_view_preferences_pkey PRIMARY KEY (hidden_by);

CREATE UNIQUE INDEX conversion_view_preferences_pkey ON public.conversion_view_preferences USING btree (hidden_by);



-- Table public.conversions (hosted metadata, no row data)
-- approximate_rows=85538; table_bytes=212377600; indexes_bytes=232153088; total_bytes=511377408; last_analyze=2026-09-25 15:44:17.708594+00
-- rls_enabled=t; force_rls=f
CREATE TABLE public.conversions (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  landing_id uuid,
  user_id uuid NOT NULL,
  landing_name text DEFAULT ''::text NOT NULL,
  phone text DEFAULT ''::text NOT NULL,
  email text DEFAULT ''::text NOT NULL,
  fn text DEFAULT ''::text NOT NULL,
  ln text DEFAULT ''::text NOT NULL,
  ct text DEFAULT ''::text NOT NULL,
  st text DEFAULT ''::text NOT NULL,
  zip text DEFAULT ''::text NOT NULL,
  country text DEFAULT ''::text NOT NULL,
  fbp text DEFAULT ''::text NOT NULL,
  fbc text DEFAULT ''::text NOT NULL,
  contact_event_id text DEFAULT ''::text NOT NULL,
  contact_event_time bigint,
  lead_event_id text DEFAULT ''::text NOT NULL,
  lead_event_time bigint,
  purchase_event_id text DEFAULT ''::text NOT NULL,
  purchase_event_time bigint,
  client_ip text DEFAULT ''::text NOT NULL,
  agent_user text DEFAULT ''::text NOT NULL,
  device_type text DEFAULT ''::text NOT NULL,
  event_source_url text DEFAULT ''::text NOT NULL,
  estado text DEFAULT 'contact'::text NOT NULL,
  valor numeric DEFAULT 0 NOT NULL,
  contact_status_capi text DEFAULT ''::text NOT NULL,
  lead_status_capi text DEFAULT ''::text NOT NULL,
  purchase_status_capi text DEFAULT ''::text NOT NULL,
  observaciones text DEFAULT ''::text NOT NULL,
  external_id text DEFAULT ''::text NOT NULL,
  utm_campaign text DEFAULT ''::text NOT NULL,
  telefono_asignado text DEFAULT ''::text NOT NULL,
  promo_code text DEFAULT ''::text NOT NULL,
  geo_city text DEFAULT ''::text NOT NULL,
  geo_region text DEFAULT ''::text NOT NULL,
  geo_country text DEFAULT ''::text NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  purchase_type text,
  test_event_code text DEFAULT ''::text NOT NULL,
  lead_payload_raw text DEFAULT ''::text NOT NULL,
  purchase_payload_raw text DEFAULT ''::text NOT NULL,
  internal_id bigint DEFAULT nextval('conversions_internal_id_seq'::regclass),
  contact_payload_raw text DEFAULT ''::text NOT NULL,
  pixel_id text DEFAULT ''::text NOT NULL,
  meta_pixel_id text DEFAULT ''::text NOT NULL,
  "sendContactPixel" boolean DEFAULT false NOT NULL,
  source_platform text DEFAULT ''::text NOT NULL,
  from_meta_ads boolean DEFAULT false NOT NULL,
  geo_source text DEFAULT 'none'::text NOT NULL,
  cuit_cuil text DEFAULT ''::text NOT NULL,
  inferred_sex text DEFAULT 'unknown'::text NOT NULL,
  sex_source text DEFAULT 'unknown'::text NOT NULL,
  purchase_coelsa_id text DEFAULT ''::text NOT NULL,
  purchase_transaction_id text DEFAULT ''::text NOT NULL,
  assigned_gerencia_id integer,
  assigned_gerencia_external_id integer,
  assigned_gerencia_name text,
  assigned_gerencia_label text,
  contact_capi_retryable boolean DEFAULT false NOT NULL,
  lead_capi_retryable boolean DEFAULT false NOT NULL,
  contact_capi_retry_count integer DEFAULT 0 NOT NULL,
  lead_capi_retry_count integer DEFAULT 0 NOT NULL,
  contact_capi_last_retry_at timestamp with time zone,
  lead_capi_last_retry_at timestamp with time zone,
  ctwa_clid text DEFAULT ''::text NOT NULL,
  purchase_capi_route text DEFAULT ''::text NOT NULL,
  purchase_capi_route_reason text DEFAULT ''::text NOT NULL,
  currency text DEFAULT 'ARS'::text NOT NULL,
  pixel_attribution_source text DEFAULT ''::text NOT NULL,
  pixel_attribution_conversion_id uuid,
  lead_bot_phone text DEFAULT ''::text NOT NULL,
  lead_agency_id text DEFAULT ''::text NOT NULL,
  lead_gerencia_id integer,
  lead_gerencia_external_id integer,
  lead_gerencia_name text DEFAULT ''::text NOT NULL,
  lead_gerencia_label text DEFAULT ''::text NOT NULL,
  lead_incoming_promo_code text DEFAULT ''::text NOT NULL,
  lead_attribution_status text DEFAULT ''::text NOT NULL,
  lead_attribution_conversion_id uuid,
  purchase_bot_phone text DEFAULT ''::text NOT NULL,
  purchase_agency_id text DEFAULT ''::text NOT NULL,
  purchase_gerencia_id integer,
  purchase_gerencia_external_id integer,
  purchase_gerencia_name text DEFAULT ''::text NOT NULL,
  purchase_gerencia_label text DEFAULT ''::text NOT NULL,
  purchase_incoming_promo_code text DEFAULT ''::text NOT NULL,
  purchase_attribution_status text DEFAULT ''::text NOT NULL,
  purchase_attribution_conversion_id uuid,
  lead_player_username text DEFAULT ''::text NOT NULL,
  registration_event_id text DEFAULT ''::text NOT NULL,
  registration_event_time bigint,
  registration_payload_raw text DEFAULT ''::text NOT NULL,
  registration_player_username text DEFAULT ''::text NOT NULL,
  registration_bot_phone text DEFAULT ''::text NOT NULL,
  registration_agency_id text DEFAULT ''::text NOT NULL,
  registration_gerencia_id integer,
  registration_gerencia_external_id integer,
  registration_gerencia_name text DEFAULT ''::text NOT NULL,
  registration_gerencia_label text DEFAULT ''::text NOT NULL,
  registration_incoming_promo_code text DEFAULT ''::text NOT NULL,
  registration_attribution_status text DEFAULT ''::text NOT NULL,
  registration_attribution_conversion_id uuid,
  purchase_player_username text DEFAULT ''::text NOT NULL,
  registration_status_capi text DEFAULT ''::text NOT NULL,
  form_fn text DEFAULT ''::text NOT NULL,
  form_ln text DEFAULT ''::text NOT NULL,
  form_email text DEFAULT ''::text NOT NULL,
  form_phone text DEFAULT ''::text NOT NULL,
  dataset_id text DEFAULT ''::text NOT NULL,
  workspace_resolution_source text DEFAULT 'legacy_default'::text NOT NULL,
  atrio_id text,
  atrio_client_id uuid,
  atrio_slug text,
  lead_atrio_id text,
  purchase_atrio_id text,
  registration_atrio_id text,
  atrio_players_id text DEFAULT ''::text NOT NULL,
  lead_atrio_players_id text DEFAULT ''::text NOT NULL,
  purchase_atrio_players_id text DEFAULT ''::text NOT NULL,
  registration_atrio_players_id text DEFAULT ''::text NOT NULL);


ALTER TABLE ONLY public.conversions ADD CONSTRAINT conversions_currency_iso_code_check CHECK (currency ~ '^[A-Z]{3}$'::text);
ALTER TABLE ONLY public.conversions ADD CONSTRAINT conversions_estado_check CHECK (estado = ANY (ARRAY['contact'::text, 'lead'::text, 'purchase'::text]));
ALTER TABLE ONLY public.conversions ADD CONSTRAINT conversions_geo_source_check CHECK (geo_source = ANY (ARRAY['payload'::text, 'ip'::text, 'phone_prefix'::text, 'none'::text]));
ALTER TABLE ONLY public.conversions ADD CONSTRAINT conversions_inferred_sex_check CHECK (inferred_sex = ANY (ARRAY['male'::text, 'female'::text, 'unknown'::text]));
ALTER TABLE ONLY public.conversions ADD CONSTRAINT conversions_landing_id_fkey FOREIGN KEY (landing_id) REFERENCES landings(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.conversions ADD CONSTRAINT conversions_lead_attribution_conversion_id_fkey FOREIGN KEY (lead_attribution_conversion_id) REFERENCES conversions(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.conversions ADD CONSTRAINT conversions_pixel_attribution_conversion_id_fkey FOREIGN KEY (pixel_attribution_conversion_id) REFERENCES conversions(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.conversions ADD CONSTRAINT conversions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.conversions ADD CONSTRAINT conversions_purchase_attribution_conversion_id_fkey FOREIGN KEY (purchase_attribution_conversion_id) REFERENCES conversions(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.conversions ADD CONSTRAINT conversions_purchase_capi_route_check CHECK (purchase_capi_route = ANY (ARRAY[''::text, 'website'::text, 'business_messaging'::text]));
ALTER TABLE ONLY public.conversions ADD CONSTRAINT conversions_purchase_type_check CHECK (purchase_type IS NULL OR (purchase_type = ANY (ARRAY['first'::text, 'repeat'::text])));
ALTER TABLE ONLY public.conversions ADD CONSTRAINT conversions_sex_source_check CHECK (sex_source = ANY (ARRAY['cuit_cuil'::text, 'name_catalog'::text, 'unknown'::text]));
ALTER TABLE ONLY public.conversions ADD CONSTRAINT conversions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX conversions_assigned_gerencia_label_idx ON public.conversions USING btree (assigned_gerencia_label);
CREATE INDEX conversions_assignment_messages_lookup_idx ON public.conversions USING btree (user_id, telefono_asignado, lead_event_time, created_at) WHERE ((lead_event_id <> ''::text) AND (telefono_asignado <> ''::text));
CREATE INDEX conversions_dataset_id_idx ON public.conversions USING btree (dataset_id) WHERE (dataset_id <> ''::text);
CREATE UNIQUE INDEX conversions_internal_id_key ON public.conversions USING btree (internal_id);
CREATE INDEX conversions_landing_assignment_messages_lookup_idx ON public.conversions USING btree (landing_id, user_id, telefono_asignado, lead_event_time, created_at) WHERE ((lead_event_id <> ''::text) AND (telefono_asignado <> ''::text));
CREATE INDEX conversions_lead_attribution_conversion_id_idx ON public.conversions USING btree (lead_attribution_conversion_id) WHERE (lead_attribution_conversion_id IS NOT NULL);
CREATE INDEX conversions_meta_audience_purchase_idx ON public.conversions USING btree (user_id, currency, purchase_event_time, created_at) WHERE (((estado = 'purchase'::text) OR (NULLIF(TRIM(BOTH FROM COALESCE(purchase_event_id, ''::text)), ''::text) IS NOT NULL)) AND (NULLIF(TRIM(BOTH FROM COALESCE(test_event_code, ''::text)), ''::text) IS NULL));
CREATE INDEX conversions_phone_metrics_contacts_idx ON public.conversions USING btree (user_id, external_id) WHERE ((COALESCE(contact_event_id, ''::text) <> ''::text) AND (COALESCE(external_id, ''::text) <> ''::text) AND (COALESCE(telefono_asignado, ''::text) <> ''::text) AND (COALESCE(test_event_code, ''::text) = ''::text));
CREATE INDEX conversions_phone_metrics_contacts_normalized_idx ON public.conversions USING btree (user_id, TRIM(BOTH FROM COALESCE(external_id, ''::text))) WHERE ((COALESCE(contact_event_id, ''::text) <> ''::text) AND (TRIM(BOTH FROM COALESCE(external_id, ''::text)) <> ''::text) AND (NULLIF(regexp_replace(COALESCE(telefono_asignado, ''::text), '\D'::text, ''::text, 'g'::text), ''::text) IS NOT NULL) AND (COALESCE(test_event_code, ''::text) = ''::text));
CREATE INDEX conversions_phone_metrics_leads_idx ON public.conversions USING btree (user_id, telefono_asignado, external_id, lead_event_time) WHERE ((COALESCE(lead_event_id, ''::text) <> ''::text) AND (COALESCE(external_id, ''::text) <> ''::text) AND (COALESCE(telefono_asignado, ''::text) <> ''::text) AND (COALESCE(test_event_code, ''::text) = ''::text));
CREATE INDEX conversions_phone_metrics_leads_normalized_idx ON public.conversions USING btree (user_id, regexp_replace(COALESCE(telefono_asignado, ''::text), '\D'::text, ''::text, 'g'::text), TRIM(BOTH FROM COALESCE(external_id, ''::text)), lead_event_time) WHERE ((COALESCE(lead_event_id, ''::text) <> ''::text) AND (TRIM(BOTH FROM COALESCE(external_id, ''::text)) <> ''::text) AND (NULLIF(regexp_replace(COALESCE(telefono_asignado, ''::text), '\D'::text, ''::text, 'g'::text), ''::text) IS NOT NULL) AND (COALESCE(test_event_code, ''::text) = ''::text));
CREATE UNIQUE INDEX conversions_pkey ON public.conversions USING btree (id);
CREATE INDEX conversions_purchase_attribution_conversion_id_idx ON public.conversions USING btree (purchase_attribution_conversion_id) WHERE (purchase_attribution_conversion_id IS NOT NULL);
CREATE INDEX conversions_purchase_capi_retryable_created_idx ON public.conversions USING btree (created_at) WHERE ((estado = 'purchase'::text) AND (valor > (0)::numeric) AND (purchase_status_capi = ANY (ARRAY[''::text, 'error'::text])));
CREATE UNIQUE INDEX conversions_purchase_coelsa_id_uidx ON public.conversions USING btree (user_id, purchase_coelsa_id) WHERE (COALESCE(purchase_coelsa_id, ''::text) <> ''::text);
CREATE INDEX conversions_purchase_coelsa_lookup_idx ON public.conversions USING btree (user_id, purchase_coelsa_id, created_at DESC) INCLUDE (id, purchase_event_id, estado);
CREATE INDEX conversions_purchase_retry_created_idx ON public.conversions USING btree (estado, created_at) INCLUDE (valor, purchase_status_capi);
CREATE UNIQUE INDEX conversions_purchase_transaction_id_uidx ON public.conversions USING btree (user_id, purchase_transaction_id) WHERE (COALESCE(purchase_transaction_id, ''::text) <> ''::text);
CREATE INDEX conversions_purchase_transaction_lookup_idx ON public.conversions USING btree (user_id, purchase_transaction_id, created_at DESC) INCLUDE (id, purchase_event_id, estado);
CREATE INDEX conversions_user_assigned_gerencia_idx ON public.conversions USING btree (user_id, assigned_gerencia_id);
CREATE INDEX conversions_user_assigned_phone_lead_time_idx ON public.conversions USING btree (user_id, telefono_asignado, lead_event_time) WHERE (COALESCE(lead_event_id, ''::text) <> ''::text);
CREATE INDEX conversions_user_atrio_phone_created_idx ON public.conversions USING btree (user_id, atrio_id, phone, created_at DESC) WHERE ((COALESCE(atrio_id, ''::text) <> ''::text) AND (COALESCE(phone, ''::text) <> ''::text));
CREATE INDEX conversions_user_atrio_players_idx ON public.conversions USING btree (user_id, atrio_players_id, created_at DESC) WHERE (COALESCE(atrio_players_id, ''::text) <> ''::text);
CREATE INDEX conversions_user_atrio_promo_idx ON public.conversions USING btree (user_id, atrio_id, promo_code) WHERE ((COALESCE(atrio_id, ''::text) <> ''::text) AND (COALESCE(promo_code, ''::text) <> ''::text));
CREATE UNIQUE INDEX conversions_user_contact_event_id_uidx ON public.conversions USING btree (user_id, contact_event_id) WHERE (contact_event_id <> ''::text);
CREATE INDEX conversions_user_created_at_lookup_idx ON public.conversions USING btree (user_id, created_at DESC) INCLUDE (phone, estado, valor, currency, purchase_event_id, test_event_code);
CREATE INDEX conversions_user_currency_created_idx ON public.conversions USING btree (user_id, currency, created_at DESC);
CREATE INDEX conversions_user_lead_atrio_phone_created_idx ON public.conversions USING btree (user_id, lead_atrio_id, phone, created_at DESC) WHERE ((COALESCE(lead_atrio_id, ''::text) <> ''::text) AND (COALESCE(phone, ''::text) <> ''::text));
CREATE INDEX conversions_user_lead_atrio_players_idx ON public.conversions USING btree (user_id, lead_atrio_players_id, created_at DESC) WHERE (COALESCE(lead_atrio_players_id, ''::text) <> ''::text);
CREATE UNIQUE INDEX conversions_user_main_promo_code_uidx ON public.conversions USING btree (user_id, promo_code) WHERE ((COALESCE(promo_code, ''::text) ~ '^[A-Za-z0-9]+-[A-Za-z0-9]+$'::text) AND (COALESCE(purchase_type, ''::text) <> 'repeat'::text));
CREATE INDEX conversions_user_phone_lead_gerencia_idx ON public.conversions USING btree (user_id, phone, lead_gerencia_id, created_at DESC) WHERE (lead_event_id <> ''::text);
CREATE INDEX conversions_user_phone_purchase_gerencia_idx ON public.conversions USING btree (user_id, phone, purchase_gerencia_id, created_at DESC) WHERE (purchase_event_id <> ''::text);
CREATE UNIQUE INDEX conversions_user_promo_code_contact_uidx ON public.conversions USING btree (user_id, promo_code) WHERE ((promo_code <> ''::text) AND (estado = 'contact'::text));
CREATE INDEX conversions_user_purchase_atrio_phone_created_idx ON public.conversions USING btree (user_id, purchase_atrio_id, phone, created_at DESC) WHERE ((COALESCE(purchase_atrio_id, ''::text) <> ''::text) AND (COALESCE(phone, ''::text) <> ''::text));
CREATE INDEX conversions_user_purchase_atrio_players_idx ON public.conversions USING btree (user_id, purchase_atrio_players_id, created_at DESC) WHERE (COALESCE(purchase_atrio_players_id, ''::text) <> ''::text);
CREATE INDEX conversions_wca_contact_phone_fallback_idx ON public.conversions USING btree (user_id, phone, assigned_gerencia_id, telefono_asignado, created_at DESC) WHERE ((estado = 'contact'::text) AND (source_platform = 'whatsapp_cloud_api'::text));
CREATE INDEX conversions_wca_external_match_idx ON public.conversions USING btree (user_id, currency, external_id) WHERE ((external_id <> ''::text) AND (COALESCE(test_event_code, ''::text) = ''::text));
CREATE INDEX conversions_wca_promo_match_idx ON public.conversions USING btree (user_id, currency, promo_code) WHERE ((promo_code <> ''::text) AND (COALESCE(test_event_code, ''::text) = ''::text));
CREATE INDEX conversions_wca_user_external_currency_expr_idx ON public.conversions USING btree (user_id, external_id, COALESCE(currency, 'ARS'::text)) WHERE ((external_id <> ''::text) AND (COALESCE(test_event_code, ''::text) = ''::text));
CREATE INDEX conversions_wca_user_promo_currency_expr_idx ON public.conversions USING btree (user_id, promo_code, COALESCE(currency, 'ARS'::text)) WHERE ((promo_code <> ''::text) AND (COALESCE(test_event_code, ''::text) = ''::text));
CREATE INDEX idx_conversions_contact_capi_retry ON public.conversions USING btree (created_at) WHERE ((contact_capi_retryable = true) AND (contact_status_capi = 'error'::text));
CREATE INDEX idx_conversions_created_at ON public.conversions USING btree (created_at DESC);
CREATE INDEX idx_conversions_landing_id ON public.conversions USING btree (landing_id);
CREATE INDEX idx_conversions_lead_capi_retry ON public.conversions USING btree (created_at) WHERE ((lead_capi_retryable = true) AND (lead_status_capi = 'error'::text));
CREATE INDEX idx_conversions_lead_player_username ON public.conversions USING btree (user_id, lead_player_username) WHERE (lead_player_username <> ''::text);
CREATE INDEX idx_conversions_phone ON public.conversions USING btree (phone) WHERE (phone <> ''::text);
CREATE INDEX idx_conversions_phone_empty_email ON public.conversions USING btree (phone) WHERE ((phone <> ''::text) AND (email = ''::text));
CREATE INDEX idx_conversions_pixel_attribution_conversion ON public.conversions USING btree (pixel_attribution_conversion_id) WHERE (pixel_attribution_conversion_id IS NOT NULL);
CREATE INDEX idx_conversions_promo_code ON public.conversions USING btree (promo_code) WHERE (promo_code <> ''::text);
CREATE INDEX idx_conversions_purchase_player_username ON public.conversions USING btree (user_id, purchase_player_username) WHERE (purchase_player_username <> ''::text);
CREATE INDEX idx_conversions_registration_player_username ON public.conversions USING btree (user_id, registration_player_username) WHERE (registration_player_username <> ''::text);
CREATE INDEX idx_conversions_retry ON public.conversions USING btree (estado, purchase_status_capi) WHERE ((estado = 'purchase'::text) AND (purchase_status_capi <> 'enviado'::text));
CREATE INDEX idx_conversions_user_currency_created_at ON public.conversions USING btree (user_id, currency, created_at DESC);
CREATE INDEX idx_conversions_user_id ON public.conversions USING btree (user_id);
CREATE INDEX idx_conversions_user_promo_created ON public.conversions USING btree (user_id, promo_code, created_at);
CREATE INDEX idx_conversions_user_purchase_type ON public.conversions USING btree (user_id, purchase_type);



-- Table public.conversions_config (hosted metadata, no row data)
-- approximate_rows=7; table_bytes=106496; indexes_bytes=24576; total_bytes=172032; last_analyze=unknown
-- rls_enabled=t; force_rls=f
CREATE TABLE public.conversions_config (
  user_id uuid NOT NULL,
  pixel_id text DEFAULT ''::text NOT NULL,
  meta_access_token text DEFAULT ''::text NOT NULL,
  meta_currency text DEFAULT 'ARS'::text NOT NULL,
  meta_api_version text DEFAULT 'v25.0'::text NOT NULL,
  send_contact_capi boolean DEFAULT false NOT NULL,
  geo_use_ipapi boolean DEFAULT false NOT NULL,
  geo_fill_only_when_missing boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  slug text DEFAULT ''::text NOT NULL,
  funnel_premium_threshold numeric DEFAULT 50000 NOT NULL,
  visible_columns text[] DEFAULT ARRAY[]::text[] NOT NULL,
  show_logs boolean DEFAULT true NOT NULL,
  tracking_ranking_config jsonb,
  show_ai_assistant boolean DEFAULT false NOT NULL,
  show_inbox boolean DEFAULT false NOT NULL,
  show_promotions boolean DEFAULT false NOT NULL,
  phone_auto_reset_daily boolean DEFAULT false NOT NULL,
  phone_auto_reset_last_date date,
  send_lead_capi boolean DEFAULT true NOT NULL,
  send_purchase_capi boolean DEFAULT true NOT NULL,
  send_first_purchase_capi boolean DEFAULT true NOT NULL,
  send_repeat_purchase_capi boolean DEFAULT true NOT NULL,
  send_geo_capi boolean DEFAULT true NOT NULL,
  include_purchase_type_capi boolean DEFAULT true NOT NULL,
  funnel_premium_thresholds jsonb DEFAULT '{"ARS": 50000}'::jsonb NOT NULL,
  tracking_ranking_configs jsonb DEFAULT '{}'::jsonb NOT NULL,
  meta_ads_only_capi boolean DEFAULT false NOT NULL,
  send_complete_registration_capi boolean DEFAULT false NOT NULL,
  purchase_capi_min_amount_enabled boolean DEFAULT false NOT NULL,
  purchase_capi_min_amounts jsonb DEFAULT '{"ARS": 0, "PYG": 0}'::jsonb NOT NULL);


ALTER TABLE ONLY public.conversions_config ADD CONSTRAINT conversions_config_pixel_id_numeric CHECK (pixel_id ~ '^[0-9]*$'::text);
ALTER TABLE ONLY public.conversions_config ADD CONSTRAINT conversions_config_pkey PRIMARY KEY (user_id);
ALTER TABLE ONLY public.conversions_config ADD CONSTRAINT conversions_config_premium_thresholds_object_check CHECK (jsonb_typeof(funnel_premium_thresholds) = 'object'::text);
ALTER TABLE ONLY public.conversions_config ADD CONSTRAINT conversions_config_purchase_capi_min_amounts_object_check CHECK (jsonb_typeof(purchase_capi_min_amounts) = 'object'::text);
ALTER TABLE ONLY public.conversions_config ADD CONSTRAINT conversions_config_slug_format CHECK (slug ~ '^[a-z0-9]*$'::text);
ALTER TABLE ONLY public.conversions_config ADD CONSTRAINT conversions_config_tracking_ranking_configs_object_check CHECK (jsonb_typeof(tracking_ranking_configs) = 'object'::text);
ALTER TABLE ONLY public.conversions_config ADD CONSTRAINT conversions_config_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX conversions_config_pkey ON public.conversions_config USING btree (user_id);
CREATE UNIQUE INDEX conversions_config_slug_unique ON public.conversions_config USING btree (slug) WHERE (slug <> ''::text);



-- Table public.conversions_pixel_configs (hosted metadata, no row data)
-- approximate_rows=15; table_bytes=16384; indexes_bytes=49152; total_bytes=106496; last_analyze=unknown
-- rls_enabled=t; force_rls=f
CREATE TABLE public.conversions_pixel_configs (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  pixel_id text NOT NULL,
  meta_access_token text NOT NULL,
  meta_currency text DEFAULT 'ARS'::text NOT NULL,
  meta_api_version text DEFAULT 'v25.0'::text NOT NULL,
  is_default boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  send_contact_capi boolean DEFAULT false NOT NULL,
  geo_use_ipapi boolean DEFAULT false NOT NULL,
  geo_fill_only_when_missing boolean DEFAULT false NOT NULL,
  comment text DEFAULT ''::text NOT NULL,
  send_lead_capi boolean DEFAULT true NOT NULL,
  send_purchase_capi boolean DEFAULT true NOT NULL,
  send_first_purchase_capi boolean DEFAULT true NOT NULL,
  send_repeat_purchase_capi boolean DEFAULT true NOT NULL,
  send_geo_capi boolean DEFAULT true NOT NULL,
  include_purchase_type_capi boolean DEFAULT true NOT NULL,
  meta_ads_only_capi boolean DEFAULT false NOT NULL,
  send_complete_registration_capi boolean DEFAULT false NOT NULL);


ALTER TABLE ONLY public.conversions_pixel_configs ADD CONSTRAINT conversions_pixel_configs_currency_len CHECK (char_length(meta_currency) >= 3 AND char_length(meta_currency) <= 8);
ALTER TABLE ONLY public.conversions_pixel_configs ADD CONSTRAINT conversions_pixel_configs_pixel_id_numeric CHECK (pixel_id ~ '^[0-9]+$'::text);
ALTER TABLE ONLY public.conversions_pixel_configs ADD CONSTRAINT conversions_pixel_configs_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.conversions_pixel_configs ADD CONSTRAINT conversions_pixel_configs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX conversions_pixel_configs_pkey ON public.conversions_pixel_configs USING btree (id);
CREATE UNIQUE INDEX conversions_pixel_configs_user_default_unique ON public.conversions_pixel_configs USING btree (user_id) WHERE (is_default = true);
CREATE UNIQUE INDEX conversions_pixel_configs_user_pixel_unique ON public.conversions_pixel_configs USING btree (user_id, pixel_id);



-- Table public.gerencia_phones (hosted metadata, no row data)
-- approximate_rows=390; table_bytes=155648; indexes_bytes=188416; total_bytes=385024; last_analyze=2026-09-25 16:50:52.586564+00
-- rls_enabled=t; force_rls=f
CREATE TABLE public.gerencia_phones (
  id bigint DEFAULT nextval('gerencia_phones_id_seq'::regclass) NOT NULL,
  gerencia_id integer NOT NULL,
  phone text NOT NULL,
  status text DEFAULT 'active'::text NOT NULL,
  usage_count bigint DEFAULT 0 NOT NULL,
  last_seen_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  kind text DEFAULT 'carga'::text NOT NULL,
  comment text DEFAULT ''::text NOT NULL,
  messages_reset_at timestamp with time zone,
  source_available boolean DEFAULT true NOT NULL,
  assignment_role text DEFAULT 'acquisition'::text NOT NULL);


ALTER TABLE ONLY public.gerencia_phones ADD CONSTRAINT gerencia_phones_assignment_role_check CHECK (assignment_role = ANY (ARRAY['acquisition'::text, 'follow_up'::text]));
ALTER TABLE ONLY public.gerencia_phones ADD CONSTRAINT gerencia_phones_gerencia_id_fkey FOREIGN KEY (gerencia_id) REFERENCES gerencias(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public.gerencia_phones ADD CONSTRAINT gerencia_phones_gerencia_id_phone_key UNIQUE (gerencia_id, phone);
ALTER TABLE ONLY public.gerencia_phones ADD CONSTRAINT gerencia_phones_kind_check CHECK (kind = ANY (ARRAY['carga'::text, 'ads'::text, 'mkt'::text, 'assistant'::text]));
ALTER TABLE ONLY public.gerencia_phones ADD CONSTRAINT gerencia_phones_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.gerencia_phones ADD CONSTRAINT gerencia_phones_status_check CHECK (status = ANY (ARRAY['active'::text, 'inactive'::text]));

CREATE INDEX gerencia_phones_assignment_acquisition_idx ON public.gerencia_phones USING btree (gerencia_id, kind, phone, messages_reset_at) WHERE ((status = 'active'::text) AND (assignment_role = 'acquisition'::text));
CREATE INDEX gerencia_phones_assignment_active_kind_phone_idx ON public.gerencia_phones USING btree (gerencia_id, kind, phone, messages_reset_at) WHERE (status = 'active'::text);
CREATE UNIQUE INDEX gerencia_phones_gerencia_id_phone_key ON public.gerencia_phones USING btree (gerencia_id, phone);
CREATE INDEX gerencia_phones_gerencia_id_status_idx ON public.gerencia_phones USING btree (gerencia_id, status);
CREATE INDEX gerencia_phones_gerencia_source_available_idx ON public.gerencia_phones USING btree (gerencia_id, source_available);
CREATE UNIQUE INDEX gerencia_phones_pkey ON public.gerencia_phones USING btree (id);



-- Table public.gerencias (hosted metadata, no row data)
-- approximate_rows=90; table_bytes=16384; indexes_bytes=65536; total_bytes=122880; last_analyze=2026-09-23 22:59:56.387289+00
-- rls_enabled=t; force_rls=f
CREATE TABLE public.gerencias (
  id integer NOT NULL,
  user_id uuid NOT NULL,
  nombre text NOT NULL,
  gerencia_id integer NOT NULL,
  fair_criterion text DEFAULT 'usage_count'::text NOT NULL,
  source_type text DEFAULT 'pbadmin'::text NOT NULL,
  workspace_currency text DEFAULT 'ARS'::text NOT NULL);


ALTER TABLE ONLY public.gerencias ADD CONSTRAINT gerencias_fair_criterion_check CHECK (fair_criterion = ANY (ARRAY['usage_count'::text, 'messages_received'::text]));
ALTER TABLE ONLY public.gerencias ADD CONSTRAINT gerencias_gerencia_id_unique UNIQUE (gerencia_id);
ALTER TABLE ONLY public.gerencias ADD CONSTRAINT gerencias_id_equals_gerencia_id_check CHECK (id = gerencia_id);
ALTER TABLE ONLY public.gerencias ADD CONSTRAINT gerencias_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.gerencias ADD CONSTRAINT gerencias_source_type_check CHECK (source_type = ANY (ARRAY['pbadmin'::text, 'manual'::text]));
ALTER TABLE ONLY public.gerencias ADD CONSTRAINT gerencias_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.gerencias ADD CONSTRAINT gerencias_workspace_currency_check CHECK (workspace_currency = ANY (ARRAY['ARS'::text, 'PYG'::text]));

CREATE UNIQUE INDEX gerencias_gerencia_id_unique ON public.gerencias USING btree (gerencia_id);
CREATE UNIQUE INDEX gerencias_pkey ON public.gerencias USING btree (id);
CREATE INDEX gerencias_user_id_idx ON public.gerencias USING btree (user_id);
CREATE INDEX idx_gerencias_user_workspace_nombre ON public.gerencias USING btree (user_id, workspace_currency, nombre);



-- Table public.hidden_conversions (hosted metadata, no row data)
-- approximate_rows=2544; table_bytes=180224; indexes_bytes=360448; total_bytes=573440; last_analyze=unknown
-- rls_enabled=t; force_rls=f
CREATE TABLE public.hidden_conversions (
  conversion_id uuid NOT NULL,
  hidden_by uuid NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL);


ALTER TABLE ONLY public.hidden_conversions ADD CONSTRAINT hidden_conversions_conversion_id_fkey FOREIGN KEY (conversion_id) REFERENCES conversions(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.hidden_conversions ADD CONSTRAINT hidden_conversions_hidden_by_fkey FOREIGN KEY (hidden_by) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.hidden_conversions ADD CONSTRAINT hidden_conversions_pkey PRIMARY KEY (conversion_id, hidden_by);

CREATE INDEX hidden_conversions_hidden_by_conversion_idx ON public.hidden_conversions USING btree (hidden_by, conversion_id);
CREATE UNIQUE INDEX hidden_conversions_pkey ON public.hidden_conversions USING btree (conversion_id, hidden_by);
CREATE INDEX idx_hidden_conversions_hidden_by ON public.hidden_conversions USING btree (hidden_by);



-- Table public.landings (hosted metadata, no row data)
-- approximate_rows=25; table_bytes=65536; indexes_bytes=98304; total_bytes=417792; last_analyze=2026-09-20 22:33:27.495542+00
-- rls_enabled=t; force_rls=f
CREATE TABLE public.landings (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  name text DEFAULT 'Nueva landing'::text NOT NULL,
  comment text DEFAULT ''::text NOT NULL,
  config jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  pixel_id text DEFAULT ''::text NOT NULL,
  post_url text DEFAULT ''::text NOT NULL,
  landing_tag text DEFAULT ''::text NOT NULL,
  phone_mode text DEFAULT 'random'::text NOT NULL,
  phone_kind text DEFAULT 'carga'::text NOT NULL,
  phone_interval_minutes integer DEFAULT 0 NOT NULL,
  phone_interval_start_hour integer,
  phone_interval_end_hour integer,
  landing_config jsonb,
  gerencia_selection_mode text DEFAULT 'weighted_random'::text NOT NULL,
  gerencia_fair_criterion text DEFAULT 'usage_count'::text NOT NULL,
  landing_type text DEFAULT 'internal'::text NOT NULL,
  external_domain text DEFAULT ''::text NOT NULL,
  publish_target text DEFAULT 'classic'::text NOT NULL,
  workspace_currency text DEFAULT 'ARS'::text NOT NULL,
  atrio_selection_mode text DEFAULT 'weighted_random'::text NOT NULL,
  atrio_fair_criterion text DEFAULT 'usage_count'::text NOT NULL);


ALTER TABLE ONLY public.landings ADD CONSTRAINT landings_atrio_fair_criterion_check CHECK (atrio_fair_criterion = ANY (ARRAY['usage_count'::text, 'messages_received'::text]));
ALTER TABLE ONLY public.landings ADD CONSTRAINT landings_atrio_selection_mode_check CHECK (atrio_selection_mode = ANY (ARRAY['weighted_random'::text, 'fair'::text]));
ALTER TABLE ONLY public.landings ADD CONSTRAINT landings_gerencia_fair_criterion_check CHECK (gerencia_fair_criterion = ANY (ARRAY['usage_count'::text, 'messages_received'::text]));
ALTER TABLE ONLY public.landings ADD CONSTRAINT landings_gerencia_selection_mode_check CHECK (gerencia_selection_mode = ANY (ARRAY['weighted_random'::text, 'fair'::text]));
ALTER TABLE ONLY public.landings ADD CONSTRAINT landings_landing_tag_alphanumeric CHECK (landing_tag ~ '^[a-zA-Z0-9]*$'::text);
ALTER TABLE ONLY public.landings ADD CONSTRAINT landings_landing_type_check CHECK (landing_type = ANY (ARRAY['internal'::text, 'external'::text]));
ALTER TABLE ONLY public.landings ADD CONSTRAINT landings_name_key UNIQUE (name);
ALTER TABLE ONLY public.landings ADD CONSTRAINT landings_phone_interval_end_hour_check CHECK (phone_interval_end_hour IS NULL OR phone_interval_end_hour >= 0 AND phone_interval_end_hour <= 23);
ALTER TABLE ONLY public.landings ADD CONSTRAINT landings_phone_interval_start_hour_check CHECK (phone_interval_start_hour IS NULL OR phone_interval_start_hour >= 0 AND phone_interval_start_hour <= 23);
ALTER TABLE ONLY public.landings ADD CONSTRAINT landings_phone_kind_check CHECK (phone_kind = ANY (ARRAY['carga'::text, 'ads'::text, 'mkt'::text, 'assistant'::text]));
ALTER TABLE ONLY public.landings ADD CONSTRAINT landings_phone_mode_check CHECK (phone_mode = ANY (ARRAY['random'::text, 'fair'::text]));
ALTER TABLE ONLY public.landings ADD CONSTRAINT landings_pixel_id_numeric CHECK (pixel_id ~ '^[0-9]*$'::text);
ALTER TABLE ONLY public.landings ADD CONSTRAINT landings_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.landings ADD CONSTRAINT landings_publish_target_check CHECK (publish_target = ANY (ARRAY['classic'::text, 'constructor'::text]));
ALTER TABLE ONLY public.landings ADD CONSTRAINT landings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.landings ADD CONSTRAINT landings_workspace_currency_check CHECK (workspace_currency = ANY (ARRAY['ARS'::text, 'PYG'::text]));

CREATE INDEX idx_landings_user_workspace_updated ON public.landings USING btree (user_id, workspace_currency, updated_at DESC);
CREATE UNIQUE INDEX landings_landing_tag_unique ON public.landings USING btree (landing_tag) WHERE (landing_tag <> ''::text);
CREATE UNIQUE INDEX landings_name_key ON public.landings USING btree (name);
CREATE UNIQUE INDEX landings_pkey ON public.landings USING btree (id);
CREATE INDEX landings_updated_at_idx ON public.landings USING btree (updated_at DESC);
CREATE INDEX landings_user_id_idx ON public.landings USING btree (user_id);



-- Table public.landings_gerencias (hosted metadata, no row data)
-- approximate_rows=44; table_bytes=8192; indexes_bytes=49152; total_bytes=98304; last_analyze=2026-09-24 19:56:57.307409+00
-- rls_enabled=t; force_rls=f
CREATE TABLE public.landings_gerencias (
  landing_id uuid NOT NULL,
  gerencia_id integer NOT NULL,
  weight integer DEFAULT 0 NOT NULL,
  phone_mode text DEFAULT 'random'::text NOT NULL,
  phone_kind text DEFAULT 'carga'::text NOT NULL,
  interval_start_hour integer,
  interval_end_hour integer);


ALTER TABLE ONLY public.landings_gerencias ADD CONSTRAINT landings_gerencias_gerencia_id_fkey FOREIGN KEY (gerencia_id) REFERENCES gerencias(id) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE ONLY public.landings_gerencias ADD CONSTRAINT landings_gerencias_interval_end_hour_check CHECK (interval_end_hour IS NULL OR interval_end_hour >= 0 AND interval_end_hour <= 23);
ALTER TABLE ONLY public.landings_gerencias ADD CONSTRAINT landings_gerencias_interval_start_hour_check CHECK (interval_start_hour IS NULL OR interval_start_hour >= 0 AND interval_start_hour <= 23);
ALTER TABLE ONLY public.landings_gerencias ADD CONSTRAINT landings_gerencias_landing_id_fkey FOREIGN KEY (landing_id) REFERENCES landings(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.landings_gerencias ADD CONSTRAINT landings_gerencias_phone_kind_check CHECK (phone_kind = ANY (ARRAY['carga'::text, 'ads'::text, 'mkt'::text, 'assistant'::text]));
ALTER TABLE ONLY public.landings_gerencias ADD CONSTRAINT landings_gerencias_phone_mode_check CHECK (phone_mode = ANY (ARRAY['random'::text, 'fair'::text]));
ALTER TABLE ONLY public.landings_gerencias ADD CONSTRAINT landings_gerencias_pkey PRIMARY KEY (landing_id, gerencia_id);

CREATE INDEX landings_gerencias_gerencia_id_idx ON public.landings_gerencias USING btree (gerencia_id);
CREATE INDEX landings_gerencias_landing_id_idx ON public.landings_gerencias USING btree (landing_id);
CREATE UNIQUE INDEX landings_gerencias_pkey ON public.landings_gerencias USING btree (landing_id, gerencia_id);



-- Table public.profiles (hosted metadata, no row data)
-- approximate_rows=7; table_bytes=8192; indexes_bytes=16384; total_bytes=65536; last_analyze=2026-09-20 17:02:11.769632+00
-- rls_enabled=t; force_rls=f
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  role text DEFAULT 'client'::text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  nombre text);


ALTER TABLE ONLY public.profiles ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.profiles ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.profiles ADD CONSTRAINT profiles_role_check CHECK (role = ANY (ARRAY['admin'::text, 'client'::text]));

CREATE UNIQUE INDEX profiles_pkey ON public.profiles USING btree (id);



-- SUPPLEMENT: read-only hosted metadata captured on 2026-09-25 after resumption.
-- The original table/constraint/index snapshot above is preserved byte-for-byte.
-- Original generator omitted policies/cardinality from its final format string; appended here.
-- Index definitions above include constraint-owned indexes: do not replay both as standalone DDL.
-- cardinality conversion_journey_starts.created_at: n_distinct=-1; null_frac=0; avg_width=8
-- cardinality conversion_journey_starts.external_id: n_distinct=-0.821403; null_frac=0; avg_width=37
-- cardinality conversion_journey_starts.first_seen_at: n_distinct=-0.999921; null_frac=0; avg_width=8
-- cardinality conversion_journey_starts.phone: n_distinct=273; null_frac=0; avg_width=1
-- cardinality conversion_journey_starts.source_platform: n_distinct=2; null_frac=0; avg_width=8
-- cardinality conversion_journey_starts.user_id: n_distinct=4; null_frac=0; avg_width=16
-- cardinality conversion_journey_starts.workspace_currency: n_distinct=2; null_frac=0; avg_width=4
-- cardinality conversions.created_at: n_distinct=-0.999848; null_frac=0; avg_width=8
-- cardinality conversions.currency: n_distinct=3; null_frac=0; avg_width=4
-- cardinality conversions.external_id: n_distinct=-0.314948; null_frac=0; avg_width=45
-- cardinality conversions.phone: n_distinct=-0.146742; null_frac=0; avg_width=11
-- cardinality conversions.promo_code: n_distinct=-0.295085; null_frac=0; avg_width=13
-- cardinality conversions.source_platform: n_distinct=4; null_frac=0; avg_width=5
-- cardinality conversions.test_event_code: n_distinct=6; null_frac=0; avg_width=1
-- cardinality conversions.user_id: n_distinct=6; null_frac=0; avg_width=16
-- cardinality conversions_config.created_at: n_distinct=-1; null_frac=0; avg_width=8
-- cardinality conversions_config.user_id: n_distinct=-1; null_frac=0; avg_width=16
-- cardinality conversions_pixel_configs.created_at: n_distinct=-0.933333; null_frac=0; avg_width=8
-- cardinality conversions_pixel_configs.user_id: n_distinct=-0.533333; null_frac=0; avg_width=16
-- cardinality gerencia_phones.created_at: n_distinct=-0.912821; null_frac=0; avg_width=8
-- cardinality gerencia_phones.phone: n_distinct=-0.94359; null_frac=0; avg_width=13
-- cardinality gerencias.user_id: n_distinct=6; null_frac=0; avg_width=16
-- cardinality gerencias.workspace_currency: n_distinct=2; null_frac=0; avg_width=5
-- cardinality hidden_conversions.conversion_id: n_distinct=-0.988844; null_frac=0; avg_width=16
-- cardinality hidden_conversions.created_at: n_distinct=47; null_frac=0; avg_width=8
-- cardinality hidden_conversions.hidden_by: n_distinct=6; null_frac=0; avg_width=16
-- cardinality landings.created_at: n_distinct=-1; null_frac=0; avg_width=8
-- cardinality landings.user_id: n_distinct=-0.28; null_frac=0; avg_width=16
-- cardinality landings.workspace_currency: n_distinct=2; null_frac=0; avg_width=5
-- cardinality profiles.created_at: n_distinct=-1; null_frac=0; avg_width=8
-- index_status public.conversion_journey_starts_external_idx: valid=t; ready=t; unique=f; primary=f; bytes=3604480
-- index_status public.conversion_journey_starts_identity_unique: valid=t; ready=t; unique=t; primary=f; bytes=12681216
-- index_status public.conversion_journey_starts_landing_seen_idx: valid=t; ready=t; unique=f; primary=f; bytes=2572288
-- index_status public.conversion_journey_starts_phone_idx: valid=t; ready=t; unique=f; primary=f; bytes=1261568
-- index_status public.conversion_journey_starts_pkey: valid=t; ready=t; unique=t; primary=t; bytes=1515520
-- index_status public.conversion_journey_starts_source_seen_idx: valid=t; ready=t; unique=f; primary=f; bytes=1540096
-- index_status public.conversion_journey_starts_user_seen_idx: valid=t; ready=t; unique=f; primary=f; bytes=1925120
-- index_status public.conversion_view_preferences_pkey: valid=t; ready=t; unique=t; primary=t; bytes=16384
-- index_status public.conversions_assigned_gerencia_label_idx: valid=t; ready=t; unique=f; primary=f; bytes=2244608
-- index_status public.conversions_assignment_messages_lookup_idx: valid=t; ready=t; unique=f; primary=f; bytes=3014656
-- index_status public.conversions_dataset_id_idx: valid=t; ready=t; unique=f; primary=f; bytes=16384
-- index_status public.conversions_internal_id_key: valid=t; ready=t; unique=t; primary=f; bytes=5808128
-- index_status public.conversions_landing_assignment_messages_lookup_idx: valid=t; ready=t; unique=f; primary=f; bytes=2162688
-- index_status public.conversions_lead_attribution_conversion_id_idx: valid=t; ready=t; unique=f; primary=f; bytes=507904
-- index_status public.conversions_meta_audience_purchase_idx: valid=t; ready=t; unique=f; primary=f; bytes=3129344
-- index_status public.conversions_phone_metrics_contacts_idx: valid=t; ready=t; unique=f; primary=f; bytes=4153344
-- index_status public.conversions_phone_metrics_contacts_normalized_idx: valid=t; ready=t; unique=f; primary=f; bytes=4210688
-- index_status public.conversions_phone_metrics_leads_idx: valid=t; ready=t; unique=f; primary=f; bytes=4112384
-- index_status public.conversions_phone_metrics_leads_normalized_idx: valid=t; ready=t; unique=f; primary=f; bytes=4186112
-- index_status public.conversions_pkey: valid=t; ready=t; unique=t; primary=t; bytes=4767744
-- index_status public.conversions_purchase_attribution_conversion_id_idx: valid=t; ready=t; unique=f; primary=f; bytes=843776
-- index_status public.conversions_purchase_capi_retryable_created_idx: valid=t; ready=t; unique=f; primary=f; bytes=16384
-- index_status public.conversions_purchase_coelsa_id_uidx: valid=t; ready=t; unique=t; primary=f; bytes=2736128
-- index_status public.conversions_purchase_coelsa_lookup_idx: valid=t; ready=t; unique=f; primary=f; bytes=28360704
-- index_status public.conversions_purchase_retry_created_idx: valid=t; ready=t; unique=f; primary=f; bytes=13787136
-- index_status public.conversions_purchase_transaction_id_uidx: valid=t; ready=t; unique=t; primary=f; bytes=3784704
-- index_status public.conversions_purchase_transaction_lookup_idx: valid=t; ready=t; unique=f; primary=f; bytes=27918336
-- index_status public.conversions_user_assigned_gerencia_idx: valid=t; ready=t; unique=f; primary=f; bytes=2097152
-- index_status public.conversions_user_assigned_phone_lead_time_idx: valid=t; ready=t; unique=f; primary=f; bytes=3383296
-- index_status public.conversions_user_atrio_phone_created_idx: valid=t; ready=t; unique=f; primary=f; bytes=8192
-- index_status public.conversions_user_atrio_players_idx: valid=t; ready=t; unique=f; primary=f; bytes=8192
-- index_status public.conversions_user_atrio_promo_idx: valid=t; ready=t; unique=f; primary=f; bytes=8192
-- index_status public.conversions_user_contact_event_id_uidx: valid=t; ready=t; unique=t; primary=f; bytes=4866048
-- index_status public.conversions_user_created_at_lookup_idx: valid=t; ready=t; unique=f; primary=f; bytes=21577728
-- index_status public.conversions_user_currency_created_idx: valid=t; ready=t; unique=f; primary=f; bytes=8724480
-- index_status public.conversions_user_lead_atrio_phone_created_idx: valid=t; ready=t; unique=f; primary=f; bytes=8192
-- index_status public.conversions_user_lead_atrio_players_idx: valid=t; ready=t; unique=f; primary=f; bytes=8192
-- index_status public.conversions_user_main_promo_code_uidx: valid=t; ready=t; unique=t; primary=f; bytes=3727360
-- index_status public.conversions_user_phone_lead_gerencia_idx: valid=t; ready=t; unique=f; primary=f; bytes=4841472
-- index_status public.conversions_user_phone_purchase_gerencia_idx: valid=t; ready=t; unique=f; primary=f; bytes=5685248
-- index_status public.conversions_user_promo_code_contact_uidx: valid=t; ready=t; unique=t; primary=f; bytes=2244608
-- index_status public.conversions_user_purchase_atrio_phone_created_idx: valid=t; ready=t; unique=f; primary=f; bytes=16384
-- index_status public.conversions_user_purchase_atrio_players_idx: valid=t; ready=t; unique=f; primary=f; bytes=16384
-- index_status public.conversions_wca_contact_phone_fallback_idx: valid=t; ready=t; unique=f; primary=f; bytes=16384
-- index_status public.conversions_wca_external_match_idx: valid=t; ready=t; unique=f; primary=f; bytes=6725632
-- index_status public.conversions_wca_promo_match_idx: valid=t; ready=t; unique=f; primary=f; bytes=3571712
-- index_status public.conversions_wca_user_external_currency_expr_idx: valid=t; ready=t; unique=f; primary=f; bytes=6717440
-- index_status public.conversions_wca_user_promo_currency_expr_idx: valid=t; ready=t; unique=f; primary=f; bytes=3571712
-- index_status public.idx_conversions_contact_capi_retry: valid=t; ready=t; unique=f; primary=f; bytes=8192
-- index_status public.idx_conversions_created_at: valid=t; ready=t; unique=f; primary=f; bytes=5636096
-- index_status public.idx_conversions_landing_id: valid=t; ready=t; unique=f; primary=f; bytes=1843200
-- index_status public.idx_conversions_lead_capi_retry: valid=t; ready=t; unique=f; primary=f; bytes=16384
-- index_status public.idx_conversions_lead_player_username: valid=t; ready=t; unique=f; primary=f; bytes=1769472
-- index_status public.idx_conversions_phone: valid=t; ready=t; unique=f; primary=f; bytes=1933312
-- index_status public.idx_conversions_phone_empty_email: valid=t; ready=t; unique=f; primary=f; bytes=2064384
-- index_status public.idx_conversions_pixel_attribution_conversion: valid=t; ready=t; unique=f; primary=f; bytes=630784
-- index_status public.idx_conversions_promo_code: valid=t; ready=t; unique=f; primary=f; bytes=3137536
-- index_status public.idx_conversions_purchase_player_username: valid=t; ready=t; unique=f; primary=f; bytes=1368064
-- index_status public.idx_conversions_registration_player_username: valid=t; ready=t; unique=f; primary=f; bytes=8192
-- index_status public.idx_conversions_retry: valid=t; ready=t; unique=f; primary=f; bytes=270336
-- index_status public.idx_conversions_user_currency_created_at: valid=t; ready=t; unique=f; primary=f; bytes=9404416
-- index_status public.idx_conversions_user_id: valid=t; ready=t; unique=f; primary=f; bytes=2129920
-- index_status public.idx_conversions_user_promo_created: valid=t; ready=t; unique=f; primary=f; bytes=5382144
-- index_status public.idx_conversions_user_purchase_type: valid=t; ready=t; unique=f; primary=f; bytes=2318336
-- index_status public.conversions_config_pkey: valid=t; ready=t; unique=t; primary=t; bytes=16384
-- index_status public.conversions_config_slug_unique: valid=t; ready=t; unique=t; primary=f; bytes=8192
-- index_status public.conversions_pixel_configs_pkey: valid=t; ready=t; unique=t; primary=t; bytes=16384
-- index_status public.conversions_pixel_configs_user_default_unique: valid=t; ready=t; unique=t; primary=f; bytes=16384
-- index_status public.conversions_pixel_configs_user_pixel_unique: valid=t; ready=t; unique=t; primary=f; bytes=16384
-- index_status public.gerencia_phones_assignment_acquisition_idx: valid=t; ready=t; unique=f; primary=f; bytes=16384
-- index_status public.gerencia_phones_assignment_active_kind_phone_idx: valid=t; ready=t; unique=f; primary=f; bytes=32768
-- index_status public.gerencia_phones_gerencia_id_phone_key: valid=t; ready=t; unique=t; primary=f; bytes=40960
-- index_status public.gerencia_phones_gerencia_id_status_idx: valid=t; ready=t; unique=f; primary=f; bytes=32768
-- index_status public.gerencia_phones_gerencia_source_available_idx: valid=t; ready=t; unique=f; primary=f; bytes=32768
-- index_status public.gerencia_phones_pkey: valid=t; ready=t; unique=t; primary=t; bytes=32768
-- index_status public.gerencias_gerencia_id_unique: valid=t; ready=t; unique=t; primary=f; bytes=16384
-- index_status public.gerencias_pkey: valid=t; ready=t; unique=t; primary=t; bytes=16384
-- index_status public.gerencias_user_id_idx: valid=t; ready=t; unique=f; primary=f; bytes=16384
-- index_status public.idx_gerencias_user_workspace_nombre: valid=t; ready=t; unique=f; primary=f; bytes=16384
-- index_status public.hidden_conversions_hidden_by_conversion_idx: valid=t; ready=t; unique=f; primary=f; bytes=147456
-- index_status public.hidden_conversions_pkey: valid=t; ready=t; unique=t; primary=t; bytes=172032
-- index_status public.idx_hidden_conversions_hidden_by: valid=t; ready=t; unique=f; primary=f; bytes=40960
-- index_status public.idx_landings_user_workspace_updated: valid=t; ready=t; unique=f; primary=f; bytes=16384
-- index_status public.landings_landing_tag_unique: valid=t; ready=t; unique=t; primary=f; bytes=16384
-- index_status public.landings_name_key: valid=t; ready=t; unique=t; primary=f; bytes=16384
-- index_status public.landings_pkey: valid=t; ready=t; unique=t; primary=t; bytes=16384
-- index_status public.landings_updated_at_idx: valid=t; ready=t; unique=f; primary=f; bytes=16384
-- index_status public.landings_user_id_idx: valid=t; ready=t; unique=f; primary=f; bytes=16384
-- index_status public.landings_gerencias_gerencia_id_idx: valid=t; ready=t; unique=f; primary=f; bytes=16384
-- index_status public.landings_gerencias_landing_id_idx: valid=t; ready=t; unique=f; primary=f; bytes=16384
-- index_status public.landings_gerencias_pkey: valid=t; ready=t; unique=t; primary=t; bytes=16384
-- index_status public.profiles_pkey: valid=t; ready=t; unique=t; primary=t; bytes=16384
CREATE POLICY conversion_journey_starts_admin_read ON public.conversion_journey_starts AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.role = 'admin'::text)))));
CREATE POLICY conversion_journey_starts_owner_read ON public.conversion_journey_starts AS PERMISSIVE FOR SELECT TO authenticated USING ((( SELECT auth.uid() AS uid) = user_id));
CREATE POLICY "Users manage own conversion_view_preferences" ON public.conversion_view_preferences AS PERMISSIVE FOR ALL TO PUBLIC USING ((( SELECT auth.uid() AS uid) = hidden_by)) WITH CHECK ((( SELECT auth.uid() AS uid) = hidden_by));
CREATE POLICY "Admins can delete all conversions" ON public.conversions AS PERMISSIVE FOR DELETE TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.role = 'admin'::text)))));
CREATE POLICY "Admins can read all conversions" ON public.conversions AS PERMISSIVE FOR SELECT TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text)))));
CREATE POLICY "Admins can update all conversions" ON public.conversions AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text)))));
CREATE POLICY "Users can delete own conversions" ON public.conversions AS PERMISSIVE FOR DELETE TO PUBLIC USING ((user_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY "Users can read own conversions" ON public.conversions AS PERMISSIVE FOR SELECT TO PUBLIC USING ((( SELECT auth.uid() AS uid) = user_id));
CREATE POLICY "Users can update own conversions" ON public.conversions AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((user_id = ( SELECT auth.uid() AS uid))) WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY "Admins can insert all conversions_config" ON public.conversions_config AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text)))));
CREATE POLICY "Admins can read all conversions_config" ON public.conversions_config AS PERMISSIVE FOR SELECT TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text)))));
CREATE POLICY "Admins can update all conversions_config" ON public.conversions_config AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text)))));
CREATE POLICY "Users can insert own conversions_config" ON public.conversions_config AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));
CREATE POLICY "Users can read own conversions_config" ON public.conversions_config AS PERMISSIVE FOR SELECT TO PUBLIC USING ((( SELECT auth.uid() AS uid) = user_id));
CREATE POLICY "Users can update own conversions_config" ON public.conversions_config AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));
CREATE POLICY "Admins can delete all conversions_pixel_configs" ON public.conversions_pixel_configs AS PERMISSIVE FOR DELETE TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.role = 'admin'::text)))));
CREATE POLICY "Admins can insert all conversions_pixel_configs" ON public.conversions_pixel_configs AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.role = 'admin'::text)))));
CREATE POLICY "Admins can read all conversions_pixel_configs" ON public.conversions_pixel_configs AS PERMISSIVE FOR SELECT TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.role = 'admin'::text)))));
CREATE POLICY "Admins can update all conversions_pixel_configs" ON public.conversions_pixel_configs AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.role = 'admin'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.role = 'admin'::text)))));
CREATE POLICY "Users can delete own conversions_pixel_configs" ON public.conversions_pixel_configs AS PERMISSIVE FOR DELETE TO PUBLIC USING ((( SELECT auth.uid() AS uid) = user_id));
CREATE POLICY "Users can insert own conversions_pixel_configs" ON public.conversions_pixel_configs AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));
CREATE POLICY "Users can read own conversions_pixel_configs" ON public.conversions_pixel_configs AS PERMISSIVE FOR SELECT TO PUBLIC USING ((( SELECT auth.uid() AS uid) = user_id));
CREATE POLICY "Users can update own conversions_pixel_configs" ON public.conversions_pixel_configs AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));
CREATE POLICY phone_delete_owner_or_admin ON public.gerencia_phones AS PERMISSIVE FOR DELETE TO authenticated USING (((EXISTS ( SELECT 1
   FROM gerencias g
  WHERE ((g.id = gerencia_phones.gerencia_id) AND (g.user_id = ( SELECT auth.uid() AS uid))))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.role = 'admin'::text))))));
CREATE POLICY phone_insert_owner_or_admin ON public.gerencia_phones AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((EXISTS ( SELECT 1
   FROM gerencias g
  WHERE ((g.id = gerencia_phones.gerencia_id) AND (g.user_id = ( SELECT auth.uid() AS uid))))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.role = 'admin'::text))))));
CREATE POLICY phone_select_owner_or_admin ON public.gerencia_phones AS PERMISSIVE FOR SELECT TO authenticated USING (((EXISTS ( SELECT 1
   FROM gerencias g
  WHERE ((g.id = gerencia_phones.gerencia_id) AND (g.user_id = ( SELECT auth.uid() AS uid))))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.role = 'admin'::text))))));
CREATE POLICY phone_update_owner_or_admin ON public.gerencia_phones AS PERMISSIVE FOR UPDATE TO authenticated USING (((EXISTS ( SELECT 1
   FROM gerencias g
  WHERE ((g.id = gerencia_phones.gerencia_id) AND (g.user_id = ( SELECT auth.uid() AS uid))))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.role = 'admin'::text)))))) WITH CHECK (((EXISTS ( SELECT 1
   FROM gerencias g
  WHERE ((g.id = gerencia_phones.gerencia_id) AND (g.user_id = ( SELECT auth.uid() AS uid))))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.role = 'admin'::text))))));
CREATE POLICY "Admins can read all gerencias" ON public.gerencias AS PERMISSIVE FOR SELECT TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text)))));
CREATE POLICY "Admins can update all gerencias" ON public.gerencias AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text)))));
CREATE POLICY "Users manage own gerencias" ON public.gerencias AS PERMISSIVE FOR ALL TO PUBLIC USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));
CREATE POLICY "Users manage own hidden_conversions" ON public.hidden_conversions AS PERMISSIVE FOR ALL TO PUBLIC USING ((( SELECT auth.uid() AS uid) = hidden_by)) WITH CHECK ((( SELECT auth.uid() AS uid) = hidden_by));
CREATE POLICY "Admins can delete all landings" ON public.landings AS PERMISSIVE FOR DELETE TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text)))));
CREATE POLICY "Admins can read all landings" ON public.landings AS PERMISSIVE FOR SELECT TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text)))));
CREATE POLICY "Admins can update all landings" ON public.landings AS PERMISSIVE FOR UPDATE TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text)))));
CREATE POLICY "Users manage own landings" ON public.landings AS PERMISSIVE FOR ALL TO PUBLIC USING ((( SELECT auth.uid() AS uid) = user_id)) WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));
CREATE POLICY "Admins can delete landings_gerencias" ON public.landings_gerencias AS PERMISSIVE FOR DELETE TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text)))));
CREATE POLICY "Admins can insert landings_gerencias" ON public.landings_gerencias AS PERMISSIVE FOR INSERT TO PUBLIC WITH CHECK ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text)))));
CREATE POLICY "Admins can read landings_gerencias" ON public.landings_gerencias AS PERMISSIVE FOR SELECT TO PUBLIC USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text)))));
CREATE POLICY "Users manage own landing gerencia assignments" ON public.landings_gerencias AS PERMISSIVE FOR ALL TO PUBLIC USING (((EXISTS ( SELECT 1
   FROM landings l
  WHERE ((l.id = landings_gerencias.landing_id) AND (l.user_id = ( SELECT auth.uid() AS uid))))) AND (EXISTS ( SELECT 1
   FROM gerencias g
  WHERE ((g.id = landings_gerencias.gerencia_id) AND (g.user_id = ( SELECT auth.uid() AS uid))))))) WITH CHECK (((EXISTS ( SELECT 1
   FROM landings l
  WHERE ((l.id = landings_gerencias.landing_id) AND (l.user_id = ( SELECT auth.uid() AS uid))))) AND (EXISTS ( SELECT 1
   FROM gerencias g
  WHERE ((g.id = landings_gerencias.gerencia_id) AND (g.user_id = ( SELECT auth.uid() AS uid)))))));
CREATE POLICY "Read own profile" ON public.profiles AS PERMISSIVE FOR SELECT TO PUBLIC USING ((( SELECT auth.uid() AS uid) = id));
CREATE POLICY "Update own profile" ON public.profiles AS PERMISSIVE FOR UPDATE TO authenticated USING ((( SELECT auth.uid() AS uid) = id)) WITH CHECK ((( SELECT auth.uid() AS uid) = id));

