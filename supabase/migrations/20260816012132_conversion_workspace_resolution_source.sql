alter table public.conversions
  add column if not exists workspace_resolution_source text not null default 'legacy_default';

comment on column public.conversions.workspace_resolution_source is
  'Trazabilidad de como se resolvio el workspace/currency de la conversion: payload, event_gerencia, lineage, promo_tag, phone_prefix, landing, pixel_config o legacy_default.';

with unique_landing_tags as (
  select
    user_id,
    landing_tag,
    min(workspace_currency) as workspace_currency
  from public.landings
  where coalesce(landing_tag, '') <> ''
    and workspace_currency in ('ARS', 'PYG')
  group by user_id, landing_tag
  having count(distinct workspace_currency) = 1
)
update public.conversions c
set workspace_resolution_source = case
  when exists (
    select 1
    from public.landings l
    where l.user_id = c.user_id
      and l.id = c.landing_id
      and l.workspace_currency = c.currency
  ) then 'landing'
  when exists (
    select 1
    from public.gerencias g
    where g.user_id = c.user_id
      and g.workspace_currency = c.currency
      and g.id in (
        c.purchase_gerencia_id,
        c.lead_gerencia_id,
        c.registration_gerencia_id,
        c.assigned_gerencia_id
      )
  ) then 'event_gerencia'
  when exists (
    select 1
    from unique_landing_tags t
    where t.user_id = c.user_id
      and t.workspace_currency = c.currency
      and split_part(coalesce(c.promo_code, ''), '-', 1) = t.landing_tag
      and coalesce(c.promo_code, '') like '%-%'
  ) then 'promo_tag'
  when coalesce(c.phone, '') like '595%' and c.currency = 'PYG' then 'phone_prefix'
  when (coalesce(c.phone, '') like '549%' or coalesce(c.phone, '') like '54%')
    and c.currency = 'ARS' then 'phone_prefix'
  else 'legacy_default'
end
where c.workspace_resolution_source = 'legacy_default';
