create table if not exists public.ai_assistant_usage_monthly (
  user_id uuid not null references auth.users(id) on delete cascade,
  month_key date not null,
  requests_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, month_key)
);

alter table public.ai_assistant_usage_monthly enable row level security;

drop policy if exists ai_assistant_usage_monthly_select_own on public.ai_assistant_usage_monthly;
create policy ai_assistant_usage_monthly_select_own
  on public.ai_assistant_usage_monthly
  for select
  using (auth.uid() = user_id);

drop policy if exists ai_assistant_usage_monthly_insert_own on public.ai_assistant_usage_monthly;
create policy ai_assistant_usage_monthly_insert_own
  on public.ai_assistant_usage_monthly
  for insert
  with check (auth.uid() = user_id);

drop policy if exists ai_assistant_usage_monthly_update_own on public.ai_assistant_usage_monthly;
create policy ai_assistant_usage_monthly_update_own
  on public.ai_assistant_usage_monthly
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.consume_ai_assistant_quota(p_limit integer default 750)
returns table(allowed boolean, used integer, limit_count integer, remaining integer)
language plpgsql
security invoker
as $$
declare
  v_user uuid := auth.uid();
  v_month date := date_trunc('month', now())::date;
  v_used integer := 0;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  update public.ai_assistant_usage_monthly
     set requests_count = requests_count + 1,
         updated_at = now()
   where user_id = v_user
     and month_key = v_month
     and requests_count < p_limit
   returning requests_count into v_used;

  if found then
    return query
    select true, v_used, p_limit, greatest(0, p_limit - v_used);
    return;
  end if;

  begin
    insert into public.ai_assistant_usage_monthly (user_id, month_key, requests_count, updated_at)
    values (v_user, v_month, 1, now());
    return query
    select true, 1, p_limit, greatest(0, p_limit - 1);
    return;
  exception when unique_violation then
    null;
  end;

  select requests_count into v_used
    from public.ai_assistant_usage_monthly
   where user_id = v_user
     and month_key = v_month;

  return query
  select false, coalesce(v_used, 0), p_limit, greatest(0, p_limit - coalesce(v_used, 0));
end;
$$;

grant execute on function public.consume_ai_assistant_quota(integer) to authenticated;

