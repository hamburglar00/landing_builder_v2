-- show_atrio is the single client capability for templates 7, 8 and 9.
-- Keep owner/admin/subscription policies and existing published landings intact.
-- Historical template flags are retained for compatibility, but grant no access.
drop policy "Template 7 permission on landing insert" on public.landings;
drop policy "Template 7 permission on landing update" on public.landings;
drop policy "Template 8 permission on landing insert" on public.landings;
drop policy "Template 8 permission on landing update" on public.landings;
drop policy "Template 9 permission on landing insert" on public.landings;
drop policy "Template 9 permission on landing update" on public.landings;

create policy "Atrio channel permission on landing insert" on public.landings
as restrictive for insert to authenticated with check (
 (coalesce(config->>'template','') not in('template7','template8','template9')
  and coalesce(landing_config#>>'{layout,template}','') not in('7','8','9')
  and coalesce(config->>'ctaDestination','')<>'atrio')
 or exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin')
 or exists(select 1 from public.client_module_permissions permission where permission.user_id=landings.user_id and permission.show_atrio)
);
create policy "Atrio channel permission on landing update" on public.landings
as restrictive for update to authenticated using(true) with check (
 (coalesce(config->>'template','') not in('template7','template8','template9')
  and coalesce(landing_config#>>'{layout,template}','') not in('7','8','9')
  and coalesce(config->>'ctaDestination','')<>'atrio')
 or exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin')
 or exists(select 1 from public.client_module_permissions permission where permission.user_id=landings.user_id and permission.show_atrio)
);
notify pgrst,'reload schema';
