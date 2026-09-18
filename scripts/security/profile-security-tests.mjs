import assert from 'node:assert/strict';

export const ids={client:'71000000-0000-4000-8000-000000000001',other:'71000000-0000-4000-8000-000000000002',admin:'71000000-0000-4000-8000-000000000003',approved:'71000000-0000-4000-8000-000000000004',forged:'71000000-0000-4000-8000-000000000005'};
export const fixture=`
INSERT INTO auth.users(id,email,raw_app_meta_data,raw_user_meta_data) VALUES
 ('${ids.client}','profile-client@example.invalid','{"panelbot_admin_created":true,"panelbot_role":"client"}','{"role":"admin","panelbot_role":"admin"}'),
 ('${ids.other}','profile-other@example.invalid','{"panelbot_admin_created":true,"panelbot_role":"client"}','{}'),
 ('${ids.admin}','profile-admin@example.invalid','{"panelbot_admin_created":true,"panelbot_role":"admin"}','{}');
UPDATE public.profiles SET nombre='synthetic-original' WHERE id='${ids.client}';
`;
const subject=`SELECT set_config('request.jwt.claim.sub','${ids.client}',true); SELECT set_config('request.jwt.claims','{"sub":"${ids.client}","role":"authenticated","user_metadata":{"role":"admin"}}',true);`;
const transaction=body=>`BEGIN; SET LOCAL statement_timeout='10s'; ${fixture} ${body} ROLLBACK;`;
const last=value=>value.trim().split(/\r?\n/).at(-1);

export function baselineEscalation(db) {
  assert.equal(last(db.sql(transaction(`${subject} SET LOCAL ROLE authenticated; UPDATE public.profiles SET role='admin' WHERE id='${ids.client}'; SELECT role FROM public.profiles WHERE id='${ids.client}';`))),'admin');
}

