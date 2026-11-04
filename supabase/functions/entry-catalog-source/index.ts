import {createClient} from 'npm:@supabase/supabase-js@2.112.3';
async function authorized(value:string|null,secret:string){
 if(!value?.startsWith('Bearer ')||secret.length<32)return false;
 const hash=async(v:string)=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)));
 const [a,b]=await Promise.all([hash(value.slice(7)),hash(secret)]);return a.reduce((different,n,i)=>different|(n^b[i]),0)===0;
}
Deno.serve(async request=>{
 const headers={'Cache-Control':'no-store','Content-Type':'application/json'};
 const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
 if(!await authorized(request.headers.get('authorization'),Deno.env.get('ENTRY_CATALOG_SYNC_SECRET')??''))return json({error:'unauthorized'},401);
 if(request.method!=='POST'||Number(request.headers.get('content-length')||0)>16384)return json({error:'invalid_request'},400);
 try{
  const text=await request.text();if(text.length>16384)return json({error:'invalid_request'},413);
  const input=JSON.parse(text),db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  if(input.action==='read'&&Object.keys(input).length===1){
   const result=await db.rpc('read_entry_catalog_changes',{p_limit:100});if(result.error)throw result.error;
   return json({changes:result.data});
  }
  if(input.action==='ack'&&Object.keys(input).length===2&&Array.isArray(input.items)&&input.items.length<=100){
   const result=await db.rpc('ack_entry_catalog_changes',{p_items:input.items});if(result.error)throw result.error;
   return json({ok:true});
  }
  return json({error:'invalid_request'},400);
 }catch{return json({error:'catalog_unavailable'},503);}
});
