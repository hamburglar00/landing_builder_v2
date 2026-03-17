-- Fuerza post_url al endpoint de conversiones para TODAS las landings.
-- Sobrescribe cualquier URL obsoleta (ej. Google Sheet) que pueda haber quedado.
-- Idempotente: ejecutar no causa problemas.

do $$
declare
  base_url text := 'https://fdkjkzpjqfbaavylapun.supabase.co';
begin
  update public.landings l
  set post_url = base_url || '/functions/v1/conversions?name=' || coalesce(p.nombre, '')
  from public.profiles p
  where l.user_id = p.id
    and coalesce(p.nombre, '') != '';
end $$;
