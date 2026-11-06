import assert from 'node:assert/strict';
import { localDatabase, read } from './phase0/local-runtime.mjs';
const db = await localDatabase();
try {
  db.sql(`CREATE SCHEMA auth;
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.role',true),'') $$;
    CREATE TABLE public.gerencia_phones(id bigint PRIMARY KEY,gerencia_id int,phone text,kind text,assignment_role text DEFAULT 'acquisition',status text DEFAULT 'active');
    INSERT INTO public.gerencia_phones VALUES(1,17,'5491100000001','mkt','follow_up','active'),(2,17,'5491100000002','mkt','acquisition','active'),(3,17,'5491100000003','carga','follow_up','active');
    GRANT USAGE ON SCHEMA auth,public TO authenticated,anon,service_role;
    GRANT SELECT,INSERT,UPDATE ON public.gerencia_phones TO authenticated,anon,service_role;`);
  const before = db.sql('SELECT id,assignment_role FROM public.gerencia_phones ORDER BY id');
  db.sql(read('supabase/migrations/20261106011727_pbadmin_mkt_whatsapp_usage.sql'));
  assert.equal(db.sql('SELECT id,assignment_role FROM public.gerencia_phones ORDER BY id'), before);
  db.sql(`SET ROLE service_role; SET request.jwt.claim.role='service_role'; UPDATE public.gerencia_phones SET pbadmin_manager_id=10 WHERE id=1; RESET ROLE; RESET request.jwt.claim.role;`);
  const denied = ["assignment_role='acquisition'", 'pbadmin_manager_id=null', "phone='5491100000011'", "kind='carga'", 'gerencia_id=18'];
  for (const set of denied) assert.throws(() => db.sql(`SET ROLE authenticated; SET request.jwt.claim.role='authenticated'; UPDATE public.gerencia_phones SET ${set} WHERE id=1;`), /PBAdmin manages/);
  assert.throws(() => db.sql("SET ROLE authenticated; INSERT INTO public.gerencia_phones(id,pbadmin_manager_id) VALUES(4,99)"), /PBAdmin manages/);
  db.sql("SET ROLE authenticated; UPDATE public.gerencia_phones SET status='inactive' WHERE id=1; UPDATE public.gerencia_phones SET assignment_role='follow_up' WHERE id=2; UPDATE public.gerencia_phones SET assignment_role='acquisition' WHERE id=3;");
  // Even a SECURITY DEFINER caller must not let an authenticated JWT bypass the guard.
  assert.throws(() => db.sql("SET request.jwt.claim.role='authenticated'; UPDATE public.gerencia_phones SET assignment_role='acquisition' WHERE id=1"), /PBAdmin manages/);
  db.sql("SET ROLE service_role; UPDATE public.gerencia_phones SET assignment_role='acquisition' WHERE id=1;");
  assert.equal(db.sql('SELECT assignment_role FROM public.gerencia_phones WHERE id=1').trim(), 'acquisition');
  console.log('PASS: migration preserves legacy data; service sync, managed-field protections and manual status/usage permissions');
} finally { db.close(); }
