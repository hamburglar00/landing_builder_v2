-- Trigger: cuando se actualiza pixel_id en conversions_config,
-- sincroniza el valor a todas las landings del usuario.

create or replace function public.sync_pixel_to_landings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.pixel_id is distinct from old.pixel_id then
    update public.landings
    set pixel_id = new.pixel_id
    where user_id = new.user_id;
  end if;
  return new;
end;
$$;

create trigger on_conversions_config_pixel_change
after update on public.conversions_config
for each row
execute function public.sync_pixel_to_landings();

comment on function public.sync_pixel_to_landings is 'Sincroniza pixel_id de conversions_config a todas las landings del usuario.';
