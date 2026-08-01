alter table public.conversions
  add column if not exists lead_bot_phone text not null default '',
  add column if not exists lead_agency_id text not null default '',
  add column if not exists lead_gerencia_id integer,
  add column if not exists lead_gerencia_external_id integer,
  add column if not exists lead_gerencia_name text not null default '',
  add column if not exists lead_gerencia_label text not null default '',
  add column if not exists lead_incoming_promo_code text not null default '',
  add column if not exists lead_attribution_status text not null default '',
  add column if not exists lead_attribution_conversion_id uuid references public.conversions(id) on delete set null,
  add column if not exists purchase_bot_phone text not null default '',
  add column if not exists purchase_agency_id text not null default '',
  add column if not exists purchase_gerencia_id integer,
  add column if not exists purchase_gerencia_external_id integer,
  add column if not exists purchase_gerencia_name text not null default '',
  add column if not exists purchase_gerencia_label text not null default '',
  add column if not exists purchase_incoming_promo_code text not null default '',
  add column if not exists purchase_attribution_status text not null default '',
  add column if not exists purchase_attribution_conversion_id uuid references public.conversions(id) on delete set null;

comment on column public.conversions.lead_bot_phone is
  'Telefono exacto del bot que recibio el Lead, tomado del payload LEAD.';
comment on column public.conversions.lead_agency_id is
  'agency_id crudo recibido con el Lead. Normalmente identifica la gerencia externa del bot.';
comment on column public.conversions.lead_gerencia_id is
  'ID interno resuelto de la gerencia que realmente recibio el Lead.';
comment on column public.conversions.lead_incoming_promo_code is
  'promo_code recibido con el Lead, incluso si se descarta para atribucion por conflicto de gerencia.';
comment on column public.conversions.lead_attribution_conversion_id is
  'Fila confiable usada como linaje para atribuir el Lead, sin alterar el origen asignado por la landing.';
comment on column public.conversions.purchase_bot_phone is
  'Telefono exacto del bot que recibio el Purchase, tomado del payload PURCHASE.';
comment on column public.conversions.purchase_agency_id is
  'agency_id crudo recibido con el Purchase. Normalmente identifica la gerencia externa del bot.';
comment on column public.conversions.purchase_gerencia_id is
  'ID interno resuelto de la gerencia que realmente recibio el Purchase.';
comment on column public.conversions.purchase_incoming_promo_code is
  'promo_code recibido con el Purchase, incluso si se descarta para atribucion por conflicto de gerencia.';
comment on column public.conversions.purchase_attribution_conversion_id is
  'Fila confiable usada como linaje para atribuir el Purchase y heredar parametros Meta.';

create index if not exists conversions_user_phone_lead_gerencia_idx
  on public.conversions (user_id, phone, lead_gerencia_id, created_at desc)
  where lead_event_id <> '';

create index if not exists conversions_user_phone_purchase_gerencia_idx
  on public.conversions (user_id, phone, purchase_gerencia_id, created_at desc)
  where purchase_event_id <> '';

create or replace function pg_temp.try_parse_conversion_payload(value text)
returns jsonb
language plpgsql
as $$
begin
  if nullif(trim(coalesce(value, '')), '') is null then
    return '{}'::jsonb;
  end if;
  return value::jsonb;
exception when others then
  return '{}'::jsonb;
end;
$$;

with payloads as (
  select
    id,
    pg_temp.try_parse_conversion_payload(lead_payload_raw) as lead_payload,
    pg_temp.try_parse_conversion_payload(purchase_payload_raw) as purchase_payload
  from public.conversions
  where coalesce(lead_payload_raw, '') <> ''
     or coalesce(purchase_payload_raw, '') <> ''
)
update public.conversions c
set
  lead_bot_phone = regexp_replace(coalesce(p.lead_payload ->> 'bot_phone', ''), '\D', '', 'g'),
  lead_agency_id = trim(coalesce(p.lead_payload ->> 'agency_id', '')),
  lead_incoming_promo_code = coalesce(
    nullif(trim(coalesce(p.lead_payload ->> 'promo_code', p.lead_payload ->> 'promoCode', '')), ''),
    c.promo_code,
    ''
  ),
  purchase_bot_phone = regexp_replace(coalesce(p.purchase_payload ->> 'bot_phone', ''), '\D', '', 'g'),
  purchase_agency_id = trim(coalesce(p.purchase_payload ->> 'agency_id', '')),
  purchase_incoming_promo_code = coalesce(
    nullif(trim(coalesce(p.purchase_payload ->> 'promo_code', p.purchase_payload ->> 'promoCode', '')), ''),
    c.promo_code,
    ''
  )
from payloads p
where c.id = p.id;

with candidates as (
  select
    c.id as conversion_id,
    g.id as gerencia_internal_id,
    g.gerencia_id as gerencia_external_id,
    coalesce(nullif(trim(g.nombre), ''), format('Gerencia %s', coalesce(g.gerencia_id, g.id))) as gerencia_name,
    row_number() over (
      partition by c.id
      order by g.id
    ) as rn
  from public.conversions c
  join public.gerencias g
    on g.user_id = c.user_id
   and g.gerencia_id::text = c.lead_agency_id
  where c.lead_event_id <> '' and c.lead_agency_id <> ''
)
update public.conversions c
set
  lead_gerencia_id = x.gerencia_internal_id,
  lead_gerencia_external_id = coalesce(x.gerencia_external_id, x.gerencia_internal_id),
  lead_gerencia_name = x.gerencia_name,
  lead_gerencia_label = format('%s (ID %s)', x.gerencia_name, coalesce(x.gerencia_external_id, x.gerencia_internal_id)),
  lead_attribution_status = 'historical_agency_id'
