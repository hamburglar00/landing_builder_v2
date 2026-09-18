-- Phase 1B.2: keep existing values in place; only change settings access.
-- Table privileges override column privileges. Reset both DML levels.
REVOKE SELECT, INSERT, UPDATE, DELETE, REFERENCES ON TABLE public.settings
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE SELECT (id, url_base, show_client_landing_preview, revalidate_secret,
    public_landing_runtime, public_landing_legacy_base_url),
  INSERT (id, url_base, show_client_landing_preview, revalidate_secret,
    public_landing_runtime, public_landing_legacy_base_url),
  UPDATE (id, url_base, show_client_landing_preview, revalidate_secret,
    public_landing_runtime, public_landing_legacy_base_url),
  REFERENCES (id, url_base, show_client_landing_preview, revalidate_secret,
    public_landing_runtime, public_landing_legacy_base_url)
  ON TABLE public.settings FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT (id, url_base, show_client_landing_preview)
  ON TABLE public.settings TO authenticated;
GRANT UPDATE (url_base, show_client_landing_preview)
  ON TABLE public.settings TO authenticated;
-- Backend readers need no DML permission on the secret. Rotation is separate.
GRANT SELECT (id, url_base, show_client_landing_preview, revalidate_secret,
    public_landing_runtime, public_landing_legacy_base_url)
  ON TABLE public.settings TO service_role;

-- Retire the public secret oracle; backend reads the column directly.
REVOKE ALL PRIVILEGES ON FUNCTION public.verify_revalidate_secret(text)
  FROM PUBLIC, anon, authenticated;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Existing row policies, values, unrelated privileges and historical SQL stay intact.
NOTIFY pgrst, 'reload schema';
