-- Existing classifications remain untouched until API2 sends explicit usage metadata.
ALTER TABLE public.gerencia_phones
  ADD COLUMN pbadmin_manager_id bigint NULL CHECK (pbadmin_manager_id > 0);

CREATE FUNCTION public.protect_pbadmin_phone_usage()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF COALESCE(auth.role(), '') IN ('anon', 'authenticated')
     OR current_user IN ('anon', 'authenticated') THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.pbadmin_manager_id IS NOT NULL THEN
        RAISE EXCEPTION 'PBAdmin manages this WhatsApp usage' USING ERRCODE = '42501';
      END IF;
    ELSIF (OLD.pbadmin_manager_id IS NOT NULL OR NEW.pbadmin_manager_id IS NOT NULL)
       AND ROW(OLD.pbadmin_manager_id, OLD.assignment_role, OLD.phone, OLD.kind, OLD.gerencia_id)
         IS DISTINCT FROM ROW(NEW.pbadmin_manager_id, NEW.assignment_role, NEW.phone, NEW.kind, NEW.gerencia_id) THEN
      RAISE EXCEPTION 'PBAdmin manages this WhatsApp usage' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.protect_pbadmin_phone_usage() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER protect_pbadmin_phone_usage
  BEFORE INSERT OR UPDATE ON public.gerencia_phones
  FOR EACH ROW EXECUTE FUNCTION public.protect_pbadmin_phone_usage();
COMMENT ON COLUMN public.gerencia_phones.pbadmin_manager_id IS
  'API2 MKT WhatsApp bot managing assignment_role. NULL preserves legacy/manual editing.';
