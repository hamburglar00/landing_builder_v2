import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compatibilitySources} from './bootstrap-compatibility.mjs';
import {compareCatalogs,platformExceptions,verifyPlatformEvidence} from './compare-schema-metadata.mjs';
test('compatibility sources are sealed separately from historical migrations',()=>{
  const x=compatibilitySources();assert.equal(x.manifest.afterHistoricalCount,268);assert.equal(x.manifest.beforeIncremental,true);assert.ok(!x.manifest.file.includes('/migrations/'));assert.equal(x.reference.policies.length,0);
});
test('column order is normalized, but types and RLS are not',()=>{
  const a={relations:[{schema:'public',name:'t',rls:true,columns:[{name:'a',type:'text'},{name:'b',type:'int'}]}]};const b=structuredClone(a);b.relations[0].columns.reverse();assert.equal(compareCatalogs(a,b,[]).status,'normalized_with_evidence');b.relations[0].columns[0].type='text';assert.equal(compareCatalogs(a,b,[]).status,'pending');b.relations[0].rls=false;assert.equal(compareCatalogs(a,b,[]).status,'pending');
});
test('only five exact reviewed platform entries qualify',()=>{
  const e=platformExceptions();assert.equal(e.length,5);for(const x of e){const a={[x.category]:x.local?[x.local]:[]},b={[x.category]:x.remote?[x.remote]:[]};assert.equal(compareCatalogs(a,b,e).status,'normalized_with_evidence');const mutated=structuredClone(a);if(x.local){mutated[x.category][0].owner='unexpected';assert.equal(compareCatalogs(mutated,b,e).status,'pending');}}
});
test('unknown platform and grant differences remain pending',()=>{
  assert.equal(compareCatalogs({extensions:[{name:'new',schema:'public'}]},{},platformExceptions()).status,'pending');assert.equal(compareCatalogs({grants:[{kind:'relation',schema:'public',name:'t',grantee:'anon',privilege:'SELECT'}]},{},platformExceptions()).status,'pending');
});
test('pg_net permission drift cannot be normalized',()=>{
  assert.throws(()=>verifyPlatformEvidence({pg_net_members:[{acl:'new'}]},{pg_net_members:[{acl:'old'}]}),/security/);
});
test('missing GraphQL provenance fails closed',()=>{
  assert.throws(()=>verifyPlatformEvidence({pg_net_members:[],graphql_event_members:[{name:'graphql_watch_ddl',extension:null}]},{pg_net_members:[],graphql_event_members:[]}),/membership/);
});
