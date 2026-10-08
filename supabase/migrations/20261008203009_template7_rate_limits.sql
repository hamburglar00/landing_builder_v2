-- Buckets durables para los endpoints de identidad del Template 7.
-- Solo el backend con service_role puede consumirlos.
create table if not exists public.template7_rate_limit_buckets (
  bucket_key text primary key check (bucket_key ~ '^[0-9a-f]{64}$'),
  hits integer not null check (hits > 0),
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create index if not exists template7_rate_limit_buckets_expires_at_idx
  on public.template7_rate_limit_buckets (expires_at);

alter table public.template7_rate_limit_buckets enable row level security;
revoke all on public.template7_rate_limit_buckets from public, anon, authenticated;
grant select, insert, update, delete on public.template7_rate_limit_buckets to service_role;

create or replace function public.consume_template7_rate_limit(
  p_bucket_key text,
  p_max_hits integer,
  p_window_seconds integer
) returns boolean
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_hits integer;
  v_now timestamptz := clock_timestamp();
begin
  if p_bucket_key !~ '^[0-9a-f]{64}$'
     or p_max_hits < 1 or p_max_hits > 1000
     or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'invalid rate limit arguments';
  end if;

  insert into public.template7_rate_limit_buckets as b
    (bucket_key, hits, expires_at, updated_at)
  values (p_bucket_key, 1, v_now + make_interval(secs => p_window_seconds), v_now)
  on conflict (bucket_key) do update set
    hits = case when b.expires_at <= v_now then 1 else b.hits + 1 end,
    expires_at = case when b.expires_at <= v_now
      then v_now + make_interval(secs => p_window_seconds) else b.expires_at end,
    updated_at = v_now
  returning hits into v_hits;

  -- Limpieza oportunista y acotada: evita crecimiento indefinido sin depender
  -- de un cron productivo. El índice de expires_at sirve a esta consulta.
  if random() < 0.01 then
    delete from public.template7_rate_limit_buckets
    where bucket_key in (
      select bucket_key from public.template7_rate_limit_buckets
      where expires_at < v_now - interval '1 day'
      order by expires_at
      limit 100
    );
  end if;

  return v_hits <= p_max_hits;
end;
$$;

revoke all on function public.consume_template7_rate_limit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_template7_rate_limit(text, integer, integer)
  to service_role;
