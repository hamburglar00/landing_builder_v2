create table if not exists public.conversion_view_preferences (
  hidden_by uuid primary key references auth.users(id) on delete cascade,
  visible_from timestamptz null,
  updated_at timestamptz not null default now()
);

alter table public.conversion_view_preferences enable row level security;

create policy "Users manage own conversion_view_preferences"
  on public.conversion_view_preferences
  for all
  using (auth.uid() = hidden_by)
  with check (auth.uid() = hidden_by);

comment on table public.conversion_view_preferences is
  'Preferencias persistentes para limitar el historial visible de Conversiones sin borrar datos.';

comment on column public.conversion_view_preferences.visible_from is
  'La UI de Conversiones consulta registros creados desde este instante.';
