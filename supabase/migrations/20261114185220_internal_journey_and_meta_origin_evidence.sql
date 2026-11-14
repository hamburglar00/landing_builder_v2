-- Additive compatibility: public Meta event identities/statuses remain untouched.
alter table public.conversions
  add column internal_events_version smallint,
  add column cta_clicked_event_id text,
  add column cta_clicked_event_time bigint,
  add column conversation_started_event_id text,
  add column conversation_started_event_time bigint,
  add column conversation_started_payload_raw text,
  add column purchase_confirmed_event_id text,
  add column purchase_confirmed_event_time bigint,
  add column meta_origin_evidence jsonb;

comment on column public.conversions.meta_origin_evidence is
  'Versioned server classification: method, exact parameter names/values, original observation date and matched source conversion. Pixel routing is independent. Unidentified does not mean proven organic.';
comment on column public.conversions.internal_events_version is
  'v1: cta_clicked, conversation_started and purchase_confirmed are operational milestones, independent of legacy public Meta event fields. Null: historical compatibility projection.';

create or replace function public.capture_internal_conversion_milestones()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare capture jsonb; cta_meta boolean := false;
begin
  begin capture := nullif(new.contact_payload_raw, '')::jsonb;
  exception when invalid_text_representation then capture := null; end;
  cta_meta := coalesce(capture->>'landing_cta_event_version' = '1'
    and capture->>'source_platform' = 'landing' and capture->>'cta_destination' = 'atrio'
    and capture->>'landing_cta_meta_event' in ('Lead','CompleteRegistration')
    and coalesce(capture->>'contact_event_id',capture->>'event_id','') = coalesce(new.contact_event_id,''), false);
  -- Preserve evidenced legacy IDs even if their original timestamp was not stored.
  -- The compatibility projection retains its created_at fallback; never invent a timestamp here.
  if nullif(new.contact_event_id,'') is not null then
    new.cta_clicked_event_id := new.contact_event_id;
    new.cta_clicked_event_time := new.contact_event_time;
  end if;
  if nullif(new.conversation_started_event_id,'') is null
      and nullif(new.lead_event_id,'') is not null
      and not (cta_meta and new.lead_event_id = new.contact_event_id) then
    new.conversation_started_event_id := new.lead_event_id;
    new.conversation_started_event_time := new.lead_event_time;
    new.conversation_started_payload_raw := new.lead_payload_raw;
  end if;
  if nullif(new.purchase_event_id,'') is not null then
    new.purchase_confirmed_event_id := new.purchase_event_id;
    new.purchase_confirmed_event_time := new.purchase_event_time;
  end if;
  -- A status update of an old CTA cannot establish that message instrumentation existed then.
  if tg_op = 'INSERT' or new.internal_events_version = 1 or nullif(new.conversation_started_event_id,'') is not null then
    new.internal_events_version := 1;
  end if;
  return new;
end $$;
revoke all on function public.capture_internal_conversion_milestones() from public, anon, authenticated;
create trigger capture_internal_conversion_milestones before insert or update on public.conversions
  for each row execute function public.capture_internal_conversion_milestones();

-- No historical rewrite. Existing preferences and accepted Meta deliveries are preserved.
alter table public.conversions_config alter column meta_ads_only_capi set default true;
alter table public.conversions_pixel_configs alter column meta_ads_only_capi set default true;

create or replace function public.set_conversions_from_meta_ads()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare event_time_seconds numeric; fbc_ms numeric; origin text; method text; parameter text; value text;
begin
  if new.meta_origin_evidence->>'version' = '1' then
    new.from_meta_ads := new.meta_origin_evidence->>'classification' = 'meta_ads';
    return new;
  end if;
  -- An unrelated status/geo update must not silently reclassify pre-migration history.
  if tg_op = 'UPDATE' and new.fbc is not distinct from old.fbc
    and new.ctwa_clid is not distinct from old.ctwa_clid
    and new.source_platform is not distinct from old.source_platform
    and new.utm_campaign is not distinct from old.utm_campaign
    and new.promo_code is not distinct from old.promo_code then
    new.from_meta_ads := old.from_meta_ads;
    return new;
  end if;
  -- Compatibility during rolling deployment; new receiver supplies full canonical evidence.
  event_time_seconds := coalesce(new.contact_event_time, new.lead_event_time, new.purchase_event_time, extract(epoch from now()));
  if coalesce(new.fbc,'') ~ '^fb\.[0-9]+\.[0-9]{13}\.[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)*$' then
    fbc_ms := split_part(new.fbc,'.',3)::numeric;
    if fbc_ms <= event_time_seconds * 1000 + 300000 and event_time_seconds * 1000 - fbc_ms <= 7776000000 then
      method := 'fbc'; parameter := 'fbc'; value := new.fbc;
    end if;
  end if;
  origin := lower(btrim(coalesce(new.source_platform,'')));
  if method is null and origin in ('chatrace','whatsapp_cloud_api')
      and btrim(coalesce(new.ctwa_clid,'')) <> '' and new.ctwa_clid !~ '[{}<>[:space:]]' then
    method := 'ctwa_clid'; parameter := 'ctwa_clid'; value := new.ctwa_clid;
  end if;
  if method is null and origin = 'chatrace' and coalesce(new.promo_code,'') ~ '^[A-Za-z0-9]+-[A-Za-z0-9]+$' then
    method := 'legacy_chatrace_promo'; parameter := 'promo_code'; value := new.promo_code;
  end if;
  new.from_meta_ads := method is not null;
  new.meta_origin_evidence := jsonb_build_object('version',1,
    'classification',case when method is not null then 'meta_ads' else 'unidentified' end,
    'method',coalesce(method,'no_supported_evidence'),
    'parameters',case when parameter is not null then jsonb_build_array(parameter) else '[]'::jsonb end,
    'values',case when parameter is not null then jsonb_build_object(parameter,value) else '{}'::jsonb end,
    'observed_at',to_timestamp(event_time_seconds));
  return new;
end $$;
revoke all on function public.set_conversions_from_meta_ads() from public, anon, authenticated;

-- Date filtering reads actual milestone dates, including a first message received after the CTA period.
create index conversions_internal_cta_time_idx on public.conversions(cta_clicked_event_time,user_id) where cta_clicked_event_time is not null;
create index conversions_internal_conversation_time_idx on public.conversions(conversation_started_event_time,user_id) where conversation_started_event_time is not null;
create index conversions_internal_purchase_time_idx on public.conversions(purchase_confirmed_event_time,user_id) where purchase_confirmed_event_time is not null;
create unique index conversions_internal_conversation_identity_idx on public.conversions(user_id,conversation_started_event_id) where conversation_started_event_id like 'atrio-conversation:%';
