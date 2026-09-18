import assert from 'node:assert/strict';
import {fixture,ids} from './profile-security-tests.mjs';

const secret='phase1b2-local-only-synthetic-0000000000000000';
const safe='id,url_base,show_client_landing_preview';
const last=x=>x.trim().split(/\r?\n/).at(-1);
const subject=id=>`SELECT set_config('request.jwt.claim.sub','${id}',true); SELECT set_config('request.jwt.claims','{"sub":"${id}","role":"authenticated"}',true);`;

export function settingsSqlTests(db,check) {
  const bool=(name,sql)=>check(name,()=>assert.equal(last(db.sql(sql)),'t'));
  const denied=(name,role,sql)=>check(name,()=>{
    let state=null;
    try {db.sql(`BEGIN; ${fixture} ${subject(ids.admin)} SET LOCAL ROLE ${role}; ${sql}; ROLLBACK;`);}
    catch(error){state=error.sqlstate;}
    assert.equal(state,'42501');
  });
  for(const role of ['anon','authenticated']) {
    denied(`${role} cannot select secret`,role,'SELECT revalidate_secret FROM public.settings');
    denied(`${role} cannot select star`,role,'SELECT * FROM public.settings');
    denied(`${role} cannot select composite row`,role,'SELECT row_to_json(s) FROM public.settings s');
    denied(`${role} cannot update secret`,role,`UPDATE public.settings SET revalidate_secret='${secret}' WHERE id=1`);
    denied(`${role} cannot insert secret`,role,`INSERT INTO public.settings(id,revalidate_secret) VALUES(1,'${secret}')`);
    denied(`${role} cannot delete settings`,role,'DELETE FROM public.settings WHERE id=1');
    denied(`${role} cannot execute secret oracle`,role,`SELECT public.verify_revalidate_secret('${secret}')`);
    for(const privilege of ['SELECT','UPDATE','INSERT','REFERENCES']) bool(`effective ${role} secret ${privilege} denied`,
      `SELECT NOT has_column_privilege('${role}','public.settings','revalidate_secret','${privilege}')`);
  }
  bool('PUBLIC has no direct sensitive column or table DML grant',`SELECT NOT EXISTS (
    SELECT FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) a
    WHERE c.oid='public.settings'::regclass AND a.grantee=0 AND a.privilege_type IN ('SELECT','INSERT','UPDATE','DELETE','REFERENCES')
    UNION ALL SELECT FROM pg_attribute c CROSS JOIN LATERAL aclexplode(c.attacl) a
    WHERE c.attrelid='public.settings'::regclass AND c.attname='revalidate_secret' AND a.grantee=0)`);
  bool('authenticated safe projection and admin update remain functional',`BEGIN; ${fixture} ${subject(ids.admin)} SET LOCAL ROLE authenticated;
    UPDATE public.settings SET url_base='https://example.invalid',show_client_landing_preview=true WHERE id=1;
    SELECT id=1 AND url_base='https://example.invalid' AND show_client_landing_preview FROM public.settings WHERE id=1; ROLLBACK;`);
  bool('client reads safe columns',`BEGIN; ${fixture} ${subject(ids.client)} SET LOCAL ROLE authenticated; SELECT id=1 AND url_base IS NOT NULL AND show_client_landing_preview IS NOT NULL FROM public.settings WHERE id=1; ROLLBACK;`);
  bool('backend can read synthetic secret',`BEGIN; UPDATE public.settings SET revalidate_secret='${secret}' WHERE id=1; SET LOCAL ROLE service_role;
    SELECT revalidate_secret='${secret}' FROM public.settings WHERE id=1; ROLLBACK;`);
  denied('backend revalidation cannot modify secret','service_role',`UPDATE public.settings SET revalidate_secret='${secret}' WHERE id=1`);
  denied('mixed SQL update fails atomically','authenticated',`UPDATE public.settings SET url_base='https://example.invalid',revalidate_secret='${secret}' WHERE id=1`);
}

