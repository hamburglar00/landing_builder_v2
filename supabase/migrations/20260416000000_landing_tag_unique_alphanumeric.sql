-- landing_tag debe ser único (excluyendo vacíos) y solo alfanumérico.

-- Constraint: solo letras y números, o vacío (para landings sin tag aún).
alter table public.landings
add constraint landings_landing_tag_alphanumeric
check (landing_tag ~ '^[a-zA-Z0-9]*$');

-- Índice único parcial: solo aplica cuando landing_tag no está vacío.
create unique index if not exists landings_landing_tag_unique
on public.landings (landing_tag)
where landing_tag <> '';
