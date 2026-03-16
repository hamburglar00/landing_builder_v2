-- Tabla de logs para conversiones (reemplaza la hoja "Logs" del Apps Script)

create table public.conversion_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  conversion_id uuid references public.conversions (id) on delete set null,
  function_name text not null default '',
  level text not null default 'INFO',
  message text not null default '',
  detail text not null default '',
  created_at timestamptz not null default now()
);

alter table public.conversion_logs enable row level security;

create policy "users_read_own_logs"
  on public.conversion_logs for select
  using (user_id = auth.uid());

create policy "admins_read_all_logs"
  on public.conversion_logs for select
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create index idx_conversion_logs_user_id on public.conversion_logs (user_id);
create index idx_conversion_logs_created_at on public.conversion_logs (created_at desc);

comment on table public.conversion_logs is 'Logs de procesamiento de conversiones (reemplaza hoja Logs del Apps Script).';
