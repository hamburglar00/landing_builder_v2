create or replace function public.get_gerencia_availability_summaries(
  p_user_id uuid default null,
  p_start timestamptz default null,
  p_end timestamptz default null
)
returns table (
  label text,
  sample_count integer,
  active_sample_count integer,
  availability_pct numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_uid uuid := auth.uid();
  v_is_admin boolean := false;
begin
  if p_user_id is null then
    select exists (
      select 1
      from public.profiles p
      where p.id = v_auth_uid
        and p.role = 'admin'
    )
    into v_is_admin;

    if not v_is_admin then
      raise exception 'not authorized';
    end if;
  elsif v_auth_uid is not null and v_auth_uid <> p_user_id then
    select exists (
      select 1
      from public.profiles p
      where p.id = v_auth_uid
        and p.role = 'admin'
    )
    into v_is_admin;

    if not v_is_admin then
      raise exception 'not authorized';
    end if;
  end if;

  return query
  select
    format(
      '%s (ID %s)',
      coalesce(nullif(trim(g.nombre), ''), format('Gerencia %s', coalesce(g.gerencia_id, g.id))),
      coalesce(g.gerencia_id, g.id)
    ) as label,
    count(*)::integer as sample_count,
    count(*) filter (where s.active_phone_count > 0)::integer as active_sample_count,
    case
      when count(*) > 0 then
        (count(*) filter (where s.active_phone_count > 0)::numeric / count(*)::numeric) * 100
      else null
    end as availability_pct
  from public.gerencia_phone_availability_snapshots s
  join public.gerencias g on g.id = s.gerencia_id
  where coalesce(s.assigned_landing_count, 0) > 0
    and (p_user_id is null or s.user_id = p_user_id)
    and (p_start is null or s.checked_at >= p_start)
    and (p_end is null or s.checked_at <= p_end)
  group by
    coalesce(nullif(trim(g.nombre), ''), format('Gerencia %s', coalesce(g.gerencia_id, g.id))),
    coalesce(g.gerencia_id, g.id)
  order by 1 asc;
end;
$$;

grant execute on function public.get_gerencia_availability_summaries(uuid, timestamptz, timestamptz) to authenticated;

create index if not exists gerencia_phone_availability_assigned_checked_idx
  on public.gerencia_phone_availability_snapshots (checked_at desc)
  where assigned_landing_count > 0;
