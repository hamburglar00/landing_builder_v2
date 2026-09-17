// Read-only static diagnosis. Does not execute SQL, reorder files or propose an executable repair.
// Lexical evidence is deliberately distinguished from a PostgreSQL semantic dependency proof.
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {root,command} from './local-runtime.mjs';
const folder=join(root,'docs/optimization/phase-0');
const history=JSON.parse(readFileSync(join(folder,'phase0b-remote-history.json'),'utf8')).migrations;
const catalog=JSON.parse(readFileSync(join(folder,'phase0b-remote-catalog.json'),'utf8'));
const id='(?:"[^"]+"|[a-zA-Z_][a-zA-Z_0-9]*)', object=`(?:[a-zA-Z_][a-zA-Z_0-9]*\\s*\\.\\s*)?${id}`;
const normalize=x=>x.trim().replace(/^public\s*\.\s*/i,'').replace(/^"(.*)"$/,'$1');
function withoutComments(text){
 // Preserve offsets/newlines; strings are kept as evidence, never evaluated.
 let out='',i=0,quote=false;
 while(i<text.length){
  if(text[i]==="'"){out+=text[i++];if(quote&&text[i]==="'"){out+=text[i++];continue;}quote=!quote;continue;}
  if(!quote&&text.slice(i,i+2)==='--'){while(i<text.length&&text[i]!=='\n')out+=' ',i++;continue;}
  if(!quote&&text.slice(i,i+2)==='/*'){
   let depth=1;out+='  ';i+=2;while(i<text.length&&depth){if(text.slice(i,i+2)==='/*'){depth++;out+='  ';i+=2;}else if(text.slice(i,i+2)==='*/'){depth--;out+='  ';i+=2;}else{out+=text[i]==='\n'?'\n':' ';i++;}}continue;
  }
  out+=text[i++];
 }return out;
}
function splitStatements(text){
 const result=[];let start=0,quote=null,dollar=null;
 for(let i=0;i<text.length;i++){
  if(dollar){if(text.startsWith(dollar,i)){i+=dollar.length-1;dollar=null;}continue;}
  if(quote){if(text[i]===quote){if(text[i+1]===quote)i++;else quote=null;}continue;}
  if(text[i]==="'"||text[i]==='"'){quote=text[i];continue;}
  const m=text.slice(i).match(/^\$[a-zA-Z_0-9]*\$/);if(m){dollar=m[0];i+=dollar.length-1;continue;}
  if(text[i]===';'){result.push({text:text.slice(start,i+1),offset:start});start=i+1;}
 }
 if(text.slice(start).trim())result.push({text:text.slice(start),offset:start});return result;
}
const migrations=readdirSync(join(root,'supabase/migrations')).filter(f=>f.endsWith('.sql')).sort().map((file,index)=>{
 const raw=readFileSync(join(root,'supabase/migrations',file),'utf8'),clean=withoutComments(raw);
 const version=file.split('_')[0],name=file.slice(version.length+1,-4);
 return {file,order:index+1,version,name,sha256:createHash('sha256').update(raw).digest('hex'),bytes:Buffer.byteLength(raw),raw,clean,statements:splitStatements(clean)};
});
const creations=[],references=[],edges=[],columns=[];
for(const m of migrations)for(const st of m.statements){
 const sql=st.text.trim(), line=offset=>m.clean.slice(0,st.offset+offset).split('\n').length;
 const definitions=[['table',new RegExp(`\\bcreate\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?(${object})`,'gi')],
 ['sequence',new RegExp(`\\bcreate\\s+sequence\\s+(?:if\\s+not\\s+exists\\s+)?(${object})`,'gi')],
 ['view',new RegExp(`\\bcreate\\s+(?:or\\s+replace\\s+)?(?:materialized\\s+)?view\\s+(${object})`,'gi')],
 ['function',new RegExp(`\\bcreate\\s+(?:or\\s+replace\\s+)?function\\s+(${object})`,'gi')],
 ['index',new RegExp(`\\bcreate\\s+(?:unique\\s+)?index\\s+(?:concurrently\\s+)?(?:if\\s+not\\s+exists\\s+)?(${object})\\s+on\\s+(${object})`,'gi')],
 ['trigger',new RegExp(`\\bcreate\\s+(?:or\\s+replace\\s+)?trigger\\s+(${id})[\\s\\S]*?\\bon\\s+(${object})`,'gi')],
 ['policy',new RegExp(`\\bcreate\\s+policy\\s+(${id})\\s+on\\s+(${object})`,'gi')]];
 const declared=[];
 for(const [kind,re] of definitions)for(const match of st.text.matchAll(re)){
  const value={kind,name:normalize(match[1]),...(match[2]?{table:normalize(match[2])}:{}),file:m.file,order:m.order,line:line(match.index)};
  creations.push(value);declared.push(value);
 }
 const isFunction=/^create\s+(or\s+replace\s+)?function\b/i.test(sql),isDo=/^do\b/i.test(sql);
 const statementKind=isFunction?'function-definition':isDo?'do-block':(sql.match(/^(alter\s+table|comment\s+on\s+column|create\s+(?:unique\s+)?index|create\s+table|create\s+policy|create\s+trigger|update|insert|delete|select|drop\s+policy)/i)?.[1].toLowerCase()??'other');
 for(const match of st.text.matchAll(/\bpublic\s*\.\s*("[^"]+"|[a-zA-Z_][a-zA-Z_0-9]*)/g)){
  const name=normalize(match[1]);
  references.push({object:name,file:m.file,order:m.order,line:line(match.index),statementKind,
   deferredOrConditional:isFunction||isDo||/^(alter|drop)\s+table\s+if\s+exists/i.test(sql),
   declaredObjects:declared.map(x=>`${x.kind}:${x.name}`)});
 }
 // These functions use SET search_path = public and unqualified FROM conversions.
 // Keep them distinct from immediate DDL dependencies: PL/pgSQL may resolve at runtime.
 for(const match of st.text.matchAll(/\b(?:from|join|references|update|into|on|table)\s+("conversions"|conversions)\b/gi)){
  references.push({object:'conversions',file:m.file,order:m.order,line:line(match.index),statementKind,
   qualification:'unqualified; verify search_path',deferredOrConditional:isFunction||isDo,
   declaredObjects:declared.map(x=>`${x.kind}:${x.name}`)});
 }
 // Declared conversion columns are evidence of intended names, not an evaluated final schema.
 const table=sql.match(new RegExp(`^create\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?(${object})\\s*\\(`,'i'));
 if(table&&['conversions','conversions_config','conversion_logs'].includes(normalize(table[1]))){
  for(const match of sql.matchAll(/^\s*("[^"]+"|[a-z_][a-z_0-9]*)\s+(uuid|text|boolean|bigint|integer|numeric|jsonb|timestamptz)\b/gim))columns.push({table:normalize(table[1]),name:normalize(match[1]),operation:'create-column',type:match[2],file:m.file});
 }
 for(const match of st.text.matchAll(/alter\s+table\s+(?:if\s+exists\s+)?public\.(conversions_config|conversions|conversion_logs)\b([\s\S]*?)(?=;|$)/gi)){
  for(const c of match[2].matchAll(/\b(add|drop)\s+column\s+(?:if\s+(?:not\s+)?exists\s+)?("[^"]+"|[a-z_][a-z_0-9]*)/gi))columns.push({table:match[1],name:normalize(c[2]),operation:c[1].toLowerCase()+'-column',file:m.file});
  for(const c of match[2].matchAll(/\brename\s+column\s+("[^"]+"|[a-z_][a-z_0-9]*)\s+to\s+("[^"]+"|[a-z_][a-z_0-9]*)/gi))columns.push({table:match[1],name:normalize(c[1]),newName:normalize(c[2]),operation:'rename-column',file:m.file});
 }
}
const firstTables=new Map();for(const c of creations.filter(x=>x.kind==='table'))if(!firstTables.has(c.name))firstTables.set(c.name,c);
const early=[];
for(const ref of references){const producer=firstTables.get(ref.object);if(producer&&producer.order>ref.order){early.push({...ref,creator:producer.file});edges.push({from:producer.file,to:ref.file,object:ref.object,kind:ref.deferredOrConditional?'potential/conditional':'direct-SQL',line:ref.line});}}
const relevant=references.filter(r=>r.object==='conversions'),preCreation=relevant.filter(r=>r.order<firstTables.get('conversions').order);
const localVersions=new Set(migrations.map(m=>m.version)),remoteVersions=new Set(history.map(h=>h.version));
const localOnly=migrations.filter(m=>!remoteVersions.has(m.version)).map(m=>m.file),remoteOnly=history.filter(h=>!localVersions.has(h.version)).map(h=>({version:h.version,name:h.name}));
const nameDifferences=migrations.flatMap(m=>{const remote=history.find(h=>h.version===m.version);return remote&&remote.name!==m.name?[{version:m.version,local:m.name,remote:remote.name}]:[];});
const unique=(values,key)=>[...new Map(values.map(v=>[key(v),v])).values()];
const columnsComparison=['conversions','conversions_config','conversion_logs'].map(table=>{
 const evidence=columns.filter(c=>c.table===table),declared=new Set(evidence.flatMap(c=>c.operation==='drop-column'?[]:[c.name,...(c.newName?[c.newName]:[])]));
 const remote=catalog.relations.find(r=>r.name===table).columns.map(c=>c.name);
 return {table,remoteCount:remote.length,staticDeclaredCount:declared.size,remoteNotFoundInStaticDeclarations:remote.filter(n=>!declared.has(n)),declaredNotCurrentlyRemote:[...declared].filter(n=>!remote.includes(n)),events:evidence};
});
const gitEvidence={shallow:command('git',['rev-parse','--is-shallow-repository']).trim()==='true',head:command('git',['rev-parse','HEAD']).trim(),
 conversionsCreator:command('git',['log','--follow','--format=%H %aI %s','--','supabase/migrations/20260416100001_conversions.sql']).trim().split(/\r?\n/),
 testEventCode:command('git',['log','--follow','--format=%H %aI %s','--','supabase/migrations/20260323201000_conversions_add_test_event_code.sql']).trim().split(/\r?\n/),
 deletedMigrationPaths:command('git',['log','--all','--diff-filter=D','--name-only','--format=','--','supabase/migrations']).trim().split(/\r?\n/).filter(Boolean)};
const report={method:'Lexical SQL/comment-aware inventory, manually reviewed direct blockers. Function/DO/dynamic SQL references may be conditional or deferred. Not a semantic topological sort, repaired execution, or proof of final schema parity.',
 inventory:migrations.map(({raw,clean,statements,...m})=>m),gitEvidence,
 historyComparison:{localCount:migrations.length,remoteCount:history.length,localOnly,remoteOnly,nameDifferences,checksumNote:'Local SHA256 hashes exact UTF-8 text; remote stored_text_md5 hashes statement-array text. Different serialization: no equality/drift inferred across these two hash fields.'},
 conversionsCreator:firstTables.get('conversions'),firstConversionsReference:relevant[0],
 conversionsPreCreationMigrations:unique(preCreation,r=>r.file).map(r=>({file:r.file,order:r.order})),conversionsReferences:relevant,
 declaredObjects:creations,earlyRelationReferences:early,dependencyEdges:unique(edges,e=>`${e.from}|${e.to}|${e.object}|${e.kind}`),columnsComparison,
 remoteConversions:{relations:catalog.relations.filter(r=>['conversions','conversions_config','conversion_logs'].includes(r.name)),
 constraints:catalog.constraints.filter(c=>c.table==='conversions'||['conversions','public.conversions'].includes(c.references)),indexes:catalog.indexes.filter(i=>i.table==='conversions'),
 policies:catalog.policies.filter(p=>p.table==='conversions'),triggers:catalog.triggers.filter(t=>t.table==='conversions'),functions:catalog.functions.filter(f=>f.references_conversions)}};
writeFileSync(join(folder,'phase0b-dependencies.json'),JSON.stringify(report,null,2)+'\n');
const render=`# Grafo e inventario estático de dependencias\n\nNo ejecuta ni reordena SQL. Las referencias dentro de funciones/DO requieren revisión semántica; no son todas bloqueos al crear la función. Fuente completa: phase0b-dependencies.json.\n\n## Referencias a conversions antes de crearla\n\n| Orden | Migración |\n| ---: | --- |\n${report.conversionsPreCreationMigrations.map(m=>`| ${m.order} | ${m.file} |`).join('\n')}\n\n## Aristas de relaciones creadas más tarde\n\n| Prerrequisito | Consumidor anterior | Objeto | Tipo |\n| --- | --- | --- | --- |\n${report.dependencyEdges.map(e=>`| ${e.from} | ${e.to} | ${e.object} | ${e.kind} |`).join('\n')}\n\n## Objetos locales que referencian conversions\n\n| Migración | Objetos declarados en el statement |\n| --- | --- |\n${unique(relevant.filter(r=>r.declaredObjects.length),r=>r.file+r.declaredObjects.join()).map(r=>`| ${r.file} | ${r.declaredObjects.join(', ')} |`).join('\n')}\n`;
writeFileSync(join(folder,'phase0b-dependency-graph.md'),render);
const privateMetadata=JSON.parse(readFileSync(join(folder,'phase0b-private-metadata.json'),'utf8'));
const publicRelations=new Set(creations.filter(c=>['table','view'].includes(c.kind)&&!c.name.includes('.')).map(c=>c.name));
const publicFunctions=new Set(creations.filter(c=>c.kind==='function'&&!c.name.includes('.')).map(c=>c.name));
const remoteRelations=catalog.relations.filter(c=>['r','p','v','m'].includes(c.kind));
const functionLineage=migrations.flatMap(m=>{
 const match=m.raw.replaceAll('\r','').match(/create or replace function public\.set_conversions_from_meta_ads\(\)[\s\S]*?as (\$[a-z_0-9]*\$)([\s\S]*?)\1/i);
 if(!match)return [];
 const bodyMd5=createHash('md5').update(match[2]).digest('hex');
 return [{file:m.file,body_md5:bodyMd5,matchesRemoteBody:bodyMd5===privateMetadata.from_meta_ads_definition.body_md5}];
});
const comparison={method:'Read-only remote catalog vs lexical declarations; NOT a replayed full-schema diff. Version equality is not SQL-content equality.',
 history:report.historyComparison,publicCatalogCounts:Object.fromEntries(Object.entries(catalog).filter(([,v])=>Array.isArray(v)).map(([k,v])=>[k,v.length])),
 remoteRelationsWithoutLocalCreate:remoteRelations.filter(c=>!publicRelations.has(c.name)).map(c=>c.name),
 localDeclaredRelationsNotCurrentlyRemote:[...publicRelations].filter(n=>!remoteRelations.some(r=>r.name===n)),
 remotePublicFunctionsWithoutLocalCreate:catalog.functions.filter(f=>!publicFunctions.has(f.name)).map(f=>({name:f.name,arguments:f.arguments})),
 privateFunctions:privateMetadata.private_functions.map(f=>({name:f.name,hasLocalCreate:creations.some(c=>c.kind==='function'&&c.name==='private.'+f.name)})),
 implicitSequences:catalog.relations.filter(c=>c.kind==='S'&&!creations.some(d=>d.kind==='sequence'&&d.name===c.name)).map(c=>c.name),
 columns:columnsComparison.map(({events,...c})=>c),fromMetaAdsDefinitionLineage:functionLineage,
 unresolved:['Static diagnosis only: current full replay status must be read from bootstrap-validation.json.',
 'Recovered tracking history includes an explicitly authorized sanitized scheduler; provenance is recorded separately.',
 'public.rls_auto_enable and event trigger ensure_rls have no local migration declaration; origin unproven.',
 'Static names and hashes do not prove equivalence of ACLs, default privileges, function settings, views, sequences, extension versions, triggers or policy semantics.',
 'pg_depend alone omits dependencies resolved dynamically by function bodies; lexical graph requires semantic review.']};
writeFileSync(join(folder,'phase0b-structural-comparison.json'),JSON.stringify(comparison,null,2)+'\n');
console.log(JSON.stringify({local:migrations.length,remote:history.length,localOnly,remoteOnly,nameDifferences,preCreation:report.conversionsPreCreationMigrations,earlyObjects:[...new Set(early.map(e=>e.object))],columns:columnsComparison.map(({events,...c})=>c),gitEvidence},null,2));
