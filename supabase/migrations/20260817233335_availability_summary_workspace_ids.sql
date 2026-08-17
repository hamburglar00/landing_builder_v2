drop function if exists public.get_gerencia_availability_summaries(uuid, timestamptz, timestamptz);

create or replace function public.get_gerencia_availability_summaries(
  p_user_id uuid default null,
  p_start timestamptz default null,
  p_end timestamptz default null,
  p_workspace_currency text default null
)
returns table (
  gerencia_id integer,
  gerencia_external_id integer,
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
  v_workspace_currency text := upper(nullif(trim(coalesce(p_workspace_currency, '')), ''));
begin
  if v_auth_uid is null then
    raise exception 'not authorized';
  end if;

  if p_user_id is null or v_auth_uid <> p_user_id then
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
    d.gerencia_id,
    d.gerencia_external_id,
    d.gerencia_label as label,
    count(*)::integer as sample_count,
    count(*) filter (where d.had_active_phone)::integer as active_sample_count,
    case
      when count(*) > 0 then
        (count(*) filter (where d.had_active_phone)::numeric / count(*)::numeric) * 100
      else null
    end as availability_pct
  from public.landing_phone_availability_demands d
  join public.gerencias g on g.id = d.gerencia_id
  where (p_user_id is null or d.user_id = p_user_id)
    and (p_start is null or d.checked_at >= p_start)
    and (p_end is null or d.checked_at <= p_end)
    and (
      v_workspace_currency is null
      or v_workspace_currency not in ('ARS', 'PYG')
      or upper(coalesce(g.workspace_currency, 'ARS')) = v_workspace_currency
    )
  group by d.gerencia_id, d.gerencia_external_id, d.gerencia_label
  order by 3 asc;
end;
$$;

grant execute on function public.get_gerencia_availability_summaries(uuid, timestamptz, timestamptz, text) to authenticated;
