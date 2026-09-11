create or replace function private.is_valid_meta_audience_rules(p_rules jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_rules is null or jsonb_typeof(p_rules) <> 'array' or jsonb_array_length(p_rules) > 20 then
    return false;
  end if;

  return not exists (
      select 1
      from jsonb_array_elements(p_rules) as item(rule)
      where jsonb_typeof(rule) <> 'object'
        or not (rule ? 'id' and rule ? 'metric' and rule ? 'operator' and rule ? 'value')
        or exists (
          select 1 from jsonb_object_keys(rule) as keys(key)
          where key not in ('id', 'metric', 'operator', 'value', 'value2')
        )
        or length(btrim(rule ->> 'id')) not between 1 and 100
        or rule ->> 'metric' not in (
          'historical_purchase_count', 'historical_first_purchase_count', 'historical_reload_count',
          'period_purchase_count', 'period_first_purchase_count', 'period_reload_count',
          'historical_total_value', 'historical_average_purchase_value', 'historical_max_purchase_value',
          'historical_first_purchase_value', 'period_total_value', 'period_first_purchase_total_value',
          'period_reload_total_value', 'period_average_purchase_value', 'period_max_purchase_value',
          'days_since_last_purchase'
        )
        or rule ->> 'operator' not in ('gt', 'gte', 'lt', 'lte', 'eq', 'between', 'top_percent')
        or jsonb_typeof(rule -> 'value') <> 'number'
        or (rule ->> 'value')::numeric < 0
        or (
          rule ->> 'operator' = 'between'
          and (
            not rule ? 'value2'
            or jsonb_typeof(rule -> 'value2') <> 'number'
            or (rule ->> 'value2')::numeric < (rule ->> 'value')::numeric
          )
        )
        or (rule ->> 'operator' <> 'between' and rule ? 'value2')
        or (
          rule ->> 'operator' = 'top_percent'
          and (
            (rule ->> 'value')::numeric not in (50, 25, 10, 5, 1)
            or rule ->> 'metric' not in (
              'historical_purchase_count', 'period_purchase_count',
              'historical_total_value', 'historical_average_purchase_value', 'historical_max_purchase_value',
              'historical_first_purchase_value', 'period_total_value', 'period_first_purchase_total_value',
              'period_reload_total_value', 'period_average_purchase_value', 'period_max_purchase_value'
            )
          )
        )
    )
    and (
      select count(*) = count(distinct rule ->> 'id')
      from jsonb_array_elements(p_rules) as item(rule)
    );
exception when others then
  return false;
end;
$$;

revoke all on function private.is_valid_meta_audience_rules(jsonb) from public, anon, authenticated;

create or replace function private.is_valid_meta_audience_fields(p_fields text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select
    cardinality(p_fields) between 1 and 8
    and p_fields <@ array['email', 'phone', 'fn', 'ln', 'ct', 'st', 'zip', 'country']::text[]
    and cardinality(p_fields) = (select count(distinct field) from unnest(p_fields) as field)
    and ('email' = any(p_fields) or 'phone' = any(p_fields));
$$;

revoke all on function private.is_valid_meta_audience_fields(text[]) from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.is_valid_meta_audience_rules(jsonb) to authenticated;
grant execute on function private.is_valid_meta_audience_fields(text[]) to authenticated;

create table public.meta_audience_configs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 120),
  currency text not null check (currency in ('ARS', 'PYG')),
  audience_type text not null check (audience_type in ('segmented', 'value_based')),
  period_kind text not null check (period_kind in ('relative', 'custom')),
  relative_days integer,
  custom_start_date date,
  custom_end_date date,
  period_timezone text not null check (period_timezone = 'America/Argentina/Buenos_Aires'),
  purchase_scope text not null check (purchase_scope in ('all', 'first', 'repeat', 'none')),
  rules jsonb not null default '[]'::jsonb check (private.is_valid_meta_audience_rules(rules)),
  summary_value_metric text not null check (summary_value_metric in (
    'historical_first_purchase_value', 'historical_total_value', 'period_total_value',
    'period_first_purchase_total_value', 'period_reload_total_value'
  )),
  export_value_metric text not null check (export_value_metric in (
    'historical_first_purchase_value', 'historical_total_value', 'period_total_value',
    'period_first_purchase_total_value', 'period_reload_total_value'
  )),
  selected_fields text[] not null check (private.is_valid_meta_audience_fields(selected_fields)),
  source_preset_id text check (source_preset_id is null or source_preset_id ~ '^[a-z0-9_]{1,80}$'),
  source_preset_version integer,
  config_version integer not null default 1 check (config_version = 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meta_audience_configs_period_check check (
    (period_kind = 'relative' and relative_days between 1 and 3650 and custom_start_date is null and custom_end_date is null)
    or
    (period_kind = 'custom' and relative_days is null and custom_start_date is not null and custom_end_date is not null and custom_start_date <= custom_end_date)
  ),
  constraint meta_audience_configs_preset_check check (
    (source_preset_id is null and source_preset_version is null)
    or (source_preset_id is not null and source_preset_version >= 1)
  )
);

create unique index meta_audience_configs_user_currency_name_uidx
  on public.meta_audience_configs (user_id, currency, lower(name));

create index meta_audience_configs_user_currency_updated_idx
  on public.meta_audience_configs (user_id, currency, updated_at desc);

create or replace function private.set_meta_audience_config_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.name := regexp_replace(btrim(new.name), '[[:space:]]+', ' ', 'g');
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.set_meta_audience_config_updated_at() from public, anon, authenticated;

create trigger meta_audience_configs_normalize
before insert or update on public.meta_audience_configs
for each row execute function private.set_meta_audience_config_updated_at();

alter table public.meta_audience_configs enable row level security;

create policy "Users select own meta audience configs"
on public.meta_audience_configs for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users insert own meta audience configs"
on public.meta_audience_configs for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users update own meta audience configs"
on public.meta_audience_configs for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users delete own meta audience configs"
on public.meta_audience_configs for delete
to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.meta_audience_configs from anon;
revoke all on table public.meta_audience_configs from authenticated;
grant select, insert, update, delete on table public.meta_audience_configs to authenticated;

comment on table public.meta_audience_configs is
  'Saved Meta audience definitions. Buyer rows, generated results, and CSV files are never persisted here.';
