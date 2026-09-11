begin;

create extension if not exists pgtap with schema extensions;

select plan(18);

-- Production already rejects new duplicate transaction ids. Dropping this
-- index only inside the rolled-back test transaction lets the RPC prove it
-- also handles legacy duplicates defensively.
drop index if exists public.conversions_purchase_transaction_id_uidx;

insert into auth.users (id, raw_app_meta_data)
values
  ('10000000-0000-0000-0000-000000000001', '{"panelbot_admin_created": true}'::jsonb),
  ('10000000-0000-0000-0000-000000000002', '{"panelbot_admin_created": true}'::jsonb);

insert into public.conversions (
  id, user_id, estado, currency, phone, email, fn,
  purchase_event_id, purchase_event_time, purchase_transaction_id,
  purchase_coelsa_id, purchase_type, valor, external_id, source_platform,
  purchase_atrio_id, purchase_atrio_players_id, created_at
)
values
  -- Phone buyer: historical first purchase plus a repeat inside September.
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'purchase', 'ARS', '+54 (9) 11 1111-1111', '', 'Ana',
   'a-first', extract(epoch from timestamptz '2026-01-10 12:00:00+00')::bigint, 'tx-a-first', '', 'first', 100, '', 'landing', '', '', '2026-01-10 12:00:00+00'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'purchase', 'ARS', '+54 9 11 1111 1111', '', 'Ana',
   'a-repeat', extract(epoch from timestamptz '2026-09-01 12:00:00+00')::bigint, '', '', 'repeat', 200, '', 'landing', '', '', '2026-01-15 12:00:00+00'),
  -- Same purchase_event_id: query-time deduplication must count it once.
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'purchase', 'ARS', '+54 9 11 1111 1111', '', 'Ana',
   'a-repeat', extract(epoch from timestamptz '2026-09-01 12:00:00+00')::bigint, '', '', 'repeat', 200, '', 'landing', '', '', '2026-09-02 12:00:00+00'),
  -- Email buyer duplicated by purchase_event_id.
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'purchase', 'ARS', '', ' CLIENTE@EXAMPLE.COM ', '',
   'b-event', extract(epoch from timestamptz '2026-09-02 12:00:00+00')::bigint, '', '', 'first', 50, '', 'landing', '', '', '2026-09-02 12:00:00+00'),
  ('20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', 'purchase', 'ARS', '', 'cliente@example.com', '',
   'b-event', extract(epoch from timestamptz '2026-09-02 12:00:00+00')::bigint, '', '', 'first', 50, '', 'landing', '', '', '2026-09-02 13:00:00+00'),
  -- Null and invalid purchase_event_time values use created_at.
  ('20000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000001', 'purchase', 'ARS', '', 'fallback@example.com', '',
   'fallback-null', null, '', '', 'first', 75, '', 'landing', '', '', '2026-09-03 12:00:00+00'),
  ('20000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000001', 'purchase', 'ARS', '', 'invalid-time@example.com', '',
   'fallback-invalid', -1, '', '', 'first', 5, '', 'landing', '', '', '2026-09-04 12:00:00+00'),
  -- Atrio pair wins over the differing phones and groups both purchases.
  ('20000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000001', 'purchase', 'ARS', '111', '', '',
   'atrio-first', extract(epoch from timestamptz '2026-09-05 12:00:00+00')::bigint, '', '', 'first', 30, '', 'whatsapp_cloud_api', 'atrio-1', 'player-1', '2026-09-05 12:00:00+00'),
  ('20000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000001', 'purchase', 'ARS', '222', '', '',
   'atrio-repeat', extract(epoch from timestamptz '2026-09-06 12:00:00+00')::bigint, '', '', 'repeat', 40, '', 'whatsapp_cloud_api', 'atrio-1', 'player-1', '2026-09-06 12:00:00+00'),
  -- External id is only a source-scoped fallback.
  ('20000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000001', 'purchase', 'ARS', '', '', '',
   'external-first', extract(epoch from timestamptz '2026-09-07 12:00:00+00')::bigint, '', '', 'first', 20, 'external-1', 'landing', '', '', '2026-09-07 12:00:00+00'),
  ('20000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000001', 'purchase', 'ARS', '', '', '',
   'external-repeat', extract(epoch from timestamptz '2026-09-08 12:00:00+00')::bigint, '', '', 'repeat', 25, 'external-1', 'landing', '', '', '2026-09-08 12:00:00+00'),
  -- No buyer identifier: each internal row remains a separate, non-exportable buyer.
  ('20000000-0000-0000-0000-000000000012', '10000000-0000-0000-0000-000000000001', 'purchase', 'ARS', '', '', '',
   'anonymous-event', extract(epoch from timestamptz '2026-09-09 12:00:00+00')::bigint, '', '', 'first', 10, '', 'landing', '', '', '2026-09-09 12:00:00+00'),
  ('20000000-0000-0000-0000-000000000013', '10000000-0000-0000-0000-000000000001', 'purchase', 'ARS', '', '', '',
   '', null, '', '', 'first', 15, '', 'landing', '', '', '2026-09-10 12:00:00+00'),
  -- purchase_event_time is authoritative, so this January event is outside September.
  ('20000000-0000-0000-0000-000000000014', '10000000-0000-0000-0000-000000000001', 'purchase', 'ARS', '', 'outside@example.com', '',
   'outside-event', extract(epoch from timestamptz '2026-01-20 12:00:00+00')::bigint, '', '', 'first', 500, '', 'landing', '', '', '2026-09-11 12:00:00+00'),
  -- PYG and another tenant must never leak into the ARS result.
  ('20000000-0000-0000-0000-000000000015', '10000000-0000-0000-0000-000000000001', 'purchase', 'PYG', '+54 9 11 1111 1111', '', '',
   'pyg-event', extract(epoch from timestamptz '2026-09-01 12:00:00+00')::bigint, '', '', 'first', 1000, '', 'landing', '', '', '2026-09-01 12:00:00+00'),
  ('20000000-0000-0000-0000-000000000016', '10000000-0000-0000-0000-000000000002', 'purchase', 'ARS', '999', '', '',
   'other-tenant', extract(epoch from timestamptz '2026-09-01 12:00:00+00')::bigint, '', '', 'first', 9999, '', 'landing', '', '', '2026-09-01 12:00:00+00'),
  -- Legacy duplicate transaction: distinct event ids, same transaction id.
  ('20000000-0000-0000-0000-000000000017', '10000000-0000-0000-0000-000000000001', 'purchase', 'ARS', '444', '', '',
   'transaction-event-a', extract(epoch from timestamptz '2026-09-12 12:00:00+00')::bigint, 'legacy-duplicate-transaction', '', 'first', 60, '', 'landing', '', '', '2026-09-12 12:00:00+00'),
  ('20000000-0000-0000-0000-000000000018', '10000000-0000-0000-0000-000000000001', 'purchase', 'ARS', '444', '', '',
   'transaction-event-b', extract(epoch from timestamptz '2026-09-12 12:00:00+00')::bigint, 'legacy-duplicate-transaction', '', 'first', 60, '', 'landing', '', '', '2026-09-12 13:00:00+00');

