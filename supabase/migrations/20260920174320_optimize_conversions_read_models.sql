-- Conversiones read models. Existing ingestion, identities, writes and RLS are unchanged.
-- The public entry point and every helper execute with the caller's privileges.
CREATE SCHEMA IF NOT EXISTS conversions_read;

CREATE OR REPLACE FUNCTION conversions_read.trim(t text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE RETURN btrim(coalesce(t,''),E' \t\n\r\f'||chr(11)||chr(160)||chr(5760)||chr(8192)||chr(8193)||chr(8194)||chr(8195)||chr(8196)||chr(8197)||chr(8198)||chr(8199)||chr(8200)||chr(8201)||chr(8202)||chr(8232)||chr(8233)||chr(8239)||chr(8287)||chr(12288)||chr(65279));
CREATE OR REPLACE FUNCTION conversions_read.txt(r jsonb,k text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE RETURN conversions_read.trim(r->>k);
CREATE OR REPLACE FUNCTION conversions_read.digits(t text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE RETURN regexp_replace(coalesce(t,''),'[^0-9]','','g');
CREATE OR REPLACE FUNCTION conversions_read.part(kind text,t text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE RETURN coalesce(kind||':'||nullif(lower(conversions_read.trim(t)),''),'');
CREATE OR REPLACE FUNCTION conversions_read.purchase_kind(r jsonb)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE RETURN CASE WHEN coalesce(r->>'purchase_event_id','')='' THEN NULL
 WHEN r->>'purchase_type' IN ('first','repeat') THEN r->>'purchase_type'
 WHEN position('REPEAT' in coalesce(r->>'observaciones',''))>0 THEN 'repeat' ELSE 'first' END;
CREATE OR REPLACE FUNCTION conversions_read.journey_key(r jsonb, stage text)
RETURNS text LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE SET search_path = '' AS $$
DECLARE agency text; lead_agency text; purchase_agency text; player text; phone text; identity_key text; promo text;
BEGIN
 agency:=coalesce(nullif(conversions_read.part('agency',r->>'assigned_gerencia_external_id'),''),nullif(conversions_read.part('agency',r->>'assigned_gerencia_id'),''),nullif(conversions_read.part('glabel',r->>'assigned_gerencia_label'),''),conversions_read.part('assigned_phone',conversions_read.digits(r->>'telefono_asignado')));
 lead_agency:=coalesce(nullif(conversions_read.part('agency',r->>'lead_agency_id'),''),nullif(conversions_read.part('agency',r->>'lead_gerencia_external_id'),''),nullif(conversions_read.part('agency',r->>'lead_gerencia_id'),''),nullif(conversions_read.part('glabel',r->>'lead_gerencia_label'),''),nullif(conversions_read.part('bot_phone',conversions_read.digits(r->>'lead_bot_phone')),''),agency);
 purchase_agency:=coalesce(nullif(conversions_read.part('agency',r->>'purchase_agency_id'),''),nullif(conversions_read.part('agency',r->>'purchase_gerencia_external_id'),''),nullif(conversions_read.part('agency',r->>'purchase_gerencia_id'),''),nullif(conversions_read.part('glabel',r->>'purchase_gerencia_label'),''),nullif(conversions_read.part('bot_phone',conversions_read.digits(r->>'purchase_bot_phone')),''),lead_agency);
 agency:=CASE stage WHEN 'purchase' THEN purchase_agency WHEN 'lead' THEN lead_agency ELSE agency END;
 player:=CASE stage WHEN 'purchase' THEN coalesce(nullif(conversions_read.part('player',r->>'purchase_player_username'),''),nullif(conversions_read.part('player',r->>'registration_player_username'),''),conversions_read.part('player',r->>'lead_player_username')) WHEN 'lead' THEN coalesce(nullif(conversions_read.part('player',r->>'registration_player_username'),''),conversions_read.part('player',r->>'lead_player_username')) ELSE '' END;
 phone:=conversions_read.part('phone',conversions_read.digits(r->>'phone'));
 identity_key:=CASE WHEN phone<>'' AND agency<>'' THEN phone||'::'||agency WHEN phone<>'' AND player<>'' THEN phone||'::'||player WHEN phone<>'' THEN phone ELSE coalesce(nullif(player,''),nullif(conversions_read.part('external',r->>'external_id'),''),nullif(conversions_read.part('email',r->>'email'),''),nullif(conversions_read.part('row',r->>'id'),''),conversions_read.part('created',r->>'created_at')) END;
 promo:=coalesce(nullif(conversions_read.part('promo',r->>'promo_code'),''),conversions_read.part('promo',stage||':'||coalesce(nullif(r->>'id',''),r->>'created_at')));
 RETURN conversions_read.txt(r,'user_id')||'::'||identity_key||'::'||promo;
END $$;

CREATE OR REPLACE FUNCTION conversions_read.ad_counts(rows jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = '' AS $$
 WITH r AS MATERIALIZED (SELECT value v FROM jsonb_array_elements(rows)),
 events AS (
 SELECT coalesce(v->>'__contact_key',conversions_read.journey_key(v,'contact')) k,'contact' stage FROM r WHERE coalesce(v->>'contact_event_id','')<>''
 UNION ALL SELECT coalesce(v->>'__lead_key',conversions_read.journey_key(v,'lead')),'lead' FROM r WHERE coalesce(v->>'lead_event_id','')<>''
 UNION ALL SELECT coalesce(v->>'__purchase_key',conversions_read.journey_key(v,'purchase')),conversions_read.purchase_kind(v) FROM r WHERE coalesce(v->>'purchase_event_id','')<>''
 ), journeys AS (
 SELECT k,bool_or(stage='contact') contact,bool_or(stage='lead') lead,count(*) FILTER(WHERE stage='first') firsts,count(*) FILTER(WHERE stage='repeat') repeats FROM events GROUP BY k
 ) SELECT jsonb_build_object(
 'adContactJourneys',count(*) FILTER(WHERE contact),
 'adLeadJourneysLinkedToContact',count(*) FILTER(WHERE contact AND lead),
 'adInferredLeadJourneys',count(*) FILTER(WHERE contact AND NOT lead AND firsts>0),
 'adLeadJourneysLinkedToContactWithInferred',count(*) FILTER(WHERE contact AND (lead OR firsts>0)),
 'adFirstPurchaseJourneysAttributed',count(*) FILTER(WHERE contact AND firsts>0),
 'adFirstPurchaseEvents',coalesce(sum(firsts),0),
 'adFirstPurchaseEventsAttributed',coalesce(sum(firsts) FILTER(WHERE contact),0),
 'adRepeatJourneys',count(*) FILTER(WHERE repeats>0),'adRepeatEvents',coalesce(sum(repeats),0),
 'adRepeatJourneysFromAttributedFirstInRange',count(*) FILTER(WHERE contact AND firsts>0 AND repeats>0),
 'adRepeatEventsFromAttributedFirstInRange',coalesce(sum(repeats) FILTER(WHERE contact AND firsts>0),0)
 ) FROM journeys
$$;

CREATE OR REPLACE FUNCTION conversions_read.truth(core jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE PARALLEL SAFE RETURN jsonb_build_object('core',core,
 'uniqueContacts',core->'adContactJourneys','uniqueLeads',core->'uniqueLeads','realLeadsLinkedToContact',core->'adLeadJourneysLinkedToContact',
 'inferredLeadsFromContactPurchase',core->'adInferredLeadJourneys','uniqueLeadsLinkedToContact',core->'adLeadJourneysLinkedToContact',
 'firstLoadPurchasers',core->'firstLoadPurchasers','firstLoadPurchasersLinkedToLead',core->'adFirstPurchaseJourneysAttributed','firstLoadPlayersAttributed',core->'firstLoadPurchasersAttributed',
 'totalPurchases',core->'totalPurchases','primera',core->'firstLoadPlayers','recurrente',core->'repeatPlayers','premium',core->'premiumPlayers',
 'purchasers',core->'firstLoadPurchasers','reachedRepeat',core->'adRepeatJourneys','repeatPlayersReached',core->'purchaseRepeat',
 'purchaseFirstCount',core->'adFirstPurchaseEvents','purchaseRepeatCount',core->'adRepeatEvents',
 'repeatFromFirstInRange',core->'adRepeatJourneysFromAttributedFirstInRange','repeatEventsFromFirstInRange',core->'adRepeatEventsFromAttributedFirstInRange','repeatPlayersFromFirstInRange',core->'repeatFromAttributedFirstInRange',
 'totalRevenue',core->'totalRevenue','firstPurchaseRevenue',core->'firstPurchaseEventRevenue','totalPurchaseCount',core->'totalPurchaseCount',
 'avgTicket',coalesce((core->>'totalRevenue')::double precision/nullif((core->>'totalPurchaseCount')::double precision,0),0),
 'avgLoadsPerPlayer',coalesce((core->>'totalPurchaseCount')::double precision/nullif((core->>'firstLoadPurchasers')::double precision,0),0));

CREATE OR REPLACE FUNCTION conversions_read.player_key(r jsonb)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE RETURN coalesce(r->>'user_id','')||'::'||CASE WHEN conversions_read.digits(r->>'phone')<>''
 THEN 'phone:'||conversions_read.digits(r->>'phone')||'::context:'||lower(coalesce(nullif(conversions_read.txt(r,'purchase_agency_id'),''),nullif(conversions_read.txt(r,'purchase_gerencia_external_id'),''),nullif(conversions_read.txt(r,'purchase_gerencia_id'),''),nullif(conversions_read.txt(r,'purchase_bot_phone'),''),nullif(conversions_read.txt(r,'purchase_gerencia_label'),''),nullif(conversions_read.txt(r,'registration_agency_id'),''),nullif(conversions_read.txt(r,'registration_gerencia_external_id'),''),nullif(conversions_read.txt(r,'registration_gerencia_id'),''),nullif(conversions_read.txt(r,'registration_bot_phone'),''),nullif(conversions_read.txt(r,'registration_gerencia_label'),''),nullif(conversions_read.txt(r,'lead_agency_id'),''),nullif(conversions_read.txt(r,'lead_gerencia_external_id'),''),nullif(conversions_read.txt(r,'lead_gerencia_id'),''),nullif(conversions_read.txt(r,'lead_bot_phone'),''),nullif(conversions_read.txt(r,'lead_gerencia_label'),''),nullif(conversions_read.txt(r,'assigned_gerencia_external_id'),''),nullif(conversions_read.txt(r,'assigned_gerencia_id'),''),nullif(conversions_read.txt(r,'telefono_asignado'),''),nullif(conversions_read.txt(r,'assigned_gerencia_label'),''),'__sin_gerencia__'))
 ELSE 'fallback:'||lower(coalesce(nullif(conversions_read.trim(coalesce(nullif(r->>'purchase_player_username',''),nullif(r->>'registration_player_username',''),r->>'lead_player_username','')),''),nullif(r->>'external_id',''),nullif(r->>'id',''),r->>'created_at')) END;
CREATE OR REPLACE FUNCTION conversions_read.funnel(rows jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = '' AS $$
 WITH r AS (
 SELECT value v,ordinality ord,conversions_read.player_key(value) k,
 date_trunc('milliseconds',(value->>'created_at')::timestamptz) t
 FROM jsonb_array_elements(rows) WITH ORDINALITY WHERE conversions_read.txt(value,'test_event_code')=''
 ), grouped AS (
 SELECT k,min(ord) ord,min(t) first_at,max(t) last_at,
 (array_agg(v->>'created_at' ORDER BY t,ord))[1] first_contact,
 (array_agg(v ORDER BY t DESC,ord DESC))[1] latest,
 (array_agg(v->>'telefono_asignado' ORDER BY t DESC,ord DESC) FILTER(WHERE conversions_read.txt(v,'telefono_asignado')<>''))[1] assigned_phone,
 (array_agg(v->>'assigned_gerencia_label' ORDER BY t DESC,ord DESC) FILTER(WHERE conversions_read.txt(v,'assigned_gerencia_label')<>''))[1] assigned_label,
 (array_agg(conversions_read.trim(coalesce(nullif(v->>'purchase_player_username',''),nullif(v->>'registration_player_username',''),v->>'lead_player_username','')) ORDER BY t DESC,ord DESC)
 FILTER(WHERE conversions_read.trim(coalesce(nullif(v->>'purchase_player_username',''),nullif(v->>'registration_player_username',''),v->>'lead_player_username',''))<>''))[1] username,
 coalesce(sum((v->>'valor')::double precision) FILTER(WHERE coalesce(v->>'purchase_event_id','')<>''),0) total,
 count(*) FILTER(WHERE coalesce(v->>'purchase_event_id','')<>'') purchases,
 count(*) FILTER(WHERE conversions_read.purchase_kind(v)='repeat') repeats,
 count(*) FILTER(WHERE coalesce(v->>'lead_event_id','')<>'') leads,
 count(*) FILTER(WHERE coalesce(v->>'contact_event_id','')<>'') contacts
 FROM r GROUP BY k
 ), result AS (
 SELECT ord,last_at,jsonb_build_object(
 'user_id',latest->>'user_id','phone',latest->>'phone','email',nullif(latest->>'email',''),'fn',nullif(latest->>'fn',''),'ln',nullif(latest->>'ln',''),
 'ct',nullif(latest->>'ct',''),'st',nullif(latest->>'st',''),'country',nullif(latest->>'country',''),'region',coalesce(nullif(latest->>'geo_region',''),nullif(latest->>'st','')),
 'utm_campaign',nullif(latest->>'utm_campaign',''),'device_type',nullif(latest->>'device_type',''),'landing_name',nullif(latest->>'landing_name',''),
 'telefono_asignado',coalesce(nullif(CASE WHEN latest->>'estado'='purchase' THEN conversions_read.txt(latest,'purchase_bot_phone') ELSE coalesce(nullif(conversions_read.txt(latest,'registration_bot_phone'),''),conversions_read.txt(latest,'lead_bot_phone')) END,''),assigned_phone),
 'assigned_gerencia_label',coalesce(nullif(CASE WHEN latest->>'estado'='purchase' THEN conversions_read.txt(latest,'purchase_gerencia_label') ELSE coalesce(nullif(conversions_read.txt(latest,'registration_gerencia_label'),''),conversions_read.txt(latest,'lead_gerencia_label')) END,''),assigned_label),
 'player_username',username,'total_valor',total,'purchase_count',purchases,'repeat_count',repeats,'lead_count',leads,'contact_count',contacts,
 'reached_contact',contacts>0,'reached_lead',leads>0,'reached_purchase',purchases>0,'reached_repeat',repeats>0,
 'last_activity',latest->>'created_at','first_contact',first_contact,
 'current_status',latest->>'estado','current_purchase_type',conversions_read.purchase_kind(latest)) v
 FROM grouped WHERE latest->>'estado' IN ('lead','purchase')
 ) SELECT coalesce(jsonb_agg(v ORDER BY last_at DESC,ord),'[]') FROM result
$$;

CREATE OR REPLACE FUNCTION conversions_read.stage(r jsonb,premium double precision)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE RETURN CASE WHEN (r->>'purchase_count')::int>0 THEN
 CASE WHEN (r->>'total_valor')::double precision>=premium THEN 'premium' WHEN (r->>'repeat_count')::int>0 OR (r->>'purchase_count')::int>1 THEN 'recurrente' ELSE 'primera_carga' END
 WHEN r->>'current_status'='purchase' THEN CASE WHEN (r->>'total_valor')::double precision>=premium THEN 'premium' WHEN r->>'current_purchase_type'='repeat' THEN 'recurrente' WHEN r->>'current_purchase_type'='first' THEN 'primera_carga' ELSE 'leads' END ELSE 'leads' END;

CREATE OR REPLACE FUNCTION conversions_read.core(rows jsonb,contacts jsonb,all_rows jsonb,premium double precision,as_of timestamptz)
RETURNS jsonb LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = '' AS $$
 -- JSON SRFs have a fixed cardinality estimate. Scalar identity dictionaries avoid
 -- nested-loop semi joins against first-purchase CTEs estimated as a single row.
 -- Each dictionary is an uncorrelated InitPlan; membership preserves exact text keys.
 WITH r AS MATERIALIZED (
 SELECT value v,ordinality ord,conversions_read.purchase_kind(value) kind,
 (value->>'user_id')||'::'||CASE WHEN conversions_read.txt(value,'phone')<>'' THEN conversions_read.txt(value,'phone') ELSE '__fallback__'||coalesce(nullif(value->>'contact_event_id',''),nullif(value->>'lead_event_id',''),nullif(value->>'purchase_event_id',''),nullif(value->>'id',''),value->>'created_at') END phone_key,
 CASE WHEN conversions_read.txt(value,'external_id')<>'' THEN (value->>'user_id')||'::'||conversions_read.txt(value,'external_id') END ext
 FROM jsonb_array_elements(rows) WITH ORDINALITY
 ), contacts_ext AS MATERIALIZED (SELECT DISTINCT ext FROM r WHERE coalesce(v->>'contact_event_id','')<>'' AND ext IS NOT NULL),
 leads_ext AS MATERIALIZED (SELECT DISTINCT ext FROM r WHERE coalesce(v->>'lead_event_id','')<>'' AND (coalesce((SELECT jsonb_object_agg(ext,true) FROM contacts_ext),'{}') ? ext)),
 firsts AS MATERIALIZED (SELECT DISTINCT ON(phone_key) * FROM r WHERE kind='first' ORDER BY phone_key,date_trunc('milliseconds',(v->>'created_at')::timestamptz),ord),
 attributed AS MATERIALIZED (SELECT * FROM firsts WHERE (coalesce((SELECT jsonb_object_agg(ext,true) FROM contacts_ext),'{}') ? ext)),
 linked AS MATERIALIZED (SELECT * FROM firsts WHERE (coalesce((SELECT jsonb_object_agg(ext,true) FROM leads_ext),'{}') ? ext)),
 retention AS (SELECT value->>'phone' phone,min(date_trunc('milliseconds',(value->>'created_at')::timestamptz)) first_purchase,
 count(*) FILTER(WHERE date_trunc('milliseconds',(value->>'created_at')::timestamptz)>=as_of-interval '720 hours') recent
 FROM jsonb_array_elements(all_rows) WHERE coalesce(value->>'purchase_event_id','')<>'' AND coalesce(value->>'phone','')<>'' GROUP BY value->>'phone'),
 totals AS (SELECT
 count(DISTINCT phone_key) FILTER(WHERE coalesce(v->>'contact_event_id','')<>'') unique_contacts,
 count(DISTINCT phone_key) FILTER(WHERE coalesce(v->>'lead_event_id','')<>'') unique_leads,
 count(*) FILTER(WHERE kind IS NOT NULL) purchases,
 count(DISTINCT phone_key) FILTER(WHERE kind='repeat') repeat_players,
 coalesce(sum((v->>'valor')::double precision) FILTER(WHERE kind IS NOT NULL),0) revenue,
 coalesce(sum((v->>'valor')::double precision) FILTER(WHERE kind='first'),0) first_revenue,
 coalesce(percentile_cont(0.5) WITHIN GROUP(ORDER BY (v->>'valor')::double precision) FILTER(WHERE kind IS NOT NULL AND (v->>'valor')::double precision>0),0) median_value,
 coalesce(avg(((v->>'purchase_event_time')::double precision-(v->>'lead_event_time')::double precision)/3600) FILTER(WHERE (v->>'lead_event_time')::double precision>0 AND (v->>'purchase_event_time')::double precision>0 AND (v->>'purchase_event_time')::double precision>=(v->>'lead_event_time')::double precision),0) lead_hours
 FROM r)
 SELECT conversions_read.ad_counts(rows)||jsonb_build_object(
 'uniqueContacts',unique_contacts,'uniqueLeads',unique_leads,
 'uniqueLeadsLinkedToContact',(SELECT count(*) FROM leads_ext),
 'inferredLeadsFromContactPurchase',(SELECT count(*) FROM attributed WHERE NOT (coalesce((SELECT jsonb_object_agg(ext,true) FROM leads_ext),'{}') ? ext)),
 'uniqueLeadsLinkedToContactWithInferred',(SELECT count(*) FROM leads_ext)+(SELECT count(*) FROM attributed WHERE NOT (coalesce((SELECT jsonb_object_agg(ext,true) FROM leads_ext),'{}') ? ext)),
 'firstLoadPurchasers',(SELECT count(*) FROM firsts),'firstLoadPurchasersLinkedToLead',(SELECT count(*) FROM linked),'firstLoadPurchasersAttributed',(SELECT count(*) FROM attributed),
 'totalPurchases',purchases,'purchaseRepeat',repeat_players,
 'repeatFromFirstInRange',(SELECT count(DISTINCT ext) FROM r WHERE kind='repeat' AND (coalesce((SELECT jsonb_object_agg(ext,true) FROM linked),'{}') ? ext)),
 'repeatFromAttributedFirstInRange',(SELECT count(DISTINCT ext) FROM r WHERE kind='repeat' AND (coalesce((SELECT jsonb_object_agg(ext,true) FROM attributed),'{}') ? ext)),
 'repeatEventsFromAttributedFirstInRange',(SELECT count(*) FROM r WHERE kind='repeat' AND (coalesce((SELECT jsonb_object_agg(ext,true) FROM attributed),'{}') ? ext)),
 'firstLoadPlayers',(SELECT count(*) FROM jsonb_array_elements(contacts) WHERE conversions_read.stage(value,premium)='primera_carga'),
 'repeatPlayers',(SELECT count(*) FROM jsonb_array_elements(contacts) WHERE conversions_read.stage(value,premium)='recurrente'),
 'premiumPlayers',(SELECT count(*) FROM jsonb_array_elements(contacts) WHERE conversions_read.stage(value,premium)='premium'),
 'totalRevenue',revenue,'totalPurchaseCount',purchases,'firstPurchaseRevenue',(SELECT coalesce(sum((v->>'valor')::double precision),0) FROM firsts),'firstPurchaseEventRevenue',first_revenue,
 'activeRetention30d',(SELECT count(*) FROM retention WHERE recent>=4 AND first_purchase<=as_of-interval '168 hours'),
 'purchaseMedian',median_value,'leadPurchaseAverageHours',lead_hours)
 FROM totals
$$;

CREATE OR REPLACE FUNCTION conversions_read.labels(r jsonb,phones jsonb,stage text DEFAULT 'all')
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE SET search_path = '' AS $$
DECLARE assigned jsonb; lead_labels jsonb; registration jsonb; purchase jsonb; result jsonb:='[]';
BEGIN
 assigned:=CASE WHEN conversions_read.txt(r,'assigned_gerencia_label')<>'' THEN jsonb_build_array(conversions_read.txt(r,'assigned_gerencia_label')) ELSE coalesce(phones->conversions_read.digits(r->>'telefono_asignado'),'[]') END;
 lead_labels:=CASE WHEN conversions_read.txt(r,'lead_gerencia_label')<>'' THEN jsonb_build_array(conversions_read.txt(r,'lead_gerencia_label')) ELSE assigned END;
 registration:=CASE WHEN conversions_read.txt(r,'registration_gerencia_label')<>'' THEN jsonb_build_array(conversions_read.txt(r,'registration_gerencia_label')) ELSE lead_labels END;
 purchase:=CASE WHEN conversions_read.txt(r,'purchase_gerencia_label')<>'' THEN jsonb_build_array(conversions_read.txt(r,'purchase_gerencia_label')) ELSE CASE WHEN stage='table' THEN registration ELSE lead_labels END END;
 IF stage='contact' THEN RETURN assigned; ELSIF stage='lead' THEN RETURN lead_labels; ELSIF stage='purchase' THEN RETURN purchase; END IF;
 IF stage='table' THEN RETURN CASE WHEN conversions_read.txt(r,'purchase_event_id')<>'' THEN purchase WHEN conversions_read.txt(r,'registration_event_id')<>'' THEN registration WHEN conversions_read.txt(r,'lead_event_id')<>'' THEN lead_labels ELSE assigned END; END IF;
 IF conversions_read.txt(r,'contact_event_id')<>'' THEN result:=result||assigned; END IF;
 IF conversions_read.txt(r,'lead_event_id')<>'' THEN result:=result||lead_labels; END IF;
 IF conversions_read.txt(r,'purchase_event_id')<>'' THEN result:=result||purchase; END IF;
 SELECT coalesce(jsonb_agg(value ORDER BY ord),'[]') INTO result FROM(SELECT value,min(ordinality) ord FROM jsonb_array_elements(CASE WHEN jsonb_array_length(result)>0 THEN result ELSE assigned END) WITH ORDINALITY GROUP BY value) distinct_labels;
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION conversions_read.matches_labels(filters jsonb,labels jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = '' AS $$
 SELECT jsonb_array_length(coalesce(filters,'[]'))=0 OR EXISTS(
 SELECT FROM jsonb_array_elements_text(filters) f CROSS JOIN jsonb_array_elements_text(labels) l
 WHERE f=l OR coalesce(CASE WHEN f~'^\d+$' THEN f ELSE substring(f from '(?i)\(ID\s*(\d+)\)') END,'!')=substring(l from '(?i)\(ID\s*(\d+)\)')
 )
$$;
CREATE OR REPLACE FUNCTION conversions_read.scope_stage(r jsonb,phones jsonb,filters jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE SET search_path = '' AS $$
DECLARE c boolean; l boolean; p boolean;
BEGIN
 IF jsonb_array_length(coalesce(filters,'[]'))=0 THEN RETURN r; END IF;
 c:=conversions_read.txt(r,'contact_event_id')<>'' AND conversions_read.matches_labels(filters,conversions_read.labels(r,phones,'contact'));
 l:=conversions_read.txt(r,'lead_event_id')<>'' AND conversions_read.matches_labels(filters,conversions_read.labels(r,phones,'lead'));
 p:=conversions_read.txt(r,'purchase_event_id')<>'' AND conversions_read.matches_labels(filters,conversions_read.labels(r,phones,'purchase'));
 IF NOT(c OR l OR p) THEN RETURN NULL; END IF;
 RETURN r||jsonb_build_object('contact_event_id',CASE WHEN c THEN r->>'contact_event_id' ELSE '' END,'contact_event_time',CASE WHEN c THEN r->'contact_event_time' END,
 'lead_event_id',CASE WHEN l THEN r->>'lead_event_id' ELSE '' END,'lead_event_time',CASE WHEN l THEN r->'lead_event_time' END,
 'purchase_event_id',CASE WHEN p THEN r->>'purchase_event_id' ELSE '' END,'purchase_event_time',CASE WHEN p THEN r->'purchase_event_time' END,
 'purchase_type',CASE WHEN p THEN r->>'purchase_type' END,'valor',CASE WHEN p THEN r->'valor' ELSE '0'::jsonb END,'estado',CASE WHEN p THEN 'purchase' WHEN l THEN 'lead' ELSE 'contact' END);
END $$;

CREATE OR REPLACE FUNCTION conversions_read.sex(t text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE RETURN CASE lower(conversions_read.trim(coalesce(t,''))) WHEN '' THEN '' WHEN 'm' THEN 'male' WHEN 'male' THEN 'male' WHEN 'masculino' THEN 'male' WHEN 'hombre' THEN 'male' WHEN 'f' THEN 'female' WHEN 'female' THEN 'female' WHEN 'femenino' THEN 'female' WHEN 'mujer' THEN 'female' ELSE 'unknown' END;
CREATE OR REPLACE FUNCTION conversions_read.table_search(r jsonb,query text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE SET search_path = '' AS $$
DECLARE q text:=lower(conversions_read.trim(coalesce(query,''))); matched text[]; target double precision; val double precision; hay text;
BEGIN
 IF q='' THEN RETURN true; END IF;
 matched:=regexp_match(q,'^valor\s*(>=|<=|>|<|==|=)\s*([-+]?[\d.,\s]+)$');
 IF matched IS NOT NULL THEN
  BEGIN target:=coalesce(nullif(regexp_replace(matched[2],'[^0-9-]','','g'),''),'0')::double precision;
  EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN target:=NULL; END;
  IF target IS NOT NULL THEN
   val:=coalesce((r->>'valor')::double precision,0);
   RETURN CASE matched[1] WHEN '>' THEN val>target WHEN '>=' THEN val>=target WHEN '<' THEN val<target WHEN '<=' THEN val<=target ELSE val=target END;
  END IF;
 END IF;
 IF length(conversions_read.digits(q))>=8 AND q~'^[0-9\s()+.\-]+$' THEN RETURN conversions_read.digits(r->>'phone')=conversions_read.digits(q); END IF;
 SELECT string_agg(r->>k,' ' ORDER BY ord) INTO hay FROM unnest(ARRAY[
 'phone','email','promo_code','external_id','utm_campaign','telefono_asignado','assigned_gerencia_label','landing_name','estado','purchase_type','currency','workspace_resolution_source','meta_pixel_id','pixel_id','dataset_id','source_platform','atrio_id','atrio_slug','atrio_players_id','lead_atrio_players_id','purchase_atrio_players_id','device_type','fn','ln','ct','st','country','geo_city','geo_region','geo_country','contact_event_id','lead_event_id','purchase_event_id'
 ]) WITH ORDINALITY fields(k,ord) WHERE coalesce(r->>k,'')<>'';
 RETURN position(q in lower(coalesce(hay,'')))>0;
END $$;

CREATE OR REPLACE FUNCTION conversions_read.funnel_page(contacts jsonb,premium double precision,options jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = '' AS $$
 WITH r AS MATERIALIZED (SELECT value v,ordinality ord,conversions_read.stage(value,premium) stage FROM jsonb_array_elements(contacts) WITH ORDINALITY),
 totals AS (SELECT stage,count(*) n FROM r GROUP BY stage),
 paging AS (SELECT greatest(1,coalesce(max(ceil(n::numeric/CASE WHEN stage='leads' THEN 33 ELSE 20 END)),1)) total_pages FROM totals),
 params AS (SELECT greatest(1,least(coalesce((options->>'page')::int,1),total_pages)) page,total_pages FROM paging),
 ordered AS (SELECT *,row_number() OVER(PARTITION BY stage ORDER BY
 CASE WHEN coalesce(options->>'sort','date')='amount' AND coalesce(options->>'direction','desc')='desc' THEN (v->>'total_valor')::double precision END DESC,
 CASE WHEN options->>'sort'='amount' AND options->>'direction'='asc' THEN (v->>'total_valor')::double precision END ASC,
 CASE WHEN coalesce(options->>'sort','date')='date' AND coalesce(options->>'direction','desc')='desc' THEN date_trunc('milliseconds',(v->>'last_activity')::timestamptz) END DESC,
 CASE WHEN coalesce(options->>'sort','date')='date' AND options->>'direction'='asc' THEN (v->>'last_activity')::timestamptz END ASC,ord) rn FROM r),
 page_rows AS MATERIALIZED (SELECT ordered.* FROM ordered CROSS JOIN params WHERE rn>(page-1)*CASE WHEN stage='leads' THEN 33 ELSE 20 END AND rn<=page*CASE WHEN stage='leads' THEN 33 ELSE 20 END),
 stages AS (SELECT unnest(ARRAY['leads','primera_carga','recurrente','premium']) stage)
 SELECT jsonb_build_object('page',page,'totalPages',total_pages,'total',jsonb_array_length(contacts),
 'groups',(SELECT jsonb_object_agg(stage,coalesce((SELECT jsonb_agg(v ORDER BY rn) FROM page_rows r WHERE r.stage=s.stage),'[]')) FROM stages s),
 'counts',(SELECT jsonb_object_agg(stage,coalesce((SELECT n FROM totals t WHERE t.stage=s.stage),0)) FROM stages s),
 -- Historical headers show revenue of the CURRENT page, not all contacts.
 'revenue',(SELECT jsonb_object_agg(stage,coalesce((SELECT sum((v->>'total_valor')::double precision) FROM page_rows r WHERE r.stage=s.stage),0)) FROM stages s)) FROM params
$$;

CREATE OR REPLACE FUNCTION conversions_read.lead_repeats(rows jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = '' AS $$
 WITH r AS MATERIALIZED (SELECT value v,ordinality ord FROM jsonb_array_elements(rows) WITH ORDINALITY),
 contacts AS MATERIALIZED (SELECT DISTINCT coalesce(v->>'__contact_key',conversions_read.journey_key(v,'contact')) k FROM r WHERE conversions_read.txt(v,'contact_event_id')<>''),
 lead_candidates AS (SELECT v,ord,coalesce(v->>'__lead_key',conversions_read.journey_key(v,'lead')) k,
 CASE WHEN coalesce((v->>'lead_event_time')::double precision,0)>0 THEN (v->>'lead_event_time')::double precision*1000 ELSE extract(epoch from date_trunc('milliseconds',(v->>'created_at')::timestamptz))*1000 END t
 FROM r WHERE conversions_read.txt(v,'lead_event_id')<>'' AND conversions_read.digits(v->>'phone')<>''),
 leads AS MATERIALIZED (SELECT DISTINCT ON(k) k,v->>'user_id'||'::'||conversions_read.digits(v->>'phone') phone,
 coalesce(substring(conversions_read.txt(v,'promo_code') from '^([A-Za-z0-9]+)-[A-Za-z0-9]+$'),substring(conversions_read.txt(v,'lead_incoming_promo_code') from '^([A-Za-z0-9]+)-[A-Za-z0-9]+$'),'Sin tag') tag
 FROM lead_candidates WHERE k IN(SELECT k FROM contacts) ORDER BY k,t,ord),
 groups AS MATERIALIZED (SELECT phone,count(*) n FROM leads GROUP BY phone),
 summaries AS (SELECT count(*) phones,coalesce(sum(n),0) total,coalesce(sum(n-1),0) repeats,count(*) FILTER(WHERE n>1) golondrinas FROM groups),
 tag_groups AS (SELECT tag,phone,count(*) n FROM leads GROUP BY tag,phone),
 tag_stats AS (SELECT tag,count(*) phones,sum(n) total,sum(n-1) repeats,count(*) FILTER(WHERE n>1) golondrinas FROM tag_groups GROUP BY tag)
 SELECT jsonb_build_object('totalLeads',total,'uniquePhones',phones,'firstLeads',phones,'repeatLeads',repeats,
 'repeatPct',CASE WHEN total>0 THEN repeats::double precision/total*100 ELSE 0 END,'golondrinaPhones',golondrinas,'golondrinaPct',CASE WHEN phones>0 THEN golondrinas::double precision/phones*100 ELSE 0 END,
 'buckets',(SELECT coalesce(jsonb_agg(jsonb_build_object('bucket',bucket,'label',CASE WHEN bucket=6 THEN '6+ veces' WHEN bucket=1 THEN '1 vez' ELSE bucket||' veces' END,'phones',phones,'leads',leads,'repeatLeads',repeats) ORDER BY bucket),'[]') FROM(SELECT least(n,6) bucket,count(*) phones,sum(n) leads,sum(n-1) repeats FROM groups GROUP BY least(n,6)) b),
 'byLandingTag',(SELECT coalesce(jsonb_agg(jsonb_build_object('landingTag',tag,'totalLeads',total,'uniquePhones',phones,'firstLeads',phones,'repeatLeads',repeats,'repeatPct',repeats::double precision/total*100,'golondrinaPhones',golondrinas,'golondrinaPct',golondrinas::double precision/phones*100) ORDER BY total DESC,tag COLLATE "pg_catalog"."es-x-icu"),'[]') FROM tag_stats)) FROM summaries
$$;

CREATE OR REPLACE FUNCTION conversions_read.start_person(r jsonb,is_start boolean)
RETURNS text LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE SET search_path = '' AS $$
DECLARE u text:=lower(conversions_read.txt(r,'user_id')); s text:=lower(conversions_read.txt(r,'source_platform')); e text:=conversions_read.part('external',r->>'external_id'); l text:=lower(conversions_read.txt(r,'landing_id')); p text:=conversions_read.part('phone',conversions_read.digits(r->>'phone')); w text:=conversions_read.part('wa',conversions_read.digits(CASE WHEN is_start THEN r->>'wa_id' ELSE r->>'phone' END)); f text;
BEGIN
 IF u='' OR s='' THEN RETURN ''; END IF;
 IF s='landing' AND e<>'' THEN RETURN u||'::landing::'||CASE WHEN l<>'' THEN 'landing:'||l||'::' ELSE '' END||e; END IF;
 IF s='whatsapp_cloud_api' AND coalesce(nullif(e,''),nullif(w,''),nullif(p,'')) IS NOT NULL THEN RETURN u||'::whatsapp_cloud_api::'||coalesce(nullif(e,''),nullif(w,''),p); END IF;
 f:=conversions_read.part('start',coalesce(CASE WHEN is_start THEN nullif(r->>'start_identity_key','') END,nullif(r->>'id',''),r->>'created_at'));
 RETURN CASE WHEN f<>'' THEN u||'::'||s||'::'||f ELSE '' END;
END $$;

CREATE OR REPLACE FUNCTION conversions_read.province(t text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE RETURN '{"buenos_aires":"buenos_aires","ciudad_autonoma_de_buenos_aires":"ciudad_autonoma_de_buenos_aires","catamarca":"catamarca","chaco":"chaco","chubut":"chubut","cordoba":"cordoba","corrientes":"corrientes","entre_rios":"entre_rios","formosa":"formosa","jujuy":"jujuy","la_pampa":"la_pampa","la_rioja":"la_rioja","mendoza":"mendoza","misiones":"misiones","neuquen":"neuquen","rio_negro":"rio_negro","salta":"salta","san_juan":"san_juan","san_luis":"san_luis","santa_cruz":"santa_cruz","santa_fe":"santa_fe","santiago_del_estero":"santiago_del_estero","tierra_del_fuego":"tierra_del_fuego","tucuman":"tucuman","provincia_de_buenos_aires":"buenos_aires","bsas":"buenos_aires","pba":"buenos_aires","caba":"ciudad_autonoma_de_buenos_aires","capital_federal":"ciudad_autonoma_de_buenos_aires","autonomous_city_of_buenos_aires":"ciudad_autonoma_de_buenos_aires","tierra_del_fuego_antartida_e_islas_del_atlantico_sur":"tierra_del_fuego"}'::jsonb->>regexp_replace(conversions_read.trim(regexp_replace(lower(regexp_replace(normalize(coalesce(t,''),NFD),U&'[\0300-\036f]','','g')),',.*$','')),'\s+','_','g');
CREATE OR REPLACE FUNCTION conversions_read.province_metrics(core jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = '' AS $$
 SELECT jsonb_build_object('contactos',core->'adContactJourneys','reachedLead',core->'adLeadJourneysLinkedToContact','reachedLeadLinkedToContact',core->'adLeadJourneysLinkedToContact','reachedPurchase',core->'adFirstPurchaseEventsAttributed','reachedPurchaseLinkedToLead',core->'adFirstPurchaseJourneysAttributed','reachedRepeat',core->'adRepeatEvents','repeatFromFirstInRange',core->'adRepeatJourneysFromAttributedFirstInRange','primerasCargas',core->'adFirstPurchaseEventsAttributed','recurrentes',core->'repeatPlayers','totalCargado',core->'totalRevenue','firstPurchaseRevenue',core->'firstPurchaseEventRevenue','purchaseCount',core->'totalPurchases','premium',core->'premiumPlayers','retencionActiva30d',core->'activeRetention30d','cargaMediana',core->'purchaseMedian','leadToPurchaseAvgHours',core->'leadPurchaseAverageHours')
$$;

CREATE OR REPLACE FUNCTION conversions_read.currency_text(n double precision,currency text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE RETURN CASE WHEN n<0 AND currency='ARS' THEN '-' ELSE '' END||currency||chr(160)||CASE WHEN n<0 AND currency='PYG' THEN '-' ELSE '' END||replace(to_char(abs(round(n::numeric)),'FM999,999,999,999,999,999,990'),',','.');

CREATE OR REPLACE FUNCTION conversions_read.tracking(rows jsonb,currency text,options jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = '' AS $$
 WITH r AS MATERIALIZED(SELECT value v,ordinality ord,
 coalesce(nullif(conversions_read.digits(value->>'phone'),''),value->>'phone') phone,
 coalesce(CASE WHEN conversions_read.txt(value,'purchase_event_id')<>'' THEN CASE WHEN (value->>'purchase_gerencia_id')::bigint>0 THEN (value->>'purchase_gerencia_id')::bigint END WHEN conversions_read.txt(value,'registration_event_id')<>'' THEN CASE WHEN (value->>'registration_gerencia_id')::bigint>0 THEN (value->>'registration_gerencia_id')::bigint END WHEN conversions_read.txt(value,'lead_event_id')<>'' THEN CASE WHEN (value->>'lead_gerencia_id')::bigint>0 THEN (value->>'lead_gerencia_id')::bigint END END,CASE WHEN (value->>'assigned_gerencia_id')::bigint>0 THEN (value->>'assigned_gerencia_id')::bigint END) gerencia
 FROM jsonb_array_elements(rows) WITH ORDINALITY WHERE coalesce(value->>'phone','')<>'' AND value->>'estado'<>'contact' AND conversions_read.txt(value,'test_event_code')=''),
 groups AS MATERIALIZED(SELECT phone,gerencia,min(ord) ord,
 (array_agg(v->>'created_at' ORDER BY date_trunc('milliseconds',(v->>'created_at')::timestamptz) DESC,ord))[1] last_active,
 count(*) FILTER(WHERE coalesce(v->>'purchase_event_id','')<>'') loads,
 coalesce(sum((v->>'valor')::double precision) FILTER(WHERE coalesce(v->>'purchase_event_id','')<>''),0) total FROM r GROUP BY phone,gerencia),
 prepared AS(SELECT *,CASE WHEN loads>0 THEN total/loads ELSE 0 END average,
 CASE WHEN gerencia IS NULL THEN 'Sin gerencia' ELSE 'Gerencia '||gerencia END label,
 CASE WHEN loads=0 THEN '📲' ELSE coalesce((SELECT coalesce(nullif(value->>'indicator',''),'-') FROM jsonb_array_elements(coalesce(options->'rules','[{"indicator":"💩","maxTotal":1000},{"indicator":"🟢","maxTotal":5000},{"indicator":"🟡","maxTotal":10000},{"indicator":"🟠","maxTotal":50000},{"indicator":"🔴","maxTotal":100000},{"indicator":"⚫","maxTotal":300000},{"indicator":"🔥","maxTotal":500000}]')) WHERE total<(value->>'maxTotal')::double precision ORDER BY (value->>'maxTotal')::double precision LIMIT 1),CASE WHEN options?'overflow' THEN coalesce(nullif(options->>'overflow',''),'-') END,'💣') END indicator FROM groups),
 filtered AS MATERIALIZED(SELECT * FROM prepared WHERE
 (coalesce(nullif(options->>'gerencia',''),'0')::bigint<=0 OR gerencia=(options->>'gerencia')::bigint)
 AND (conversions_read.trim(coalesce(options->>'search',''))='' OR EXISTS(SELECT FROM unnest(ARRAY[indicator,phone,coalesce(gerencia::text,''),label,loads::text,conversions_read.currency_text(average,currency),conversions_read.currency_text(total,currency),replace(to_char(greatest(0,trunc(total)),'FM999,999,999,999,999,999,990'),',','.')]) x WHERE position(lower(conversions_read.trim(options->>'search')) in lower(x))>0))),
 paging AS(SELECT count(*) total,greatest(1,ceil(count(*)::numeric/20)::int) pages FROM filtered),
 params AS(SELECT *,greatest(1,least(coalesce((options->>'page')::int,1),pages)) page FROM paging),
 sorted AS(SELECT *,row_number() OVER(ORDER BY
 CASE WHEN coalesce(options->>'sort','last_active_desc')<>'last_active_desc' THEN CASE WHEN loads>0 THEN 0 ELSE 1 END END,
 CASE WHEN coalesce(options->>'sort','last_active_desc')='last_active_desc' OR loads=0 THEN date_trunc('milliseconds',last_active::timestamptz) END DESC,
 CASE WHEN coalesce(options->>'sort','last_active_desc')<>'last_active_desc' AND loads>0 THEN CASE options->>'sort' WHEN 'total_loaded_desc' THEN total WHEN 'loads_desc' THEN loads ELSE average END END DESC,ord) position FROM filtered)
 SELECT jsonb_build_object('total',params.total,'page',page,'totalPages',pages,'rows',coalesce((SELECT jsonb_agg(jsonb_build_object('id',phone||'::'||coalesce(gerencia::text,'sin-gerencia'),'phone',phone,'gerenciaId',gerencia,'gerenciaLabel',label,'lastActive',last_active,'loads',loads,'totalLoaded',total,'avgLoad',average,'gerenciaIds',CASE WHEN gerencia IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(gerencia) END) ORDER BY position) FROM sorted WHERE coalesce((options->>'export')::boolean,false) OR position>(page-1)*20 AND position<=page*20),'[]')) FROM params
$$;

CREATE OR REPLACE FUNCTION conversions_read.display_id(label text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE RETURN coalesce((regexp_match(label,'\(ID\s*(\d+)\)','i'))[1],(regexp_match(label,'\mGerencia\s+(\d+)\M','i'))[1],'');
CREATE OR REPLACE FUNCTION conversions_read.performance(rows jsonb,phones jsonb,availability jsonb,premium double precision,options jsonb,as_of timestamptz)
RETURNS jsonb LANGUAGE sql STABLE PARALLEL SAFE SET search_path = '' AS $$
 WITH a AS MATERIALIZED(SELECT value v,ordinality ord FROM jsonb_array_elements(availability) WITH ORDINALITY),
 selected AS MATERIALIZED(SELECT value label FROM jsonb_array_elements_text(coalesce(options->'labels','[]'))),
 r AS MATERIALIZED(SELECT value v,ordinality ord FROM jsonb_array_elements(rows) WITH ORDINALITY),
 labels_for_rows AS MATERIALIZED(SELECT r.*,targets.label FROM r CROSS JOIN LATERAL(
 SELECT label FROM selected WHERE conversions_read.matches_labels(jsonb_build_array(label),conversions_read.labels(v,phones))
 UNION ALL SELECT l FROM jsonb_array_elements_text(conversions_read.labels(v,phones)) l WHERE NOT EXISTS(SELECT FROM selected)) targets),
 canonical AS MATERIALIZED(SELECT v,ord,CASE WHEN EXISTS(SELECT FROM selected) THEN label ELSE coalesce((SELECT a.v->>'label' FROM a WHERE conversions_read.display_id(label)<>'' AND conversions_read.display_id(label)=a.v->>'gerencia_external_id' ORDER BY a.ord DESC LIMIT 1),(SELECT a.v->>'label' FROM a WHERE conversions_read.display_id(label)<>'' AND conversions_read.display_id(label)=a.v->>'gerencia_id' AND a.v->>'gerencia_external_id' IS NULL ORDER BY a.ord DESC LIMIT 1),label) END label FROM labels_for_rows),
 scoped AS MATERIALIZED(SELECT label,ord,conversions_read.scope_stage(v,phones,jsonb_build_array(label)) v FROM canonical),
 labels AS(SELECT label FROM selected UNION SELECT l FROM jsonb_each(phones) p CROSS JOIN LATERAL jsonb_array_elements_text(p.value) l WHERE NOT EXISTS(SELECT FROM selected) UNION SELECT v->>'label' FROM a WHERE NOT EXISTS(SELECT FROM selected) OR v->>'label' IN(SELECT label FROM selected) UNION SELECT label FROM scoped WHERE v IS NOT NULL),
 filtered_labels AS(SELECT label FROM labels WHERE position(lower(conversions_read.trim(coalesce(options->>'search',''))) in lower(label))>0),
 groups AS MATERIALIZED(SELECT label,coalesce((SELECT jsonb_agg(v ORDER BY ord) FROM scoped WHERE scoped.label=labels.label AND v IS NOT NULL),'[]') data FROM filtered_labels labels),
 metrics AS MATERIALIZED(SELECT label,conversions_read.ad_counts(data)||jsonb_build_object(
 'totalPurchases',(SELECT count(*) FROM jsonb_array_elements(data) WHERE coalesce(value->>'purchase_event_id','')<>''),
 'totalRevenue',(SELECT coalesce(sum((value->>'valor')::double precision),0) FROM jsonb_array_elements(data) WHERE coalesce(value->>'purchase_event_id','')<>'')) truth,
 coalesce((SELECT (v->>'availability_pct')::double precision FROM a WHERE conversions_read.display_id(label)<>'' AND v->>'gerencia_external_id'=conversions_read.display_id(label) ORDER BY ord DESC LIMIT 1),(SELECT (v->>'availability_pct')::double precision FROM a WHERE conversions_read.display_id(label)<>'' AND v->>'gerencia_id'=conversions_read.display_id(label) AND v->>'gerencia_external_id' IS NULL ORDER BY ord DESC LIMIT 1),(SELECT (v->>'availability_pct')::double precision FROM a WHERE v->>'label'=label ORDER BY ord DESC LIMIT 1)) available FROM groups),
 projected AS(SELECT label,jsonb_build_object('label',label,'contactos',truth->'adContactJourneys','mensajes',truth->'adLeadJourneysLinkedToContact','cargas',truth->'totalPurchases','montoCargado',truth->'totalRevenue','disponibilidad',available,
 'pctInicioConversacion',CASE WHEN (truth->>'adContactJourneys')::double precision>0 THEN (truth->>'adLeadJourneysLinkedToContact')::double precision/(truth->>'adContactJourneys')::double precision*100 ELSE 0 END,
 'pctCarga',CASE WHEN (truth->>'adLeadJourneysLinkedToContact')::double precision>0 THEN (truth->>'adFirstPurchaseJourneysAttributed')::double precision/(truth->>'adLeadJourneysLinkedToContact')::double precision*100 ELSE 0 END,
 'pctRecarga',CASE WHEN (truth->>'adFirstPurchaseJourneysAttributed')::double precision>0 THEN (truth->>'adRepeatJourneysFromAttributedFirstInRange')::double precision/(truth->>'adFirstPurchaseJourneysAttributed')::double precision*100 ELSE 0 END) v FROM metrics)
 SELECT jsonb_build_object('rows',coalesce(jsonb_agg(v ORDER BY
 CASE WHEN coalesce(options->>'sort','label')<>'label' AND options->>'direction'='asc' THEN coalesce((v->>(options->>'sort'))::double precision,-1) END,
 CASE WHEN coalesce(options->>'sort','label')<>'label' AND options->>'direction'<>'asc' THEN coalesce((v->>(options->>'sort'))::double precision,-1) END DESC,
 CASE WHEN options->>'direction'='desc' AND coalesce(options->>'sort','label')='label' THEN label END COLLATE "pg_catalog"."es-x-icu" DESC,
 label COLLATE "pg_catalog"."es-x-icu"),'[]'),
 'totals',(SELECT jsonb_object_agg(k,amount) FROM (
 SELECT k,coalesce(sum((v->>k)::double precision ORDER BY label COLLATE "pg_catalog"."es-x-icu"),0) amount
 FROM unnest(ARRAY['contactos','pctInicioConversacion','mensajes','cargas','montoCargado','pctCarga','pctRecarga']) k LEFT JOIN projected ON true GROUP BY k
 ) totals)) FROM projected
$$;
CREATE OR REPLACE FUNCTION conversions_read.js_text(v jsonb)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = '' AS $$
 SELECT CASE jsonb_typeof(v) WHEN 'object' THEN '[object Object]' WHEN 'array' THEN (SELECT string_agg(coalesce(conversions_read.js_text(value),''),',' ORDER BY ordinality) FROM jsonb_array_elements(v) WITH ORDINALITY) ELSE v#>>'{}' END
$$;
CREATE OR REPLACE FUNCTION conversions_read.payload_value(payload jsonb,keys text[])
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = '' AS $$
 SELECT coalesce((SELECT conversions_read.trim(conversions_read.js_text(payload->key)) FROM unnest(keys) WITH ORDINALITY k(key,ord) WHERE conversions_read.trim(coalesce(conversions_read.js_text(payload->key),''))<>'' ORDER BY ord LIMIT 1),'')
$$;
CREATE OR REPLACE FUNCTION conversions_read.start_labels(r jsonb,phones jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = '' AS $$
 WITH vars AS(SELECT conversions_read.txt(r,'assigned_gerencia_label') label,coalesce(nullif(conversions_read.txt(r,'assigned_gerencia_external_id'),''),conversions_read.txt(r,'assigned_gerencia_id')) id),
 labels AS(SELECT label,0 ord FROM vars WHERE label<>'' UNION ALL SELECT coalesce(nullif(conversions_read.txt(r,'assigned_gerencia_name'),''),nullif(regexp_replace(label,'\s*\(ID\s*\d+\)\s*$','','i'),''),'Gerencia')||' (ID '||id||')',1 FROM vars WHERE id<>'' UNION ALL SELECT value,ordinality+1 FROM jsonb_array_elements_text(coalesce(phones->conversions_read.digits(r->>'telefono_asignado'),'[]')) WITH ORDINALITY WHERE value<>''),
 unique_labels AS(SELECT label,min(ord) ord FROM labels GROUP BY label)
 SELECT coalesce(jsonb_agg(label ORDER BY ord),'[]') FROM unique_labels
$$;
CREATE OR REPLACE FUNCTION conversions_read.match_filters(r jsonb,f jsonb,phones jsonb,view_kind text)
RETURNS boolean LANGUAGE sql IMMUTABLE PARALLEL SAFE RETURN (coalesce(f->>'source','__all__')<>'landing' OR coalesce(f->>'landing','__all__')='__all__' OR conversions_read.txt(r,'landing_name')=f->>'landing') AND
 (coalesce(f->>'pixel','__all__')='__all__' OR CASE WHEN f->>'source'='whatsapp_cloud_api' THEN conversions_read.txt(r,'dataset_id') ELSE conversions_read.trim(coalesce(r->>'meta_pixel_id',r->>'pixel_id','')) END=f->>'pixel') AND
 (coalesce(f->>'phone','__all__')='__all__' OR conversions_read.digits(r->>'telefono_asignado')=f->>'phone') AND
 (jsonb_array_length(coalesce(f->'gerencias','[]'))=0 OR conversions_read.matches_labels(f->'gerencias',CASE WHEN view_kind='starts' THEN conversions_read.start_labels(r,phones) ELSE conversions_read.labels(r,phones,CASE WHEN view_kind='table' THEN 'table' ELSE 'all' END) END)) AND
 (coalesce(f->>'meta','__all__')='__all__' OR coalesce((r->>'from_meta_ads')::boolean,false)=(f->>'meta'='true')) AND
 (coalesce(f->>'source','__all__')='__all__' OR lower(conversions_read.txt(r,'source_platform'))=f->>'source') AND
 (coalesce(f->>'sex','__all__')='__all__' OR (view_kind<>'starts' AND conversions_read.sex(r->>'inferred_sex')=f->>'sex')) AND
 (jsonb_array_length(coalesce(f->'campaigns','[]'))=0 OR coalesce(f->'campaigns','[]')?conversions_read.txt(r,'utm_campaign')) AND
 (coalesce(f->>'device','__all__')='__all__' OR lower(conversions_read.txt(r,'device_type'))=f->>'device');
CREATE OR REPLACE FUNCTION conversions_read.inbox_matches(row_data jsonb,related jsonb,f jsonb,phones jsonb,options jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE SET search_path = '' AS $$
DECLARE payload jsonb; r jsonb; labels jsonb; assigned text; campaign text; promo text; label text; hay text;
BEGIN
 BEGIN payload:=(row_data->>'payload_raw')::jsonb; EXCEPTION WHEN invalid_text_representation THEN payload:='{}'; END;
 IF jsonb_typeof(payload) IS DISTINCT FROM 'object' THEN payload:='{}'; END IF;
 assigned:=conversions_read.digits(coalesce(nullif(related->>'telefono_asignado',''),conversions_read.payload_value(payload,ARRAY['telefono_asignado','bot_phone','assigned_phone'])));
 campaign:=conversions_read.trim(coalesce(nullif(related->>'utm_campaign',''),conversions_read.payload_value(payload,ARRAY['utm_campaign'])));
 promo:=conversions_read.trim(coalesce(nullif(row_data->>'promo_code',''),conversions_read.payload_value(payload,ARRAY['promo_code'])));
 label:=conversions_read.payload_value(payload,ARRAY['assigned_gerencia_label','gerencia_label','gerencia']);
 labels:=CASE WHEN related IS NOT NULL THEN conversions_read.labels(related,phones) ELSE (CASE WHEN label<>'' THEN jsonb_build_array(label) ELSE '[]'::jsonb END)||coalesce(phones->assigned,'[]') END;
 r:=jsonb_build_object('landing_name',conversions_read.trim(coalesce(nullif(row_data->>'landing_name',''),nullif(related->>'landing_name',''),conversions_read.payload_value(payload,ARRAY['landing_name','landingName','landing']))),
 'meta_pixel_id',CASE WHEN related IS NOT NULL THEN conversions_read.trim(coalesce(related->>'meta_pixel_id',related->>'pixel_id','')) ELSE conversions_read.payload_value(payload,ARRAY['meta_pixel_id','pixel_id']) END,
 'dataset_id',CASE WHEN related IS NOT NULL THEN conversions_read.txt(related,'dataset_id') ELSE conversions_read.payload_value(payload,ARRAY['dataset_id','datasetId','meta_messaging_dataset_id']) END,
 'telefono_asignado',assigned,'source_platform',coalesce(nullif(related->>'source_platform',''),conversions_read.payload_value(payload,ARRAY['source_platform'])),
 'inferred_sex',CASE WHEN related IS NOT NULL THEN related->>'inferred_sex' ELSE conversions_read.payload_value(payload,ARRAY['inferred_sex','sex']) END,
 'utm_campaign',campaign,'device_type',coalesce(nullif(related->>'device_type',''),conversions_read.payload_value(payload,ARRAY['device_type'])),
 'from_meta_ads',CASE WHEN related IS NOT NULL THEN coalesce((related->>'from_meta_ads')::boolean,false) ELSE conversions_read.payload_value(payload,ARRAY['fbc'])<>'' OR campaign<>'' OR promo~'^[A-Za-z0-9]+-[A-Za-z0-9]+$' END);
 IF NOT conversions_read.match_filters(r,f||'{"gerencias":[]}','{}','stats') OR NOT conversions_read.matches_labels(coalesce(f->'gerencias','[]'),labels) THEN RETURN false; END IF;
 IF coalesce(options->>'action','all')<>'all' AND upper(coalesce(row_data->>'action',''))<>options->>'action' THEN RETURN false; END IF;
 SELECT string_agg(coalesce(row_data->>k,''),' ' ORDER BY ord) INTO hay FROM unnest(ARRAY['action','status','promo_code','coelsa_id','transaction_id','phone','action_event_id','response_body','landing_name','payload_raw']) WITH ORDINALITY keys(k,ord);
 RETURN position(lower(conversions_read.trim(coalesce(options->>'search',''))) in lower(hay))>0;
END $$;
CREATE OR REPLACE FUNCTION conversions_read.prepare_stats(rows jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = '' AS $$
 SELECT coalesce(jsonb_agg(v||jsonb_strip_nulls(jsonb_build_object(
 '__contact_key',CASE WHEN coalesce(v->>'contact_event_id','')<>'' THEN coalesce(v->>'__contact_key',conversions_read.journey_key(v,'contact')) END,
 '__lead_key',CASE WHEN coalesce(v->>'lead_event_id','')<>'' THEN coalesce(v->>'__lead_key',conversions_read.journey_key(v,'lead')) END,
 '__purchase_key',CASE WHEN coalesce(v->>'purchase_event_id','')<>'' THEN coalesce(v->>'__purchase_key',conversions_read.journey_key(v,'purchase')) END)) ORDER BY ord),'[]') FROM jsonb_array_elements(rows) WITH ORDINALITY r(v,ord)
$$;
-- Reorder the same top-ten aggregates, preserving their canonical revenue ranking
-- for the assistant summary. Small index permutations avoid another report request.
CREATE OR REPLACE FUNCTION conversions_read.slice_orders(rows jsonb,label_key text)
RETURNS jsonb LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = '' AS $$
 WITH r AS MATERIALIZED(SELECT value v,ordinality-1 idx FROM jsonb_array_elements(rows) WITH ORDINALITY),
 sorts AS(SELECT k,d FROM unnest(ARRAY['name','mensajes','cargas','pct','revenue']) k CROSS JOIN unnest(ARRAY['asc','desc']) d),
 ordered AS(SELECT k,d,coalesce((SELECT jsonb_agg(idx ORDER BY
 CASE WHEN k='name' AND d='asc' THEN v->>label_key END COLLATE "pg_catalog"."es-x-icu" ASC,
 CASE WHEN k='name' AND d='desc' THEN v->>label_key END COLLATE "pg_catalog"."es-x-icu" DESC,
 CASE WHEN k<>'name' THEN CASE WHEN d='asc' THEN 1 ELSE -1 END *
 CASE WHEN k='pct' THEN CASE WHEN (v->>'mensajes')::double precision>0 THEN (v->>'cargas')::double precision/(v->>'mensajes')::double precision ELSE 0 END ELSE (v->>k)::double precision END END,idx) FROM r),'[]') indices FROM sorts),
 grouped AS(SELECT k,jsonb_object_agg(d,indices) directions FROM ordered GROUP BY k)
 SELECT jsonb_object_agg(k,directions) FROM grouped
$$;
CREATE OR REPLACE FUNCTION conversions_read.stats(rows jsonb,contacts jsonb,starts jsonb,premium double precision,options jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path = '' AS $$
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

CREATE OR REPLACE FUNCTION public.get_conversion_report(p_request jsonb DEFAULT '{}')
-- PostgREST hoists this bounded report-only timeout. Broad historical reports
-- previously used many separate reads; they must not inherit an 8-second page budget.
-- The role/global settings are unchanged; modest local work_mem limits disk spilling.
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' SET extra_float_digits = 3 SET statement_timeout = '60s' SET work_mem = '16MB' AS $$
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
END $$;


-- Gerencia metrics use stage-scoped rows, not the latest-stage table grouping.

REVOKE ALL ON SCHEMA conversions_read FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA conversions_read TO authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA conversions_read FROM PUBLIC,anon;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA conversions_read TO authenticated;
REVOKE ALL ON FUNCTION public.get_conversion_report(jsonb) FROM PUBLIC,anon;
GRANT ALL ON FUNCTION public.get_conversion_report(jsonb) TO authenticated;
