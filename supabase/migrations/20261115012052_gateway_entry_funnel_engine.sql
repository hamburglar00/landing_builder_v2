-- Diagnostic provenance only. Preserve the currently installed collector,
-- ownership checks, strict field allowlist, rate limits, grants and RLS.
alter table public.entry_funnel_events drop constraint entry_funnel_events_engine_check;
alter table public.entry_funnel_events add constraint entry_funnel_events_engine_check
  check(engine in ('classic','constructor','nexobet','gateway'));
do $$
declare
  definition text := pg_get_functiondef('public.record_entry_funnel_events(uuid,uuid,integer,jsonb)'::regprocedure);
  old_enum constant text := $needle$v_event->>'engine' not in ('classic','constructor','nexobet')$needle$;
begin
  if (length(definition)-length(replace(definition,old_enum,'')))/length(old_enum) <> 1 then
    raise exception 'Unexpected collector engine validation; review migration';
  end if;
  execute replace(definition,old_enum,$replacement$v_event->>'engine' not in ('classic','constructor','nexobet','gateway')$replacement$);
end $$;
