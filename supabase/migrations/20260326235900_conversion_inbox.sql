create table if not exists public.conversion_inbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversion_id uuid null references public.conversions(id) on delete set null,
  landing_name text not null default '',
  action text not null default 'CONTACT',
  promo_code text not null default '',
  phone text not null default '',
  payload_raw text not null default '',
  status text not null default 'received' check (status in ('received', 'processed', 'error')),
  http_status integer null,
  response_body text not null default '',
  processed_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists conversion_inbox_user_created_idx
  on public.conversion_inbox (user_id, created_at desc);

create index if not exists conversion_inbox_status_created_idx
  on public.conversion_inbox (status, created_at desc);

alter table public.conversion_inbox enable row level security;

drop policy if exists "conversion_inbox_select_own" on public.conversion_inbox;
create policy "conversion_inbox_select_own"
on public.conversion_inbox
for select
to authenticated
using (auth.uid() = user_id);

