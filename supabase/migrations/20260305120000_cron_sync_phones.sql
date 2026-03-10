-- Cron: cada 5 minutos invoca la Edge Function sync-phones en modo "todas las gerencias".
-- Requiere: plan Pro (pg_cron) y extensión pg_net.
--
-- Tras aplicar la migración y desplegar las Edge Functions, ejecutá UNA VEZ la función
-- bootstrap-cron-config para escribir la URL del proyecto (ver README en supabase/migrations).
-- El secret del cron se genera aquí y se guarda en cron_config; no hace falta configurar CRON_SECRET.
--

-- Extensiones (pg_cron puede no estar disponible en plan Free)
-- Extensiones (ignorar error si ya existen o hay restricciones de privilegios)
do $$
begin
  execute 'create extension if not exists pg_cron';
exception when others then null;
end $$;
do $$
begin
  execute 'create extension if not exists pg_net';
exception when others then null;
end $$;
do $$
begin
  execute 'create extension if not exists pgcrypto';
exception when others then null;
end $$;

-- Privilegios para cron (ignorar si ya existen o el rol no aplica)
do $$
begin
  execute 'grant usage on schema cron to postgres';
exception when others then null;
end $$;
do $$
begin
  execute 'grant all privileges on all tables in schema cron to postgres';
exception when others then null;
end $$;

-- Configuración para el job (URL de la Edge Function y secret)
create table if not exists public.cron_config (
  key text primary key,
  value text not null
);

comment on table public.cron_config is
  'Configuración para jobs de cron (ej: URL de sync-phones y secret).';

-- URL placeholder: la Edge Function bootstrap-cron-config la reemplazará con la URL real del proyecto.
insert into public.cron_config (key, value) values
  ('sync_phones_url', 'https://REPLACE_WITH_YOUR_PROJECT_REF.supabase.co/functions/v1/sync-phones')
on conflict (key) do nothing;

-- Secret generado aquí; sync-phones lo valida leyendo esta tabla (no hace falta CRON_SECRET en env).
insert into public.cron_config (key, value) values
  ('sync_phones_cron_secret', encode(extensions.gen_random_bytes(32), 'hex'))
on conflict (key) do update set value = excluded.value;

-- Función que llama a sync-phones con cron_secret (sincroniza todas las gerencias)
create or replace function public.cron_sync_phones_all()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  u text;
  s text;
begin
  select value into u from public.cron_config where key = 'sync_phones_url';
  select value into s from public.cron_config where key = 'sync_phones_cron_secret';

  if u is null or s is null then
    raise notice 'cron_sync_phones_all: missing config (sync_phones_url or sync_phones_cron_secret).';
    return;
  end if;

  if u like '%REPLACE_%' or s = 'REPLACE_WITH_STRONG_SECRET' then
    raise notice 'cron_sync_phones_all: replace placeholder URL/secret in cron_config.';
    return;
  end if;

  perform net.http_post(
    url := u,
    body := jsonb_build_object('cron_secret', s),
    headers := '{"Content-Type": "application/json"}'::jsonb,
    timeout_milliseconds := 60000
  );
end;
$$;

comment on function public.cron_sync_phones_all() is
  'Invoca la Edge Function sync-phones en modo cron (todas las gerencias). Usado por pg_cron cada 5 min.';

-- Job: cada 5 minutos (quitar antes por si se reaplica la migración)
do $$
begin
  perform cron.unschedule('sync-phones-every-5min');
exception when others then
  null;
end $$;

select cron.schedule(
  'sync-phones-every-5min',
  '*/5 * * * *',
  $$select public.cron_sync_phones_all()$$
);
