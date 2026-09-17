import {readFileSync,writeFileSync} from 'node:fs';
import {createBootstrapDatabase} from './bootstrap-runtime.mjs';
const db=await createBootstrapDatabase();
try {
 const metadata=JSON.parse(db.sql(readFileSync('scripts/phase0/bootstrap-net-diagnostic.sql','utf8')));
 // Keep the reviewed, hash-sealed initial reference immutable.
 writeFileSync('docs/optimization/phase-0/bootstrap-net-diagnostic-latest.json',JSON.stringify({provider:db.provider,metadata},null,2)+'\n');
 console.log(JSON.stringify({provider:db.provider,postgres:metadata.postgres,installed:metadata.installed,available:metadata.available.map(v=>v.version),hooks:metadata.provider_hooks,roles:metadata.roles}));
 db.installNativePgNet();
 const native=JSON.parse(db.sql(readFileSync('scripts/phase0/bootstrap-net-diagnostic.sql','utf8')));
 writeFileSync('docs/optimization/phase-0/bootstrap-net-native-diagnostic.json',JSON.stringify({provider:db.provider,metadata:native},null,2)+'\n');
 console.log(JSON.stringify({nativeInstalled:native.installed,functions:native.functions.map(f=>({name:f.name,acl:f.acl,security_definer:f.security_definer,settings:f.settings})),eventTriggers:db.sql("show event_triggers").trim()}));
} finally {db.close();}