export function sqlProfileTests(db,check) {
  const bool=(name,query)=>check(name,()=>assert.equal(last(db.sql(query)),'t'));
  const denied=(name,role,statement,code='42501')=>check(name,()=>{
    let actual=null;
    try {db.sql(transaction(`${subject} SET LOCAL ROLE ${role}; ${statement};`));}catch(error){actual=error.sqlstate;}
    assert.equal(actual,code);
  });
  bool('SQL own nombre update',transaction(`${subject} SET LOCAL ROLE authenticated; UPDATE public.profiles SET nombre='synthetic-edited' WHERE id='${ids.client}'; SELECT nombre='synthetic-edited' FROM public.profiles WHERE id='${ids.client}';`));
  denied('SQL role escalation denied','authenticated',`UPDATE public.profiles SET role='admin' WHERE id='${ids.client}'`);
  denied('SQL identity id change denied','authenticated',`UPDATE public.profiles SET id='${ids.forged}' WHERE id='${ids.client}'`);
  denied('SQL nonexistent user_id rejected','authenticated',`UPDATE public.profiles SET user_id='${ids.forged}' WHERE id='${ids.client}'`,'42703');
  denied('SQL administrative created_at denied','authenticated',`UPDATE public.profiles SET created_at='2000-01-01T00:00:00Z' WHERE id='${ids.client}'`);
  bool('SQL other profile remains unchanged',transaction(`${subject} SET LOCAL ROLE authenticated; WITH changed AS (UPDATE public.profiles SET nombre='synthetic-forbidden' WHERE id='${ids.other}' RETURNING 1) SELECT count(*)=0 FROM changed;`));
  denied('SQL anon update denied','anon',`UPDATE public.profiles SET nombre='synthetic-forbidden' WHERE id='${ids.client}'`);
  bool('SQL mixed statement atomic failure',transaction(`${subject} SET LOCAL ROLE authenticated; DO $$ BEGIN BEGIN UPDATE public.profiles SET nombre='synthetic-forbidden',role='admin' WHERE id='${ids.client}'; RAISE EXCEPTION 'unexpected success'; EXCEPTION WHEN insufficient_privilege THEN NULL; END; END $$; SELECT nombre='synthetic-original' AND role='client' FROM public.profiles WHERE id='${ids.client}';`));
  denied('SQL client insert admin denied','authenticated',`INSERT INTO public.profiles(id,role,nombre) VALUES ('${ids.forged}','admin','synthetic-forbidden')`);
  denied('SQL client delete denied','authenticated',`DELETE FROM public.profiles WHERE id='${ids.client}'`);
  bool('SQL missing JWT subject updates zero rows',transaction("SET LOCAL ROLE authenticated; WITH changed AS (UPDATE public.profiles SET nombre='synthetic-forbidden' RETURNING 1) SELECT count(*)=0 FROM changed;"));
  bool('SQL admin browser also restricted to own nombre',transaction(`SELECT set_config('request.jwt.claim.sub','${ids.admin}',true); SET LOCAL ROLE authenticated; UPDATE public.profiles SET nombre='synthetic-admin-edit' WHERE id='${ids.admin}'; SELECT nombre='synthetic-admin-edit' AND role='admin' FROM public.profiles WHERE id='${ids.admin}';`));
  bool('SQL approved Auth creation keeps admin role',transaction(`SET LOCAL ROLE service_role; INSERT INTO public.auth_signup_approvals(email,user_id,requested_by,role) VALUES ('profile-approved@example.invalid','${ids.approved}','${ids.admin}','admin'); RESET ROLE; INSERT INTO auth.users(id,email,raw_app_meta_data,raw_user_meta_data) VALUES ('${ids.approved}','profile-approved@example.invalid','{}','{"role":"client"}'); SELECT (SELECT role='admin' FROM public.profiles WHERE id='${ids.approved}') AND NOT EXISTS(SELECT FROM public.auth_signup_approvals WHERE user_id='${ids.approved}');`));
  bool('SQL trusted app_metadata assigns client and admin; user_metadata ignored',transaction(`SELECT (SELECT role='client' FROM public.profiles WHERE id='${ids.client}') AND (SELECT role='admin' FROM public.profiles WHERE id='${ids.admin}');`));
  check('SQL user_metadata alone cannot authorize signup',()=>{
    let code=null;try {db.sql(`BEGIN; INSERT INTO auth.users(id,email,raw_app_meta_data,raw_user_meta_data) VALUES ('${ids.forged}','profile-forged@example.invalid','{}','{"panelbot_admin_created":true,"panelbot_role":"admin"}'); ROLLBACK;`);}catch(error){code=error.sqlstate;}assert.equal(code,'28000');
  });
  bool('SQL create-client service upsert conflict path',transaction(`SET LOCAL ROLE service_role; INSERT INTO public.profiles(id,role,nombre) VALUES ('${ids.client}','client','synthetic-upsert') ON CONFLICT(id) DO UPDATE SET id=excluded.id,role=excluded.role,nombre=excluded.nombre; SELECT nombre='synthetic-upsert' AND role='client' FROM public.profiles WHERE id='${ids.client}';`));
  bool('SQL create-client service upsert insertion path',transaction(`DELETE FROM public.profiles WHERE id='${ids.client}'; SET LOCAL ROLE service_role; INSERT INTO public.profiles(id,role,nombre) VALUES ('${ids.client}','client','synthetic-upsert') ON CONFLICT(id) DO UPDATE SET id=excluded.id,role=excluded.role,nombre=excluded.nombre; SELECT nombre='synthetic-upsert' AND role='client' AND created_at IS NOT NULL FROM public.profiles WHERE id='${ids.client}';`));
  denied('SQL service cannot supply created_at','service_role',`UPDATE public.profiles SET created_at='2000-01-01T00:00:00Z' WHERE id='${ids.client}'`);
  denied('SQL service direct profile deletion unnecessary and denied','service_role',`DELETE FROM public.profiles WHERE id='${ids.client}'`);
  // The real administrative deletion is exercised through local Auth below.
  // A service JWT accepted by Auth does not grant SQL access to auth.users.
  for(const role of ['service_role','authenticated','anon']) {
    denied(`SQL ${role} direct Auth deletion denied`,role,`DELETE FROM auth.users WHERE id='${ids.client}'`);
    bool(`Effective auth.users DELETE grant absent for ${role}`,`SELECT NOT has_table_privilege('${role}','auth.users','DELETE');`);
  }
  const grants=JSON.parse(db.sql(`SELECT jsonb_agg(jsonb_build_object('role',r,'column',c,'update',has_column_privilege(r,'public.profiles',c,'UPDATE'),'insert',has_column_privilege(r,'public.profiles',c,'INSERT'))) FROM unnest(array['anon','authenticated','service_role']) r CROSS JOIN unnest(array['id','role','created_at','nombre']) c;`));
  for(const row of grants)for(const op of ['insert','update'])check(`Effective ${op} grant ${row.role}.${row.column}`,()=>assert.equal(row[op],row.role==='service_role'?row.column!=='created_at':row.role==='authenticated'&&row.column==='nombre'&&op==='update'));
  for(const role of ['anon','authenticated','service_role'])bool(`No table-level DML grant for ${role}`,`SELECT NOT has_table_privilege('${role}','public.profiles','INSERT') AND NOT has_table_privilege('${role}','public.profiles','UPDATE') AND NOT has_table_privilege('${role}','public.profiles','DELETE');`);
  bool('RLS USING and WITH CHECK scoped to authenticated',"SELECT roles=array['authenticated']::name[] AND qual='(( SELECT auth.uid() AS uid) = id)' AND with_check=qual FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='Update own profile';");
  return grants;
}