from candidates x
where c.id = x.conversion_id and x.rn = 1;

with candidates as (
  select
    c.id as conversion_id,
    g.id as gerencia_internal_id,
    g.gerencia_id as gerencia_external_id,
    coalesce(nullif(trim(g.nombre), ''), format('Gerencia %s', coalesce(g.gerencia_id, g.id))) as gerencia_name,
    row_number() over (
      partition by c.id
      order by g.id
    ) as rn
  from public.conversions c
  join public.gerencias g
    on g.user_id = c.user_id
   and g.gerencia_id::text = c.purchase_agency_id
  where c.purchase_event_id <> '' and c.purchase_agency_id <> ''
)
update public.conversions c
set
  purchase_gerencia_id = x.gerencia_internal_id,
  purchase_gerencia_external_id = coalesce(x.gerencia_external_id, x.gerencia_internal_id),
  purchase_gerencia_name = x.gerencia_name,
  purchase_gerencia_label = format('%s (ID %s)', x.gerencia_name, coalesce(x.gerencia_external_id, x.gerencia_internal_id)),
  purchase_attribution_status = 'historical_agency_id'
from candidates x
where c.id = x.conversion_id and x.rn = 1;

with unique_phone_matches as (
  select
    c.id as conversion_id,
    min(g.id) as gerencia_internal_id,
    min(g.gerencia_id) as gerencia_external_id,
    min(coalesce(nullif(trim(g.nombre), ''), format('Gerencia %s', coalesce(g.gerencia_id, g.id)))) as gerencia_name
  from public.conversions c
  join public.gerencia_phones gp
    on regexp_replace(coalesce(gp.phone, ''), '\D', '', 'g') = c.lead_bot_phone
  join public.gerencias g on g.id = gp.gerencia_id and g.user_id = c.user_id
  where c.lead_event_id <> '' and c.lead_gerencia_id is null and c.lead_bot_phone <> ''
  group by c.id
  having count(distinct g.id) = 1
)
update public.conversions c
set
  lead_gerencia_id = x.gerencia_internal_id,
  lead_gerencia_external_id = coalesce(x.gerencia_external_id, x.gerencia_internal_id),
  lead_gerencia_name = x.gerencia_name,
  lead_gerencia_label = format('%s (ID %s)', x.gerencia_name, coalesce(x.gerencia_external_id, x.gerencia_internal_id)),
  lead_attribution_status = 'historical_unique_bot_phone'
from unique_phone_matches x
where c.id = x.conversion_id;

with unique_phone_matches as (
  select
    c.id as conversion_id,
    min(g.id) as gerencia_internal_id,
    min(g.gerencia_id) as gerencia_external_id,
    min(coalesce(nullif(trim(g.nombre), ''), format('Gerencia %s', coalesce(g.gerencia_id, g.id)))) as gerencia_name
  from public.conversions c
  join public.gerencia_phones gp
    on regexp_replace(coalesce(gp.phone, ''), '\D', '', 'g') = c.purchase_bot_phone
  join public.gerencias g on g.id = gp.gerencia_id and g.user_id = c.user_id
  where c.purchase_event_id <> '' and c.purchase_gerencia_id is null and c.purchase_bot_phone <> ''
  group by c.id
  having count(distinct g.id) = 1
)
update public.conversions c
set
  purchase_gerencia_id = x.gerencia_internal_id,
  purchase_gerencia_external_id = coalesce(x.gerencia_external_id, x.gerencia_internal_id),
  purchase_gerencia_name = x.gerencia_name,
  purchase_gerencia_label = format('%s (ID %s)', x.gerencia_name, coalesce(x.gerencia_external_id, x.gerencia_internal_id)),
  purchase_attribution_status = 'historical_unique_bot_phone'
from unique_phone_matches x
where c.id = x.conversion_id;

update public.conversions
set lead_attribution_status = 'historical_unresolved'
where lead_event_id <> '' and lead_attribution_status = '';

update public.conversions
set purchase_attribution_status = 'historical_unresolved'
where purchase_event_id <> '' and purchase_attribution_status = '';

update public.conversions_config
set visible_columns = (
  select array_agg(column_name order by first_position)
  from (
    select column_name, min(position) as first_position
    from unnest(
      coalesce(visible_columns, array[]::text[]) || array[
        'lead_bot_phone',
        'lead_agency_id',
        'lead_gerencia_label',
        'lead_incoming_promo_code',
        'lead_attribution_status',
        'lead_attribution_conversion_id',
        'purchase_bot_phone',
        'purchase_agency_id',
        'purchase_gerencia_label',
        'purchase_incoming_promo_code',
        'purchase_attribution_status',
        'purchase_attribution_conversion_id'
      ]
    ) with ordinality as expanded(column_name, position)
    group by column_name
  ) deduplicated
)
where not coalesce(visible_columns, array[]::text[]) @> array[
  'lead_bot_phone',
  'lead_agency_id',
  'lead_gerencia_label',
  'lead_incoming_promo_code',
  'lead_attribution_status',
  'lead_attribution_conversion_id',
  'purchase_bot_phone',
  'purchase_agency_id',
  'purchase_gerencia_label',
  'purchase_incoming_promo_code',
  'purchase_attribution_status',
  'purchase_attribution_conversion_id'
];
