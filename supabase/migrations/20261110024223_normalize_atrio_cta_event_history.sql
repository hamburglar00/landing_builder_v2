-- Run after the new receiver and retry worker are deployed. No Meta requests.
do $backfill$
declare
  r public.conversions%rowtype;
  capture jsonb;
  event_name text;
  stage text;
  canonical_id text;
  canonical_status text;
  previous jsonb;
  delivery record;
  sent jsonb;
  response jsonb;
  delivery_proven boolean;
  corrected integer := 0;
  conflicts integer := 0;
  unproven integer := 0;
begin
  for r in select * from public.conversions
    where source_platform='landing' and coalesce(contact_event_id,'')<>''
      and contact_payload_raw like '%"landing_cta_event_version"%'
    for update
  loop
    begin capture:=r.contact_payload_raw::jsonb;
    exception when invalid_text_representation then continue;
    end;
    if capture->>'landing_cta_event_version' is distinct from '1'
      or capture->>'source_platform' is distinct from 'landing'
      or capture->>'cta_destination' is distinct from 'atrio'
      or coalesce(nullif(capture->>'contact_event_id',''),capture->>'event_id','')<>r.contact_event_id
    then continue; end if;
    event_name:=capture->>'landing_cta_meta_event';
    if event_name is null or event_name not in ('Lead','CompleteRegistration') then continue; end if;
    stage:=case when event_name='Lead' then 'lead' else 'registration' end;
    canonical_id:=to_jsonb(r)->>(stage||'_event_id');
    canonical_status:=to_jsonb(r)->>(stage||'_status_capi');
    -- Never overwrite an unrelated message/registration or replay an accepted event.
    if coalesce(canonical_id,'')<>'' and canonical_id<>r.contact_event_id then
      conflicts:=conflicts+1; continue;
    end if;
    if canonical_id=r.contact_event_id and coalesce(r.contact_status_capi,'')='' then continue; end if;
    if r.contact_status_capi='enviado' then
      delivery_proven:=false;
      for delivery in select payload_meta,response_meta from public.conversion_logs
        where conversion_id=r.id and payload_meta is not null and response_meta is not null
      loop
        begin
          sent:=delivery.payload_meta::jsonb;
          response:=delivery.response_meta::jsonb;
          if sent->'data'->0->>'event_name'=event_name
            and sent->'data'->0->>'event_id'=r.contact_event_id
            and response->>'events_received' ~ '^[1-9][0-9]*$'
          then delivery_proven:=true; exit; end if;
        exception when invalid_text_representation then continue;
        end;
      end loop;
      if not delivery_proven then unproven:=unproven+1; continue; end if;
    end if;
    select jsonb_object_agg(key,value) into previous from jsonb_each(to_jsonb(r))
      where key in ('estado','contact_status_capi','contact_capi_retryable','observaciones')
        or key in (stage||'_event_id',stage||'_event_time',stage||'_payload_raw',stage||'_status_capi',
          stage||'_atrio_id',stage||'_atrio_players_id',stage||'_incoming_promo_code',stage||'_agency_id',
          stage||'_gerencia_id',stage||'_gerencia_external_id',stage||'_gerencia_name',stage||'_gerencia_label');
    insert into private.atrio_cta_event_corrections(conversion_id,event_name,previous_fields)
      values(r.id,event_name,previous) on conflict(conversion_id) do nothing;
    canonical_status:=coalesce(nullif(canonical_status,''),r.contact_status_capi,'');
    if stage='lead' then
      update public.conversions set
        lead_event_id=r.contact_event_id,lead_event_time=r.contact_event_time,lead_payload_raw=r.contact_payload_raw,
        lead_status_capi=canonical_status,lead_atrio_id=coalesce(r.atrio_id,''),lead_atrio_players_id=coalesce(r.atrio_players_id,''),
        lead_incoming_promo_code=coalesce(r.promo_code,''),
        lead_agency_id=coalesce(r.assigned_gerencia_external_id::text,''),lead_gerencia_id=r.assigned_gerencia_id,
        lead_gerencia_external_id=r.assigned_gerencia_external_id,lead_gerencia_name=coalesce(r.assigned_gerencia_name,''),
        lead_gerencia_label=coalesce(r.assigned_gerencia_label,''),
        estado=case when nullif(r.purchase_event_id,'') is not null or r.estado='purchase' then 'purchase'
          when r.estado='registration' then 'registration' else 'lead' end,
        contact_status_capi='',contact_capi_retryable=case when canonical_status='enviado' then false else r.contact_capi_retryable end,
        observaciones=regexp_replace(coalesce(r.observaciones,''),'\mCONTACT\M','LEAD','g')
      where id=r.id;
    else
      update public.conversions set
        registration_event_id=r.contact_event_id,registration_event_time=r.contact_event_time,registration_payload_raw=r.contact_payload_raw,
        registration_status_capi=canonical_status,registration_atrio_id=coalesce(r.atrio_id,''),registration_atrio_players_id=coalesce(r.atrio_players_id,''),
        registration_incoming_promo_code=coalesce(r.promo_code,''),
        registration_agency_id=coalesce(r.assigned_gerencia_external_id::text,''),registration_gerencia_id=r.assigned_gerencia_id,
        registration_gerencia_external_id=r.assigned_gerencia_external_id,registration_gerencia_name=coalesce(r.assigned_gerencia_name,''),
        registration_gerencia_label=coalesce(r.assigned_gerencia_label,''),
        estado=case when nullif(r.purchase_event_id,'') is not null or r.estado='purchase' then 'purchase' else 'registration' end,
        contact_status_capi='',contact_capi_retryable=case when canonical_status='enviado' then false else r.contact_capi_retryable end,
        observaciones=regexp_replace(coalesce(r.observaciones,''),'\mCONTACT\M','COMPLETEREGISTRATION','g')
      where id=r.id;
    end if;
    corrected:=corrected+1;
  end loop;
  raise notice 'Atrio CTA: % corrected, % conflicting milestones preserved, % accepted deliveries without matching evidence preserved',corrected,conflicts,unproven;
end;
$backfill$;
