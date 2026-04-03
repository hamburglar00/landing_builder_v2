create table if not exists public.client_subscriptions (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  plan_code text not null default 'starter' check (plan_code in ('starter','plus','pro','premium','scale')),
  max_landings int not null default 2 check (max_landings >= 1),
  max_phones int not null default 5 check (max_phones >= 1),
  status text not null default 'active' check (status in ('active','paused','expired')),
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  grace_days int not null default 5 check (grace_days >= 0 and grace_days <= 30),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.client_subscriptions enable row level security;

drop policy if exists "Users can read own client_subscriptions" on public.client_subscriptions;
create policy "Users can read own client_subscriptions"
on public.client_subscriptions
for select
using (auth.uid() = user_id);

drop policy if exists "Admins can read all client_subscriptions" on public.client_subscriptions;
create policy "Admins can read all client_subscriptions"
on public.client_subscriptions
for select
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  )
);

drop policy if exists "Admins can insert client_subscriptions" on public.client_subscriptions;
create policy "Admins can insert client_subscriptions"
on public.client_subscriptions
for insert
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  )
);

drop policy if exists "Admins can update client_subscriptions" on public.client_subscriptions;
create policy "Admins can update client_subscriptions"
on public.client_subscriptions
for update
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  )
)
with check (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  )
);

create or replace function public.set_client_subscriptions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_client_subscriptions_updated_at on public.client_subscriptions;
create trigger trg_client_subscriptions_updated_at
before update on public.client_subscriptions
for each row
execute function public.set_client_subscriptions_updated_at();

create or replace function public.get_client_plan_limits(p_user_id uuid)
returns table (
  plan_code text,
  max_landings int,
  max_phones int,
  status text,
  expires_at timestamptz,
  grace_days int
)
language sql
stable
as $$
  select
    cs.plan_code,
    cs.max_landings,
    cs.max_phones,
    cs.status,
    cs.expires_at,
    cs.grace_days
  from public.client_subscriptions cs
  where cs.user_id = p_user_id
$$;

create or replace function public.is_client_access_blocked(p_user_id uuid)
returns boolean
language plpgsql
stable
as $$
declare
  v_status text;
  v_expires_at timestamptz;
  v_grace_days int;
begin
  select cs.status, cs.expires_at, cs.grace_days
    into v_status, v_expires_at, v_grace_days
  from public.client_subscriptions cs
  where cs.user_id = p_user_id;

  if not found then
    return false;
  end if;

  if v_status in ('paused', 'expired') then
    return true;
  end if;

  if v_expires_at is null then
    return false;
  end if;

  return now() > (v_expires_at + make_interval(days => coalesce(v_grace_days, 5)));
end;
$$;

create or replace function public.enforce_landing_plan_limit()
returns trigger
language plpgsql
as $$
declare
  v_role text;
  v_max_landings int;
  v_current_count int;
begin
  select p.role into v_role
  from public.profiles p
  where p.id = new.user_id;

  if v_role = 'admin' then
    return new;
  end if;

  select cs.max_landings
    into v_max_landings
  from public.client_subscriptions cs
  where cs.user_id = new.user_id;

  if v_max_landings is null then
    return new;
  end if;

  select count(*)
    into v_current_count
  from public.landings l
  where l.user_id = new.user_id;

  if v_current_count >= v_max_landings then
    raise exception 'PLAN_LIMIT_LANDINGS';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_landing_plan_limit on public.landings;
create trigger trg_enforce_landing_plan_limit
before insert on public.landings
for each row
execute function public.enforce_landing_plan_limit();

-- Backfill para clientes existentes (si no tienen suscripción).
insert into public.client_subscriptions (
  user_id,
  plan_code,
  max_landings,
  max_phones,
  status,
  starts_at,
  expires_at,
  grace_days
)
select
  p.id,
  'starter',
  2,
  5,
  'active',
  now(),
  now() + interval '30 days',
  5
from public.profiles p
where p.role = 'client'
  and not exists (
    select 1
    from public.client_subscriptions cs
    where cs.user_id = p.id
  );
