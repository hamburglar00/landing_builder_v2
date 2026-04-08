-- Evita que el landing_tag cambie una vez fijado.
-- Regla: si old.landing_tag está vacío/null, se puede establecer.
-- Una vez establecido, queda inmutable a nivel DB.

create or replace function public.prevent_landing_tag_change()
returns trigger
language plpgsql
as $$
begin
  -- Si no cambia, continuar.
  if new.landing_tag is not distinct from old.landing_tag then
    return new;
  end if;

  -- Si antes estaba vacío, permitir seteo inicial.
  if coalesce(old.landing_tag, '') = '' then
    return new;
  end if;

  -- En cualquier otro caso, bloquear cambio.
  raise exception 'Landing tag is immutable once set'
    using errcode = 'P0001';
end;
$$;

drop trigger if exists prevent_landing_tag_change on public.landings;

create trigger prevent_landing_tag_change
before update on public.landings
for each row
execute function public.prevent_landing_tag_change();

