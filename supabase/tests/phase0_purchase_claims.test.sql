-- LOCAL ONLY: tests the actual claim RPC with synthetic aliases; no Meta calls.
begin;
set local search_path=public,extensions;
select plan(12);
insert into auth.users(id) values ('15000000-0000-0000-0000-000000000001'),('15000000-0000-0000-0000-000000000002');
create temporary table first_claim as select * from public.claim_purchase_event(
  '15000000-0000-0000-0000-000000000001',array[' payment:synthetic-a ','payment:synthetic-a','action:synthetic-a'],'synthetic-original');
select is((select claimed from first_claim),true,'first receipt claims processing');
select is((select count(*) from public.purchase_event_claim_keys where user_id='15000000-0000-0000-0000-000000000001'),2::bigint,'keys trimmed and deduplicated');
select is((select claimed from public.claim_purchase_event('15000000-0000-0000-0000-000000000001',array['action:synthetic-a'],'synthetic-new')),false,'duplicate alias cannot claim again');
select is((select event_id from public.claim_purchase_event('15000000-0000-0000-0000-000000000001',array['payment:synthetic-a'],'synthetic-new')),'synthetic-original','duplicate preserves event id');
select is((select claimed from public.claim_purchase_event('15000000-0000-0000-0000-000000000002',array['payment:synthetic-a'],'synthetic-other')),true,'same opaque key isolated per owner');
select public.complete_purchase_event_claim((select claim_id from first_claim),null,'error');
select is((select claimed from public.claim_purchase_event('15000000-0000-0000-0000-000000000001',array['payment:synthetic-a'],'synthetic-retry')),true,'failed attempt can retry');
select is((select event_id from public.purchase_event_claims where id=(select claim_id from first_claim)),'synthetic-original','retry reuses original event identity');
update public.purchase_event_claims set updated_at=now()-interval '5 minutes' where id=(select claim_id from first_claim);
select is((select claimed from public.claim_purchase_event('15000000-0000-0000-0000-000000000001',array['payment:synthetic-a'],'synthetic-new')),false,'exactly five minutes is not stale');
update public.purchase_event_claims set updated_at=now()-interval '5 minutes 0.000001 seconds' where id=(select claim_id from first_claim);
select is((select claimed from public.claim_purchase_event('15000000-0000-0000-0000-000000000001',array['payment:synthetic-a'],'synthetic-new')),true,'older than five minutes is reclaimable');
select public.complete_purchase_event_claim((select claim_id from first_claim),null,'processed');
select is((select claimed from public.claim_purchase_event('15000000-0000-0000-0000-000000000001',array['payment:synthetic-a'],'synthetic-new')),false,'completed receipt is not reprocessed');
select is((select claim_status from public.claim_purchase_event('15000000-0000-0000-0000-000000000001',array['',' '],'synthetic-unprotected')),'unprotected','no stable keys explicitly unprotected');
select ok(not has_function_privilege('authenticated','public.claim_purchase_event(uuid,text[],text)','EXECUTE'),'browser cannot call claim RPC');
select * from finish();
rollback;
