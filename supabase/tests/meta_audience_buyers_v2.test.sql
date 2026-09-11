begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(34);

-- Allow legacy duplicate transaction fixtures inside this rolled-back test.
drop index if exists public.conversions_purchase_transaction_id_uidx;

insert into auth.users (id, raw_app_meta_data)
values
  ('11000000-0000-0000-0000-000000000001', '{"panelbot_admin_created": true}'::jsonb),
  ('11000000-0000-0000-0000-000000000002', '{"panelbot_admin_created": true}'::jsonb);

insert into public.conversions (
  id, user_id, estado, currency, phone, email, fn,
  purchase_event_id, purchase_event_time, purchase_transaction_id,
  purchase_type, valor, external_id, source_platform,
  purchase_atrio_id, purchase_atrio_players_id, created_at
)
values
  -- A repeat can predate the first explicit first without becoming the first load.
  ('21000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 'purchase', 'ARS', '111', '', 'Ana',
   'a-repeat-old', extract(epoch from timestamptz '2026-01-01 00:00:00+00')::bigint, '', 'repeat', 20, '', 'landing', '', '', '2026-01-01 00:00:00+00'),
  ('21000000-0000-0000-0000-000000000002', '11000000-0000-0000-0000-000000000001', 'purchase', 'ARS', '111', '', 'Ana',
   'a-first', extract(epoch from timestamptz '2026-01-05 00:00:00+00')::bigint, '', 'first', 100, '', 'landing', '', '', '2026-01-05 00:00:00+00'),
  ('21000000-0000-0000-0000-000000000003', '11000000-0000-0000-0000-000000000001', 'purchase', 'ARS', '111', '', 'Ana',
   'a-repeat-period', extract(epoch from timestamptz '2026-09-10 00:00:00+00')::bigint, '', 'repeat', 200, '', 'landing', '', '', '2026-09-10 00:00:00+00'),
  -- Repeat-only buyer has no historical first.
  ('21000000-0000-0000-0000-000000000004', '11000000-0000-0000-0000-000000000001', 'purchase', 'ARS', '', 'no-first@example.com', '',
   'no-first', extract(epoch from timestamptz '2026-09-15 00:00:00+00')::bigint, '', 'repeat', 50, '', 'landing', '', '', '2026-09-15 00:00:00+00'),
  -- Historical buyer without period activity must remain in the v2 universe.
  ('21000000-0000-0000-0000-000000000005', '11000000-0000-0000-0000-000000000001', 'purchase', 'ARS', '', 'inactive@example.com', '',
   'inactive-first', extract(epoch from timestamptz '2026-03-01 00:00:00+00')::bigint, '', 'first', 75, '', 'landing', '', '', '2026-03-01 00:00:00+00'),
  -- Unknown and null types count as purchases and value, never as first/repeat.
  ('21000000-0000-0000-0000-000000000006', '11000000-0000-0000-0000-000000000001', 'purchase', 'ARS', '222', '', '',
   'unknown-type', extract(epoch from timestamptz '2026-09-20 00:00:00+00')::bigint, '', 'legacy', 30, '', 'landing', '', '', '2026-09-20 00:00:00+00'),
  ('21000000-0000-0000-0000-000000000007', '11000000-0000-0000-0000-000000000001', 'purchase', 'ARS', '222', '', '',
   'null-type', extract(epoch from timestamptz '2026-09-21 00:00:00+00')::bigint, '', null, 40, '', 'landing', '', '', '2026-09-21 00:00:00+00'),
  -- Duplicate event and transaction IDs are resolved defensively once.
  ('21000000-0000-0000-0000-000000000008', '11000000-0000-0000-0000-000000000001', 'purchase', 'ARS', '333', '', '',
   'duplicate-a', extract(epoch from timestamptz '2026-09-22 00:00:00+00')::bigint, 'legacy-duplicate-v2', 'first', 60, '', 'landing', '', '', '2026-09-22 00:00:00+00'),
  ('21000000-0000-0000-0000-000000000009', '11000000-0000-0000-0000-000000000001', 'purchase', 'ARS', '333', '', '',
   'duplicate-b', extract(epoch from timestamptz '2026-09-22 00:00:00+00')::bigint, 'legacy-duplicate-v2', 'first', 60, '', 'landing', '', '', '2026-09-22 01:00:00+00'),
  -- Atrio pair has priority over changing phones.
  ('21000000-0000-0000-0000-000000000010', '11000000-0000-0000-0000-000000000001', 'purchase', 'ARS', '444', '', '',
   'atrio-first-v2', extract(epoch from timestamptz '2026-09-01 00:00:00+00')::bigint, '', 'first', 10, '', 'whatsapp_cloud_api', 'atrio-v2', 'player-v2', '2026-09-01 00:00:00+00'),
  ('21000000-0000-0000-0000-000000000011', '11000000-0000-0000-0000-000000000001', 'purchase', 'ARS', '555', '', '',
   'atrio-repeat-v2', extract(epoch from timestamptz '2026-09-30 23:59:59+00')::bigint, '', 'repeat', 15, '', 'whatsapp_cloud_api', 'atrio-v2', 'player-v2', '2026-09-30 23:59:59+00'),
  -- Null event time falls back to created_at at the period boundary.
  ('21000000-0000-0000-0000-000000000012', '11000000-0000-0000-0000-000000000001', 'purchase', 'ARS', '', 'fallback-v2@example.com', '',
   'fallback-v2', null, '', 'first', 25, '', 'landing', '', '', '2026-09-01 00:00:00+00'),
  -- Excluded because its effective time is after as_of.
  ('21000000-0000-0000-0000-000000000013', '11000000-0000-0000-0000-000000000001', 'purchase', 'ARS', '', 'future@example.com', '',
   'future-v2', extract(epoch from timestamptz '2026-10-11 00:00:00+00')::bigint, '', 'first', 999, '', 'landing', '', '', '2026-09-01 00:00:00+00'),
  -- PYG and another tenant remain isolated.
  ('21000000-0000-0000-0000-000000000014', '11000000-0000-0000-0000-000000000001', 'purchase', 'PYG', '111', '', '',
   'pyg-v2', extract(epoch from timestamptz '2026-09-10 00:00:00+00')::bigint, '', 'first', 1000, '', 'landing', '', '', '2026-09-10 00:00:00+00'),
  ('21000000-0000-0000-0000-000000000015', '11000000-0000-0000-0000-000000000002', 'purchase', 'ARS', '999', '', '',
   'other-user-v2', extract(epoch from timestamptz '2026-09-10 00:00:00+00')::bigint, '', 'first', 9999, '', 'landing', '', '', '2026-09-10 00:00:00+00');

