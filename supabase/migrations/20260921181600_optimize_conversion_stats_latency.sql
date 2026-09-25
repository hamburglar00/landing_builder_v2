-- Statistics latency only; original filtered path and other views are retained.
CREATE OR REPLACE FUNCTION conversions_read.stats(rows jsonb, contacts jsonb, starts jsonb, premium double precision, options jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $$
#variable_conflict use_column
DECLARE as_of timestamptz:=coalesce((options->>'now')::timestamptz,statement_timestamp()); tz text:=coalesce(options->>'timezone','UTC');
 core jsonb; result jsonb; hourly jsonb; daily jsonb; daily_messages jsonb; weekdays jsonb; repeats jsonb; breakdowns jsonb:='{}'; provinces jsonb:='{}';
 dim text; label text; slice_rows jsonb; slice_contacts jsonb; slice_core jsonb; groups jsonb; group_rows jsonb; dimension_result jsonb;
 chart_start timestamp; chart_end timestamp; today date; start_count bigint; contact_count bigint; revenue_today double precision; revenue_yesterday double precision; province_slice record;
BEGIN
 rows:=conversions_read.prepare_stats(rows);
 -- Once identity keys are prepared, chart/core passes need only these scalar fields.
 -- Gerencia and presentation context remain in the already prepared funnel contacts.
 SELECT coalesce(jsonb_agg((SELECT jsonb_object_agg(key,value) FROM jsonb_each(r.value) WHERE key=ANY(ARRAY[
 'id','user_id','phone','external_id','created_at','source_platform','landing_id','landing_name','utm_campaign','device_type','geo_region',
 'contact_event_id','lead_event_id','lead_event_time','purchase_event_id','purchase_event_time','purchase_type','observaciones','valor','estado',
 'promo_code','lead_incoming_promo_code','__contact_key','__lead_key','__purchase_key'])) ORDER BY ordinality),'[]') INTO rows FROM jsonb_array_elements(rows) WITH ORDINALITY r;
 core:=conversions_read.core(rows,contacts,rows,premium,as_of);
 result:=conversions_read.truth(core);
 repeats:=conversions_read.lead_repeats(rows);
 SELECT count(DISTINCT coalesce(nullif(conversions_read.part('start',value->>'start_identity_key'),''),nullif(conversions_read.part('row',value->>'id'),''))) INTO start_count FROM jsonb_array_elements(starts);
 SELECT count(DISTINCT conversions_read.start_person(value,false)) INTO contact_count FROM jsonb_array_elements(rows)
 WHERE conversions_read.txt(value,'contact_event_id')<>'' AND conversions_read.start_person(value,false)<>'' AND conversions_read.start_person(value,false) IN(SELECT conversions_read.start_person(value,true) FROM jsonb_array_elements(starts));
 SELECT coalesce(jsonb_agg(value ORDER BY (value->>'total_valor')::double precision DESC,ordinality),'[]') INTO slice_contacts FROM (
 SELECT value,ordinality FROM jsonb_array_elements(contacts) WITH ORDINALITY WHERE (value->>'total_valor')::double precision>0 ORDER BY (value->>'total_valor')::double precision DESC,ordinality LIMIT greatest(1,least(coalesce((options->>'topLimit')::int,10),100))) top;
 result:=result||jsonb_build_object('leads',core->'uniqueLeads','journeyStarts',start_count,'journeyStartContacts',contact_count,'retencionActiva30d',core->'activeRetention30d','leadRepeatStats',repeats,
 'dominantLeadFrequencyBucket',(SELECT value FROM jsonb_array_elements(repeats->'buckets') ORDER BY (value->>'leads')::int DESC,(value->>'bucket')::int LIMIT 1),
 'topContacts',slice_contacts,'funnelContactCount',jsonb_array_length(contacts),'conversionCount',jsonb_array_length(rows));
 FOREACH dim IN ARRAY ARRAY['utm_campaign','device_type','landing_name'] LOOP
  label:=CASE dim WHEN 'utm_campaign' THEN 'campaign' WHEN 'device_type' THEN 'device' ELSE 'landing' END;
  WITH r AS MATERIALIZED (SELECT value v,ordinality ord,coalesce(nullif(value->>dim,''),CASE dim WHEN 'utm_campaign' THEN 'Sin campaña' WHEN 'device_type' THEN 'Desconocido' ELSE 'Sin landing' END) k FROM jsonb_array_elements(rows) WITH ORDINALITY),
  c AS (SELECT value v,ordinality ord,coalesce(nullif(value->>dim,''),CASE dim WHEN 'utm_campaign' THEN 'Sin campaña' WHEN 'device_type' THEN 'Desconocido' ELSE 'Sin landing' END) k FROM jsonb_array_elements(contacts) WITH ORDINALITY),
  keys AS (SELECT k,min(ord) ord FROM(SELECT k,ord FROM c UNION ALL SELECT k,ord+jsonb_array_length(contacts) FROM r) x GROUP BY k),
  data_groups AS(SELECT k,jsonb_agg(v ORDER BY ord) data FROM r GROUP BY k),
  slices AS(SELECT keys.k,keys.ord,coalesce(data_groups.data,'[]') data FROM keys LEFT JOIN data_groups USING(k)),
  aggregated AS MATERIALIZED (SELECT k,ord,conversions_read.ad_counts(data) ad,
  (SELECT coalesce(sum((value->>'valor')::double precision),0) FROM jsonb_array_elements(data) WHERE coalesce(value->>'purchase_event_id','')<>'') revenue,
  (SELECT coalesce(sum((value->>'valor')::double precision),0) FROM jsonb_array_elements(data) WHERE conversions_read.purchase_kind(value)='first') first_revenue FROM slices)
  SELECT coalesce(jsonb_agg(v ORDER BY revenue DESC,ord),'[]') INTO dimension_result FROM(
   SELECT jsonb_build_object(label,k,'mensajes',ad->'adLeadJourneysLinkedToContact','cargas',ad->'adFirstPurchaseEventsAttributed','revenue',revenue,'firstRevenue',first_revenue) v,revenue,ord FROM aggregated ORDER BY revenue DESC,ord LIMIT CASE WHEN dim='device_type' THEN NULL ELSE 10 END
  ) selected;
  breakdowns:=breakdowns||jsonb_build_object(CASE dim WHEN 'utm_campaign' THEN 'byCampaign' WHEN 'device_type' THEN 'byDevice' ELSE 'byLanding' END,dimension_result);
 END LOOP;
 breakdowns:=breakdowns||jsonb_build_object('campaignOrder',conversions_read.slice_orders(breakdowns->'byCampaign','campaign'),'landingOrder',conversions_read.slice_orders(breakdowns->'byLanding','landing'));
 IF options->>'from' IS NOT NULL AND options->>'to' IS NOT NULL THEN
  chart_start:=(options->>'from')::timestamptz AT TIME ZONE tz; chart_end:=(options->>'to')::timestamptz AT TIME ZONE tz;
 ELSE
  SELECT min(date_trunc('day',(value->>'created_at')::timestamptz AT TIME ZONE tz)),max(date_trunc('day',(value->>'created_at')::timestamptz AT TIME ZONE tz)) INTO chart_start,chart_end FROM jsonb_array_elements(rows);
  IF chart_end IS NULL THEN chart_end:=as_of AT TIME ZONE tz; chart_start:=chart_end-interval '6 days';
  ELSIF chart_end-chart_start<interval '6 days' THEN chart_start:=chart_end-interval '6 days'; END IF;
 END IF;
 WITH r AS MATERIALIZED(SELECT value v,extract(hour from (value->>'created_at')::timestamptz AT TIME ZONE tz)::int h FROM jsonb_array_elements(rows)),
 bins AS(SELECT h,count(*) FILTER(WHERE coalesce(v->>'purchase_event_id','')<>'') purchases,
 count(*) FILTER(WHERE v->>'estado'='lead' OR coalesce(v->>'lead_event_id','')<>'') leads,
 count(*) FILTER(WHERE conversions_read.purchase_kind(v)='first') firsts,count(*) FILTER(WHERE conversions_read.purchase_kind(v)='repeat') repeats,
 coalesce(sum((v->>'valor')::double precision) FILTER(WHERE coalesce(v->>'purchase_event_id','')<>''),0) revenue,conversions_read.ad_counts(jsonb_agg(v)) ad FROM r GROUP BY h)
 SELECT jsonb_agg(jsonb_build_object('hour',h::text,'leads',coalesce(leads,0),'cargas',coalesce(purchases,0),'cargas_first',coalesce(firsts,0),'cargas_repeat',coalesce(repeats,0),'ingresos',coalesce(revenue,0),'ad',coalesce(ad,conversions_read.ad_counts('[]'))) ORDER BY h) INTO hourly FROM generate_series(0,23) s(h) LEFT JOIN bins USING(h);
 WITH r AS MATERIALIZED(SELECT value v,((value->>'created_at')::timestamptz AT TIME ZONE tz)::date d FROM jsonb_array_elements(rows)),
 bins AS(SELECT d,count(*) FILTER(WHERE coalesce(v->>'purchase_event_id','')<>'') purchases,
 count(*) FILTER(WHERE v->>'estado'='lead' OR coalesce(v->>'lead_event_id','')<>'') leads,
 count(*) FILTER(WHERE conversions_read.purchase_kind(v)='first') firsts,count(*) FILTER(WHERE conversions_read.purchase_kind(v)='repeat') repeats,
 coalesce(sum((v->>'valor')::double precision) FILTER(WHERE coalesce(v->>'purchase_event_id','')<>''),0) revenue,conversions_read.ad_counts(jsonb_agg(v)) ad FROM r GROUP BY d)
 SELECT coalesce(jsonb_agg(jsonb_build_object('key',to_char(day,'YYYY-MM-DD'),'day',to_char(day,'DD/MM'),'leads',coalesce(leads,0),'cargas',coalesce(purchases,0),'cargas_first',coalesce(firsts,0),'cargas_repeat',coalesce(repeats,0),'ingresos',coalesce(revenue,0),'ad',coalesce(ad,conversions_read.ad_counts('[]'))) ORDER BY day),'[]') INTO daily FROM generate_series(chart_start,chart_end,interval '1 day') s(day) LEFT JOIN bins ON bins.d=s.day::date;
 -- Count each weekday in one pass, instead of scanning the same JSON array twice
 -- for each label. Empty weekdays still render zero in the original order.
 WITH bins AS MATERIALIZED(
  SELECT extract(isodow from (value->>'created_at')::timestamptz AT TIME ZONE tz)::int weekday,
  count(*) FILTER(WHERE value->>'estado'='lead' OR coalesce(value->>'lead_event_id','')<>'') leads,
  count(*) FILTER(WHERE coalesce(value->>'purchase_event_id','')<>'') purchases
  FROM jsonb_array_elements(rows) GROUP BY weekday)
 SELECT jsonb_agg(jsonb_build_object('day',label,'mensajes',coalesce(leads,0),'cargas',coalesce(purchases,0)) ORDER BY ord) INTO weekdays
 FROM unnest(ARRAY['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo']) WITH ORDINALITY d(label,ord) LEFT JOIN bins ON bins.weekday=d.ord;
 -- Preserve the existing DD/MM match across years (first date encountered in input).
 WITH r AS MATERIALIZED(SELECT value v,ordinality ord,((value->>'created_at')::timestamptz AT TIME ZONE tz)::date d FROM jsonb_array_elements(rows) WITH ORDINALITY),
 bins AS MATERIALIZED(SELECT d,min(ord) ord,count(*) FILTER(WHERE v->>'estado'='lead' OR coalesce(v->>'lead_event_id','')<>'') leads,count(*) FILTER(WHERE coalesce(v->>'purchase_event_id','')<>'') purchases,count(*) FILTER(WHERE conversions_read.purchase_kind(v)='first') firsts FROM r GROUP BY d)
 SELECT coalesce(jsonb_agg(jsonb_build_object('day',value->>'day','leads',coalesce(b.leads,0),'cargas',coalesce(b.purchases,0),'cargas_first',coalesce(b.firsts,0)) ORDER BY chart.ordinality),'[]') INTO daily_messages FROM jsonb_array_elements(daily) WITH ORDINALITY chart LEFT JOIN LATERAL(SELECT * FROM bins WHERE to_char(d,'DD/MM')=chart.value->>'day' ORDER BY ord LIMIT 1) b ON true;
 today:=(as_of AT TIME ZONE tz)::date;
 SELECT coalesce(sum((value->>'valor')::double precision) FILTER(WHERE date_trunc('milliseconds',(value->>'created_at')::timestamptz AT TIME ZONE tz)::date=today),0),coalesce(sum((value->>'valor')::double precision) FILTER(WHERE date_trunc('milliseconds',(value->>'created_at')::timestamptz AT TIME ZONE tz)::date=today-1),0)
 INTO revenue_today,revenue_yesterday FROM jsonb_array_elements(rows) WHERE coalesce(value->>'purchase_event_id','')<>'';
 FOR province_slice IN
  WITH r AS(SELECT conversions_read.province(value->>'geo_region') p,jsonb_agg(value ORDER BY ordinality) data FROM jsonb_array_elements(rows) WITH ORDINALITY GROUP BY p),
  c AS(SELECT conversions_read.province(value->>'region') p,jsonb_agg(value ORDER BY ordinality) data FROM jsonb_array_elements(contacts) WITH ORDINALITY GROUP BY p)
  SELECT coalesce(r.p,c.p) p,coalesce(r.data,'[]') rows,coalesce(c.data,'[]') contacts FROM r FULL JOIN c ON r.p=c.p WHERE coalesce(r.p,c.p) IS NOT NULL
 LOOP
  label:=province_slice.p; slice_rows:=province_slice.rows; slice_contacts:=province_slice.contacts;
  slice_core:=conversions_read.core(slice_rows,slice_contacts,slice_rows,premium,as_of);
  provinces:=provinces||jsonb_build_object(label,conversions_read.province_metrics(slice_core));
 END LOOP;
 RETURN result||breakdowns||jsonb_build_object('hourlyBuckets',hourly,'dailyData',daily,'dailyMessages',daily_messages,'weekdays',weekdays,'provinces',provinces,'globalProvince',conversions_read.province_metrics(core),'revenueToday',revenue_today,'revenueYesterday',revenue_yesterday);
END $$;

-- Relational fast path for statistics without global selector filters.
-- Authentication, RLS and visible-from semantics match the public RPC.
CREATE OR REPLACE FUNCTION conversions_read.stats_native(p_request jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path='' AS $$
DECLARE viewer uuid:=(SELECT auth.uid()); admin_mode boolean:=coalesce((p_request->>'admin')::boolean,false);
 currency_filter text:=nullif(p_request->>'currency','__all__'); from_at timestamptz:=(p_request->>'from')::timestamptz; to_at timestamptz:=(p_request->>'to')::timestamptz; visible_from timestamptz;
 phone_labels jsonb:=coalesce(p_request->'phoneLabels','{}'); premium double precision:=coalesce((p_request->>'premium')::double precision,50000);
 options jsonb:=coalesce(p_request->'options','{}')||jsonb_build_object('from',p_request->>'from','to',p_request->>'to','timezone',p_request->>'timezone','now',p_request->>'now'); result jsonb;
BEGIN
 IF viewer IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 IF admin_mode AND NOT EXISTS(SELECT FROM public.profiles WHERE id=viewer AND role='admin') THEN RAISE EXCEPTION 'Administrator required' USING ERRCODE='42501'; END IF;
 IF currency_filter IS NOT NULL AND currency_filter NOT IN('ARS','PYG') THEN RAISE EXCEPTION 'Invalid currency' USING ERRCODE='22023'; END IF;
 SELECT p.visible_from INTO visible_from FROM public.conversion_view_preferences p WHERE p.hidden_by=viewer;
 from_at:=greatest(from_at,visible_from);

 WITH source AS MATERIALIZED ( SELECT row_number() OVER(ORDER BY c.created_at DESC,c.id) ord,c.id,c.internal_id,c.user_id,c.landing_id,nullif(c.landing_name,'') AS landing_name,c.phone,nullif(c.email,'') AS email,nullif(c.fn,'') AS fn,nullif(c.ln,'') AS ln,nullif(c.ct,'') AS ct,nullif(c.st,'') AS st,nullif(c.country,'') AS country,
 nullif(c.currency,'') AS currency,nullif(c.workspace_resolution_source,'') AS workspace_resolution_source,nullif(c.external_id,'') AS external_id,nullif(c.promo_code,'') AS promo_code,nullif(c.utm_campaign,'') AS utm_campaign,nullif(c.device_type,'') AS device_type,nullif(c.inferred_sex,'') AS inferred_sex,nullif(c.geo_city,'') AS geo_city,nullif(c.geo_region,'') AS geo_region,nullif(c.geo_country,'') AS geo_country,
 nullif(c.contact_event_id,'') AS contact_event_id,c.contact_event_time,nullif(c.lead_event_id,'') AS lead_event_id,c.lead_event_time,nullif(c.registration_event_id,'') AS registration_event_id,c.registration_event_time,nullif(c.purchase_event_id,'') AS purchase_event_id,c.purchase_event_time,nullif(c.purchase_type,'') AS purchase_type,nullif(c.estado,'') AS estado,c.valor,nullif(c.observaciones,'') AS observaciones,c.test_event_code,
 c.from_meta_ads,nullif(c.source_platform,'') AS source_platform,c.meta_pixel_id,nullif(c.pixel_id,'') AS pixel_id,nullif(c.dataset_id,'') AS dataset_id,nullif(c.atrio_id,'') AS atrio_id,nullif(c.atrio_slug,'') AS atrio_slug,nullif(c.atrio_players_id,'') AS atrio_players_id,nullif(c.lead_atrio_players_id,'') AS lead_atrio_players_id,nullif(c.purchase_atrio_players_id,'') AS purchase_atrio_players_id,
 nullif(c.telefono_asignado,'') AS telefono_asignado,c.assigned_gerencia_id,c.assigned_gerencia_external_id,nullif(c.assigned_gerencia_label,'') AS assigned_gerencia_label,nullif(c.assigned_gerencia_name,'') AS assigned_gerencia_name,
 nullif(c.lead_agency_id,'') AS lead_agency_id,c.lead_gerencia_id,c.lead_gerencia_external_id,nullif(c.lead_gerencia_label,'') AS lead_gerencia_label,nullif(c.lead_bot_phone,'') AS lead_bot_phone,nullif(c.lead_player_username,'') AS lead_player_username,nullif(c.lead_incoming_promo_code,'') AS lead_incoming_promo_code,
 nullif(c.registration_agency_id,'') AS registration_agency_id,c.registration_gerencia_id,c.registration_gerencia_external_id,nullif(c.registration_gerencia_label,'') AS registration_gerencia_label,nullif(c.registration_bot_phone,'') AS registration_bot_phone,nullif(c.registration_player_username,'') AS registration_player_username,
 nullif(c.purchase_agency_id,'') AS purchase_agency_id,c.purchase_gerencia_id,c.purchase_gerencia_external_id,nullif(c.purchase_gerencia_label,'') AS purchase_gerencia_label,nullif(c.purchase_bot_phone,'') AS purchase_bot_phone,nullif(c.purchase_player_username,'') AS purchase_player_username,c.created_at
 FROM public.conversions c WHERE (admin_mode OR c.user_id=viewer)
 AND (from_at IS NULL OR c.created_at>=from_at) AND (to_at IS NULL OR c.created_at<=to_at)
 AND (currency_filter IS NULL OR c.currency=currency_filter OR CASE WHEN upper(conversions_read.trim(coalesce(c.currency,'')))~'^[A-Z]{3}$' THEN upper(conversions_read.trim(c.currency)) ELSE 'ARS' END=currency_filter)
 AND NOT EXISTS(SELECT FROM public.hidden_conversions h WHERE h.hidden_by=viewer AND h.conversion_id=c.id)
 ORDER BY c.created_at DESC,c.id
),
 clean AS MATERIALIZED(SELECT * FROM source WHERE test_event_code IS NULL OR test_event_code='' OR conversions_read.trim(test_event_code)=''),
 start_rows AS MATERIALIZED(SELECT jsonb_strip_nulls(to_jsonb(s)) v,row_number() OVER(ORDER BY s.first_seen_at DESC,s.id) ordinality FROM public.conversion_journey_starts s WHERE (admin_mode OR s.user_id=viewer) AND (from_at IS NULL OR s.first_seen_at>=from_at) AND (to_at IS NULL OR s.first_seen_at<=to_at) AND (currency_filter IS NULL OR CASE WHEN upper(conversions_read.trim(coalesce(s.workspace_currency,'')))~'^[A-Z]{3}$' THEN upper(conversions_read.trim(s.workspace_currency)) ELSE 'ARS' END=currency_filter)),
 option_inputs AS MATERIALIZED(SELECT jsonb_build_object('landing_name',src.landing_name,'telefono_asignado',src.telefono_asignado,'source_platform',src.source_platform,'utm_campaign',src.utm_campaign,'device_type',src.device_type,'meta_pixel_id',src.meta_pixel_id,'pixel_id',src.pixel_id,'dataset_id',src.dataset_id) value FROM clean src UNION ALL SELECT v FROM start_rows),
 label_rows AS MATERIALIZED(SELECT jsonb_build_object('contact_event_id',src.contact_event_id,'lead_event_id',src.lead_event_id,'purchase_event_id',src.purchase_event_id,'assigned_gerencia_label',src.assigned_gerencia_label,'lead_gerencia_label',src.lead_gerencia_label,'purchase_gerencia_label',src.purchase_gerencia_label,'telefono_asignado',src.telefono_asignado,'inferred_sex',src.inferred_sex) value,ord ordinality FROM clean src),
 all_options AS MATERIALIZED (SELECT DISTINCT jsonb_build_object('landing_name',value->'landing_name','telefono_asignado',value->'telefono_asignado','source_platform',value->'source_platform','utm_campaign',value->'utm_campaign','device_type',value->'device_type') v FROM option_inputs),
 label_inputs AS(SELECT jsonb_build_object(
 'contact_event_id',CASE WHEN conversions_read.txt(value,'contact_event_id')<>'' THEN 'event' ELSE '' END,
 'lead_event_id',CASE WHEN conversions_read.txt(value,'lead_event_id')<>'' THEN 'event' ELSE '' END,
 'purchase_event_id',CASE WHEN conversions_read.txt(value,'purchase_event_id')<>'' THEN 'event' ELSE '' END,
 'assigned_gerencia_label',value->>'assigned_gerencia_label','lead_gerencia_label',value->>'lead_gerencia_label','purchase_gerencia_label',value->>'purchase_gerencia_label','telefono_asignado',conversions_read.digits(value->>'telefono_asignado')) v,ordinality ord FROM label_rows),
 label_contexts AS MATERIALIZED(SELECT v,min(ord) ord FROM label_inputs GROUP BY v),
 start_inputs AS(SELECT jsonb_build_object('assigned_gerencia_label',value->>'assigned_gerencia_label','assigned_gerencia_name',value->>'assigned_gerencia_name','assigned_gerencia_id',value->>'assigned_gerencia_id','assigned_gerencia_external_id',value->>'assigned_gerencia_external_id','telefono_asignado',conversions_read.digits(value->>'telefono_asignado')) v,ordinality ord FROM (SELECT v value,ordinality FROM start_rows) sr),
 start_contexts AS MATERIALIZED(SELECT v,min(ord) ord FROM start_inputs GROUP BY v),
 gerencia_labels AS MATERIALIZED(SELECT l.value label,0 source,r.ord,l.ordinality label_ord FROM label_contexts r CROSS JOIN LATERAL jsonb_array_elements_text(conversions_read.labels(v,phone_labels)) WITH ORDINALITY l
 UNION ALL SELECT l.value,1,r.ord,l.ordinality FROM start_contexts r CROSS JOIN LATERAL jsonb_array_elements_text(conversions_read.start_labels(v,phone_labels)) WITH ORDINALITY l),
 ordered_labels AS(SELECT DISTINCT ON(label) * FROM gerencia_labels ORDER BY label,source,ord,label_ord),
 values AS (SELECT 'landing' k,conversions_read.txt(v,'landing_name') v FROM all_options UNION ALL
 SELECT 'phone',conversions_read.digits(v->>'telefono_asignado') FROM all_options UNION ALL
 SELECT 'source',lower(conversions_read.txt(v,'source_platform')) FROM all_options UNION ALL
 SELECT 'campaign',conversions_read.txt(v,'utm_campaign') FROM all_options UNION ALL
 SELECT 'device',lower(conversions_read.txt(v,'device_type')) FROM all_options UNION ALL
 SELECT 'sex',conversions_read.sex(value) FROM (SELECT DISTINCT value->>'inferred_sex' value FROM label_rows) sexes UNION ALL
 SELECT 'gerencia',label FROM gerencia_labels),
 unique_values AS (SELECT DISTINCT k,v FROM values WHERE v<>''),
 grouped AS (SELECT k,jsonb_agg(v ORDER BY v COLLATE "pg_catalog"."es-x-icu") vals FROM unique_values GROUP BY k)
, metadata_base AS(SELECT coalesce(jsonb_object_agg(k,vals),'{}')||jsonb_build_object('gerenciaPriority',(SELECT coalesce(jsonb_agg(label ORDER BY source,ord,label_ord),'[]') FROM ordered_labels)) metadata FROM grouped),
 tracking_inputs AS MATERIALIZED(SELECT DISTINCT jsonb_build_object('source_platform',value->'source_platform','meta_pixel_id',value->'meta_pixel_id','pixel_id',value->'pixel_id','dataset_id',value->'dataset_id') v FROM option_inputs),
 sources AS(SELECT DISTINCT lower(conversions_read.txt(v,'source_platform')) src FROM tracking_inputs UNION SELECT '__all__'),
 tracking_options AS(SELECT src,coalesce((SELECT jsonb_agg(id ORDER BY id COLLATE "pg_catalog"."es-x-icu") FROM(SELECT DISTINCT CASE WHEN sources.src='whatsapp_cloud_api' THEN conversions_read.txt(v,'dataset_id') ELSE conversions_read.trim(coalesce(v->>'meta_pixel_id',v->>'pixel_id','')) END id FROM tracking_inputs WHERE sources.src='__all__' OR lower(conversions_read.txt(v,'source_platform'))=sources.src) ids WHERE id<>''),'[]') ids FROM sources)
, metadata AS(SELECT metadata||jsonb_build_object('tracking',(SELECT jsonb_object_agg(src,ids) FROM tracking_options)) v FROM metadata_base),

 fr AS (SELECT src.*,((COALESCE(src.user_id::text, ''::text) || '::'::text) || CASE WHEN (conversions_read.digits(src.phone::text) <> ''::text) THEN ((('phone:'::text || conversions_read.digits(src.phone::text)) || '::context:'::text) || lower(COALESCE(NULLIF(conversions_read.trim(src.purchase_agency_id::text), ''::text), NULLIF(conversions_read.trim(src.purchase_gerencia_external_id::text), ''::text), NULLIF(conversions_read.trim(src.purchase_gerencia_id::text), ''::text), NULLIF(conversions_read.trim(src.purchase_bot_phone::text), ''::text), NULLIF(conversions_read.trim(src.purchase_gerencia_label::text), ''::text), NULLIF(conversions_read.trim(src.registration_agency_id::text), ''::text), NULLIF(conversions_read.trim(src.registration_gerencia_external_id::text), ''::text), NULLIF(conversions_read.trim(src.registration_gerencia_id::text), ''::text), NULLIF(conversions_read.trim(src.registration_bot_phone::text), ''::text), NULLIF(conversions_read.trim(src.registration_gerencia_label::text), ''::text), NULLIF(conversions_read.trim(src.lead_agency_id::text), ''::text), NULLIF(conversions_read.trim(src.lead_gerencia_external_id::text), ''::text), NULLIF(conversions_read.trim(src.lead_gerencia_id::text), ''::text), NULLIF(conversions_read.trim(src.lead_bot_phone::text), ''::text), NULLIF(conversions_read.trim(src.lead_gerencia_label::text), ''::text), NULLIF(conversions_read.trim(src.assigned_gerencia_external_id::text), ''::text), NULLIF(conversions_read.trim(src.assigned_gerencia_id::text), ''::text), NULLIF(conversions_read.trim(src.telefono_asignado::text), ''::text), NULLIF(conversions_read.trim(src.assigned_gerencia_label::text), ''::text), '__sin_gerencia__'::text))) ELSE ('fallback:'::text || lower(COALESCE(NULLIF(conversions_read."trim"(COALESCE(NULLIF(src.purchase_player_username::text, ''::text), NULLIF(src.registration_player_username::text, ''::text), src.lead_player_username::text, ''::text)), ''::text), NULLIF(src.external_id::text, ''::text), NULLIF(src.id::text, ''::text), (to_jsonb(src.created_at)#>>'{}')))) END) k,date_trunc('milliseconds',src.created_at) t FROM clean src),
 fg AS MATERIALIZED( SELECT k,min(ord) ord,min(t) first_at,max(t) last_at,
 (array_agg((to_jsonb(src.created_at)#>>'{}') ORDER BY t,ord))[1] first_contact,
 (array_agg(ord ORDER BY t DESC,ord DESC))[1] latest_ord,
 (array_agg(src.telefono_asignado::text ORDER BY t DESC,ord DESC) FILTER(WHERE conversions_read.trim(src.telefono_asignado::text)<>''))[1] assigned_phone,
 (array_agg(src.assigned_gerencia_label::text ORDER BY t DESC,ord DESC) FILTER(WHERE conversions_read.trim(src.assigned_gerencia_label::text)<>''))[1] assigned_label,
 (array_agg(conversions_read.trim(coalesce(nullif(src.purchase_player_username::text,''),nullif(src.registration_player_username::text,''),src.lead_player_username::text,'')) ORDER BY t DESC,ord DESC)
 FILTER(WHERE conversions_read.trim(coalesce(nullif(src.purchase_player_username::text,''),nullif(src.registration_player_username::text,''),src.lead_player_username::text,''))<>''))[1] username,
 coalesce(sum((src.valor::text)::double precision) FILTER(WHERE coalesce(src.purchase_event_id::text,'')<>''),0) total,
 count(*) FILTER(WHERE coalesce(src.purchase_event_id::text,'')<>'') purchases,
 count(*) FILTER(WHERE CASE WHEN (COALESCE(src.purchase_event_id::text, ''::text) = ''::text) THEN NULL::text WHEN (src.purchase_type::text = ANY (ARRAY['first'::text, 'repeat'::text])) THEN src.purchase_type::text WHEN (POSITION(('REPEAT'::text) IN (COALESCE(src.observaciones::text, ''::text))) > 0) THEN 'repeat'::text ELSE 'first'::text END='repeat') repeats,
 count(*) FILTER(WHERE coalesce(src.lead_event_id::text,'')<>'') leads,
 count(*) FILTER(WHERE coalesce(src.contact_event_id::text,'')<>'') contacts
 FROM fr src GROUP BY k
),
 fc AS MATERIALIZED(SELECT grouped.ord group_ord,last_at,latest_ord,total total_valor,purchases purchase_count,repeats repeat_count,
 latest.estado current_status,CASE WHEN (COALESCE(latest.purchase_event_id::text, ''::text) = ''::text) THEN NULL::text WHEN (latest.purchase_type::text = ANY (ARRAY['first'::text, 'repeat'::text])) THEN latest.purchase_type::text WHEN (POSITION(('REPEAT'::text) IN (COALESCE(latest.observaciones::text, ''::text))) > 0) THEN 'repeat'::text ELSE 'first'::text END current_purchase_type,
 latest.phone,latest.utm_campaign,latest.device_type,latest.landing_name,coalesce(nullif(latest.geo_region,''),nullif(latest.st,'')) region
 FROM fg grouped JOIN clean latest ON latest.ord=latest_ord WHERE latest.estado IN ('lead','purchase')),
 contacts AS MATERIALIZED(SELECT fc.*,row_number() OVER(ORDER BY last_at DESC,group_ord) ord FROM fc WHERE conversions_read.trim(phone)<>''),
 identity_parts AS MATERIALIZED(SELECT src.ord,src.created_at,src.phone,src.user_id,src.contact_event_id,src.lead_event_id,src.purchase_event_id,src.id,src.external_id,src.estado,src.purchase_type,src.observaciones,src.valor,src.lead_event_time,src.purchase_event_time,src.promo_code,src.lead_incoming_promo_code,src.utm_campaign,src.device_type,src.landing_name,src.geo_region,src.user_id::text usr,conversions_read.digits(src.phone) digits,
 conversions_read.part('phone',conversions_read.digits(src.phone)) phone_part,coalesce(nullif(conversions_read.part('agency',src.assigned_gerencia_external_id::text),''),nullif(conversions_read.part('agency',src.assigned_gerencia_id::text),''),nullif(conversions_read.part('glabel',src.assigned_gerencia_label::text),''),conversions_read.part('assigned_phone',conversions_read.digits(src.telefono_asignado))) agency,coalesce(nullif(conversions_read.part('agency',src.lead_agency_id::text),''),nullif(conversions_read.part('agency',src.lead_gerencia_external_id::text),''),nullif(conversions_read.part('agency',src.lead_gerencia_id::text),''),nullif(conversions_read.part('glabel',src.lead_gerencia_label::text),''),nullif(conversions_read.part('bot_phone',conversions_read.digits(src.lead_bot_phone)),''),'') lead_agency,coalesce(nullif(conversions_read.part('agency',src.purchase_agency_id::text),''),nullif(conversions_read.part('agency',src.purchase_gerencia_external_id::text),''),nullif(conversions_read.part('agency',src.purchase_gerencia_id::text),''),nullif(conversions_read.part('glabel',src.purchase_gerencia_label::text),''),nullif(conversions_read.part('bot_phone',conversions_read.digits(src.purchase_bot_phone)),''),'') purchase_agency,
 coalesce(nullif(conversions_read.part('player',src.registration_player_username::text),''),conversions_read.part('player',src.lead_player_username::text)) lead_player,coalesce(nullif(conversions_read.part('player',src.purchase_player_username::text),''),nullif(conversions_read.part('player',src.registration_player_username::text),''),conversions_read.part('player',src.lead_player_username::text)) purchase_player,
 coalesce(nullif(conversions_read.part('external',src.external_id::text),''),nullif(conversions_read.part('email',src.email::text),''),nullif(conversions_read.part('row',src.id::text),''),conversions_read.part('created',to_jsonb(src.created_at)#>>'{}')) fallback,
 conversions_read.part('promo',src.promo_code::text) promo,coalesce(nullif(src.id::text,''),to_jsonb(src.created_at)#>>'{}') row_id,
 lower(conversions_read.trim(src.source_platform)) platform,lower(conversions_read.trim(src.landing_id::text)) landing_part,conversions_read.part('external',src.external_id::text) external_part
 FROM clean src),
 settings AS MATERIALIZED(SELECT coalesce((options->>'now')::timestamptz,statement_timestamp()) as_of,coalesce(options->>'timezone','UTC') tz),
 r AS MATERIALIZED( SELECT src.ord,src.created_at created,
 date_trunc('milliseconds',src.created_at) created_ms,
 (src.created_at AT TIME ZONE tz)::date AS day,
 extract(hour FROM src.created_at AT TIME ZONE tz)::int AS hour,
 extract(isodow FROM src.created_at AT TIME ZONE tz)::int weekday,
 src.phone::text phone,src.digits,src.user_id::text usr,
 (src.user_id::text)||'::'||CASE WHEN conversions_read.trim(src.phone::text)<>'' THEN conversions_read.trim(src.phone::text) ELSE '__fallback__'||coalesce(nullif(src.contact_event_id::text,''),nullif(src.lead_event_id::text,''),nullif(src.purchase_event_id::text,''),nullif(src.id::text,''),src.created_at::text) END phone_key,
 CASE WHEN conversions_read.trim(src.external_id::text)<>'' THEN (src.user_id::text)||'::'||conversions_read.trim(src.external_id::text) END ext,
 coalesce(src.contact_event_id::text,'')<>'' contact,coalesce(src.lead_event_id::text,'')<>'' lead,
 coalesce(src.purchase_event_id::text,'')<>'' purchase,
 src.estado::text='lead' OR coalesce(src.lead_event_id::text,'')<>'' message,
 conversions_read.trim(src.contact_event_id::text)<>'' clean_contact,conversions_read.trim(src.lead_event_id::text)<>'' clean_lead,
 CASE WHEN (COALESCE(src.purchase_event_id::text, ''::text) = ''::text) THEN NULL::text WHEN (src.purchase_type::text = ANY (ARRAY['first'::text, 'repeat'::text])) THEN src.purchase_type::text WHEN (POSITION(('REPEAT'::text) IN (COALESCE(src.observaciones::text, ''::text))) > 0) THEN 'repeat'::text ELSE 'first'::text END kind,(src.valor::text)::double precision amount,
 (src.lead_event_time::text)::double precision lead_time,(src.purchase_event_time::text)::double precision purchase_time,
 CASE WHEN coalesce(src.contact_event_id::text,'')<>'' THEN (src.usr||'::'||CASE WHEN src.phone_part<>'' AND (src.agency)<>'' THEN src.phone_part||'::'||(src.agency) WHEN src.phone_part<>'' AND ('')<>'' THEN src.phone_part||'::'||('') WHEN src.phone_part<>'' THEN src.phone_part ELSE coalesce(nullif((''),''),src.fallback) END||'::'||coalesce(nullif(src.promo,''),conversions_read.part('promo','contact:'||src.row_id))) END ck,
 CASE WHEN coalesce(src.lead_event_id::text,'')<>'' THEN (src.usr||'::'||CASE WHEN src.phone_part<>'' AND (coalesce(nullif(src.lead_agency,''),src.agency))<>'' THEN src.phone_part||'::'||(coalesce(nullif(src.lead_agency,''),src.agency)) WHEN src.phone_part<>'' AND (src.lead_player)<>'' THEN src.phone_part||'::'||(src.lead_player) WHEN src.phone_part<>'' THEN src.phone_part ELSE coalesce(nullif((src.lead_player),''),src.fallback) END||'::'||coalesce(nullif(src.promo,''),conversions_read.part('promo','lead:'||src.row_id))) END lk,
 CASE WHEN coalesce(src.purchase_event_id::text,'')<>'' THEN (src.usr||'::'||CASE WHEN src.phone_part<>'' AND (coalesce(nullif(src.purchase_agency,''),nullif(src.lead_agency,''),src.agency))<>'' THEN src.phone_part||'::'||(coalesce(nullif(src.purchase_agency,''),nullif(src.lead_agency,''),src.agency)) WHEN src.phone_part<>'' AND (src.purchase_player)<>'' THEN src.phone_part||'::'||(src.purchase_player) WHEN src.phone_part<>'' THEN src.phone_part ELSE coalesce(nullif((src.purchase_player),''),src.fallback) END||'::'||coalesce(nullif(src.promo,''),conversions_read.part('promo','purchase:'||src.row_id))) END pk,
 CASE WHEN conversions_read.trim(src.contact_event_id::text)<>'' THEN CASE WHEN src.usr='' OR src.platform='' THEN '' WHEN src.platform='landing' AND src.external_part<>'' THEN src.usr||'::landing::'||CASE WHEN src.landing_part<>'' THEN 'landing:'||src.landing_part||'::' ELSE '' END||src.external_part WHEN src.platform='whatsapp_cloud_api' AND coalesce(nullif(src.external_part,''),nullif(src.phone_part,'')) IS NOT NULL THEN src.usr||'::whatsapp_cloud_api::'||coalesce(nullif(src.external_part,''),'wa:'||src.digits) ELSE src.usr||'::'||src.platform||'::'||conversions_read.part('start',src.row_id) END END person,
 coalesce(substring(conversions_read.trim(src.promo_code::text) from '^([A-Za-z0-9]+)-[A-Za-z0-9]+$'),substring(conversions_read.trim(src.lead_incoming_promo_code::text) from '^([A-Za-z0-9]+)-[A-Za-z0-9]+$'),'Sin tag') tag,
 coalesce(nullif(src.utm_campaign::text,''),'Sin campaña') campaign,coalesce(nullif(src.device_type::text,''),'Desconocido') device,
 coalesce(nullif(src.landing_name::text,''),'Sin landing') landing,conversions_read.province(src.geo_region::text) province
 FROM identity_parts src CROSS JOIN settings
),
 c AS MATERIALIZED (
 SELECT ord,group_ord,latest_ord,total_valor amount,CASE WHEN ((ct.purchase_count::text)::integer > 0) THEN CASE WHEN ((ct.total_valor::text)::double precision >= premium) THEN 'premium'::text WHEN (((ct.repeat_count::text)::integer > 0) OR ((ct.purchase_count::text)::integer > 1)) THEN 'recurrente'::text ELSE 'primera_carga'::text END WHEN (ct.current_status::text = 'purchase'::text) THEN CASE WHEN ((ct.total_valor::text)::double precision >= premium) THEN 'premium'::text WHEN (ct.current_purchase_type::text = 'repeat'::text) THEN 'recurrente'::text WHEN (ct.current_purchase_type::text = 'first'::text) THEN 'primera_carga'::text ELSE 'leads'::text END ELSE 'leads'::text END stage,
 coalesce(nullif(utm_campaign,''),'Sin campaña') campaign,coalesce(nullif(device_type,''),'Desconocido') device,
 coalesce(nullif(landing_name,''),'Sin landing') landing,conversions_read.province(region) province FROM contacts ct
), s AS MATERIALIZED (
 SELECT coalesce(nullif(conversions_read.part('start',value->>'start_identity_key'),''),nullif(conversions_read.part('row',value->>'id'),'')) identity,
 conversions_read.start_person(value,true) person FROM (SELECT v value FROM start_rows) st
), events AS (
 SELECT r.campaign,r.device,r.landing,r.hour,r.day,r.province,e.k,e.stage
 FROM r CROSS JOIN LATERAL(VALUES(ck,'contact'::text,contact),(lk,'lead',lead),(pk,kind,purchase)) e(k,stage,enabled) WHERE e.enabled
), journeys AS (
 SELECT grouping(campaign,device,landing,hour,day,province) g,campaign,device,landing,hour,day,province,k,
 bool_or(stage='contact') contact,bool_or(stage='lead') lead,count(*) FILTER(WHERE stage='first') firsts,count(*) FILTER(WHERE stage='repeat') repeats
 FROM events GROUP BY GROUPING SETS((k),(campaign,k),(device,k),(landing,k),(hour,k),(day,k),(province,k))
), ads AS MATERIALIZED (
 SELECT CASE g WHEN 63 THEN 'global' WHEN 31 THEN 'campaign' WHEN 47 THEN 'device' WHEN 55 THEN 'landing' WHEN 59 THEN 'hour' WHEN 61 THEN 'day' ELSE 'province' END dim,
 CASE g WHEN 63 THEN '__global__' WHEN 31 THEN campaign WHEN 47 THEN device WHEN 55 THEN landing WHEN 59 THEN hour::text WHEN 61 THEN day::text ELSE province END name,
 jsonb_build_object('adContactJourneys',count(*) FILTER(WHERE contact),'adLeadJourneysLinkedToContact',count(*) FILTER(WHERE contact AND lead),
 'adInferredLeadJourneys',count(*) FILTER(WHERE contact AND NOT lead AND firsts>0),'adLeadJourneysLinkedToContactWithInferred',count(*) FILTER(WHERE contact AND (lead OR firsts>0)),
 'adFirstPurchaseJourneysAttributed',count(*) FILTER(WHERE contact AND firsts>0),'adFirstPurchaseEvents',coalesce(sum(firsts),0),'adFirstPurchaseEventsAttributed',coalesce(sum(firsts) FILTER(WHERE contact),0),
 'adRepeatJourneys',count(*) FILTER(WHERE repeats>0),'adRepeatEvents',coalesce(sum(repeats),0),'adRepeatJourneysFromAttributedFirstInRange',count(*) FILTER(WHERE contact AND firsts>0 AND repeats>0),
 'adRepeatEventsFromAttributedFirstInRange',coalesce(sum(repeats) FILTER(WHERE contact AND firsts>0),0)) ad
 FROM journeys GROUP BY g,campaign,device,landing,hour,day,province
), x AS MATERIALIZED (
 SELECT scope,ord,created_ms,phone,phone_key,ext,contact,lead,purchase,kind,amount,lead_time,purchase_time
 FROM r CROSS JOIN LATERAL(VALUES('__global__'::text),(province)) scopes(scope) WHERE scope IS NOT NULL
), scopes AS MATERIALIZED (SELECT '__global__'::text scope UNION SELECT province FROM r WHERE province IS NOT NULL UNION SELECT province FROM c WHERE province IS NOT NULL),
 contact_ext AS MATERIALIZED (SELECT DISTINCT scope,ext FROM x WHERE contact AND ext IS NOT NULL),
 lead_ext AS MATERIALIZED (SELECT DISTINCT scope,ext FROM x WHERE lead AND ext IS NOT NULL),
 firsts AS MATERIALIZED (
 SELECT DISTINCT ON(scope,phone_key) scope,phone_key,ext,amount,ord,created_ms FROM x WHERE kind='first' ORDER BY scope,phone_key,created_ms,ord
), first_totals AS MATERIALIZED (
 SELECT f.scope,count(*) purchasers,count(*) FILTER(WHERE ce.ext IS NOT NULL) attributed,
 count(*) FILTER(WHERE ce.ext IS NOT NULL AND le.ext IS NOT NULL) linked,
 count(*) FILTER(WHERE ce.ext IS NOT NULL AND le.ext IS NULL) inferred,coalesce(sum(amount ORDER BY phone_key),0) revenue
 FROM firsts f LEFT JOIN contact_ext ce ON ce.scope=f.scope AND ce.ext=f.ext LEFT JOIN lead_ext le ON le.scope=f.scope AND le.ext=f.ext GROUP BY f.scope
), first_refs AS MATERIALIZED (
 SELECT f.scope,f.ext,bool_or(le.ext IS NOT NULL) linked FROM firsts f JOIN contact_ext ce ON ce.scope=f.scope AND ce.ext=f.ext LEFT JOIN lead_ext le ON le.scope=f.scope AND le.ext=f.ext GROUP BY f.scope,f.ext
), totals AS MATERIALIZED (
 SELECT x.scope,count(DISTINCT phone_key) FILTER(WHERE contact) unique_contacts,count(DISTINCT phone_key) FILTER(WHERE lead) unique_leads,
 count(DISTINCT x.ext) FILTER(WHERE lead AND ce.ext IS NOT NULL) linked_leads,count(*) FILTER(WHERE kind IS NOT NULL) purchases,
 count(DISTINCT phone_key) FILTER(WHERE kind='repeat') repeat_players,
 coalesce(percentile_cont(0.5) WITHIN GROUP(ORDER BY amount) FILTER(WHERE kind IS NOT NULL AND amount>0),0) median_value,
 count(DISTINCT x.ext) FILTER(WHERE kind='repeat' AND f.linked) repeat_from_first,
 count(DISTINCT x.ext) FILTER(WHERE kind='repeat' AND f.ext IS NOT NULL) repeat_from_attributed,
 count(*) FILTER(WHERE kind='repeat' AND f.ext IS NOT NULL) repeat_events_from_attributed
 FROM x LEFT JOIN contact_ext ce ON ce.scope=x.scope AND ce.ext=x.ext LEFT JOIN first_refs f ON f.scope=x.scope AND f.ext=x.ext GROUP BY x.scope
), retention AS MATERIALIZED (
 SELECT scope,phone,min(created_ms) first_purchase,count(*) FILTER(WHERE created_ms>=as_of-interval '720 hours') recent
 FROM x CROSS JOIN settings WHERE purchase AND phone<>'' GROUP BY scope,phone
), retained AS MATERIALIZED (SELECT scope,count(*) n FROM retention CROSS JOIN settings WHERE recent>=4 AND first_purchase<=as_of-interval '168 hours' GROUP BY scope),
 stages AS MATERIALIZED (
 SELECT scope,count(*) FILTER(WHERE stage='primera_carga') first_players,count(*) FILTER(WHERE stage='recurrente') repeat_players,count(*) FILTER(WHERE stage='premium') premium_players
 FROM c CROSS JOIN LATERAL(VALUES('__global__'::text),(province)) s(scope) WHERE scope IS NOT NULL GROUP BY scope
), money_totals AS MATERIALIZED (
 SELECT scope,m.* FROM scopes sc CROSS JOIN LATERAL(
 SELECT coalesce(sum(amount) FILTER(WHERE kind IS NOT NULL),0) revenue,
 coalesce(sum(amount) FILTER(WHERE kind='first'),0) first_revenue,
 coalesce(avg((purchase_time-lead_time)/3600) FILTER(WHERE lead_time>0 AND purchase_time>0 AND purchase_time>=lead_time),0) lead_hours
 FROM(SELECT phone_key,amount,kind,lead_time,purchase_time FROM x WHERE x.scope=sc.scope ORDER BY phone_key) ordered
 ) m
), cores AS MATERIALIZED (
 SELECT scope,coalesce(a.ad,conversions_read.ad_counts('[]'))||jsonb_build_object(
 'uniqueContacts',coalesce(t.unique_contacts,0),'uniqueLeads',coalesce(t.unique_leads,0),'uniqueLeadsLinkedToContact',coalesce(t.linked_leads,0),
 'inferredLeadsFromContactPurchase',coalesce(f.inferred,0),'uniqueLeadsLinkedToContactWithInferred',coalesce(t.linked_leads,0)+coalesce(f.inferred,0),
 'firstLoadPurchasers',coalesce(f.purchasers,0),'firstLoadPurchasersLinkedToLead',coalesce(f.linked,0),'firstLoadPurchasersAttributed',coalesce(f.attributed,0),
 'totalPurchases',coalesce(t.purchases,0),'purchaseRepeat',coalesce(t.repeat_players,0),'repeatFromFirstInRange',coalesce(t.repeat_from_first,0),
 'repeatFromAttributedFirstInRange',coalesce(t.repeat_from_attributed,0),'repeatEventsFromAttributedFirstInRange',coalesce(t.repeat_events_from_attributed,0),
 'firstLoadPlayers',coalesce(s.first_players,0),'repeatPlayers',coalesce(s.repeat_players,0),'premiumPlayers',coalesce(s.premium_players,0),
 'totalRevenue',coalesce(m.revenue,0),'totalPurchaseCount',coalesce(t.purchases,0),'firstPurchaseRevenue',coalesce(f.revenue,0),'firstPurchaseEventRevenue',coalesce(m.first_revenue,0),
 'activeRetention30d',coalesce(ret.n,0),'purchaseMedian',coalesce(t.median_value,0),'leadPurchaseAverageHours',coalesce(m.lead_hours,0)) core
 FROM scopes LEFT JOIN money_totals m USING(scope) LEFT JOIN totals t USING(scope) LEFT JOIN first_totals f USING(scope) LEFT JOIN stages s USING(scope) LEFT JOIN retained ret USING(scope)
 LEFT JOIN ads a ON a.dim=CASE WHEN scope='__global__' THEN 'global' ELSE 'province' END AND a.name=scope
), clean_contact_keys AS MATERIALIZED (SELECT DISTINCT ck k FROM r WHERE clean_contact),
 repeat_leads AS MATERIALIZED (
 SELECT DISTINCT ON(lk) lk,usr||'::'||digits phone,tag FROM r WHERE clean_lead AND digits<>'' AND lk IN(SELECT k FROM clean_contact_keys)
 ORDER BY lk,CASE WHEN lead_time>0 THEN lead_time*1000 ELSE extract(epoch FROM created_ms)*1000 END,ord
), repeat_groups AS MATERIALIZED (SELECT phone,count(*) n FROM repeat_leads GROUP BY phone),
 repeat_summary AS (SELECT count(*) phones,coalesce(sum(n),0) total,coalesce(sum(n-1),0) repeats,count(*) FILTER(WHERE n>1) golondrinas FROM repeat_groups),
 tag_groups AS (SELECT tag,phone,count(*) n FROM repeat_leads GROUP BY tag,phone),
 tag_stats AS (SELECT tag,count(*) phones,sum(n) total,sum(n-1) repeats,count(*) FILTER(WHERE n>1) golondrinas FROM tag_groups GROUP BY tag),
 repeats AS MATERIALIZED (
 SELECT jsonb_build_object('totalLeads',total,'uniquePhones',phones,'firstLeads',phones,'repeatLeads',repeats,
 'repeatPct',CASE WHEN total>0 THEN repeats::double precision/total*100 ELSE 0 END,'golondrinaPhones',golondrinas,'golondrinaPct',CASE WHEN phones>0 THEN golondrinas::double precision/phones*100 ELSE 0 END,
 'buckets',(SELECT coalesce(jsonb_agg(jsonb_build_object('bucket',bucket,'label',CASE WHEN bucket=6 THEN '6+ veces' WHEN bucket=1 THEN '1 vez' ELSE bucket||' veces' END,'phones',phones,'leads',leads,'repeatLeads',repeats) ORDER BY bucket),'[]') FROM(SELECT least(n,6) bucket,count(*) phones,sum(n) leads,sum(n-1) repeats FROM repeat_groups GROUP BY least(n,6)) b),
 'byLandingTag',(SELECT coalesce(jsonb_agg(jsonb_build_object('landingTag',tag,'totalLeads',total,'uniquePhones',phones,'firstLeads',phones,'repeatLeads',repeats,'repeatPct',repeats::double precision/total*100,'golondrinaPhones',golondrinas,'golondrinaPct',golondrinas::double precision/phones*100) ORDER BY total DESC,tag COLLATE "pg_catalog"."es-x-icu"),'[]') FROM tag_stats)) v FROM repeat_summary
), dimension_keys AS MATERIALIZED (
 SELECT dim,name,min(ord) ord FROM(
 SELECT dim,name,ord FROM c CROSS JOIN LATERAL(VALUES('campaign',campaign),('device',device),('landing',landing)) d(dim,name)
 UNION ALL SELECT dim,name,ord+(SELECT count(*) FROM contacts) FROM r CROSS JOIN LATERAL(VALUES('campaign',campaign),('device',device),('landing',landing)) d(dim,name)
 ) k GROUP BY dim,name
), bins AS MATERIALIZED (
 SELECT grouping(campaign,device,landing,hour,day) g,campaign,device,landing,hour,day,min(ord) ord,
 count(*) FILTER(WHERE purchase) purchases,count(*) FILTER(WHERE message) leads,count(*) FILTER(WHERE kind='first') firsts,count(*) FILTER(WHERE kind='repeat') repeats,
 coalesce(sum(amount ORDER BY ord) FILTER(WHERE purchase),0) revenue,coalesce(sum(amount ORDER BY ord) FILTER(WHERE kind='first'),0) first_revenue
 FROM r GROUP BY GROUPING SETS((campaign),(device),(landing),(hour),(day))
), dimension_rows AS MATERIALIZED (
 SELECT k.dim,k.name,k.ord,coalesce(b.revenue,0) revenue,jsonb_build_object(k.dim,k.name,'mensajes',coalesce(a.ad,conversions_read.ad_counts('[]'))->'adLeadJourneysLinkedToContact',
 'cargas',coalesce(a.ad,conversions_read.ad_counts('[]'))->'adFirstPurchaseEventsAttributed','revenue',coalesce(b.revenue,0),'firstRevenue',coalesce(b.first_revenue,0)) v,
 row_number() OVER(PARTITION BY k.dim ORDER BY coalesce(b.revenue,0) DESC,k.ord) rank
 FROM dimension_keys k LEFT JOIN ads a ON a.dim=k.dim AND a.name=k.name
 LEFT JOIN bins b ON (k.dim='campaign' AND b.g=15 AND b.campaign=k.name) OR (k.dim='device' AND b.g=23 AND b.device=k.name) OR (k.dim='landing' AND b.g=27 AND b.landing=k.name)
), breakdowns AS MATERIALIZED (
 SELECT coalesce(jsonb_agg(v ORDER BY revenue DESC,ord) FILTER(WHERE dim='campaign' AND rank<=10),'[]') campaign,
 coalesce(jsonb_agg(v ORDER BY revenue DESC,ord) FILTER(WHERE dim='device'),'[]') device,
 coalesce(jsonb_agg(v ORDER BY revenue DESC,ord) FILTER(WHERE dim='landing' AND rank<=10),'[]') landing FROM dimension_rows
), date_limits AS MATERIALIZED (
 SELECT CASE WHEN options->>'from' IS NOT NULL AND options->>'to' IS NOT NULL THEN (options->>'from')::timestamptz AT TIME ZONE tz
 ELSE CASE WHEN max(day) IS NULL THEN as_of AT TIME ZONE tz-interval '6 days' WHEN max(day)-min(day)<6 THEN max(day)::timestamp-interval '6 days' ELSE min(day)::timestamp END END first_day,
 CASE WHEN options->>'from' IS NOT NULL AND options->>'to' IS NOT NULL THEN (options->>'to')::timestamptz AT TIME ZONE tz ELSE coalesce(max(day)::timestamp,as_of AT TIME ZONE tz) END last_day
 FROM settings LEFT JOIN r ON true GROUP BY tz,as_of
), days AS MATERIALIZED (SELECT day FROM date_limits CROSS JOIN LATERAL generate_series(first_day,last_day,interval '1 day') day),
 hourly AS MATERIALIZED (
 SELECT jsonb_agg(jsonb_build_object('hour',h::text,'leads',coalesce(b.leads,0),'cargas',coalesce(b.purchases,0),'cargas_first',coalesce(b.firsts,0),'cargas_repeat',coalesce(b.repeats,0),'ingresos',coalesce(b.revenue,0),'ad',coalesce(a.ad,conversions_read.ad_counts('[]'))) ORDER BY h) v
 FROM generate_series(0,23) h LEFT JOIN bins b ON b.g=29 AND b.hour=h LEFT JOIN ads a ON a.dim='hour' AND a.name=h::text
), daily AS MATERIALIZED (
 SELECT coalesce(jsonb_agg(jsonb_build_object('key',to_char(d.day,'YYYY-MM-DD'),'day',to_char(d.day,'DD/MM'),'leads',coalesce(b.leads,0),'cargas',coalesce(b.purchases,0),'cargas_first',coalesce(b.firsts,0),'cargas_repeat',coalesce(b.repeats,0),'ingresos',coalesce(b.revenue,0),'ad',coalesce(a.ad,conversions_read.ad_counts('[]'))) ORDER BY d.day),'[]') v
 FROM days d LEFT JOIN bins b ON b.g=30 AND b.day=d.day::date LEFT JOIN ads a ON a.dim='day' AND a.name=d.day::date::text
), weekday_bins AS MATERIALIZED (SELECT weekday,count(*) FILTER(WHERE message) leads,count(*) FILTER(WHERE purchase) purchases FROM r GROUP BY weekday),
 weekdays AS MATERIALIZED (
 SELECT jsonb_agg(jsonb_build_object('day',label,'mensajes',coalesce(leads,0),'cargas',coalesce(purchases,0)) ORDER BY ord) v
 FROM unnest(ARRAY['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo']) WITH ORDINALITY d(label,ord) LEFT JOIN weekday_bins b ON b.weekday=d.ord
), first_dates AS MATERIALIZED (SELECT DISTINCT ON(to_char(day,'DD/MM')) to_char(day,'DD/MM') label,leads,purchases,firsts FROM bins WHERE g=30 ORDER BY to_char(day,'DD/MM'),ord),
 daily_messages AS MATERIALIZED (
 SELECT coalesce(jsonb_agg(jsonb_build_object('day',to_char(d.day,'DD/MM'),'leads',coalesce(b.leads,0),'cargas',coalesce(b.purchases,0),'cargas_first',coalesce(b.firsts,0)) ORDER BY d.day),'[]') v FROM days d LEFT JOIN first_dates b ON b.label=to_char(d.day,'DD/MM')
), revenue_days AS (
 SELECT coalesce(sum(amount ORDER BY ord) FILTER(WHERE (created_ms AT TIME ZONE tz)::date=(as_of AT TIME ZONE tz)::date),0) today,
 coalesce(sum(amount ORDER BY ord) FILTER(WHERE (created_ms AT TIME ZONE tz)::date=(as_of AT TIME ZONE tz)::date-1),0) yesterday FROM r CROSS JOIN settings WHERE purchase
)
SELECT jsonb_build_object('options',(SELECT v FROM metadata),'counts',jsonb_build_object('visible',(SELECT count(*) FROM source),'stats',(SELECT count(*) FROM clean),'starts',(SELECT count(*) FROM start_rows),'funnel',(SELECT count(*) FROM contacts),'unfilteredFunnel',(SELECT count(*) FROM fc)),'stats',conversions_read.truth(core)||jsonb_build_object(
 'leads',core->'uniqueLeads','journeyStarts',(SELECT count(DISTINCT identity) FROM s),'journeyStartContacts',(SELECT count(DISTINCT person) FROM r WHERE clean_contact AND person<>'' AND person IN(SELECT person FROM s)),
 'retencionActiva30d',core->'activeRetention30d','leadRepeatStats',repeats.v,'dominantLeadFrequencyBucket',(SELECT value FROM jsonb_array_elements(repeats.v->'buckets') ORDER BY (value->>'leads')::int DESC,(value->>'bucket')::int LIMIT 1),
 'topContacts',(SELECT coalesce(jsonb_agg(v ORDER BY amount DESC,ord),'[]') FROM(SELECT jsonb_build_object(
 'user_id',latest.user_id::text,'phone',latest.phone::text,'email',nullif(latest.email::text,''),'fn',nullif(latest.fn::text,''),'ln',nullif(latest.ln::text,''),
 'ct',nullif(latest.ct::text,''),'st',nullif(latest.st::text,''),'country',nullif(latest.country::text,''),'region',coalesce(nullif(latest.geo_region::text,''),nullif(latest.st::text,'')),
 'utm_campaign',nullif(latest.utm_campaign::text,''),'device_type',nullif(latest.device_type::text,''),'landing_name',nullif(latest.landing_name::text,''),
 'telefono_asignado',coalesce(nullif(CASE WHEN latest.estado::text='purchase' THEN conversions_read.trim(latest.purchase_bot_phone::text) ELSE coalesce(nullif(conversions_read.trim(latest.registration_bot_phone::text),''),conversions_read.trim(latest.lead_bot_phone::text)) END,''),assigned_phone),
 'assigned_gerencia_label',coalesce(nullif(CASE WHEN latest.estado::text='purchase' THEN conversions_read.trim(latest.purchase_gerencia_label::text) ELSE coalesce(nullif(conversions_read.trim(latest.registration_gerencia_label::text),''),conversions_read.trim(latest.lead_gerencia_label::text)) END,''),assigned_label),
 'player_username',username,'total_valor',total,'purchase_count',purchases,'repeat_count',repeats,'lead_count',leads,'contact_count',contacts,
 'reached_contact',contacts>0,'reached_lead',leads>0,'reached_purchase',purchases>0,'reached_repeat',repeats>0,
 'last_activity',(to_jsonb(latest.created_at)#>>'{}'),'first_contact',first_contact,
 'current_status',latest.estado::text,'current_purchase_type',CASE WHEN (COALESCE(latest.purchase_event_id::text, ''::text) = ''::text) THEN NULL::text WHEN (latest.purchase_type::text = ANY (ARRAY['first'::text, 'repeat'::text])) THEN latest.purchase_type::text WHEN (POSITION(('REPEAT'::text) IN (COALESCE(latest.observaciones::text, ''::text))) > 0) THEN 'repeat'::text ELSE 'first'::text END) v,selected.amount,selected.ord FROM(SELECT * FROM c WHERE amount>0 ORDER BY amount DESC,ord LIMIT greatest(1,least(coalesce((options->>'topLimit')::int,10),100))) selected JOIN fg grouped ON grouped.ord=selected.group_ord JOIN clean latest ON latest.ord=selected.latest_ord) top),
 'funnelContactCount',(SELECT count(*) FROM contacts),'conversionCount',(SELECT count(*) FROM clean),'byCampaign',breakdowns.campaign,'byDevice',breakdowns.device,'byLanding',breakdowns.landing,
 'campaignOrder',conversions_read.slice_orders(breakdowns.campaign,'campaign'),'landingOrder',conversions_read.slice_orders(breakdowns.landing,'landing'),
 'hourlyBuckets',hourly.v,'dailyData',daily.v,'dailyMessages',daily_messages.v,'weekdays',weekdays.v,
 'provinces',(SELECT coalesce(jsonb_object_agg(scope,conversions_read.province_metrics(core)),'{}') FROM cores WHERE scope<>'__global__'),
 'globalProvince',conversions_read.province_metrics(core),'revenueToday',revenue_days.today,'revenueYesterday',revenue_days.yesterday))
INTO result FROM cores CROSS JOIN repeats CROSS JOIN breakdowns CROSS JOIN hourly CROSS JOIN daily CROSS JOIN daily_messages CROSS JOIN weekdays CROSS JOIN revenue_days WHERE scope='__global__';
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION conversions_read.stats_native(jsonb) FROM PUBLIC,anon;
GRANT ALL ON FUNCTION conversions_read.stats_native(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_conversion_report(p_request jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
 SET extra_float_digits TO '3'
 SET statement_timeout TO '60s'
 SET work_mem TO '16MB'
AS $function$
DECLARE viewer uuid:=(SELECT auth.uid()); admin_mode boolean:=coalesce((p_request->>'admin')::boolean,false);
 currency_filter text:=nullif(p_request->>'currency','__all__'); from_at timestamptz:=(p_request->>'from')::timestamptz; to_at timestamptz:=(p_request->>'to')::timestamptz; visible_from timestamptz;
 rows jsonb; starts jsonb; stats_rows jsonb; filtered jsonb; filtered_starts jsonb; funnel jsonb:='[]'; all_funnel jsonb:='[]'; phones jsonb:=coalesce(p_request->'phoneLabels','{}');
 f jsonb:=coalesce(p_request->'filters','{}'); options jsonb:=coalesce(p_request->'options','{}'); view_kind text:=coalesce(p_request->>'view','funnel');
 premium double precision:=coalesce((p_request->>'premium')::double precision,50000); result jsonb; table_result jsonb; metadata jsonb; allowed_columns text[]; requested_columns text[];
 availability jsonb; total bigint; page_number int:=greatest(1,coalesce((options->>'page')::int,1)); total_pages int; page_ids uuid[]; active_filters boolean;
BEGIN
 IF viewer IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 IF admin_mode AND NOT EXISTS(SELECT FROM public.profiles WHERE id=viewer AND role='admin') THEN RAISE EXCEPTION 'Administrator required' USING ERRCODE='42501'; END IF;
 IF currency_filter IS NOT NULL AND currency_filter NOT IN('ARS','PYG') THEN RAISE EXCEPTION 'Invalid currency' USING ERRCODE='22023'; END IF;
 SELECT p.visible_from INTO visible_from FROM public.conversion_view_preferences p WHERE p.hidden_by=viewer;
 from_at:=greatest(from_at,visible_from);
 active_filters:=coalesce(f->>'source','__all__')<>'__all__' OR coalesce(f->>'pixel','__all__')<>'__all__'
 OR coalesce(f->>'phone','__all__')<>'__all__' OR coalesce(f->>'meta','__all__')<>'__all__'
 OR coalesce(f->>'sex','__all__')<>'__all__' OR coalesce(f->>'device','__all__')<>'__all__'
 OR jsonb_array_length(coalesce(f->'gerencias','[]'))>0 OR jsonb_array_length(coalesce(f->'campaigns','[]'))>0;

 IF view_kind='stats' AND NOT active_filters THEN RETURN conversions_read.stats_native(p_request); END IF;
 -- No raw event payload, IP address, agent or form dump is needed to aggregate a report.
 -- Omit empty internal text fields as well as NULLs. Keep phone and meta_pixel_id:
 -- their empty-string/null distinction participates in the existing fallback rules.
 -- Table cells are projected from the original records after IDs are paginated.
 WITH source AS (
 SELECT c.id,c.internal_id,c.user_id,c.landing_id,nullif(c.landing_name,'') AS landing_name,c.phone,nullif(c.email,'') AS email,nullif(c.fn,'') AS fn,nullif(c.ln,'') AS ln,nullif(c.ct,'') AS ct,nullif(c.st,'') AS st,nullif(c.country,'') AS country,
 nullif(c.currency,'') AS currency,nullif(c.workspace_resolution_source,'') AS workspace_resolution_source,nullif(c.external_id,'') AS external_id,nullif(c.promo_code,'') AS promo_code,nullif(c.utm_campaign,'') AS utm_campaign,nullif(c.device_type,'') AS device_type,nullif(c.inferred_sex,'') AS inferred_sex,nullif(c.geo_city,'') AS geo_city,nullif(c.geo_region,'') AS geo_region,nullif(c.geo_country,'') AS geo_country,
 nullif(c.contact_event_id,'') AS contact_event_id,c.contact_event_time,nullif(c.lead_event_id,'') AS lead_event_id,c.lead_event_time,nullif(c.registration_event_id,'') AS registration_event_id,c.registration_event_time,nullif(c.purchase_event_id,'') AS purchase_event_id,c.purchase_event_time,nullif(c.purchase_type,'') AS purchase_type,nullif(c.estado,'') AS estado,c.valor,nullif(c.observaciones,'') AS observaciones,nullif(c.test_event_code,'') AS test_event_code,
 c.from_meta_ads,nullif(c.source_platform,'') AS source_platform,c.meta_pixel_id,nullif(c.pixel_id,'') AS pixel_id,nullif(c.dataset_id,'') AS dataset_id,nullif(c.atrio_id,'') AS atrio_id,nullif(c.atrio_slug,'') AS atrio_slug,nullif(c.atrio_players_id,'') AS atrio_players_id,nullif(c.lead_atrio_players_id,'') AS lead_atrio_players_id,nullif(c.purchase_atrio_players_id,'') AS purchase_atrio_players_id,
 nullif(c.telefono_asignado,'') AS telefono_asignado,c.assigned_gerencia_id,c.assigned_gerencia_external_id,nullif(c.assigned_gerencia_label,'') AS assigned_gerencia_label,nullif(c.assigned_gerencia_name,'') AS assigned_gerencia_name,
 nullif(c.lead_agency_id,'') AS lead_agency_id,c.lead_gerencia_id,c.lead_gerencia_external_id,nullif(c.lead_gerencia_label,'') AS lead_gerencia_label,nullif(c.lead_bot_phone,'') AS lead_bot_phone,nullif(c.lead_player_username,'') AS lead_player_username,nullif(c.lead_incoming_promo_code,'') AS lead_incoming_promo_code,
 nullif(c.registration_agency_id,'') AS registration_agency_id,c.registration_gerencia_id,c.registration_gerencia_external_id,nullif(c.registration_gerencia_label,'') AS registration_gerencia_label,nullif(c.registration_bot_phone,'') AS registration_bot_phone,nullif(c.registration_player_username,'') AS registration_player_username,
 nullif(c.purchase_agency_id,'') AS purchase_agency_id,c.purchase_gerencia_id,c.purchase_gerencia_external_id,nullif(c.purchase_gerencia_label,'') AS purchase_gerencia_label,nullif(c.purchase_bot_phone,'') AS purchase_bot_phone,nullif(c.purchase_player_username,'') AS purchase_player_username,c.created_at
 FROM public.conversions c WHERE (admin_mode OR c.user_id=viewer)
 AND (from_at IS NULL OR c.created_at>=from_at) AND (to_at IS NULL OR c.created_at<=to_at)
 AND (currency_filter IS NULL OR CASE WHEN upper(conversions_read.trim(coalesce(c.currency,'')))~'^[A-Z]{3}$' THEN upper(conversions_read.trim(c.currency)) ELSE 'ARS' END=currency_filter)
 AND NOT EXISTS(SELECT FROM public.hidden_conversions h WHERE h.hidden_by=viewer AND h.conversion_id=c.id)
 ORDER BY c.created_at DESC,c.id
 ) SELECT coalesce(jsonb_agg(jsonb_strip_nulls(to_jsonb(source))),'[]') INTO rows FROM source;
 SELECT coalesce(jsonb_agg(jsonb_strip_nulls(to_jsonb(s)) ORDER BY s.first_seen_at DESC,s.id),'[]') INTO starts
 FROM public.conversion_journey_starts s WHERE (admin_mode OR s.user_id=viewer)
 AND (from_at IS NULL OR s.first_seen_at>=from_at) AND (to_at IS NULL OR s.first_seen_at<=to_at)
 AND (currency_filter IS NULL OR CASE WHEN upper(conversions_read.trim(coalesce(s.workspace_currency,'')))~'^[A-Z]{3}$' THEN upper(conversions_read.trim(s.workspace_currency)) ELSE 'ARS' END=currency_filter);
 SELECT coalesce(jsonb_agg(value),'[]') INTO stats_rows FROM jsonb_array_elements(rows) WHERE conversions_read.txt(value,'test_event_code')='';
 -- Options are computed from the historical unfiltered visible universe, before global filters.
 -- Option lists only need distinct small contexts. Do not spool full conversion
 -- objects once for every field of a selector on broad historical periods.
 WITH all_options AS MATERIALIZED (SELECT DISTINCT jsonb_build_object('landing_name',value->'landing_name','telefono_asignado',value->'telefono_asignado','source_platform',value->'source_platform','utm_campaign',value->'utm_campaign','device_type',value->'device_type') v FROM jsonb_array_elements(stats_rows||starts)),
 label_inputs AS(SELECT jsonb_build_object(
 'contact_event_id',CASE WHEN conversions_read.txt(value,'contact_event_id')<>'' THEN 'event' ELSE '' END,
 'lead_event_id',CASE WHEN conversions_read.txt(value,'lead_event_id')<>'' THEN 'event' ELSE '' END,
 'purchase_event_id',CASE WHEN conversions_read.txt(value,'purchase_event_id')<>'' THEN 'event' ELSE '' END,
 'assigned_gerencia_label',value->>'assigned_gerencia_label','lead_gerencia_label',value->>'lead_gerencia_label','purchase_gerencia_label',value->>'purchase_gerencia_label','telefono_asignado',conversions_read.digits(value->>'telefono_asignado')) v,ordinality ord FROM jsonb_array_elements(stats_rows) WITH ORDINALITY),
 label_contexts AS MATERIALIZED(SELECT v,min(ord) ord FROM label_inputs GROUP BY v),
 start_inputs AS(SELECT jsonb_build_object('assigned_gerencia_label',value->>'assigned_gerencia_label','assigned_gerencia_name',value->>'assigned_gerencia_name','assigned_gerencia_id',value->>'assigned_gerencia_id','assigned_gerencia_external_id',value->>'assigned_gerencia_external_id','telefono_asignado',conversions_read.digits(value->>'telefono_asignado')) v,ordinality ord FROM jsonb_array_elements(starts) WITH ORDINALITY),
 start_contexts AS MATERIALIZED(SELECT v,min(ord) ord FROM start_inputs GROUP BY v),
 gerencia_labels AS MATERIALIZED(SELECT l.value label,0 source,r.ord,l.ordinality label_ord FROM label_contexts r CROSS JOIN LATERAL jsonb_array_elements_text(conversions_read.labels(v,phones)) WITH ORDINALITY l
 UNION ALL SELECT l.value,1,r.ord,l.ordinality FROM start_contexts r CROSS JOIN LATERAL jsonb_array_elements_text(conversions_read.start_labels(v,phones)) WITH ORDINALITY l),
 ordered_labels AS(SELECT DISTINCT ON(label) * FROM gerencia_labels ORDER BY label,source,ord,label_ord),
 values AS (SELECT 'landing' k,conversions_read.txt(v,'landing_name') v FROM all_options UNION ALL
 SELECT 'phone',conversions_read.digits(v->>'telefono_asignado') FROM all_options UNION ALL
 SELECT 'source',lower(conversions_read.txt(v,'source_platform')) FROM all_options UNION ALL
 SELECT 'campaign',conversions_read.txt(v,'utm_campaign') FROM all_options UNION ALL
 SELECT 'device',lower(conversions_read.txt(v,'device_type')) FROM all_options UNION ALL
 SELECT 'sex',conversions_read.sex(value) FROM (SELECT DISTINCT value->>'inferred_sex' value FROM jsonb_array_elements(stats_rows)) sexes UNION ALL
 SELECT 'gerencia',label FROM gerencia_labels),
 unique_values AS (SELECT DISTINCT k,v FROM values WHERE v<>''),
 grouped AS (SELECT k,jsonb_agg(v ORDER BY v COLLATE "pg_catalog"."es-x-icu") vals FROM unique_values GROUP BY k)
 SELECT coalesce(jsonb_object_agg(k,vals),'{}')||jsonb_build_object('gerenciaPriority',(SELECT coalesce(jsonb_agg(label ORDER BY source,ord,label_ord),'[]') FROM ordered_labels)) INTO metadata FROM grouped;
 WITH r AS MATERIALIZED(SELECT DISTINCT jsonb_build_object('source_platform',value->'source_platform','meta_pixel_id',value->'meta_pixel_id','pixel_id',value->'pixel_id','dataset_id',value->'dataset_id') v FROM jsonb_array_elements(stats_rows||starts)),
 sources AS(SELECT DISTINCT lower(conversions_read.txt(v,'source_platform')) src FROM r UNION SELECT '__all__'),
 options AS(SELECT src,coalesce((SELECT jsonb_agg(id ORDER BY id COLLATE "pg_catalog"."es-x-icu") FROM(SELECT DISTINCT CASE WHEN sources.src='whatsapp_cloud_api' THEN conversions_read.txt(v,'dataset_id') ELSE conversions_read.trim(coalesce(v->>'meta_pixel_id',v->>'pixel_id','')) END id FROM r WHERE sources.src='__all__' OR lower(conversions_read.txt(v,'source_platform'))=sources.src) ids WHERE id<>''),'[]') ids FROM sources)
 SELECT metadata||jsonb_build_object('tracking',jsonb_object_agg(src,ids)) INTO metadata FROM options;
 active_filters:=coalesce(f->>'source','__all__')<>'__all__' OR coalesce(f->>'pixel','__all__')<>'__all__'
 OR coalesce(f->>'phone','__all__')<>'__all__' OR coalesce(f->>'meta','__all__')<>'__all__'
 OR coalesce(f->>'sex','__all__')<>'__all__' OR coalesce(f->>'device','__all__')<>'__all__'
 OR jsonb_array_length(coalesce(f->'gerencias','[]'))>0 OR jsonb_array_length(coalesce(f->'campaigns','[]'))>0;
 IF NOT active_filters THEN filtered:=stats_rows; filtered_starts:=starts;
 ELSE
 SELECT coalesce(jsonb_agg(scoped),'[]') INTO filtered FROM (
 SELECT conversions_read.scope_stage(value,phones,coalesce(f->'gerencias','[]')) scoped FROM jsonb_array_elements(stats_rows) WHERE conversions_read.match_filters(value,f,phones,'stats')) s WHERE scoped IS NOT NULL;
 SELECT coalesce(jsonb_agg(value),'[]') INTO filtered_starts FROM jsonb_array_elements(starts) WHERE conversions_read.match_filters(value,f,phones,'starts');
 END IF;
 -- The existing funnel scopes stages only for a gerencia filter; all other filters
 -- select eligible phones after aggregation of the complete visible currency/date universe.
 IF view_kind IN ('funnel','stats','selection') THEN
 all_funnel:=conversions_read.funnel(rows);
 IF jsonb_array_length(coalesce(f->'gerencias','[]'))>0 THEN funnel:=conversions_read.funnel(filtered);
 ELSIF NOT active_filters THEN
 SELECT coalesce(jsonb_agg(value),'[]') INTO funnel FROM jsonb_array_elements(all_funnel) WHERE conversions_read.txt(value,'phone')<>'';
 ELSE
  SELECT coalesce(jsonb_agg(value),'[]') INTO funnel FROM jsonb_array_elements(all_funnel)
  WHERE (coalesce(f->>'source','__all__')<>'landing' OR coalesce(f->>'landing','__all__')='__all__' OR conversions_read.txt(value,'landing_name')=f->>'landing')
  AND conversions_read.txt(value,'phone') IN(SELECT conversions_read.txt(value,'phone') FROM jsonb_array_elements(filtered) WHERE conversions_read.txt(value,'phone')<>'');
 END IF;
 END IF;
 result:=jsonb_build_object('options',metadata,'counts',jsonb_build_object('visible',jsonb_array_length(rows),'stats',jsonb_array_length(filtered),'starts',jsonb_array_length(filtered_starts),'funnel',jsonb_array_length(funnel),'unfilteredFunnel',jsonb_array_length(all_funnel)));
 IF view_kind='funnel' THEN
  table_result:=conversions_read.funnel_page(funnel,premium,options);
  WITH page_phones AS(SELECT DISTINCT conversions_read.digits(v->>'phone') phone FROM jsonb_each(table_result->'groups') g CROSS JOIN LATERAL jsonb_array_elements(g.value) v),
  labels AS(SELECT conversions_read.digits(r.value->>'phone') phone,l.value label,r.ordinality ro,l.ordinality lo FROM jsonb_array_elements(filtered) WITH ORDINALITY r CROSS JOIN LATERAL jsonb_array_elements_text(conversions_read.labels(r.value,phones)) WITH ORDINALITY l WHERE conversions_read.digits(r.value->>'phone') IN(SELECT phone FROM page_phones)),
  unique_labels AS(SELECT DISTINCT ON(phone,label) * FROM labels ORDER BY phone,label,ro,lo),
  grouped AS(SELECT phone,jsonb_agg(label ORDER BY ro,lo) labels FROM unique_labels GROUP BY phone)
  SELECT table_result||jsonb_build_object('labelsByPhone',coalesce(jsonb_object_agg(phone,labels),'{}')) INTO table_result FROM grouped;
  RETURN result||jsonb_build_object('funnel',table_result);
 ELSIF view_kind='activity' THEN
  WITH related AS MATERIALIZED(
   SELECT c.id,c.internal_id,to_jsonb(c) v FROM public.conversions c
   WHERE (admin_mode OR c.user_id=viewer) AND (from_at IS NULL OR c.created_at>=from_at) AND (to_at IS NULL OR c.created_at<=to_at)
   AND NOT EXISTS(SELECT FROM public.hidden_conversions h WHERE h.hidden_by=viewer AND h.conversion_id=c.id)
   AND (c.id IN(SELECT value::uuid FROM jsonb_array_elements_text(coalesce(options->'conversionIds','[]'))) OR c.id IN(SELECT i.conversion_id FROM public.conversion_inbox i WHERE i.id IN(SELECT value::uuid FROM jsonb_array_elements_text(coalesce(options->'inboxIds','[]')))))
  )
  SELECT result||jsonb_build_object('activity',jsonb_build_object('internalIds',(SELECT coalesce(jsonb_object_agg(id,internal_id),'{}') FROM related),'inboxIds',(SELECT coalesce(jsonb_agg(i.id ORDER BY i.created_at DESC),'[]') FROM public.conversion_inbox i LEFT JOIN related ON related.id=i.conversion_id
  WHERE i.id IN(SELECT value::uuid FROM jsonb_array_elements_text(coalesce(options->'inboxIds','[]'))) AND i.user_id=viewer
  AND (from_at IS NULL OR i.created_at>=from_at) AND (to_at IS NULL OR i.created_at<=to_at)
  AND conversions_read.inbox_matches(to_jsonb(i),related.v,f,phones,options)))) INTO result;
  RETURN result;
 ELSIF view_kind='tracking' THEN
  RETURN result||jsonb_build_object('tracking',conversions_read.tracking(stats_rows,coalesce(currency_filter,'ARS'),options));
 ELSIF view_kind='performance' THEN
  availability:='[]';
  IF p_request->>'from' IS NOT NULL AND p_request->>'to' IS NOT NULL THEN
   SELECT coalesce(jsonb_agg(to_jsonb(a)),'[]') INTO availability FROM public.get_gerencia_availability_summaries(CASE WHEN admin_mode THEN NULL ELSE viewer END,(p_request->>'from')::timestamptz,(p_request->>'to')::timestamptz,currency_filter) a;
  END IF;
  RETURN result||jsonb_build_object('performance',conversions_read.performance(conversions_read.prepare_stats(filtered),phones,availability,premium,options,(p_request->>'now')::timestamptz));
 ELSIF view_kind='selection' THEN
  RETURN jsonb_build_object('selection',jsonb_build_object('ids',(SELECT coalesce(jsonb_agg(value->'id'),'[]') FROM jsonb_array_elements(rows)),'contacts',(SELECT coalesce(jsonb_agg(jsonb_build_object('user_id',value->'user_id','phone',value->'phone')),'[]') FROM jsonb_array_elements(all_funnel))));
 ELSIF view_kind='stats' THEN
  RETURN result||jsonb_build_object('stats',conversions_read.stats(filtered,funnel,filtered_starts,premium,options||jsonb_build_object('from',p_request->>'from','to',p_request->>'to','timezone',p_request->>'timezone','now',p_request->>'now')));
 ELSIF view_kind IN ('table','export') THEN
  SELECT coalesce(jsonb_agg(value),'[]') INTO filtered FROM jsonb_array_elements(rows) WHERE conversions_read.match_filters(value,f,phones,'table') AND conversions_read.table_search(value,options->>'search');
  total:=jsonb_array_length(filtered); total_pages:=greatest(1,ceil(total::numeric/50)::int); page_number:=least(page_number,total_pages);
  SELECT array_agg((value->>'id')::uuid ORDER BY ordinality) INTO page_ids FROM jsonb_array_elements(filtered) WITH ORDINALITY
  WHERE (view_kind='export' OR (ordinality>(page_number-1)*50 AND ordinality<=page_number*50));
  allowed_columns:=ARRAY['id','internal_id','landing_id','user_id','landing_name','phone','email','form_fn','form_ln','form_email','form_phone','cuit_cuil','inferred_sex','sex_source','fn','ln','ct','st','zip','country','fbp','fbc','from_meta_ads','geo_source','meta_pixel_id','pixel_id','dataset_id','pixel_attribution_source','pixel_attribution_conversion_id','source_platform','ctwa_clid','atrio_id','atrio_client_id','atrio_slug','atrio_players_id','contact_event_id','contact_event_time','sendContactPixel','contact_payload_raw','lead_event_id','lead_event_time','lead_payload_raw','purchase_event_id','purchase_event_time','purchase_payload_raw','purchase_coelsa_id','purchase_transaction_id','test_event_code','purchase_type','purchase_capi_route','purchase_capi_route_reason','client_ip','agent_user','device_type','event_source_url','estado','valor','currency','workspace_resolution_source','contact_status_capi','lead_status_capi','registration_status_capi','purchase_status_capi','observaciones','external_id','utm_campaign','telefono_asignado','assigned_gerencia_id','assigned_gerencia_external_id','assigned_gerencia_name','assigned_gerencia_label','lead_bot_phone','lead_player_username','lead_agency_id','lead_gerencia_id','lead_gerencia_external_id','lead_gerencia_name','lead_gerencia_label','lead_incoming_promo_code','lead_atrio_id','lead_atrio_players_id','lead_attribution_status','lead_attribution_conversion_id','registration_event_id','registration_event_time','registration_payload_raw','registration_player_username','registration_bot_phone','registration_agency_id','registration_gerencia_id','registration_gerencia_external_id','registration_gerencia_name','registration_gerencia_label','registration_incoming_promo_code','registration_atrio_id','registration_atrio_players_id','registration_attribution_status','registration_attribution_conversion_id','purchase_bot_phone','purchase_player_username','purchase_agency_id','purchase_gerencia_id','purchase_gerencia_external_id','purchase_gerencia_name','purchase_gerencia_label','purchase_incoming_promo_code','purchase_atrio_id','purchase_atrio_players_id','purchase_attribution_status','purchase_attribution_conversion_id','promo_code','geo_city','geo_region','geo_country','created_at'];
  SELECT array_agg(DISTINCT k) INTO requested_columns FROM unnest(ARRAY['id','internal_id','user_id','created_at','estado','observaciones','phone','email','purchase_event_id','lead_event_id','contact_event_id','valor','purchase_type','from_meta_ads','source_platform']||ARRAY(SELECT jsonb_array_elements_text(coalesce(options->'columns','[]')))) k WHERE k=ANY(allowed_columns);
  IF 'meta_pixel_id'=ANY(requested_columns) THEN requested_columns:=requested_columns||ARRAY['pixel_id']; END IF;
  -- PDF needs selected cells plus three scalar metrics, never raw technical payloads.
  IF view_kind='export' THEN
   result:=result||jsonb_build_object('exportCore',conversions_read.ad_counts(filtered));
   SELECT coalesce(jsonb_agg(value),'[]') INTO filtered FROM jsonb_array_elements(filtered) WHERE lower(value->>'estado') IN(SELECT jsonb_array_elements_text(coalesce(options->'events','["contact","lead","purchase"]')));
   SELECT array_agg((value->>'id')::uuid ORDER BY ordinality) INTO page_ids FROM jsonb_array_elements(filtered) WITH ORDINALITY;
   requested_columns:=requested_columns||ARRAY['currency','registration_event_id','registration_event_time','purchase_type'];
  END IF;
  SELECT coalesce(jsonb_agg((SELECT jsonb_object_agg(key,CASE WHEN view_kind='export' AND key LIKE '%payload_raw' THEN to_jsonb(CASE WHEN conversions_read.trim(coalesce(value#>>'{}',''))<>'' THEN 'present' ELSE '' END) ELSE value END) FROM jsonb_each(to_jsonb(c)) WHERE key=ANY(requested_columns)) ORDER BY ids.ord),'[]') INTO table_result FROM unnest(page_ids) WITH ORDINALITY ids(id,ord) JOIN public.conversions c USING(id);
  RETURN result||jsonb_build_object('table',jsonb_build_object('rows',table_result,'total',total,'page',page_number,'totalPages',total_pages,'eventCounts',jsonb_build_object('contact',(SELECT count(*) FROM jsonb_array_elements(filtered) WHERE lower(value->>'estado')='contact'),'lead',(SELECT count(*) FROM jsonb_array_elements(filtered) WHERE lower(value->>'estado')='lead'),'purchase',(SELECT count(*) FROM jsonb_array_elements(filtered) WHERE lower(value->>'estado')='purchase'))));
 END IF;
 RETURN result;
END $function$;
