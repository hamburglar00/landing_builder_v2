import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { root } from './local-runtime.mjs';

const clean = sql => sql.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
// Conservative guard, not a PostgreSQL parser. Unresolvable dynamic future DDL is rejected.
export function checkFutureOrder(files, cutoff='20260915190657') {
  const ordered=[...files].sort(([a],[b])=>a.localeCompare(b));
  const providers=new Map(), columnProviders=[];
  for(const [file,sql] of ordered) {
    const text=clean(sql);
    for(const m of text.matchAll(/\bcreate\s+(?:or\s+replace\s+)?(?:table|view|sequence|type|function)\s+(?:if\s+not\s+exists\s+)?((?:public|private)\.[a-z_][a-z_0-9]*)/gi)) if(!providers.has(m[1].toLowerCase()))providers.set(m[1].toLowerCase(),file);
    for(const m of text.matchAll(/\balter\s+table\s+(?:if\s+exists\s+)?((?:public|private)\.[a-z_][a-z_0-9]*)\s+add\s+column\s+(?:if\s+not\s+exists\s+)?("[^"]+"|[a-z_][a-z_0-9]*)/gi))columnProviders.push({table:m[1].toLowerCase(),column:m[2].replaceAll('"',''),file});
  }
  const violations=[];
  for(const [file,sql] of ordered) {
    if(file.split('_')[0]<=cutoff)continue;
    const text=clean(sql);
    if(/\bexecute\b/i.test(text.replace(/\bexecute\s+(?:function|procedure)\b/gi,''))) violations.push({file,kind:'dynamic-SQL-requires-review'});
    if(/\bcreate\s+(?:or\s+replace\s+)?(?:table|view|sequence|type|function)\s+(?:if\s+not\s+exists\s+)?(?!if\b)[a-z_][a-z_0-9]*(?=\s|\(|;)/i.test(text) || /\b(?:public|private)\s*\.\s*"/.test(text)) violations.push({file,kind:'unresolved-object-declaration-requires-review'});
    for(const m of text.matchAll(/\b(?:public|private)\.[a-z_][a-z_0-9]*/gi)) {
      const provider=providers.get(m[0].toLowerCase());
      if(provider && provider>file)violations.push({file,kind:'future-object',object:m[0],provider});
    }
    for(const m of text.matchAll(/\b(?:from|join|update|into|references|table)\s+([a-z_][a-z_0-9]*)\b(?!\.)/gi)) {
      for(const schema of ['public','private']){const object=schema+'.'+m[1].toLowerCase(),provider=providers.get(object);if(provider&&provider>file)violations.push({file,kind:'future-object',object,provider});}
    }
    for(const c of columnProviders)if(c.file>file && text.toLowerCase().includes(c.table) && new RegExp('\\b'+c.column+'\\b','i').test(text)) violations.push({file,kind:'future-column',object:c.table+'.'+c.column,provider:c.file});
  }
  return [...new Map(violations.map(v=>[JSON.stringify(v),v])).values()];
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  if(process.argv.length!==2)throw Error('No target arguments accepted');
  const dir=join(root,'supabase/migrations');
  const files=new Map(readdirSync(dir).filter(f=>f.endsWith('.sql')).map(f=>[f,readFileSync(join(dir,f),'utf8')]));
  const violations=checkFutureOrder(files);
  console.log(JSON.stringify({futureFiles:[...files.keys()].filter(f=>f.split('_')[0]>'20260915190657').length,violations}));
  if(violations.length)process.exitCode=1;
}
