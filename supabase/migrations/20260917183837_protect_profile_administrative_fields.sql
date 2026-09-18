-- Phase 1B.1: clients may edit only their own nombre.
-- Table privileges override column restrictions, so revoke both levels first.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.profiles
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE INSERT (id, role, created_at, nombre), UPDATE (id, role, created_at, nombre)
  ON TABLE public.profiles FROM PUBLIC, anon, authenticated, service_role;

GRANT UPDATE (nombre) ON TABLE public.profiles TO authenticated;
-- create-client upserts these three fields, including id on conflict.
-- Auth triggers still run as their existing owner; created_at uses its default.
GRANT INSERT (id, role, nombre), UPDATE (id, role, nombre)
  ON TABLE public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER POLICY "Update own profile" ON public.profiles TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);