export function settingsDataApiTests(db,api,check) {
  db.sql(`BEGIN; ${fixture} UPDATE public.settings SET url_base='https://before.example.invalid',revalidate_secret='${secret}' WHERE id=1; COMMIT;`);
  const read=()=>api.request('authenticated',ids.admin,'GET',`settings?id=eq.1&select=${safe}`).body;
  const blocked=(role,result)=>{
    assert.equal(result.status,role==='anon'?401:403);
    assert.equal(result.body.code,'42501');
    assert.ok(!JSON.stringify(result.body).includes(secret));
  };
  try {
    for(const role of ['anon','authenticated']) {
      for(const select of ['revalidate_secret','leak:revalidate_secret',safe+',revalidate_secret']) {
        check(`Data API ${role} explicit sensitive projection ${select}`,()=>blocked(role,api.request(role,ids.admin,'GET',`settings?id=eq.1&select=${select}`)));
      }
      check(`Data API ${role} star never returns secret`,()=>{
        const result=api.request(role,ids.admin,'GET','settings?id=eq.1&select=*');
        if(result.status===200) {assert.ok(!JSON.stringify(result.body).includes(secret));for(const row of result.body)assert.ok(!Object.hasOwn(row,'revalidate_secret'));}
        else blocked(role,result);
      });
      check(`Data API ${role} secret update denied`,()=>blocked(role,api.request(role,ids.admin,'PATCH',`settings?id=eq.1&select=${safe}`,{revalidate_secret:'forbidden'})));
      check(`Data API ${role} mixed payload atomic`,()=>{
        const before=read();blocked(role,api.request(role,ids.admin,'PATCH',`settings?id=eq.1&select=${safe}`,{url_base:'https://attacker.example.invalid',revalidate_secret:'forbidden'}));assert.deepEqual(read(),before);
      });
      check(`Data API ${role} secret filter denied`,()=>blocked(role,api.request(role,ids.admin,'GET',`settings?select=id&revalidate_secret=eq.forbidden`)));
      check(`Data API ${role} oracle unavailable`,()=>{
        const result=api.request(role,ids.admin,'POST','rpc/verify_revalidate_secret',{p_secret:secret});
        assert.ok([401,403,404].includes(result.status));assert.ok(!JSON.stringify(result.body).includes(secret));
      });
    }
    for(const id of [ids.admin,ids.client])check(`Data API safe projection ${id===ids.admin?'admin':'client'}`,()=>{
      const result=api.request('authenticated',id,'GET',`settings?id=eq.1&select=${safe}`);
      assert.equal(result.status,200);assert.equal(result.body.length,1);assert.deepEqual(Object.keys(result.body[0]).sort(),safe.split(',').sort());
    });
    check('Data API admin changes safe field with explicit return projection',()=>{
      const result=api.request('authenticated',ids.admin,'PATCH',`settings?id=eq.1&select=${safe}`,{url_base:'https://changed.example.invalid'});
      assert.equal(result.status,200);assert.equal(result.body[0].url_base,'https://changed.example.invalid');assert.ok(!JSON.stringify(result.body).includes(secret));
    });
    check('Data API client cannot change global safe settings',()=>{
      const before=read(),result=api.request('authenticated',ids.client,'PATCH',`settings?id=eq.1&select=${safe}`,{url_base:'https://forbidden.example.invalid'});
      assert.equal(result.status,200);assert.deepEqual(result.body,[]);assert.deepEqual(read(),before);
    });
    check('Data API backend reads exact synthetic value without transforming it',()=>{
      const result=api.request('service_role',undefined,'GET','settings?id=eq.1&select=revalidate_secret');
      assert.equal(result.status,200);assert.equal(result.body[0].revalidate_secret,secret);
    });
    check('Data API backend revalidation cannot write secret',()=>blocked('authenticated',api.request('service_role',undefined,'PATCH',`settings?id=eq.1&select=${safe}`,{revalidate_secret:'forbidden'})));
    check('Data API public routing RPC contains only its existing safe fields',()=>{
      const result=api.request('anon',undefined,'POST','rpc/get_public_landing_routing',{});
      assert.equal(result.status,200);assert.deepEqual(Object.keys(result.body[0]).sort(),['public_landing_legacy_base_url','public_landing_runtime']);
    });
  } finally {
    db.sql(`DELETE FROM auth.users WHERE id IN ('${ids.admin}','${ids.client}','${ids.other}'); UPDATE public.settings SET url_base='',revalidate_secret='' WHERE id=1;`);
  }
}