select has_function(
  'public',
  'get_meta_audience_buyers_v2',
  array['text', 'timestamp with time zone', 'timestamp with time zone', 'timestamp with time zone'],
  'creates the versioned buyer metrics RPC'
);

select has_function(
  'public',
  'get_meta_audience_buyers_v2_payload',
  array['text', 'timestamp with time zone', 'timestamp with time zone', 'timestamp with time zone'],
  'creates the single-row Data API transport RPC'
);

select throws_ok(
  $$ select * from public.get_meta_audience_buyers_v2('ARS', '2026-10-10', '2026-09-01', '2026-09-30') $$,
  'P0001', 'not authorized', 'rejects unauthenticated callers'
);

select ok(
  not has_function_privilege('anon', 'public.get_meta_audience_buyers_v2(text,timestamptz,timestamptz,timestamptz)', 'EXECUTE'),
  'anon cannot execute v2'
);

select ok(
  has_function_privilege('authenticated', 'public.get_meta_audience_buyers_v2(text,timestamptz,timestamptz,timestamptz)', 'EXECUTE'),
  'authenticated can execute v2'
);

select ok(
  not has_function_privilege('anon', 'public.get_meta_audience_buyers_v2_payload(text,timestamptz,timestamptz,timestamptz)', 'EXECUTE'),
  'anon cannot execute the transport RPC'
);

select ok(
  has_function_privilege('authenticated', 'public.get_meta_audience_buyers_v2_payload(text,timestamptz,timestamptz,timestamptz)', 'EXECUTE'),
  'authenticated can execute the transport RPC'
);

select set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000001', true);

select throws_ok(
  $$ select * from public.get_meta_audience_buyers_v2('USD', '2026-10-10', '2026-09-01', '2026-09-30') $$,
  'P0001', 'invalid currency', 'rejects unsupported currencies'
);

select throws_ok(
  $$ select * from public.get_meta_audience_buyers_v2('ARS', '2026-10-10', '2026-10-01', '2026-09-30') $$,
  'P0001', 'invalid period', 'rejects start after end'
);

