-- Persist the origin used to resolve a Purchase pixel independently from
-- Contact/Lead/Purchase event ids. Event ids remain unique per event.

alter table public.conversions
  add column if not exists pixel_attribution_source text not null default '',
  add column if not exists pixel_attribution_conversion_id uuid null
    references public.conversions(id) on delete set null;

create index if not exists idx_conversions_pixel_attribution_conversion
  on public.conversions(pixel_attribution_conversion_id)
  where pixel_attribution_conversion_id is not null;

comment on column public.conversions.pixel_attribution_source is
  'Trusted source used to resolve pixel_id for Purchase delivery.';

comment on column public.conversions.pixel_attribution_conversion_id is
  'Root conversion that supplied the trusted Purchase pixel, when applicable.';

-- Existing rows with a direct Contact context are trusted attribution roots.
update public.conversions c
set
  pixel_attribution_source = case
    when lower(coalesce(c.source_platform, '')) = 'chatrace' then 'chatrace_context'
    when coalesce(c.contact_payload_raw, '') <> '' then 'contact_context'
    else 'stored_attribution'
  end,
  pixel_attribution_conversion_id = c.id
where coalesce(c.pixel_attribution_source, '') = ''
  and c.estado = 'purchase'
  and coalesce(nullif(c.pixel_id, ''), nullif(c.meta_pixel_id, '')) is not null
  and (
    coalesce(c.contact_event_id, '') <> ''
    or coalesce(c.contact_payload_raw, '') <> ''
    or lower(coalesce(c.source_platform, '')) = 'chatrace'
  )
  and exists (
    select 1
    from public.conversions_pixel_configs pc
    where pc.user_id = c.user_id
      and pc.pixel_id = coalesce(nullif(c.pixel_id, ''), nullif(c.meta_pixel_id, ''))
  );

-- First choice for historical Purchase rows: the trusted Contact/root row with
-- the exact same full promo_code.
with trusted_promo_roots as (
  select distinct on (candidate.user_id, candidate.promo_code)
    candidate.user_id,
    candidate.promo_code,
    candidate.id as source_conversion_id,
    coalesce(
      nullif(candidate.pixel_id, ''),
      nullif(candidate.meta_pixel_id, '')
    ) as resolved_pixel_id
  from public.conversions candidate
  join public.conversions_pixel_configs pc
    on pc.user_id = candidate.user_id
   and pc.pixel_id = coalesce(
     nullif(candidate.pixel_id, ''),
     nullif(candidate.meta_pixel_id, '')
   )
  where coalesce(candidate.promo_code, '') <> ''
    and coalesce(
      nullif(candidate.pixel_id, ''),
      nullif(candidate.meta_pixel_id, '')
    ) is not null
    and (
      coalesce(candidate.contact_event_id, '') <> ''
      or coalesce(candidate.contact_payload_raw, '') <> ''
      or coalesce(candidate.pixel_attribution_source, '') <> ''
      or lower(coalesce(candidate.source_platform, '')) = 'chatrace'
    )
  order by
    candidate.user_id,
    candidate.promo_code,
    case when coalesce(candidate.contact_payload_raw, '') <> '' then 0 else 1 end,
    case when coalesce(candidate.contact_event_id, '') <> '' then 0 else 1 end,
    candidate.created_at asc
),
exact_promo_attribution as (
  select
    target.id as target_id,
    root.source_conversion_id,
    root.resolved_pixel_id
  from public.conversions target
  join trusted_promo_roots root
    on root.user_id = target.user_id
   and root.promo_code = target.promo_code
  where target.estado = 'purchase'
    and coalesce(target.pixel_attribution_source, '') = ''
    and (
      (
        coalesce(target.pixel_id, '') = ''
        and coalesce(target.meta_pixel_id, '') = ''
      )
      or coalesce(
        nullif(target.pixel_id, ''),
        nullif(target.meta_pixel_id, '')
      ) = root.resolved_pixel_id
    )
)
update public.conversions target
set
  pixel_id = attribution.resolved_pixel_id,
  meta_pixel_id = attribution.resolved_pixel_id,
  pixel_attribution_source = 'promo_root',
  pixel_attribution_conversion_id = attribution.source_conversion_id
from exact_promo_attribution attribution
where target.id = attribution.target_id;

-- Second choice: an explicit landing_id that still maps to a configured pixel.
with landing_id_attribution as (
  select
    c.id as target_id,
    l.pixel_id
  from public.conversions c
  join public.landings l
    on l.id = c.landing_id
   and l.user_id = c.user_id
  join public.conversions_pixel_configs pc
    on pc.user_id = c.user_id
   and pc.pixel_id = l.pixel_id
  where c.estado = 'purchase'
    and coalesce(c.pixel_attribution_source, '') = ''
    and (
      (
        coalesce(c.pixel_id, '') = ''
        and coalesce(c.meta_pixel_id, '') = ''
      )
      or coalesce(nullif(c.pixel_id, ''), nullif(c.meta_pixel_id, '')) = l.pixel_id
    )
    and coalesce(l.pixel_id, '') <> ''
)
update public.conversions target
set
  pixel_id = attribution.pixel_id,
  meta_pixel_id = attribution.pixel_id,
  pixel_attribution_source = 'landing_id',
  pixel_attribution_conversion_id = null
from landing_id_attribution attribution
where target.id = attribution.target_id;

-- Final deterministic historical choice: a case-insensitive landing_tag
-- prefix that resolves to exactly one configured pixel for the client.
with landing_tag_candidates as (
  select
    c.id as target_id,
    min(l.pixel_id) as pixel_id,
    count(distinct l.pixel_id) as distinct_pixel_count
  from public.conversions c
  join public.landings l
    on l.user_id = c.user_id
   and lower(l.landing_tag) = lower(split_part(c.promo_code, '-', 1))
  join public.conversions_pixel_configs pc
    on pc.user_id = c.user_id
   and pc.pixel_id = l.pixel_id
  where c.estado = 'purchase'
    and coalesce(c.pixel_attribution_source, '') = ''
    and position('-' in coalesce(c.promo_code, '')) > 1
    and coalesce(l.pixel_id, '') <> ''
  group by c.id
  having count(distinct l.pixel_id) = 1
)
update public.conversions target
set
  pixel_id = attribution.pixel_id,
  meta_pixel_id = attribution.pixel_id,
  pixel_attribution_source = 'landing_tag',
  pixel_attribution_conversion_id = null
from landing_tag_candidates attribution
where target.id = attribution.target_id
  and (
    (
      coalesce(target.pixel_id, '') = ''
      and coalesce(target.meta_pixel_id, '') = ''
    )
    or coalesce(
      nullif(target.pixel_id, ''),
      nullif(target.meta_pixel_id, '')
    ) = attribution.pixel_id
  );
