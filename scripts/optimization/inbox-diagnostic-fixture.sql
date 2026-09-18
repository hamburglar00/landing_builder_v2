BEGIN;
SET LOCAL statement_timeout='45s';
INSERT INTO auth.users(id,email,raw_app_meta_data,raw_user_meta_data)
VALUES ('74000000-0000-4000-8000-000000000001','inbox-synthetic@example.invalid','{"panelbot_admin_created":true,"panelbot_role":"client"}','{}');
INSERT INTO public.whatsapp_cloud_api_configs(id,user_id,name)
VALUES ('74000000-0000-4000-8000-000000000010','74000000-0000-4000-8000-000000000001','inbox-synthetic');
INSERT INTO public.whatsapp_cloud_api_contacts(id,config_id,user_id,wa_id,profile_name,external_id,first_message_at,last_message_at,created_at)
SELECT md5('inbox-contact-'||g)::uuid,'74000000-0000-4000-8000-000000000010','74000000-0000-4000-8000-000000000001','synthetic-'||g,'Synthetic '||g,'inbox-external-'||g,
 '2026-09-01'::timestamptz, '2026-09-18T18:00:00Z'::timestamptz-g*interval '1 minute','2026-09-01'::timestamptz
FROM generate_series(1,268) g;
INSERT INTO public.whatsapp_cloud_api_assignments(config_id,user_id,contact_id,first_message_id,promo_code)
SELECT config_id,user_id,id,'assignment-'||wa_id,'SYNTHETIC-'||wa_id FROM public.whatsapp_cloud_api_contacts;
INSERT INTO public.whatsapp_cloud_api_webhook_events(config_id,user_id,event_type,payload,received_at,meta_message_id,status)
SELECT c.config_id,c.user_id,'message',jsonb_build_object('message',jsonb_build_object('from',c.wa_id,'text',jsonb_build_object('body','SYNTHETIC-INBOX-MESSAGE-'||g))),
 c.last_message_at-g*interval '1 second',c.wa_id||'-message-'||g,'processed'
FROM public.whatsapp_cloud_api_contacts c CROSS JOIN generate_series(1,60) g;
INSERT INTO public.conversions(user_id,external_id,estado,currency,observaciones)
SELECT '74000000-0000-4000-8000-000000000001', CASE WHEN g<=268 THEN 'inbox-external-'||g ELSE 'unrelated-'||g END,'contact','ARS',
 (SELECT string_agg(md5(g::text||'-'||n),'' ORDER BY n) FROM generate_series(1,40) n)
FROM generate_series(1,82000) g;
COMMIT;
ANALYZE public.conversions;
ANALYZE public.whatsapp_cloud_api_contacts;
ANALYZE public.whatsapp_cloud_api_configs;
ANALYZE public.whatsapp_cloud_api_assignments;
ANALYZE public.whatsapp_cloud_api_webhook_events;