select has_function(
  'public',
  'get_meta_audience_buyers',
  array['text', 'timestamp with time zone', 'timestamp with time zone', 'text', 'text'],
  'creates the Meta audience RPC'
);

select throws_ok(
  $$ select * from public.get_meta_audience_buyers('ARS', '2026-09-01', '2026-09-30', 'all', 'period_total') $$,
  'P0001',
  'not authorized',
  'rejects calls without an authenticated user'
);

select ok(
  not has_function_privilege('anon', 'public.get_meta_audience_buyers(text,timestamptz,timestamptz,text,text)', 'EXECUTE'),
  'anon cannot execute the RPC'
);

select ok(
  has_function_privilege('authenticated', 'public.get_meta_audience_buyers(text,timestamptz,timestamptz,text,text)', 'EXECUTE'),
  'authenticated users can execute the RPC'
);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);

create temporary table audience_all on commit drop as
select *
from public.get_meta_audience_buyers(
  'ARS', '2026-09-01 00:00:00+00', '2026-09-30 23:59:59+00', 'all', 'period_total'
);

select is((select count(*) from audience_all), 9::bigint, 'groups only in-period ARS buyers for the authenticated tenant');
select is((select sum(purchase_count) from audience_all), 11::numeric, 'deduplicates transaction and event ids without deleting source rows');
select is((select sum(total_value) from audience_all), 530::numeric, 'sums deduplicated period values');
select is((select total_value from audience_all where customer_key = 'phone:444'), 60::numeric, 'deduplicates a repeated transaction id');
select is((select count(*) from audience_all where customer_key like 'atrio:%'), 1::bigint, 'groups by atrio_id plus players_id first');
select is((select total_value from audience_all where customer_key = 'email:cliente@example.com'), 50::numeric, 'normalizes and groups email identities');
select is((select count(*) from audience_all where customer_key like 'row:%'), 2::bigint, 'counts unidentified rows as separate non-exportable buyers');
select is((select count(*) from audience_all where email in ('fallback@example.com', 'invalid-time@example.com')), 2::bigint, 'falls back to created_at for null or invalid event times');
select is((select count(*) from audience_all where email = 'outside@example.com'), 0::bigint, 'uses valid purchase_event_time instead of created_at');

select is(
  (select count(*) from public.get_meta_audience_buyers('ARS', '2026-09-01', '2026-09-30 23:59:59+00', 'repeat', 'period_total')),
  3::bigint,
  'filters period totals to reloads'
);

select is(
  (select count(*) from public.get_meta_audience_buyers('ARS', '2026-09-01', '2026-09-30 23:59:59+00', 'first', 'period_total')),
  8::bigint,
  'filters period totals to first purchases'
);

select is(
  (select total_value from public.get_meta_audience_buyers('ARS', '2026-09-01', '2026-09-30 23:59:59+00', 'all', 'first_purchase') where customer_key = 'phone:5491111111111'),
  100::numeric,
  'uses the historical first purchase value for a buyer active in the period'
);

select is(
  (select first_purchase_at from public.get_meta_audience_buyers('ARS', '2026-09-01', '2026-09-30 23:59:59+00', 'all', 'first_purchase') where customer_key = 'phone:5491111111111'),
  timestamptz '2026-01-10 12:00:00+00',
  'returns the effective historical first purchase date'
);

select is(
  (select sum(total_value) from public.get_meta_audience_buyers('PYG', '2026-09-01', '2026-09-30 23:59:59+00', 'all', 'period_total')),
  1000::numeric,
  'keeps PYG separate from ARS'
);

select * from finish();

rollback;
