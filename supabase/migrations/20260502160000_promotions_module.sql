-- Promotions module: independent giveaway landing + passive email enrichment.

create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '',
  slug text not null,
  message text not null default '',
  prize text not null default '',
  draw_at timestamptz not null,
  status text not null default 'active' check (status in ('active', 'closed')),
  winner_participant_id uuid null,
  winner_username text not null default '',
  winner_selected_at timestamptz null,
  winner_notified_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (slug)
);

create index if not exists idx_promotions_user_created
  on public.promotions (user_id, created_at desc);

create index if not exists idx_promotions_slug_active
  on public.promotions (slug)
  where status = 'active';

create table if not exists public.promotion_participants (
  id uuid primary key default gen_random_uuid(),
  promotion_id uuid not null references public.promotions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  username text not null default '',
  phone text not null default '',
  email text not null default '',
  visitor_token text not null default '',
  matched_conversion_count integer not null default 0,
  matched_conversion_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (promotion_id, phone),
  unique (promotion_id, email),
  unique (promotion_id, visitor_token)
);

alter table public.promotions
  add constraint promotions_winner_participant_fk
  foreign key (winner_participant_id)
  references public.promotion_participants(id)
  on delete set null;

create index if not exists idx_promotion_participants_promotion_created
  on public.promotion_participants (promotion_id, created_at desc);

create index if not exists idx_promotion_participants_user_phone
  on public.promotion_participants (user_id, phone)
  where phone <> '';

alter table public.promotions enable row level security;
alter table public.promotion_participants enable row level security;

drop policy if exists "Users can read own promotions" on public.promotions;
create policy "Users can read own promotions"
  on public.promotions for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own promotions" on public.promotions;
create policy "Users can insert own promotions"
  on public.promotions for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own promotions" on public.promotions;
create policy "Users can update own promotions"
  on public.promotions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own promotions" on public.promotions;
create policy "Users can delete own promotions"
  on public.promotions for delete
  using (auth.uid() = user_id);

drop policy if exists "Admins can read all promotions" on public.promotions;
create policy "Admins can read all promotions"
  on public.promotions for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists "Admins can update all promotions" on public.promotions;
create policy "Admins can update all promotions"
  on public.promotions for update
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists "Public can read active promotions" on public.promotions;
create policy "Public can read active promotions"
  on public.promotions for select
  using (status = 'active');

drop policy if exists "Users can read own promotion participants" on public.promotion_participants;
create policy "Users can read own promotion participants"
  on public.promotion_participants for select
  using (auth.uid() = user_id);

drop policy if exists "Admins can read all promotion participants" on public.promotion_participants;
create policy "Admins can read all promotion participants"
  on public.promotion_participants for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

create or replace function public.set_promotions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_promotions_updated_at on public.promotions;
create trigger trg_promotions_updated_at
before update on public.promotions
for each row
execute function public.set_promotions_updated_at();

comment on table public.promotions is 'Promociones/sorteos publicos independientes del flujo de conversiones.';
comment on table public.promotion_participants is 'Participantes de promociones. Se usan para captar email y enriquecer conversiones pasivamente por telefono.';
