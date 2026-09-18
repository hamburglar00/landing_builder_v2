-- The phase runner supplies three synthetic users, gerencias and phones first.
-- Run only on its isolated reconstructed database, in a rolled-back transaction.
SET LOCAL search_path = public, extensions;
SELECT plan(8);
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid='public.gerencia_phones'::regclass), 'phone RLS enabled');
SELECT is((SELECT count(*)::integer FROM pg_policies WHERE schemaname='public' AND tablename='gerencia_phones'), 4, 'four operation-specific policies');
SELECT ok(NOT has_table_privilege('anon','public.gerencia_phones','SELECT'), 'anon cannot list phone administration');
SELECT ok(NOT has_column_privilege('authenticated','public.gerencia_phones','usage_count','UPDATE'), 'operational counters are backend-only');
SELECT set_config('request.jwt.claim.sub','71000000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claims','{"sub":"71000000-0000-4000-8000-000000000001","role":"authenticated","user_metadata":{"role":"admin"}}',true);
SET LOCAL ROLE authenticated;
SELECT results_eq('SELECT id FROM public.gerencia_phones ORDER BY id', 'VALUES (730101::bigint),(730103::bigint)', 'client reads only owned phones');
SELECT throws_ok($$INSERT INTO public.gerencia_phones(gerencia_id,phone) VALUES(7302,'000009')$$, '42501', NULL, 'foreign creation denied');
SELECT throws_ok($$UPDATE public.gerencia_phones SET gerencia_id=7302,comment='forbidden' WHERE id=730101$$, '42501', NULL, 'mixed reassignment denied');
SELECT is((SELECT comment FROM public.gerencia_phones WHERE id=730101), '', 'denied mixed payload leaves original field');
SELECT * FROM finish();
