import assert from 'node:assert/strict';
import test from 'node:test';
import {canonicalStartHandoffUrl} from '../lib/reyDeAses/handoff-url';

const origin='https://gateway.example.com';
test('unknown and repeated advertising fields cannot authorize access or reject a valid handoff',()=>{
  const dirty=origin+'/start?t=opaque&ef=e1.diagnostic&new_meta_field=x&new_meta_field=y&fbclid=click&utm_future=abc&landing=diana&provider=evil&skin=wrong&advisor_id=foreign&return_to=https://evil.test';
  assert.equal(canonicalStartHandoffUrl(dirty,origin),origin+'/start?t=opaque&ef=e1.diagnostic');
});
test('origin, path, access token and diagnostic carrier remain strict',()=>{
  for(const bad of [origin+'/start',origin+'/start?t=',origin+'/start?t=a&t=b',origin+'/start?t='+ 'x'.repeat(12001),origin+'/prepare?t=a',origin+'/start?t=a#fragment',origin+'/start?t=a&ef=',origin+'/start?t=a&ef=e1.a&ef=e1.b','http://gateway.example.com/start?t=a','https://evil.test/start?t=a','https://user:pass@gateway.example.com/start?t=a'])assert.throws(()=>canonicalStartHandoffUrl(bad,origin));
});
