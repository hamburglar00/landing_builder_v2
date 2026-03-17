-- Backfill post_url for existing landings to use the conversions endpoint.
-- Each landing's post_url is set to: {SUPABASE_URL}/functions/v1/conversions?name={profiles.nombre}
-- Only updates landings that don't already have the correct conversions URL pattern.
-- The base URL below must match your Supabase project. Adjust if using a different project.

do $$
declare
  base_url text := 'https://fdkjkzpjqfbaavylapun.supabase.co';
begin
  update public.landings l
  set post_url = base_url || '/functions/v1/conversions?name=' || coalesce(p.nombre, '')
  from public.profiles p
  where l.user_id = p.id
    and coalesce(p.nombre, '') != ''
    and (
      l.post_url is null
      or l.post_url = ''
      or l.post_url not like base_url || '/functions/v1/conversions?name=%'
    );
end $$;
