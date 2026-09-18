-- Phase 1B.3: phone administration follows the protected owner/admin model.
-- Existing assignment algorithms, functions and scheduled jobs are unchanged.
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.gerencia_phones
  FROM PUBLIC, anon, authenticated;
REVOKE INSERT (id, gerencia_id, phone, status, usage_count, last_seen_at,
  created_at, updated_at, kind, comment, messages_reset_at, source_available, assignment_role),
  UPDATE (id, gerencia_id, phone, status, usage_count, last_seen_at,
  created_at, updated_at, kind, comment, messages_reset_at, source_available, assignment_role)
  ON public.gerencia_phones FROM PUBLIC, anon, authenticated;
GRANT SELECT, DELETE ON public.gerencia_phones TO authenticated;
GRANT INSERT (gerencia_id, phone, status, last_seen_at, kind, comment, source_available, assignment_role),
  UPDATE (gerencia_id, phone, status, last_seen_at, kind, comment, source_available, assignment_role)
  ON public.gerencia_phones TO authenticated;
REVOKE USAGE, SELECT, UPDATE ON SEQUENCE public.gerencia_phones_id_seq FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SEQUENCE public.gerencia_phones_id_seq TO authenticated;

ALTER TABLE public.gerencia_phones ENABLE ROW LEVEL SECURITY;
DROP POLICY "Users manage own gerencia phones" ON public.gerencia_phones;
DROP POLICY "Admins can read all gerencia phones" ON public.gerencia_phones;
DROP POLICY "All users can select gerencia phones" ON public.gerencia_phones;

CREATE POLICY phone_select_owner_or_admin ON public.gerencia_phones
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.gerencias g
      WHERE g.id = gerencia_phones.gerencia_id AND g.user_id = (SELECT auth.uid()))
    OR EXISTS (SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin')
  );
CREATE POLICY phone_insert_owner_or_admin ON public.gerencia_phones
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.gerencias g
      WHERE g.id = gerencia_phones.gerencia_id AND g.user_id = (SELECT auth.uid()))
    OR EXISTS (SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin')
  );
CREATE POLICY phone_update_owner_or_admin ON public.gerencia_phones
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.gerencias g
      WHERE g.id = gerencia_phones.gerencia_id AND g.user_id = (SELECT auth.uid()))
    OR EXISTS (SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.gerencias g
      WHERE g.id = gerencia_phones.gerencia_id AND g.user_id = (SELECT auth.uid()))
    OR EXISTS (SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin')
  );
CREATE POLICY phone_delete_owner_or_admin ON public.gerencia_phones
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.gerencias g
      WHERE g.id = gerencia_phones.gerencia_id AND g.user_id = (SELECT auth.uid()))
    OR EXISTS (SELECT 1 FROM public.profiles p
      WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin')
  );

-- Invoker triggers permit unchanged conflict keys in legitimate upserts while
-- rejecting actual reassignment, including an administrator's mixed payload.
CREATE FUNCTION private.prevent_phone_owner_reassignment()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF NEW.gerencia_id IS DISTINCT FROM OLD.gerencia_id THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Phone ownership cannot be reassigned';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.prevent_phone_owner_reassignment() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER phone_owner_immutable BEFORE UPDATE OF gerencia_id ON public.gerencia_phones
  FOR EACH ROW EXECUTE FUNCTION private.prevent_phone_owner_reassignment();

CREATE FUNCTION private.prevent_gerencia_owner_reassignment()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Gerencia ownership cannot be reassigned';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.prevent_gerencia_owner_reassignment() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER gerencia_owner_immutable BEFORE UPDATE OF user_id ON public.gerencias
  FOR EACH ROW EXECUTE FUNCTION private.prevent_gerencia_owner_reassignment();

-- Explicitly authorized exception: only EXECUTE ACLs on these two entrypoints.
-- No CREATE OR REPLACE, owner/search_path change, job edit or compensating grant.
REVOKE ALL ON FUNCTION public.cron_sync_phones_all() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cron_reset_phone_operational_daily() FROM PUBLIC, anon, authenticated;
