-- Template 6 CTA taps. No visitor identity or commercial conversion data is stored.
alter table public.landings
  add column card_analytics_reset_at timestamptz;

create table public.landing_card_clicks (
  landing_id uuid not null references public.landings(id) on delete cascade,
  event_id uuid not null,
  card_index smallint not null check (card_index between 1 and 6),
  clicked_at timestamptz not null default clock_timestamp(),
  primary key (landing_id, event_id)
);

create index landing_card_clicks_landing_time_idx
  on public.landing_card_clicks (landing_id, clicked_at)
  include (card_index);

alter table public.landing_card_clicks enable row level security;

-- The landings SELECT policy already scopes rows to their owner or an admin.
create policy "Landing owners and admins read card clicks"
  on public.landing_card_clicks for select to authenticated
  using (exists (
    select 1 from public.landings l where l.id = landing_card_clicks.landing_id
  ));

revoke all on public.landing_card_clicks from anon, authenticated;
grant select on public.landing_card_clicks to authenticated;
grant select, insert on public.landing_card_clicks to service_role;

-- Invoked only by the Edge Function with service_role. A row lock makes reset
-- and recording linearizable; a repeated event_id never increases the count.
create function public.record_template6_card_click(
  p_landing_id uuid,
  p_card_index integer,
  p_event_id uuid
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_config jsonb;
  v_card_count integer;
begin
  if p_landing_id is null or p_card_index is null or p_event_id is null then
    return false;
  end if;

  select l.config into v_config
  from public.landings l
  where l.id = p_landing_id
  for share;

  if not found or v_config->>'template' is distinct from 'template6' then
    return false;
  end if;

  v_card_count := case v_config->'template6Cover'->>'grid'
    when '2x1' then 2
    when '2x3' then 6
    else 4
  end;
  if p_card_index < 1 or p_card_index > v_card_count then
    return false;
  end if;

  insert into public.landing_card_clicks (landing_id, card_index, event_id)
  values (p_landing_id, p_card_index, p_event_id)
  on conflict (landing_id, event_id) do nothing;

  return true;
end;
$$;

revoke all on function public.record_template6_card_click(uuid, integer, uuid) from public, anon, authenticated;
grant execute on function public.record_template6_card_click(uuid, integer, uuid) to service_role;

-- Inclusive calendar dates in Buenos Aires, with counts computed in SQL.
create function public.get_template6_card_analytics(
  p_landing_id uuid,
  p_from date,
  p_to date
)
returns table (card_index integer, clicks bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select c.card_index::integer, count(*)::bigint
  from public.landings l
  join public.landing_card_clicks c on c.landing_id = l.id
  where l.id = p_landing_id
    and l.config->>'template' = 'template6'
    and p_from is not null
    and p_to is not null
    and p_from <= p_to
    and c.clicked_at >= greatest(
      p_from::timestamp at time zone 'America/Argentina/Buenos_Aires',
      coalesce(l.card_analytics_reset_at, '-infinity'::timestamptz)
    )
    and c.clicked_at < (p_to + 1)::timestamp at time zone 'America/Argentina/Buenos_Aires'
  group by c.card_index
  order by c.card_index;
$$;

revoke all on function public.get_template6_card_analytics(uuid, date, date) from public, anon;
grant execute on function public.get_template6_card_analytics(uuid, date, date) to authenticated;

create function public.reset_template6_card_analytics(p_landing_id uuid)
returns timestamptz
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_reset_at timestamptz;
begin
  update public.landings l
  set card_analytics_reset_at = clock_timestamp()
  where l.id = p_landing_id
    and l.config->>'template' = 'template6'
  returning l.card_analytics_reset_at into v_reset_at;

  if not found then
    raise exception 'Landing no disponible para reiniciar las analíticas';
  end if;
  return v_reset_at;
end;
$$;

revoke all on function public.reset_template6_card_analytics(uuid) from public, anon;
grant execute on function public.reset_template6_card_analytics(uuid) to authenticated;
