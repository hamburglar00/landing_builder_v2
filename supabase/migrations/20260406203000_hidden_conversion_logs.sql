-- Persist hidden logs per user so "Limpiar vista" in Logs survives refresh.

create table if not exists public.hidden_conversion_logs (
  log_id bigint not null references public.conversion_logs (id) on delete cascade,
  hidden_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (log_id, hidden_by)
);

alter table public.hidden_conversion_logs enable row level security;

drop policy if exists "Users manage own hidden_conversion_logs" on public.hidden_conversion_logs;
create policy "Users manage own hidden_conversion_logs"
  on public.hidden_conversion_logs
  for all
  using (auth.uid() = hidden_by)
  with check (auth.uid() = hidden_by);

create index if not exists idx_hidden_conversion_logs_hidden_by
  on public.hidden_conversion_logs (hidden_by);

