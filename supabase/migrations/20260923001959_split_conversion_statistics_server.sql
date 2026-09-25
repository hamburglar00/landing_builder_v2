-- Migration 278: request-scoped global statistics on the existing application server.
-- No data writes, indexes, persistent summaries, schedulers or replacement of the old RPC.
-- Summary uses the existing RPC memory ceiling. Source pages use hosted default memory.
-- Invoker permissions, viewer preferences and tenant RLS apply to every read.
DO $$ BEGIN
 IF to_regtype('conversions_read."application/vnd.conversion-columns"') IS NULL THEN
  CREATE DOMAIN conversions_read."application/vnd.conversion-columns" AS bytea;
 ELSIF NOT EXISTS(SELECT FROM pg_type WHERE oid='conversions_read."application/vnd.conversion-columns"'::regtype AND typtype='d' AND typbasetype='bytea'::regtype) THEN
  RAISE EXCEPTION 'Unexpected conversion statistics transport type';
 END IF;
END $$;
REVOKE ALL ON DOMAIN conversions_read."application/vnd.conversion-columns" FROM PUBLIC,anon;
GRANT USAGE ON DOMAIN conversions_read."application/vnd.conversion-columns" TO authenticated;

CREATE OR REPLACE FUNCTION conversions_read.stats_text(t text) RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE SECURITY INVOKER RETURN coalesce(btrim(t,E' \t\n\r\f'||chr(11)||chr(160)||chr(5760)||chr(8192)||chr(8193)||chr(8194)||chr(8195)||chr(8196)||chr(8197)||chr(8198)||chr(8199)||chr(8200)||chr(8201)||chr(8202)||chr(8232)||chr(8233)||chr(8239)||chr(8287)||chr(12288)||chr(65279)),'');
CREATE OR REPLACE FUNCTION conversions_read.stats_part(kind text,t text) RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE SECURITY INVOKER RETURN coalesce(kind||':'||nullif(lower(btrim(t,E' \t\n\r\f'||chr(11)||chr(160)||chr(5760)||chr(8192)||chr(8193)||chr(8194)||chr(8195)||chr(8196)||chr(8197)||chr(8198)||chr(8199)||chr(8200)||chr(8201)||chr(8202)||chr(8232)||chr(8233)||chr(8239)||chr(8287)||chr(12288)||chr(65279))),''),'');
REVOKE ALL ON FUNCTION conversions_read.stats_text(text),conversions_read.stats_part(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION conversions_read.stats_text(text),conversions_read.stats_part(text,text) TO authenticated;

CREATE OR REPLACE FUNCTION conversions_read.stats_summary(p_request jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' SET work_mem='16MB' SET extra_float_digits=3 AS $$
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
 IF coalesce(p_request->'filters'->>'source','__all__')<>'__all__'
 OR coalesce(p_request->'filters'->>'pixel','__all__')<>'__all__'
 OR coalesce(p_request->'filters'->>'phone','__all__')<>'__all__'
 OR coalesce(p_request->'filters'->>'meta','__all__')<>'__all__'
 OR coalesce(p_request->'filters'->>'sex','__all__')<>'__all__'
 OR coalesce(p_request->'filters'->>'device','__all__')<>'__all__'
 OR jsonb_array_length(coalesce(p_request->'filters'->'gerencias','[]'))>0
 OR jsonb_array_length(coalesce(p_request->'filters'->'campaigns','[]'))>0
 THEN RAISE EXCEPTION 'Active filters use get_conversion_report' USING ERRCODE='22023'; END IF;


 WITH source AS NOT MATERIALIZED ( SELECT c.id,c.internal_id,c.user_id,c.landing_id,nullif(c.landing_name,'') AS landing_name,c.phone,nullif(c.email,'') AS email,nullif(c.fn,'') AS fn,nullif(c.ln,'') AS ln,nullif(c.ct,'') AS ct,nullif(c.st,'') AS st,nullif(c.country,'') AS country,
 nullif(c.currency,'') AS currency,nullif(c.workspace_resolution_source,'') AS workspace_resolution_source,nullif(c.external_id,'') AS external_id,nullif(c.promo_code,'') AS promo_code,nullif(c.utm_campaign,'') AS utm_campaign,nullif(c.device_type,'') AS device_type,nullif(c.inferred_sex,'') AS inferred_sex,nullif(c.geo_city,'') AS geo_city,nullif(c.geo_region,'') AS geo_region,nullif(c.geo_country,'') AS geo_country,
 nullif(c.contact_event_id,'') AS contact_event_id,c.contact_event_time,nullif(c.lead_event_id,'') AS lead_event_id,c.lead_event_time,nullif(c.registration_event_id,'') AS registration_event_id,c.registration_event_time,nullif(c.purchase_event_id,'') AS purchase_event_id,c.purchase_event_time,nullif(c.purchase_type,'') AS purchase_type,nullif(c.estado,'') AS estado,c.valor,nullif(c.observaciones,'') AS observaciones,c.test_event_code,
 c.from_meta_ads,nullif(c.source_platform,'') AS source_platform,c.meta_pixel_id,nullif(c.pixel_id,'') AS pixel_id,nullif(c.dataset_id,'') AS dataset_id,nullif(c.atrio_id,'') AS atrio_id,nullif(c.atrio_slug,'') AS atrio_slug,nullif(c.atrio_players_id,'') AS atrio_players_id,nullif(c.lead_atrio_players_id,'') AS lead_atrio_players_id,nullif(c.purchase_atrio_players_id,'') AS purchase_atrio_players_id,
 nullif(c.telefono_asignado,'') AS telefono_asignado,c.assigned_gerencia_id,c.assigned_gerencia_external_id,nullif(c.assigned_gerencia_label,'') AS assigned_gerencia_label,nullif(c.assigned_gerencia_name,'') AS assigned_gerencia_name,
 nullif(c.lead_agency_id,'') AS lead_agency_id,c.lead_gerencia_id,c.lead_gerencia_external_id,nullif(c.lead_gerencia_label,'') AS lead_gerencia_label,nullif(c.lead_bot_phone,'') AS lead_bot_phone,nullif(c.lead_player_username,'') AS lead_player_username,nullif(c.lead_incoming_promo_code,'') AS lead_incoming_promo_code,
 nullif(c.registration_agency_id,'') AS registration_agency_id,c.registration_gerencia_id,c.registration_gerencia_external_id,nullif(c.registration_gerencia_label,'') AS registration_gerencia_label,nullif(c.registration_bot_phone,'') AS registration_bot_phone,nullif(c.registration_player_username,'') AS registration_player_username,
 nullif(c.purchase_agency_id,'') AS purchase_agency_id,c.purchase_gerencia_id,c.purchase_gerencia_external_id,nullif(c.purchase_gerencia_label,'') AS purchase_gerencia_label,nullif(c.purchase_bot_phone,'') AS purchase_bot_phone,nullif(c.purchase_player_username,'') AS purchase_player_username,c.created_at
 FROM public.conversions c WHERE (coalesce(c.contact_event_id,'')<>'' OR coalesce(c.lead_event_id,'')<>'' OR coalesce(c.purchase_event_id,'')<>'') AND (admin_mode OR c.user_id=viewer)
 AND (from_at IS NULL OR c.created_at>=from_at) AND (to_at IS NULL OR c.created_at<=to_at)
 AND (currency_filter IS NULL OR c.currency=currency_filter OR (c.currency IS DISTINCT FROM 'ARS' AND c.currency IS DISTINCT FROM 'PYG' AND CASE WHEN upper(conversions_read.stats_text(coalesce(c.currency,'')))~'^[A-Z]{3}$' THEN upper(conversions_read.stats_text(c.currency)) ELSE 'ARS' END=currency_filter))
 AND c.id NOT IN(SELECT h.conversion_id FROM public.hidden_conversions h WHERE h.hidden_by=viewer AND h.conversion_id IS NOT NULL)),
clean AS NOT MATERIALIZED (SELECT * FROM source WHERE test_event_code IS NULL OR test_event_code='' OR conversions_read.stats_text(test_event_code)=''),
start_rows AS NOT MATERIALIZED (SELECT s.id,s.start_identity_key FROM public.conversion_journey_starts s WHERE (admin_mode OR s.user_id=viewer) AND (from_at IS NULL OR s.first_seen_at>=from_at) AND (to_at IS NULL OR s.first_seen_at<=to_at) AND (currency_filter IS NULL OR CASE WHEN upper(conversions_read.stats_text(coalesce(s.workspace_currency,'')))~'^[A-Z]{3}$' THEN upper(conversions_read.stats_text(s.workspace_currency)) ELSE 'ARS' END=currency_filter)),
identity_parts AS NOT MATERIALIZED (SELECT
 src.created_at,
 src.phone,
 src.user_id,
 src.contact_event_id,
 src.lead_event_id,
 src.purchase_event_id,
 src.id,
 src.external_id,
 src.purchase_type,
 src.observaciones,
 src.user_id::text usr,
 CASE WHEN phone_norm.value<>'' THEN 'phone:'||phone_norm.value ELSE '' END phone_part,
 CASE WHEN phone_norm.value<>'' THEN coalesce(nullif(coalesce('agency:'||src.assigned_gerencia_external_id::text,''),''),nullif(coalesce('agency:'||src.assigned_gerencia_id::text,''),''),nullif(conversions_read.stats_part('glabel',src.assigned_gerencia_label::text),''),conversions_read.stats_part('assigned_phone',conversions_read.digits(src.telefono_asignado))) ELSE '' END agency,
 CASE WHEN phone_norm.value<>'' AND (coalesce(src.lead_event_id,'')<>'' OR coalesce(src.purchase_event_id,'')<>'') THEN coalesce(nullif(conversions_read.stats_part('agency',src.lead_agency_id::text),''),nullif(conversions_read.stats_part('agency',src.lead_gerencia_external_id::text),''),nullif(conversions_read.stats_part('agency',src.lead_gerencia_id::text),''),nullif(conversions_read.stats_part('glabel',src.lead_gerencia_label::text),''),nullif(conversions_read.stats_part('bot_phone',conversions_read.digits(src.lead_bot_phone)),''),'') ELSE '' END lead_agency,
 CASE WHEN phone_norm.value<>'' AND coalesce(src.purchase_event_id,'')<>'' THEN coalesce(nullif(conversions_read.stats_part('agency',src.purchase_agency_id::text),''),nullif(conversions_read.stats_part('agency',src.purchase_gerencia_external_id::text),''),nullif(conversions_read.stats_part('agency',src.purchase_gerencia_id::text),''),nullif(conversions_read.stats_part('glabel',src.purchase_gerencia_label::text),''),nullif(conversions_read.stats_part('bot_phone',conversions_read.digits(src.purchase_bot_phone)),''),'') ELSE '' END purchase_agency,
 conversions_read.stats_part('promo',src.promo_code::text) promo,
 coalesce(nullif(src.id::text,''),to_jsonb(src.created_at)#>>'{}') row_id,
 src.registration_player_username,
 src.lead_player_username,
 src.purchase_player_username,
 src.email FROM clean src CROSS JOIN LATERAL(SELECT conversions_read.digits(src.phone) value OFFSET 0) phone_norm OFFSET 0),
settings AS MATERIALIZED (SELECT coalesce((options->>'now')::timestamptz,statement_timestamp()) as_of,coalesce(options->>'timezone','UTC') tz),
r AS NOT MATERIALIZED ( SELECT src.id,src.created_at,
 date_trunc('milliseconds',src.created_at) created_ms,
 (src.user_id::text)||'::'||CASE WHEN conversions_read.stats_text(src.phone::text)<>'' THEN conversions_read.stats_text(src.phone::text) ELSE '__fallback__'||coalesce(nullif(src.contact_event_id::text,''),nullif(src.lead_event_id::text,''),nullif(src.purchase_event_id::text,''),nullif(src.id::text,''),src.created_at::text) END COLLATE "pg_catalog"."C" AS phone_key,
 CASE WHEN conversions_read.stats_text(src.external_id::text)<>'' THEN (src.user_id::text)||'::'||conversions_read.stats_text(src.external_id::text) END COLLATE "pg_catalog"."C" AS ext,
 coalesce(src.contact_event_id::text,'')<>'' contact,
 coalesce(src.lead_event_id::text,'')<>'' lead,
 coalesce(src.purchase_event_id::text,'')<>'' purchase,
 CASE WHEN (COALESCE(src.purchase_event_id::text, ''::text) = ''::text) THEN NULL::text WHEN (src.purchase_type::text = ANY (ARRAY['first'::text, 'repeat'::text])) THEN src.purchase_type::text WHEN (POSITION(('REPEAT'::text) IN (COALESCE(src.observaciones::text, ''::text))) > 0) THEN 'repeat'::text ELSE 'first'::text END kind,
 CASE WHEN coalesce(src.contact_event_id::text,'')<>'' THEN (src.usr||'::'||CASE WHEN src.phone_part<>'' AND (src.agency)<>'' THEN src.phone_part||'::'||(src.agency) WHEN src.phone_part<>'' AND ('')<>'' THEN src.phone_part||'::'||('') WHEN src.phone_part<>'' THEN src.phone_part ELSE coalesce(nullif((''),''),(coalesce(nullif(conversions_read.stats_part('external',src.external_id::text),''),nullif(conversions_read.stats_part('email',src.email::text),''),nullif(conversions_read.stats_part('row',src.id::text),''),conversions_read.stats_part('created',to_jsonb(src.created_at)#>>'{}')))) END||'::'||coalesce(nullif(src.promo,''),conversions_read.stats_part('promo','contact:'||src.row_id))) END COLLATE "pg_catalog"."C" AS ck,
 CASE WHEN coalesce(src.lead_event_id::text,'')<>'' THEN (src.usr||'::'||CASE WHEN src.phone_part<>'' AND (coalesce(nullif(src.lead_agency,''),src.agency))<>'' THEN src.phone_part||'::'||(coalesce(nullif(src.lead_agency,''),src.agency)) WHEN src.phone_part<>'' AND ((coalesce(nullif(conversions_read.stats_part('player',src.registration_player_username::text),''),conversions_read.stats_part('player',src.lead_player_username::text))))<>'' THEN src.phone_part||'::'||((coalesce(nullif(conversions_read.stats_part('player',src.registration_player_username::text),''),conversions_read.stats_part('player',src.lead_player_username::text)))) WHEN src.phone_part<>'' THEN src.phone_part ELSE coalesce(nullif(((coalesce(nullif(conversions_read.stats_part('player',src.registration_player_username::text),''),conversions_read.stats_part('player',src.lead_player_username::text)))),''),(coalesce(nullif(conversions_read.stats_part('external',src.external_id::text),''),nullif(conversions_read.stats_part('email',src.email::text),''),nullif(conversions_read.stats_part('row',src.id::text),''),conversions_read.stats_part('created',to_jsonb(src.created_at)#>>'{}')))) END||'::'||coalesce(nullif(src.promo,''),conversions_read.stats_part('promo','lead:'||src.row_id))) END COLLATE "pg_catalog"."C" AS lk,
 CASE WHEN coalesce(src.purchase_event_id::text,'')<>'' THEN (src.usr||'::'||CASE WHEN src.phone_part<>'' AND (coalesce(nullif(src.purchase_agency,''),nullif(src.lead_agency,''),src.agency))<>'' THEN src.phone_part||'::'||(coalesce(nullif(src.purchase_agency,''),nullif(src.lead_agency,''),src.agency)) WHEN src.phone_part<>'' AND ((coalesce(nullif(conversions_read.stats_part('player',src.purchase_player_username::text),''),nullif(conversions_read.stats_part('player',src.registration_player_username::text),''),conversions_read.stats_part('player',src.lead_player_username::text))))<>'' THEN src.phone_part||'::'||((coalesce(nullif(conversions_read.stats_part('player',src.purchase_player_username::text),''),nullif(conversions_read.stats_part('player',src.registration_player_username::text),''),conversions_read.stats_part('player',src.lead_player_username::text)))) WHEN src.phone_part<>'' THEN src.phone_part ELSE coalesce(nullif(((coalesce(nullif(conversions_read.stats_part('player',src.purchase_player_username::text),''),nullif(conversions_read.stats_part('player',src.registration_player_username::text),''),conversions_read.stats_part('player',src.lead_player_username::text)))),''),(coalesce(nullif(conversions_read.stats_part('external',src.external_id::text),''),nullif(conversions_read.stats_part('email',src.email::text),''),nullif(conversions_read.stats_part('row',src.id::text),''),conversions_read.stats_part('created',to_jsonb(src.created_at)#>>'{}')))) END||'::'||coalesce(nullif(src.promo,''),conversions_read.stats_part('promo','purchase:'||src.row_id))) END COLLATE "pg_catalog"."C" AS pk FROM identity_parts src CROSS JOIN settings
),
s AS MATERIALIZED (SELECT coalesce(nullif(conversions_read.stats_part('start',start_identity_key),''),nullif(conversions_read.stats_part('row',id::text),'')) identity FROM start_rows),
ad_r AS NOT MATERIALIZED (SELECT ck,lk,pk,contact,lead,purchase,kind FROM r OFFSET 0),
events AS NOT MATERIALIZED (
 SELECT NULL::text AS campaign,NULL::text AS device,NULL::text AS landing,NULL::int AS hour,NULL::date AS day,NULL::text AS province,e.k,e.stage
 FROM ad_r r CROSS JOIN LATERAL(VALUES(ck,'contact'::text,contact),(lk,'lead',lead),(pk,kind,purchase)) e(k,stage,enabled) WHERE e.enabled
),
journeys AS NOT MATERIALIZED (
 SELECT 63 g,NULL::text AS campaign,NULL::text AS device,NULL::text AS landing,NULL::int AS hour,NULL::date AS day,NULL::text AS province,k,
 bool_or(stage='contact') contact,bool_or(stage='lead') lead,count(*) FILTER(WHERE stage='first') firsts,count(*) FILTER(WHERE stage='repeat') repeats
 FROM events GROUP BY GROUPING SETS((k))
),
ads AS MATERIALIZED (
 SELECT CASE g WHEN 63 THEN 'global' WHEN 31 THEN 'campaign' WHEN 47 THEN 'device' WHEN 55 THEN 'landing' WHEN 59 THEN 'hour' WHEN 61 THEN 'day' ELSE 'province' END dim,
 CASE g WHEN 63 THEN '__global__' WHEN 31 THEN campaign WHEN 47 THEN device WHEN 55 THEN landing WHEN 59 THEN hour::text WHEN 61 THEN day::text ELSE province END name,
 jsonb_build_object('adContactJourneys',count(*) FILTER(WHERE contact),'adLeadJourneysLinkedToContact',count(*) FILTER(WHERE contact AND lead),
 'adInferredLeadJourneys',count(*) FILTER(WHERE contact AND NOT lead AND firsts>0),'adLeadJourneysLinkedToContactWithInferred',count(*) FILTER(WHERE contact AND (lead OR firsts>0)),
 'adFirstPurchaseJourneysAttributed',count(*) FILTER(WHERE contact AND firsts>0),'adFirstPurchaseEvents',coalesce(sum(firsts),0),'adFirstPurchaseEventsAttributed',coalesce(sum(firsts) FILTER(WHERE contact),0),
 'adRepeatJourneys',count(*) FILTER(WHERE repeats>0),'adRepeatEvents',coalesce(sum(repeats),0),'adRepeatJourneysFromAttributedFirstInRange',count(*) FILTER(WHERE contact AND firsts>0 AND repeats>0),
 'adRepeatEventsFromAttributedFirstInRange',coalesce(sum(repeats) FILTER(WHERE contact AND firsts>0),0)) ad
 FROM journeys GROUP BY g,campaign,device,landing,hour,day,province
),
x AS MATERIALIZED (
 SELECT CASE WHEN purchase_kind.kind='first' THEN src.id END id,
 CASE WHEN purchase_kind.kind='first' THEN src.created_at END created_at,
 CASE WHEN purchase_kind.kind IS NOT NULL THEN src.user_id::text||'::'||CASE WHEN clean_keys.phone<>'' THEN clean_keys.phone ELSE '__fallback__'||coalesce(nullif(src.contact_event_id,''),nullif(src.lead_event_id,''),nullif(src.purchase_event_id,''),src.id::text,src.created_at::text) END END COLLATE "pg_catalog"."C" phone_key,
 CASE WHEN clean_keys.external<>'' THEN src.user_id::text||'::'||clean_keys.external END COLLATE "pg_catalog"."C" ext,
 coalesce(src.contact_event_id,'')<>'' contact,purchase_kind.kind
 FROM clean src
 CROSS JOIN LATERAL(SELECT conversions_read.stats_text(src.phone) phone,conversions_read.stats_text(src.external_id) external OFFSET 0) clean_keys
 CROSS JOIN LATERAL(SELECT CASE WHEN coalesce(src.purchase_event_id,'')='' THEN NULL::text WHEN src.purchase_type IN('first','repeat') THEN src.purchase_type WHEN position('REPEAT' IN coalesce(src.observaciones,''))>0 THEN 'repeat' ELSE 'first' END kind OFFSET 0) purchase_kind
 WHERE coalesce(src.contact_event_id,'')<>'' OR coalesce(src.purchase_event_id,'')<>''
),
contact_ext AS MATERIALIZED (SELECT DISTINCT ext FROM x WHERE contact AND ext IS NOT NULL),
firsts AS MATERIALIZED (
 SELECT DISTINCT ON(phone_key) phone_key,ext FROM x WHERE kind='first'
 ORDER BY phone_key,date_trunc('milliseconds',created_at),created_at DESC,id
),
first_totals AS MATERIALIZED (
 SELECT count(*) FILTER(WHERE ce.ext IS NOT NULL) attributed FROM firsts f LEFT JOIN contact_ext ce ON ce.ext=f.ext
),
first_refs AS MATERIALIZED (SELECT DISTINCT f.ext FROM firsts f JOIN contact_ext ce ON ce.ext=f.ext),
totals AS MATERIALIZED (
 SELECT count(*) FILTER(WHERE kind IS NOT NULL) purchases,
 count(DISTINCT phone_key) FILTER(WHERE kind='repeat') repeat_players,
 count(DISTINCT x.ext) FILTER(WHERE kind='repeat' AND f.ext IS NOT NULL) repeat_from_attributed
 FROM x LEFT JOIN first_refs f ON f.ext=x.ext
)
SELECT jsonb_build_object('ad',a.ad,'summary',jsonb_build_object('journeyStarts',(SELECT count(DISTINCT identity) FROM s),'uniqueContacts',coalesce(a.ad->'adContactJourneys','0'),'uniqueLeadsLinkedToContact',coalesce(a.ad->'adLeadJourneysLinkedToContact','0'),'inferredLeadsFromContactPurchase',coalesce(a.ad->'adInferredLeadJourneys','0'),'purchaseFirstCount',coalesce(a.ad->'adFirstPurchaseEvents','0'),'purchaseRepeatCount',coalesce(a.ad->'adRepeatEvents','0'),'repeatEventsFromFirstInRange',coalesce(a.ad->'adRepeatEventsFromAttributedFirstInRange','0'),'firstLoadPlayersAttributed',coalesce(f.attributed,0),'repeatPlayersReached',coalesce(t.repeat_players,0),'repeatPlayersFromFirstInRange',coalesce(t.repeat_from_attributed,0),'totalPurchases',coalesce(t.purchases,0))) INTO result FROM totals t CROSS JOIN first_totals f LEFT JOIN ads a ON a.dim='global' AND a.name='__global__';
RETURN result; END $$;
REVOKE ALL ON FUNCTION conversions_read.stats_summary(jsonb) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION conversions_read.stats_summary(jsonb) TO authenticated;


CREATE OR REPLACE FUNCTION conversions_read.stats_money(p_request jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' SET work_mem='16MB' SET extra_float_digits=3 AS $$
DECLARE viewer uuid:=(SELECT auth.uid()); admin_mode boolean:=coalesce((p_request->>'admin')::boolean,false);
 currency_filter text:=nullif(p_request->>'currency','__all__'); from_at timestamptz:=(p_request->>'from')::timestamptz; to_at timestamptz:=(p_request->>'to')::timestamptz; visible_from timestamptz;
 phone_labels jsonb:=coalesce(p_request->'phoneLabels','{}'); premium double precision:=coalesce((p_request->>'premium')::double precision,50000);
 options jsonb:=coalesce(p_request->'options','{}')||jsonb_build_object('from',p_request->>'from','to',p_request->>'to','timezone',p_request->>'timezone','now',p_request->>'now'); result json;
BEGIN
 IF viewer IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 IF admin_mode AND NOT EXISTS(SELECT FROM public.profiles WHERE id=viewer AND role='admin') THEN RAISE EXCEPTION 'Administrator required' USING ERRCODE='42501'; END IF;
 IF currency_filter IS NOT NULL AND currency_filter NOT IN('ARS','PYG') THEN RAISE EXCEPTION 'Invalid currency' USING ERRCODE='22023'; END IF;
 SELECT p.visible_from INTO visible_from FROM public.conversion_view_preferences p WHERE p.hidden_by=viewer;
 from_at:=greatest(from_at,visible_from);
 IF coalesce(p_request->'filters'->>'source','__all__')<>'__all__'
 OR coalesce(p_request->'filters'->>'pixel','__all__')<>'__all__'
 OR coalesce(p_request->'filters'->>'phone','__all__')<>'__all__'
 OR coalesce(p_request->'filters'->>'meta','__all__')<>'__all__'
 OR coalesce(p_request->'filters'->>'sex','__all__')<>'__all__'
 OR coalesce(p_request->'filters'->>'device','__all__')<>'__all__'
 OR jsonb_array_length(coalesce(p_request->'filters'->'gerencias','[]'))>0
 OR jsonb_array_length(coalesce(p_request->'filters'->'campaigns','[]'))>0
 THEN RAISE EXCEPTION 'Active filters use get_conversion_report' USING ERRCODE='22023'; END IF;



 RETURN (WITH regions AS MATERIALIZED (
 SELECT jsonb_object_agg(raw,conversions_read.province(raw)) lookup FROM (SELECT DISTINCT geo_region raw FROM public.conversions WHERE geo_region IS NOT NULL) names
 ), r AS MATERIALIZED (
 SELECT c.id,c.created_at,c.valor::double precision amount,
 c.user_id::text||'::'||CASE WHEN conversions_read.stats_text(coalesce(c.phone,''))<>'' THEN conversions_read.stats_text(c.phone) ELSE '__fallback__'||coalesce(nullif(c.contact_event_id,''),nullif(c.lead_event_id,''),nullif(c.purchase_event_id,''),c.id::text,c.created_at::text) END phone_key,
 CASE WHEN coalesce(c.purchase_event_id,'')='' THEN NULL::text WHEN c.purchase_type IN('first','repeat') THEN c.purchase_type WHEN position('REPEAT' IN coalesce(c.observaciones,''))>0 THEN 'repeat' ELSE 'first' END kind,
 regions.lookup->>c.geo_region province,
 c.lead_event_time::double precision lead_time,c.purchase_event_time::double precision purchase_time
 FROM public.conversions c CROSS JOIN regions WHERE (admin_mode OR c.user_id=viewer)
 AND (from_at IS NULL OR c.created_at>=from_at) AND (to_at IS NULL OR c.created_at<=to_at)
 AND (currency_filter IS NULL OR c.currency=currency_filter OR (c.currency IS DISTINCT FROM 'ARS' AND c.currency IS DISTINCT FROM 'PYG' AND CASE WHEN upper(conversions_read.stats_text(coalesce(c.currency,'')))~'^[A-Z]{3}$' THEN upper(conversions_read.stats_text(c.currency)) ELSE 'ARS' END=currency_filter))
 AND c.id NOT IN(SELECT h.conversion_id FROM public.hidden_conversions h WHERE h.hidden_by=viewer AND h.conversion_id IS NOT NULL)
 AND conversions_read.stats_text(coalesce(c.test_event_code,''))=''
 ORDER BY c.created_at DESC,c.id
 ), money AS (
 SELECT '__global__'::text scope,coalesce(sum(amount) FILTER(WHERE kind IS NOT NULL),0) revenue,
 coalesce(sum(amount) FILTER(WHERE kind='first'),0) event_revenue,
 coalesce(percentile_cont(0.5) WITHIN GROUP(ORDER BY amount) FILTER(WHERE kind IS NOT NULL AND amount>0),0) median,
 coalesce(avg((purchase_time-lead_time)/3600) FILTER(WHERE lead_time>0 AND purchase_time>0 AND purchase_time>=lead_time),0) hours FROM (SELECT phone_key,amount,kind,lead_time,purchase_time FROM r ORDER BY phone_key) ordered
 UNION ALL SELECT province scope,coalesce(sum(amount) FILTER(WHERE kind IS NOT NULL),0) revenue,
 coalesce(sum(amount) FILTER(WHERE kind='first'),0) event_revenue,
 coalesce(percentile_cont(0.5) WITHIN GROUP(ORDER BY amount) FILTER(WHERE kind IS NOT NULL AND amount>0),0) median,
 coalesce(avg((purchase_time-lead_time)/3600) FILTER(WHERE lead_time>0 AND purchase_time>0 AND purchase_time>=lead_time),0) hours FROM (SELECT province,phone_key,amount,kind,lead_time,purchase_time FROM r WHERE province IS NOT NULL ORDER BY province,phone_key) ordered GROUP BY province
 ), first_totals AS (
 SELECT '__global__'::text scope,sum(amount) first_revenue FROM (
 SELECT DISTINCT ON(phone_key) phone_key,amount FROM r WHERE kind='first' ORDER BY phone_key,date_trunc('milliseconds',created_at),created_at DESC,id
 ) firsts
 ), grouped AS (SELECT money.*,coalesce(first_revenue,0) first_revenue FROM money LEFT JOIN first_totals USING(scope))
 SELECT coalesce(jsonb_object_agg(scope,to_jsonb(grouped)-'scope'),'{"__global__":{"revenue":0,"event_revenue":0,"first_revenue":0,"median":0,"hours":0}}') FROM grouped);
 END $$;
 REVOKE ALL ON FUNCTION conversions_read.stats_money(jsonb) FROM PUBLIC,anon;
 GRANT EXECUTE ON FUNCTION conversions_read.stats_money(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION conversions_read.stats_dictionary(values_array text[])
RETURNS json LANGUAGE sql IMMUTABLE PARALLEL SAFE SECURITY INVOKER SET search_path='' AS $$
 WITH names AS MATERIALIZED (SELECT value,row_number() OVER()::integer-1 id FROM (SELECT DISTINCT value FROM unnest(values_array) value WHERE value IS NOT NULL) unique_values),
 dictionary AS (SELECT json_agg(value ORDER BY id) labels,jsonb_object_agg(value,id) indexes FROM names)
 SELECT json_build_object('dictionary',labels,'indices',(SELECT json_agg((indexes->>value)::integer ORDER BY ordinal) FROM unnest(values_array) WITH ORDINALITY v(value,ordinal))) FROM dictionary
$$;
REVOKE ALL ON FUNCTION conversions_read.stats_dictionary(text[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION conversions_read.stats_dictionary(text[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_conversion_stats_source(p_request jsonb,p_cursor jsonb DEFAULT NULL,p_context_only boolean DEFAULT false)
RETURNS conversions_read."application/vnd.conversion-columns" LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' SET work_mem='2184kB' SET extra_float_digits=3 AS $$
DECLARE viewer uuid:=(SELECT auth.uid()); admin_mode boolean:=coalesce((p_request->>'admin')::boolean,false);
 currency_filter text:=nullif(p_request->>'currency','__all__'); from_at timestamptz:=(p_request->>'from')::timestamptz; to_at timestamptz:=(p_request->>'to')::timestamptz; visible_from timestamptz;
 phone_labels jsonb:=coalesce(p_request->'phoneLabels','{}'); premium double precision:=coalesce((p_request->>'premium')::double precision,50000);
 options jsonb:=coalesce(p_request->'options','{}')||jsonb_build_object('from',p_request->>'from','to',p_request->>'to','timezone',p_request->>'timezone','now',p_request->>'now'); result json;
BEGIN
 IF viewer IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 IF admin_mode AND NOT EXISTS(SELECT FROM public.profiles WHERE id=viewer AND role='admin') THEN RAISE EXCEPTION 'Administrator required' USING ERRCODE='42501'; END IF;
 IF currency_filter IS NOT NULL AND currency_filter NOT IN('ARS','PYG') THEN RAISE EXCEPTION 'Invalid currency' USING ERRCODE='22023'; END IF;
 SELECT p.visible_from INTO visible_from FROM public.conversion_view_preferences p WHERE p.hidden_by=viewer;
 from_at:=greatest(from_at,visible_from);
 IF coalesce(p_request->'filters'->>'source','__all__')<>'__all__'
 OR coalesce(p_request->'filters'->>'pixel','__all__')<>'__all__'
 OR coalesce(p_request->'filters'->>'phone','__all__')<>'__all__'
 OR coalesce(p_request->'filters'->>'meta','__all__')<>'__all__'
 OR coalesce(p_request->'filters'->>'sex','__all__')<>'__all__'
 OR coalesce(p_request->'filters'->>'device','__all__')<>'__all__'
 OR jsonb_array_length(coalesce(p_request->'filters'->'gerencias','[]'))>0
 OR jsonb_array_length(coalesce(p_request->'filters'->'campaigns','[]'))>0
 THEN RAISE EXCEPTION 'Active filters use get_conversion_report' USING ERRCODE='22023'; END IF;


 IF p_cursor IS NOT NULL AND (jsonb_typeof(p_cursor)<>'object' OR p_cursor->>'created_at' IS NULL OR p_cursor->>'id' IS NULL)
 THEN RAISE EXCEPTION 'Invalid statistics cursor' USING ERRCODE='22023'; END IF;
 IF p_context_only THEN
 IF p_cursor IS NOT NULL THEN RAISE EXCEPTION 'Context does not accept a cursor' USING ERRCODE='22023'; END IF;
 RETURN convert_to(json_build_object('money',conversions_read.stats_money(p_request),'starts',(SELECT coalesce(json_agg(json_build_array(s.id,s.user_id,s.source_platform,s.start_identity_key,s.landing_id,s.landing_name,s.workspace_currency,s.external_id,s.phone,s.wa_id,s.utm_campaign,s.meta_pixel_id,s.dataset_id,s.telefono_asignado,s.assigned_gerencia_id,s.assigned_gerencia_external_id,s.assigned_gerencia_name,s.assigned_gerencia_label,s.device_type,s.first_seen_at,s.created_at) ORDER BY s.first_seen_at DESC,s.id),'[]') FROM (SELECT s.id,s.user_id,s.source_platform,s.start_identity_key,s.landing_id,s.landing_name,s.workspace_currency,s.external_id,s.phone,s.wa_id,s.utm_campaign,s.meta_pixel_id,s.dataset_id,s.telefono_asignado,s.assigned_gerencia_id,s.assigned_gerencia_external_id,s.assigned_gerencia_name,s.assigned_gerencia_label,s.device_type,s.first_seen_at,s.created_at FROM public.conversion_journey_starts s WHERE (admin_mode OR s.user_id=viewer) AND (from_at IS NULL OR s.first_seen_at>=from_at) AND (to_at IS NULL OR s.first_seen_at<=to_at) AND (currency_filter IS NULL OR CASE WHEN upper(conversions_read.stats_text(coalesce(s.workspace_currency,'')))~'^[A-Z]{3}$' THEN upper(conversions_read.stats_text(s.workspace_currency)) ELSE 'ARS' END=currency_filter)) s))::text,'UTF8');
 END IF;
 RETURN convert_to((WITH page AS NOT MATERIALIZED(SELECT extract(epoch FROM ((c.created_at AT TIME ZONE coalesce(nullif(p_request->>'timezone',''),'UTC'))-(c.created_at AT TIME ZONE 'UTC')))::integer stats_utc_offset,c.id AS "id",c.user_id AS "user_id",c.landing_id AS "landing_id",nullif(c.landing_name,'') AS "landing_name",c.phone AS "phone",nullif(c.email,'') AS "email",nullif(c.fn,'') AS "fn",nullif(c.ln,'') AS "ln",nullif(c.ct,'') AS "ct",nullif(c.st,'') AS "st",nullif(c.country,'') AS "country",nullif(c.external_id,'') AS "external_id",nullif(c.promo_code,'') AS "promo_code",nullif(c.utm_campaign,'') AS "utm_campaign",nullif(c.device_type,'') AS "device_type",nullif(c.inferred_sex,'') AS "inferred_sex",nullif(c.geo_region,'') AS "geo_region",CASE WHEN conversions_read.stats_text(c.phone)='' THEN nullif(c.contact_event_id,'') WHEN coalesce(c.contact_event_id,'')='' THEN NULL WHEN conversions_read.stats_text(c.contact_event_id)='' THEN ' ' ELSE '1' END AS "contact_event_id",CASE WHEN conversions_read.stats_text(c.phone)='' THEN nullif(c.lead_event_id,'') WHEN coalesce(c.lead_event_id,'')='' THEN NULL WHEN conversions_read.stats_text(c.lead_event_id)='' THEN ' ' ELSE '1' END AS "lead_event_id",c.lead_event_time AS "lead_event_time",CASE WHEN conversions_read.stats_text(c.phone)='' THEN nullif(c.purchase_event_id,'') WHEN coalesce(c.purchase_event_id,'')='' THEN NULL WHEN conversions_read.stats_text(c.purchase_event_id)='' THEN ' ' ELSE '1' END AS "purchase_event_id",c.purchase_event_time AS "purchase_event_time",nullif(c.purchase_type,'') AS "purchase_type",nullif(c.estado,'') AS "estado",c.valor AS "valor",nullif(c.observaciones,'') AS "observaciones",c.test_event_code AS "test_event_code",nullif(c.source_platform,'') AS "source_platform",c.meta_pixel_id AS "meta_pixel_id",nullif(c.pixel_id,'') AS "pixel_id",nullif(c.dataset_id,'') AS "dataset_id",nullif(c.telefono_asignado,'') AS "telefono_asignado",c.assigned_gerencia_id AS "assigned_gerencia_id",c.assigned_gerencia_external_id AS "assigned_gerencia_external_id",nullif(c.assigned_gerencia_label,'') AS "assigned_gerencia_label",nullif(c.assigned_gerencia_name,'') AS "assigned_gerencia_name",nullif(c.lead_agency_id,'') AS "lead_agency_id",c.lead_gerencia_id AS "lead_gerencia_id",c.lead_gerencia_external_id AS "lead_gerencia_external_id",nullif(c.lead_gerencia_label,'') AS "lead_gerencia_label",nullif(c.lead_bot_phone,'') AS "lead_bot_phone",nullif(c.lead_player_username,'') AS "lead_player_username",nullif(c.lead_incoming_promo_code,'') AS "lead_incoming_promo_code",nullif(c.registration_agency_id,'') AS "registration_agency_id",c.registration_gerencia_id AS "registration_gerencia_id",c.registration_gerencia_external_id AS "registration_gerencia_external_id",nullif(c.registration_gerencia_label,'') AS "registration_gerencia_label",nullif(c.registration_bot_phone,'') AS "registration_bot_phone",nullif(c.registration_player_username,'') AS "registration_player_username",nullif(c.purchase_agency_id,'') AS "purchase_agency_id",c.purchase_gerencia_id AS "purchase_gerencia_id",c.purchase_gerencia_external_id AS "purchase_gerencia_external_id",nullif(c.purchase_gerencia_label,'') AS "purchase_gerencia_label",nullif(c.purchase_bot_phone,'') AS "purchase_bot_phone",nullif(c.purchase_player_username,'') AS "purchase_player_username",c.created_at AS "created_at" FROM public.conversions c WHERE (admin_mode OR c.user_id=viewer)
 AND (from_at IS NULL OR c.created_at>=from_at) AND (to_at IS NULL OR c.created_at<=to_at)
 AND (currency_filter IS NULL OR c.currency=currency_filter OR (c.currency IS DISTINCT FROM 'ARS' AND c.currency IS DISTINCT FROM 'PYG' AND CASE WHEN upper(conversions_read.stats_text(coalesce(c.currency,'')))~'^[A-Z]{3}$' THEN upper(conversions_read.stats_text(c.currency)) ELSE 'ARS' END=currency_filter))
 AND c.id NOT IN(SELECT h.conversion_id FROM public.hidden_conversions h WHERE h.hidden_by=viewer AND h.conversion_id IS NOT NULL)
 AND (p_cursor IS NULL OR c.created_at<=(p_cursor->>'created_at')::timestamptz)
 AND (p_cursor IS NULL OR c.created_at<(p_cursor->>'created_at')::timestamptz OR (c.created_at=(p_cursor->>'created_at')::timestamptz AND c.id>(p_cursor->>'id')::uuid))
 ORDER BY c.created_at DESC,c.id LIMIT 21001)
 SELECT json_build_object('columns','["id","user_id","landing_id","landing_name","phone","email","fn","ln","ct","st","country","external_id","promo_code","utm_campaign","device_type","inferred_sex","geo_region","contact_event_id","lead_event_id","lead_event_time","purchase_event_id","purchase_event_time","purchase_type","estado","valor","observaciones","test_event_code","source_platform","meta_pixel_id","pixel_id","dataset_id","telefono_asignado","assigned_gerencia_id","assigned_gerencia_external_id","assigned_gerencia_label","assigned_gerencia_name","lead_agency_id","lead_gerencia_id","lead_gerencia_external_id","lead_gerencia_label","lead_bot_phone","lead_player_username","lead_incoming_promo_code","registration_agency_id","registration_gerencia_id","registration_gerencia_external_id","registration_gerencia_label","registration_bot_phone","registration_player_username","purchase_agency_id","purchase_gerencia_id","purchase_gerencia_external_id","purchase_gerencia_label","purchase_bot_phone","purchase_player_username","created_at"]'::json,'types','["uuid","uuid","uuid","text","text","text","text","text","text","text","text","text","text","text","text","text","text","text","text","int8","text","int8","text","text","numeric","text","text","text","text","text","text","text","int4","int4","text","text","text","int4","int4","text","text","text","text","text","int4","int4","text","text","text","text","int4","int4","text","text","text","timestamptz"]'::json,
 'valuesByColumn',json_build_array(CASE WHEN count("id")>0 THEN array_to_json(array_agg("id")) ELSE 'null'::json END,
 CASE WHEN count("user_id")>0 THEN conversions_read.stats_dictionary(array_agg("user_id"::text)) ELSE 'null'::json END,
 CASE WHEN count("landing_id")>0 THEN array_to_json(array_agg("landing_id")) ELSE 'null'::json END,
 CASE WHEN count("landing_name")>0 THEN conversions_read.stats_dictionary(array_agg("landing_name"::text)) ELSE 'null'::json END,
 CASE WHEN count("phone")>0 THEN array_to_json(array_agg("phone")) ELSE 'null'::json END,
 CASE WHEN count("email")>0 THEN array_to_json(array_agg("email")) ELSE 'null'::json END,
 CASE WHEN count("fn")>0 THEN array_to_json(array_agg("fn")) ELSE 'null'::json END,
 CASE WHEN count("ln")>0 THEN array_to_json(array_agg("ln")) ELSE 'null'::json END,
 CASE WHEN count("ct")>0 THEN array_to_json(array_agg("ct")) ELSE 'null'::json END,
 CASE WHEN count("st")>0 THEN array_to_json(array_agg("st")) ELSE 'null'::json END,
 CASE WHEN count("country")>0 THEN array_to_json(array_agg("country")) ELSE 'null'::json END,
 CASE WHEN count("external_id")>0 THEN array_to_json(array_agg("external_id")) ELSE 'null'::json END,
 CASE WHEN count("promo_code")>0 THEN array_to_json(array_agg("promo_code")) ELSE 'null'::json END,
 CASE WHEN count("utm_campaign")>0 THEN conversions_read.stats_dictionary(array_agg("utm_campaign"::text)) ELSE 'null'::json END,
 CASE WHEN count("device_type")>0 THEN array_to_json(array_agg("device_type")) ELSE 'null'::json END,
 CASE WHEN count("inferred_sex")>0 THEN array_to_json(array_agg("inferred_sex")) ELSE 'null'::json END,
 CASE WHEN count("geo_region")>0 THEN conversions_read.stats_dictionary(array_agg("geo_region"::text)) ELSE 'null'::json END,
 CASE WHEN count("contact_event_id")>0 THEN array_to_json(array_agg("contact_event_id")) ELSE 'null'::json END,
 CASE WHEN count("lead_event_id")>0 THEN array_to_json(array_agg("lead_event_id")) ELSE 'null'::json END,
 CASE WHEN count("lead_event_time")>0 THEN array_to_json(array_agg("lead_event_time")) ELSE 'null'::json END,
 CASE WHEN count("purchase_event_id")>0 THEN array_to_json(array_agg("purchase_event_id")) ELSE 'null'::json END,
 CASE WHEN count("purchase_event_time")>0 THEN array_to_json(array_agg("purchase_event_time")) ELSE 'null'::json END,
 CASE WHEN count("purchase_type")>0 THEN array_to_json(array_agg("purchase_type")) ELSE 'null'::json END,
 CASE WHEN count("estado")>0 THEN array_to_json(array_agg("estado")) ELSE 'null'::json END,
 CASE WHEN count("valor")>0 THEN array_to_json(array_agg("valor")) ELSE 'null'::json END,
 CASE WHEN count("observaciones")>0 THEN array_to_json(array_agg("observaciones")) ELSE 'null'::json END,
 CASE WHEN count("test_event_code")>0 THEN array_to_json(array_agg("test_event_code")) ELSE 'null'::json END,
 CASE WHEN count("source_platform")>0 THEN conversions_read.stats_dictionary(array_agg("source_platform"::text)) ELSE 'null'::json END,
 CASE WHEN count("meta_pixel_id")>0 THEN array_to_json(array_agg("meta_pixel_id")) ELSE 'null'::json END,
 CASE WHEN count("pixel_id")>0 THEN array_to_json(array_agg("pixel_id")) ELSE 'null'::json END,
 CASE WHEN count("dataset_id")>0 THEN array_to_json(array_agg("dataset_id")) ELSE 'null'::json END,
 CASE WHEN count("telefono_asignado")>0 THEN array_to_json(array_agg("telefono_asignado")) ELSE 'null'::json END,
 CASE WHEN count("assigned_gerencia_id")>0 THEN array_to_json(array_agg("assigned_gerencia_id")) ELSE 'null'::json END,
 CASE WHEN count("assigned_gerencia_external_id")>0 THEN array_to_json(array_agg("assigned_gerencia_external_id")) ELSE 'null'::json END,
 CASE WHEN count("assigned_gerencia_label")>0 THEN conversions_read.stats_dictionary(array_agg("assigned_gerencia_label"::text)) ELSE 'null'::json END,
 CASE WHEN count("assigned_gerencia_name")>0 THEN array_to_json(array_agg("assigned_gerencia_name")) ELSE 'null'::json END,
 CASE WHEN count("lead_agency_id")>0 THEN array_to_json(array_agg("lead_agency_id")) ELSE 'null'::json END,
 CASE WHEN count("lead_gerencia_id")>0 THEN array_to_json(array_agg("lead_gerencia_id")) ELSE 'null'::json END,
 CASE WHEN count("lead_gerencia_external_id")>0 THEN array_to_json(array_agg("lead_gerencia_external_id")) ELSE 'null'::json END,
 CASE WHEN count("lead_gerencia_label")>0 THEN conversions_read.stats_dictionary(array_agg("lead_gerencia_label"::text)) ELSE 'null'::json END,
 CASE WHEN count("lead_bot_phone")>0 THEN array_to_json(array_agg("lead_bot_phone")) ELSE 'null'::json END,
 CASE WHEN count("lead_player_username")>0 THEN array_to_json(array_agg("lead_player_username")) ELSE 'null'::json END,
 CASE WHEN count("lead_incoming_promo_code")>0 THEN array_to_json(array_agg("lead_incoming_promo_code")) ELSE 'null'::json END,
 CASE WHEN count("registration_agency_id")>0 THEN array_to_json(array_agg("registration_agency_id")) ELSE 'null'::json END,
 CASE WHEN count("registration_gerencia_id")>0 THEN array_to_json(array_agg("registration_gerencia_id")) ELSE 'null'::json END,
 CASE WHEN count("registration_gerencia_external_id")>0 THEN array_to_json(array_agg("registration_gerencia_external_id")) ELSE 'null'::json END,
 CASE WHEN count("registration_gerencia_label")>0 THEN array_to_json(array_agg("registration_gerencia_label")) ELSE 'null'::json END,
 CASE WHEN count("registration_bot_phone")>0 THEN array_to_json(array_agg("registration_bot_phone")) ELSE 'null'::json END,
 CASE WHEN count("registration_player_username")>0 THEN array_to_json(array_agg("registration_player_username")) ELSE 'null'::json END,
 CASE WHEN count("purchase_agency_id")>0 THEN array_to_json(array_agg("purchase_agency_id")) ELSE 'null'::json END,
 CASE WHEN count("purchase_gerencia_id")>0 THEN array_to_json(array_agg("purchase_gerencia_id")) ELSE 'null'::json END,
 CASE WHEN count("purchase_gerencia_external_id")>0 THEN array_to_json(array_agg("purchase_gerencia_external_id")) ELSE 'null'::json END,
 CASE WHEN count("purchase_gerencia_label")>0 THEN conversions_read.stats_dictionary(array_agg("purchase_gerencia_label"::text)) ELSE 'null'::json END,
 CASE WHEN count("purchase_bot_phone")>0 THEN array_to_json(array_agg("purchase_bot_phone")) ELSE 'null'::json END,
 CASE WHEN count("purchase_player_username")>0 THEN array_to_json(array_agg("purchase_player_username")) ELSE 'null'::json END,
 CASE WHEN count("created_at")>0 THEN array_to_json(array_agg("created_at")) ELSE 'null'::json END),'rowCount',count(*),'calendarOffsets',coalesce(array_to_json(array_agg(stats_utc_offset)),'[]'::json),
 'money',NULL,'starts','[]'::json) FROM page)::text,'UTF8');
 END $$;
 REVOKE ALL ON FUNCTION public.get_conversion_stats_source(jsonb,jsonb,boolean) FROM PUBLIC,anon;
 GRANT EXECUTE ON FUNCTION public.get_conversion_stats_source(jsonb,jsonb,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_conversion_stats_summary(p_request jsonb)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT conversions_read.stats_summary(p_request)
$$;
REVOKE ALL ON FUNCTION public.get_conversion_stats_summary(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_conversion_stats_summary(jsonb) TO authenticated;
-- PostgREST assumes authenticated from the verified request JWT. Each
-- SECURITY INVOKER RPC therefore applies auth.uid(), table RLS and stored admin ACLs.
NOTIFY pgrst,'reload schema';
