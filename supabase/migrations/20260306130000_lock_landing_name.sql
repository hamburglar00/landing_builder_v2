-- Evita que el nombre de la landing cambie una vez fijado.
-- Regla: mientras el nombre sea del tipo "Nueva-landing-xxxx" se puede cambiar.
-- Una vez que deja de empezar por "Nueva-landing-", queda inmutable a nivel DB.

create or replace function public.prevent_landing_name_change()
returns trigger
language plpgsql
as $$
begin
  -- Si el nombre no cambia, no hacemos nada.
  if new.name is not distinct from old.name then
    return new;
  end if;

  -- Permitimos cambios solo mientras el nombre anterior sea un placeholder.
  if old.name like 'Nueva-landing-%' then
    return new;
  end if;

  -- En cualquier otro caso, bloqueamos el cambio.
  raise exception 'Landing name is immutable once set'
    using errcode = 'P0001';
end;
$$;

drop trigger if exists prevent_landing_name_change on public.landings;

create trigger prevent_landing_name_change
before update on public.landings
for each row
execute function public.prevent_landing_name_change();

