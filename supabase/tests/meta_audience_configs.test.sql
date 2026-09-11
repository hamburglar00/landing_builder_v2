begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(35);

insert into auth.users (id, raw_app_meta_data)
values
  ('12000000-0000-0000-0000-000000000001', '{"panelbot_admin_created": true}'::jsonb),
  ('12000000-0000-0000-0000-000000000002', '{"panelbot_admin_created": true}'::jsonb);

select has_table('public', 'meta_audience_configs', 'creates saved audience config table');
select col_is_pk('public', 'meta_audience_configs', 'id', 'id is the primary key');
select fk_ok('public', 'meta_audience_configs', 'user_id', 'auth', 'users', 'id', 'user ownership references auth.users');
select ok((select relrowsecurity from pg_class where oid = 'public.meta_audience_configs'::regclass), 'RLS is enabled');
select ok(not has_table_privilege('anon', 'public.meta_audience_configs', 'SELECT'), 'anon lacks SELECT grant');
select ok(not has_table_privilege('anon', 'public.meta_audience_configs', 'INSERT'), 'anon lacks INSERT grant');
select ok(not has_table_privilege('anon', 'public.meta_audience_configs', 'UPDATE'), 'anon lacks UPDATE grant');
select ok(not has_table_privilege('anon', 'public.meta_audience_configs', 'DELETE'), 'anon lacks DELETE grant');
select ok(has_table_privilege('authenticated', 'public.meta_audience_configs', 'SELECT'), 'authenticated has SELECT grant');
select ok(has_table_privilege('authenticated', 'public.meta_audience_configs', 'INSERT'), 'authenticated has INSERT grant');
select ok(has_table_privilege('authenticated', 'public.meta_audience_configs', 'UPDATE'), 'authenticated has UPDATE grant');
select ok(has_table_privilege('authenticated', 'public.meta_audience_configs', 'DELETE'), 'authenticated has DELETE grant');

set local role authenticated;
set local request.jwt.claim.sub = '12000000-0000-0000-0000-000000000001';

select results_eq(
  $$insert into public.meta_audience_configs (
      user_id, name, currency, audience_type, period_kind, relative_days, period_timezone,
      purchase_scope, rules, summary_value_metric, export_value_metric, selected_fields,
      source_preset_id, source_preset_version, config_version
    ) values (
      '12000000-0000-0000-0000-000000000001', 'VIP ARS últimos 90 días', 'ARS', 'segmented',
      'relative', 90, 'America/Argentina/Buenos_Aires', 'all',
      '[{"id":"vip-value","metric":"period_total_value","operator":"top_percent","value":10},{"id":"vip-count","metric":"period_purchase_count","operator":"gte","value":3}]'::jsonb,
      'period_total_value', 'period_total_value', array['email','phone','fn','ln','country'],
      'vip_90d', 1, 1
    ) returning name$$,
  array['VIP ARS últimos 90 días'::text],
  'owner creates a valid config'
);

select results_eq(
  $$select name from public.meta_audience_configs$$,
  array['VIP ARS últimos 90 días'::text],
  'owner reads own config'
);

select throws_ok(
  $$insert into public.meta_audience_configs (
      user_id, name, currency, audience_type, period_kind, relative_days, period_timezone,
      purchase_scope, rules, summary_value_metric, export_value_metric, selected_fields
    ) select user_id, '  vip   ars ÚLTIMOS 90 DÍAS  ', currency, audience_type, period_kind, relative_days,
      period_timezone, purchase_scope, rules, summary_value_metric, export_value_metric, selected_fields
      from public.meta_audience_configs limit 1$$,
  '23505', null, 'normalized name is unique per owner and currency'
);

select results_eq(
  $$update public.meta_audience_configs set name = 'VIP ARS 90D' returning name$$,
  array['VIP ARS 90D'::text],
  'owner renames own config'
);

select ok(
  (select updated_at >= created_at from public.meta_audience_configs),
  'updated_at is maintained automatically'
);

select results_eq(
  $$insert into public.meta_audience_configs (
      user_id, name, currency, audience_type, period_kind, custom_start_date, custom_end_date,
      period_timezone, purchase_scope, rules, summary_value_metric, export_value_metric, selected_fields
    ) select user_id, 'Copia personalizada', currency, audience_type, 'custom', date '2026-01-01', date '2026-02-01',
      period_timezone, 'none', '[]'::jsonb, summary_value_metric, export_value_metric, selected_fields
      from public.meta_audience_configs limit 1 returning name$$,
  array['Copia personalizada'::text],
  'owner duplicates into an independent row'
);

select throws_ok(
  $$insert into public.meta_audience_configs (
      user_id, name, currency, audience_type, period_kind, relative_days, period_timezone,
      purchase_scope, rules, summary_value_metric, export_value_metric, selected_fields
    ) select user_id, 'Moneda inválida', 'USD', audience_type, period_kind, relative_days,
      period_timezone, purchase_scope, rules, summary_value_metric, export_value_metric, selected_fields
      from public.meta_audience_configs limit 1$$,
  '23514', null, 'rejects unsupported currency'
);

select throws_ok(
  $$insert into public.meta_audience_configs (
      user_id, name, currency, audience_type, period_kind, relative_days, period_timezone,
      purchase_scope, rules, summary_value_metric, export_value_metric, selected_fields
    ) select user_id, 'Regla desconocida', currency, audience_type, period_kind, relative_days,
      period_timezone, purchase_scope, '[{"id":"x","metric":"period_total_value","operator":"gte","value":1,"extra":true}]'::jsonb,
      summary_value_metric, export_value_metric, selected_fields from public.meta_audience_configs limit 1$$,
  '23514', null, 'rejects unknown rule fields'
);

