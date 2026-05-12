-- Persist hidden inbox events per user so "Limpiar vista" also affects Inbox without deleting source data.

create table if not exists public.hidden_conversion_inbox (
  inbox_id uuid not null references public.conversion_inbox (id) on delete cascade,
  hidden_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (inbox_id, hidden_by)
);

alter table public.hidden_conversion_inbox enable row level security;

drop policy if exists "Users manage own hidden_conversion_inbox" on public.hidden_conversion_inbox;
create policy "Users manage own hidden_conversion_inbox"
  on public.hidden_conversion_inbox
  for all
  using (auth.uid() = hidden_by)
  with check (auth.uid() = hidden_by);

create index if not exists idx_hidden_conversion_inbox_hidden_by
  on public.hidden_conversion_inbox (hidden_by);
