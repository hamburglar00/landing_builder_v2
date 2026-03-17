-- Tablas para ocultar registros de forma persistente (no borrar de BD).
-- hidden_conversions: oculta conversiones específicas (tabla).
-- hidden_contacts: oculta contactos del funnel por (user_id, phone).

create table public.hidden_conversions (
  conversion_id uuid not null references public.conversions (id) on delete cascade,
  hidden_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (conversion_id, hidden_by)
);

create table public.hidden_contacts (
  user_id uuid not null references auth.users (id) on delete cascade,
  phone text not null,
  hidden_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, phone, hidden_by)
);

alter table public.hidden_conversions enable row level security;
alter table public.hidden_contacts enable row level security;

-- Solo el usuario que ocultó puede ver/insertar/borrar sus propias entradas
create policy "Users manage own hidden_conversions"
  on public.hidden_conversions for all
  using (auth.uid() = hidden_by)
  with check (auth.uid() = hidden_by);

create policy "Users manage own hidden_contacts"
  on public.hidden_contacts for all
  using (auth.uid() = hidden_by)
  with check (auth.uid() = hidden_by);

create index idx_hidden_conversions_hidden_by on public.hidden_conversions (hidden_by);
create index idx_hidden_contacts_hidden_by on public.hidden_contacts (hidden_by);

comment on table public.hidden_conversions is 'Conversiones ocultas por el usuario en la vista (persistente, no borra de BD).';
comment on table public.hidden_contacts is 'Contactos del funnel ocultos por el usuario (por user_id + phone).';
