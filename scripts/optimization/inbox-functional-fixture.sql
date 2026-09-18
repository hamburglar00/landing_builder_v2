BEGIN;
SET LOCAL statement_timeout='8s';
INSERT INTO auth.users(id,email,raw_app_meta_data,raw_user_meta_data) VALUES
('74000000-0000-4000-8000-000000000002','inbox-other@example.invalid','{"panelbot_admin_created":true,"panelbot_role":"client"}','{"role":"admin"}'),
('74000000-0000-4000-8000-000000000003','inbox-admin@example.invalid','{"panelbot_admin_created":true,"panelbot_role":"admin"}','{}');
INSERT INTO public.whatsapp_cloud_api_configs(id,user_id,name,workspace_currency) VALUES
('74000000-0000-4000-8000-000000000011','74000000-0000-4000-8000-000000000001','Synthetic PYG','PYG'),
('74000000-0000-4000-8000-000000000012','74000000-0000-4000-8000-000000000002','Synthetic other','ARS');
INSERT INTO public.whatsapp_cloud_api_contacts(id,config_id,user_id,wa_id,profile_name,first_message_at,last_message_at,created_at) VALUES
('74000000-0000-4000-8000-000000000097','74000000-0000-4000-8000-000000000011','74000000-0000-4000-8000-000000000001','synthetic-pyg','Synthetic PYG','2026-09-01','2026-09-18T18:03:00Z','2026-09-01'),
('74000000-0000-4000-8000-000000000098','74000000-0000-4000-8000-000000000012','74000000-0000-4000-8000-000000000002','synthetic-other','Synthetic other','2026-09-01','2026-09-18T18:02:00Z','2026-09-01'),
('74000000-0000-4000-8000-000000000099','74000000-0000-4000-8000-000000000010','74000000-0000-4000-8000-000000000001','synthetic-empty','Synthetic empty','2026-09-01','2026-09-18T03:01:00Z','2026-09-01');
UPDATE public.conversions SET lead_event_id='synthetic-lead' WHERE external_id='inbox-external-1';
UPDATE public.conversions SET estado='purchase',valor=100 WHERE external_id='inbox-external-2';
UPDATE public.conversions SET estado='purchase',valor=100,purchase_type='repeat' WHERE external_id='inbox-external-3';
UPDATE public.conversions SET estado='purchase',valor=60000 WHERE external_id='inbox-external-4';
COMMIT;