select throws_ok(
  $$ select * from public.get_meta_audience_buyers_v2('ARS', '2026-09-15', '2026-09-01', '2026-09-30') $$,
  'P0001', 'invalid period', 'rejects period end after as_of'
);

create temporary table audience_v2 on commit drop as
select *
from public.get_meta_audience_buyers_v2(
  'ARS', '2026-10-10 00:00:00+00', '2026-09-01 00:00:00+00', '2026-09-30 23:59:59+00'
);

select is((select count(*) from audience_v2), 7::bigint, 'returns active and inactive historical ARS buyers');
select is((select count(*) from audience_v2 where period_purchase_count = 0), 1::bigint, 'keeps buyers inactive in the period');
select is((select historical_purchase_count from audience_v2 where customer_key = 'phone:111'), 3::bigint, 'counts historical purchases');
select is((select period_purchase_count from audience_v2 where customer_key = 'phone:111'), 1::bigint, 'counts period purchases independently');
select is((select historical_first_purchase_count from audience_v2 where customer_key = 'phone:111'), 1::bigint, 'counts explicit historical first loads');
select is((select historical_reload_count from audience_v2 where customer_key = 'phone:111'), 2::bigint, 'counts explicit historical reloads');
select is((select historical_total_value from audience_v2 where customer_key = 'phone:111'), 320::numeric, 'returns historical total value');
select is((select period_total_value from audience_v2 where customer_key = 'phone:111'), 200::numeric, 'returns period total value');
select is((select historical_first_purchase_value from audience_v2 where customer_key = 'phone:111'), 100::numeric, 'uses the oldest explicit first value');
select is((select historical_first_purchase_at from audience_v2 where customer_key = 'phone:111'), timestamptz '2026-01-05 00:00:00+00', 'uses the oldest explicit first timestamp');
select is((select days_since_last_purchase from audience_v2 where customer_key = 'phone:111'), 30::bigint, 'calculates full elapsed days from as_of');
select is((select period_reload_total_value from audience_v2 where customer_key = 'phone:111'), 200::numeric, 'returns reload value in the period');

select ok(
  (select historical_first_purchase_value is null and historical_first_purchase_at is null
   from audience_v2 where customer_key = 'email:no-first@example.com'),
  'repeat-only buyer has no historical first'
);

select ok(
  (select historical_first_purchase_count = 0 and historical_reload_count = 0 and historical_purchase_count = 2
   from audience_v2 where customer_key = 'phone:222'),
  'unknown purchase types are never reclassified'
);

select ok(
  (select period_average_purchase_value is null and period_max_purchase_value is null and period_total_value = 0
   from audience_v2 where customer_key = 'email:inactive@example.com'),
  'inactive period aggregates preserve null average and max'
);

select is((select count(*) from audience_v2 where customer_key = 'phone:333'), 1::bigint, 'deduplicates legacy transactions');
select is((select count(*) from audience_v2 where customer_key like 'atrio:%'), 1::bigint, 'keeps conservative Atrio identity priority');
select is((select period_first_purchase_total_value from audience_v2 where customer_key like 'atrio:%'), 10::numeric, 'returns period first-load total');
select is((select period_reload_total_value from audience_v2 where customer_key like 'atrio:%'), 15::numeric, 'returns period reload total');
select is((select count(*) from audience_v2 where email = 'fallback-v2@example.com'), 1::bigint, 'uses created_at when event time is null');
select is((select count(*) from audience_v2 where email = 'future@example.com'), 0::bigint, 'excludes effective purchases after as_of');

select is(
  (select count(*) from public.get_meta_audience_buyers_v2('PYG', '2026-10-10', '2026-09-01', '2026-09-30 23:59:59+00')),
  1::bigint,
  'keeps currencies separate'
);

select is(
  jsonb_array_length(public.get_meta_audience_buyers_v2_payload('ARS', '2026-10-10', '2026-09-01', '2026-09-30 23:59:59+00') -> 'rows'),
  7,
  'transport returns every buyer in one Data API row'
);

select set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000002', true);
select is(
  (select count(*) from public.get_meta_audience_buyers_v2('ARS', '2026-10-10', '2026-09-01', '2026-09-30 23:59:59+00')),
  1::bigint,
  'isolates authenticated users'
);

select * from finish();
rollback;
