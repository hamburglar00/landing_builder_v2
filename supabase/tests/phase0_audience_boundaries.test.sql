-- LOCAL ONLY: synthetic timestamps at microsecond boundaries, never production.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path=public,extensions;
select plan(12);
insert into auth.users(id) values ('14000000-0000-0000-0000-000000000001');
insert into public.conversions(user_id,estado,currency,email,purchase_event_id,purchase_type,valor,created_at,test_event_code)
select '14000000-0000-0000-0000-000000000001','purchase',currency,'boundary@example.invalid',label,kind,value,at,code
from (values
 ('start','first',10,'2026-09-01 03:00:00+00'::timestamptz,''),
 ('end','repeat',20,'2026-09-02 03:00:00+00'::timestamptz,' '),
 ('after-end','repeat',30,'2026-09-02 03:00:00.000001+00'::timestamptz,''),
 ('as-of','repeat',40,'2026-09-03 03:00:00+00'::timestamptz,''),
 ('after-as-of','repeat',1000,'2026-09-03 03:00:00.000001+00'::timestamptz,''),
 ('test','first',1000,'2026-09-01 04:00:00+00'::timestamptz,'TEST'),
 ('negative',null,-50,'2026-09-01 05:00:00+00'::timestamptz,'')
) as v(label,kind,value,at,code) cross join (values ('ARS'),('PYG')) currencies(currency);
set local request.jwt.claim.sub='14000000-0000-0000-0000-000000000001';
create temporary table actual as
select * from public.get_meta_audience_buyers_v2('ARS','2026-09-03 03:00Z','2026-09-01 03:00Z','2026-09-02 03:00Z');
select is((select count(*) from actual),1::bigint,'one ARS buyer');
select is((select historical_purchase_count from actual),5::bigint,'as_of inclusive, future and test excluded');
select is((select period_purchase_count from actual),3::bigint,'both period boundaries inclusive, microsecond after excluded');
select is((select historical_total_value from actual),100::numeric,'negative value clamped to zero');
select is((select period_total_value from actual),30::numeric,'period total excludes later events');
select is((select historical_first_purchase_value from actual),10::numeric,'first explicit historical purchase');
select is((select historical_first_purchase_count from actual),1::bigint,'test first excluded');
select is((select historical_reload_count from actual),3::bigint,'unknown type counted only in total');
select is((select days_since_last_purchase from actual),0::bigint,'recency measured at as_of');
select is((select historical_total_value from public.get_meta_audience_buyers_v2('PYG','2026-09-03 03:00Z','2026-09-01 03:00Z','2026-09-02 03:00Z')),100::numeric,'PYG isolated from ARS');
select is((select period_purchase_count from public.get_meta_audience_buyers_v2('ARS','2026-09-03 03:00Z','2026-09-03 02:59Z','2026-09-03 02:59Z')),0::bigint,'inactive buyer stays in historical universe');
select is((select days_since_last_purchase from public.get_meta_audience_buyers_v2('ARS','2026-09-03 02:59:59Z','2026-09-01 03:00Z','2026-09-02 03:00Z')),0::bigint,'recency floors elapsed seconds rather than calendar days');
select * from finish();
rollback;