export function authAdminTests(db,auth,api,check) {
  db.sql(`BEGIN; ${fixture} SET LOCAL ROLE service_role;
    INSERT INTO public.auth_signup_approvals(email,user_id,requested_by,role)
    VALUES ('profile-approved@example.invalid','${ids.approved}','${ids.admin}','client'); COMMIT;`);
  check('Auth Admin API creates approved synthetic user and profile',()=>{
    const response=auth.request('POST','admin/users',{
      id:ids.approved,email:'profile-approved@example.invalid',email_confirm:true,
      app_metadata:{panelbot_admin_created:true,panelbot_role:'client'},user_metadata:{role:'admin'},
    });
    assert.equal(response.status,200);
    assert.equal(response.body.id,ids.approved);
    assert.equal(last(db.sql(`SELECT (SELECT role='client' FROM public.profiles WHERE id='${ids.approved}')
      AND NOT EXISTS(SELECT FROM public.auth_signup_approvals WHERE user_id='${ids.approved}');`)),'t');
  });
  check('Auth-created profile accepts existing backend upsert',()=>{
    const response=api.request('service_role',undefined,'POST','profiles?on_conflict=id',
      {id:ids.approved,role:'client',nombre:'synthetic-auth-backend'},'resolution=merge-duplicates,return=representation');
    assert.ok([200,201].includes(response.status));
    assert.equal(response.body[0].nombre,'synthetic-auth-backend');
  });
  check('Auth Admin API hard deletion cascades to profiles',()=>{
    assert.equal(last(db.sql("SELECT confdeltype='c' AND confrelid='auth.users'::regclass FROM pg_constraint WHERE conrelid='public.profiles'::regclass AND conname='profiles_id_fkey';")),'t');
    const response=auth.request('DELETE',`admin/users/${ids.approved}`,{should_soft_delete:false});
    assert.equal(response.status,200);
    assert.equal(last(db.sql(`SELECT NOT EXISTS(SELECT FROM auth.users WHERE id='${ids.approved}')
      AND NOT EXISTS(SELECT FROM public.profiles WHERE id='${ids.approved}');`)),'t');
  });
  db.sql(`DELETE FROM auth.users WHERE id IN ('${ids.client}','${ids.other}','${ids.admin}');`);
}

export function httpProfileTests(db,api,check) {
  db.sql(`BEGIN; ${fixture} COMMIT;`);
  const path=id=>`profiles?id=eq.${id}`;
  const patch=(role,id,body)=>api.request(role,ids.client,'PATCH',path(id),body);
  const read=()=>api.request('authenticated',ids.client,'GET',path(ids.client)).body[0];
  check('Data API own nombre update',()=>{const r=patch('authenticated',ids.client,{nombre:'synthetic-http'});assert.equal(r.status,200);assert.equal(r.body[0].nombre,'synthetic-http');});
  for(const [name,body] of [['role',{role:'admin'}],['id',{id:ids.forged}],['created_at',{created_at:'2000-01-01T00:00:00Z'}]])check(`Data API protected ${name}`,()=>{const r=patch('authenticated',ids.client,body);assert.equal(r.status,403);assert.equal(r.body.code,'42501');});
  check('Data API nonexistent user_id rejected',()=>{const r=patch('authenticated',ids.client,{user_id:ids.forged});assert.equal(r.status,400);assert.equal(r.body.code,'PGRST204');});
  check('Data API other profile cannot be updated',()=>{const r=patch('authenticated',ids.other,{nombre:'synthetic-forbidden'});assert.equal(r.status,200);assert.deepEqual(r.body,[]);});
  check('Data API anon cannot update profile',()=>{const r=patch('anon',ids.client,{nombre:'synthetic-forbidden'});assert.equal(r.status,401);assert.equal(r.body.code,'42501');});
  check('Data API mixed payload fails without partial update',()=>{const before=read();const r=patch('authenticated',ids.client,{nombre:'synthetic-forbidden',role:'admin'});assert.equal(r.status,403);assert.equal(r.body.code,'42501');assert.deepEqual(read(),before);});
  check('Data API service create-client upsert',()=>{const r=api.request('service_role',undefined,'POST','profiles?on_conflict=id',{id:ids.client,role:'client',nombre:'synthetic-backend'},'resolution=merge-duplicates,return=representation');assert.ok([200,201].includes(r.status));assert.equal(r.body[0].nombre,'synthetic-backend');assert.equal(r.body[0].role,'client');});
  check('Data API service administrative role capability preserved',()=>{const r=patch('service_role',ids.client,{role:'admin'});assert.equal(r.status,200);assert.equal(r.body[0].role,'admin');});
  check('Data API service created_at denied',()=>{const r=patch('service_role',ids.client,{created_at:'2000-01-01T00:00:00Z'});assert.equal(r.status,403);assert.equal(r.body.code,'42501');});
  check('Data API admin JWT still cannot edit role',()=>{const r=patch('authenticated',ids.client,{role:'client'});assert.equal(r.status,403);assert.equal(r.body.code,'42501');});
  db.sql(`DELETE FROM auth.users WHERE id IN ('${ids.client}','${ids.other}','${ids.admin}');`);
}
