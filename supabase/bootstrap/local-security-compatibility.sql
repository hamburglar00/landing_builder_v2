-- LOCAL/CI ONLY. Applied by the isolated runner after all 268 historical migrations.
-- Exact remote definition, verified against Supabase's official RLS event-trigger pattern.
DO $$ BEGIN
 IF current_setting('phase0.local_compatibility',true) IS DISTINCT FROM 'runner-owned-isolated-database'
 OR inet_server_addr() IS NOT NULL OR current_setting('cron.launch_active_jobs',true) <> 'off' THEN
   RAISE EXCEPTION 'Local compatibility gate not satisfied';
 END IF;
END $$;
CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$
;
ALTER FUNCTION public.rls_auto_enable() OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.rls_auto_enable() TO PUBLIC, postgres, anon, authenticated, service_role;
CREATE EVENT TRIGGER ensure_rls ON ddl_command_end
 WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
 EXECUTE FUNCTION public.rls_auto_enable();
ALTER EVENT TRIGGER ensure_rls OWNER TO postgres;
ALTER EVENT TRIGGER ensure_rls ENABLE;
ALTER TABLE public.ar_name_inferred_sex ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ar_name_inferred_sex NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.ar_phone_area_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ar_phone_area_codes NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.cron_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cron_config NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.tracking_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracking_queue NO FORCE ROW LEVEL SECURITY;
-- Existing policies (none) and grants already match the reviewed remote catalog.
-- They are asserted by the runner, not silently replaced with invented access rules.
