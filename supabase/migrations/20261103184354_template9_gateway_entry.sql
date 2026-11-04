-- Template 9 is a visual alternative to the same single-platform T7 entry.
-- Keep existing T7/T8 limits, ownership, subscription guards and grants intact.
do $$
declare target regprocedure; definition text; revised text;
begin
  target := 'public.resolve_template7_start_context(uuid,text,uuid,text,text,text,text,text)'::regprocedure;
  definition := pg_get_functiondef(target);
  revised := replace(definition,
    'v_landing.config ->> ''template'' = ''template7''',
    'v_landing.config ->> ''template'' in (''template7'',''template9'')');
  revised := replace(revised,
    'v_landing.landing_config #>> ''{layout,template}'' = ''7''',
    'v_landing.landing_config #>> ''{layout,template}'' in (''7'',''9'')');
  if revised = definition or position('''template9''' in revised) = 0 then
    raise exception 'Unexpected Template 7 start context definition';
  end if;
  execute revised;

  target := 'public.resolve_template7_destination_context(uuid,text)'::regprocedure;
  definition := pg_get_functiondef(target);
  revised := replace(definition, 'not in (''template7'',''template8'')', 'not in (''template7'',''template8'',''template9'')');
  if revised = definition then raise exception 'Unexpected destination context definition'; end if;
  execute revised;

  target := 'public.record_entry_funnel_events(uuid,uuid,integer,jsonb)'::regprocedure;
  definition := pg_get_functiondef(target);
  revised := replace(definition, 'p_template not in (7,8)', 'p_template not in (7,8,9)');
  if revised = definition then raise exception 'Unexpected entry funnel definition'; end if;
  execute revised;
end;
$$;

alter table public.entry_funnel_events drop constraint entry_funnel_events_template_check;
alter table public.entry_funnel_events add constraint entry_funnel_events_template_check check (template in (7,8,9));

-- Reuse the existing administrator-controlled single-platform entry capability.
-- No new permission defaults, existing landings or client settings are rewritten.
create policy "Template 9 permission on landing insert"
on public.landings as restrictive for insert to authenticated
with check (
  (coalesce(config ->> 'template','') <> 'template9'
    and coalesce(landing_config #>> '{layout,template}','') <> '9')
  or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
  or exists (select 1 from public.client_template_permissions permission
    where permission.user_id = landings.user_id and permission.template7_enabled)
);
create policy "Template 9 permission on landing update"
on public.landings as restrictive for update to authenticated using (true)
with check (
  (coalesce(config ->> 'template','') <> 'template9'
    and coalesce(landing_config #>> '{layout,template}','') <> '9')
  or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin')
  or exists (select 1 from public.client_template_permissions permission
    where permission.user_id = landings.user_id and permission.template7_enabled)
);
