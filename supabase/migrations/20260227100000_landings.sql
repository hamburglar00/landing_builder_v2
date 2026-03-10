-- Landings: cada cliente (user_id) tiene muchas landings.
-- Almacenamos todos los datos: nombre, comentario y config (JSONB) con el tema completo.

create table public.landings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null default 'Nueva landing',
  comment text not null default '',
  config jsonb not null default '{}',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.landings is 'Landings creadas por clientes; cada fila es una landing con su config de tema (plantilla fija).';
comment on column public.landings.config is 'JSON con LandingThemeConfig: template, backgroundMode, backgroundImages, rotateEveryHours, logoUrl, titleLine1/2/3, subtitleLine1/2/3, footerBadgeLine1/2/3, ctaText, tipografías (sizes/bold/fontFamily), colores (titleColor, subtitleColor, etc.) y layout (ctaPosition).';

create index landings_user_id_idx on public.landings (user_id);
create index landings_updated_at_idx on public.landings (updated_at desc);

alter table public.landings enable row level security;

-- El dueño puede hacer todo en sus propias landings
create policy "Users manage own landings"
on public.landings
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Los admins pueden leer todas las landings (soporte/listado)
create policy "Admins can read all landings"
on public.landings
for select
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  )
);

-- Trigger para actualizar updated_at
create or replace function public.set_landings_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create trigger landings_updated_at
before update on public.landings
for each row
execute function public.set_landings_updated_at();