select throws_ok(
  $$insert into public.meta_audience_configs (
      user_id, name, currency, audience_type, period_kind, relative_days, period_timezone,
      purchase_scope, rules, summary_value_metric, export_value_metric, selected_fields
    ) select user_id, 'Top inválido', currency, audience_type, period_kind, relative_days,
      period_timezone, purchase_scope, '[{"id":"x","metric":"historical_reload_count","operator":"top_percent","value":10}]'::jsonb,
      summary_value_metric, export_value_metric, selected_fields from public.meta_audience_configs limit 1$$,
  '23514', null, 'rejects top percent for unsupported metric'
);

select throws_ok(
  $$insert into public.meta_audience_configs (
      user_id, name, currency, audience_type, period_kind, relative_days, period_timezone,
      purchase_scope, rules, summary_value_metric, export_value_metric, selected_fields
    ) select user_id, 'Between inválido', currency, audience_type, period_kind, relative_days,
      period_timezone, purchase_scope, '[{"id":"x","metric":"period_total_value","operator":"between","value":10,"value2":5}]'::jsonb,
      summary_value_metric, export_value_metric, selected_fields from public.meta_audience_configs limit 1$$,
  '23514', null, 'rejects invalid between range'
);

select throws_ok(
  $$insert into public.meta_audience_configs (
      user_id, name, currency, audience_type, period_kind, relative_days, period_timezone,
      purchase_scope, rules, summary_value_metric, export_value_metric, selected_fields
    ) select user_id, 'IDs repetidos', currency, audience_type, period_kind, relative_days,
      period_timezone, purchase_scope, '[{"id":"x","metric":"period_total_value","operator":"gte","value":1},{"id":"x","metric":"period_total_value","operator":"gte","value":2}]'::jsonb,
      summary_value_metric, export_value_metric, selected_fields from public.meta_audience_configs limit 1$$,
  '23514', null, 'rejects duplicate rule IDs'
);

select throws_ok(
  $$insert into public.meta_audience_configs (
      user_id, name, currency, audience_type, period_kind, relative_days, period_timezone,
      purchase_scope, rules, summary_value_metric, export_value_metric, selected_fields
    ) select user_id, 'Sin identificador', currency, audience_type, period_kind, relative_days,
      period_timezone, purchase_scope, rules, summary_value_metric, export_value_metric, array['fn','ln']
      from public.meta_audience_configs limit 1$$,
  '23514', null, 'requires phone or email'
);

select throws_ok(
  $$insert into public.meta_audience_configs (
      user_id, name, currency, audience_type, period_kind, relative_days, period_timezone,
      purchase_scope, rules, summary_value_metric, export_value_metric, selected_fields
    ) select user_id, 'Campos repetidos', currency, audience_type, period_kind, relative_days,
      period_timezone, purchase_scope, rules, summary_value_metric, export_value_metric, array['email','email']
      from public.meta_audience_configs limit 1$$,
  '23514', null, 'rejects duplicate selected fields'
);

select throws_ok(
  $$insert into public.meta_audience_configs (
      user_id, name, currency, audience_type, period_kind, relative_days, period_timezone,
      purchase_scope, rules, summary_value_metric, export_value_metric, selected_fields, config_version
    ) select user_id, 'Versión inválida', currency, audience_type, period_kind, relative_days,
      period_timezone, purchase_scope, rules, summary_value_metric, export_value_metric, selected_fields, 2
      from public.meta_audience_configs limit 1$$,
  '23514', null, 'rejects invalid config version'
);

set local request.jwt.claim.sub = '12000000-0000-0000-0000-000000000002';

select is_empty($$select * from public.meta_audience_configs$$, 'another user reads no configs');
select is_empty($$update public.meta_audience_configs set name = 'Robada' returning id$$, 'another user updates no configs');
select is_empty($$delete from public.meta_audience_configs returning id$$, 'another user deletes no configs');

select throws_ok(
  $$insert into public.meta_audience_configs (
      user_id, name, currency, audience_type, period_kind, relative_days, period_timezone,
      purchase_scope, rules, summary_value_metric, export_value_metric, selected_fields
    ) values (
      '12000000-0000-0000-0000-000000000001', 'Ajena', 'ARS', 'segmented', 'relative', 30,
      'America/Argentina/Buenos_Aires', 'none', '[]'::jsonb, 'historical_total_value',
      'historical_total_value', array['email']
    )$$,
  '42501', null, 'another user cannot create for owner'
);

set local role anon;
select throws_ok($$select * from public.meta_audience_configs$$, '42501', null, 'anon cannot select');
select throws_ok($$delete from public.meta_audience_configs$$, '42501', null, 'anon cannot delete');

set local role authenticated;
set local request.jwt.claim.sub = '12000000-0000-0000-0000-000000000001';
select is((select count(*) from public.meta_audience_configs), 2::bigint, 'denied writes left owner rows intact');
select results_eq(
  $$delete from public.meta_audience_configs where name = 'Copia personalizada' returning name$$,
  array['Copia personalizada'::text],
  'owner deletes a config'
);
select is((select count(*) from public.meta_audience_configs), 1::bigint, 'one owner config remains');

select * from finish();
rollback;
