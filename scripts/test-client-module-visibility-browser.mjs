import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require = createRequire(new URL('../frontend/package.json', import.meta.url));
const {chromium} = require('playwright');
const base = process.env.BUILDER_TEST_URL ?? 'http://127.0.0.1:3137';
const browser = await chromium.launch();
const id = '92000000-0000-4000-8000-000000000001';
const keys = ['show_followups','show_whatsapp_api','show_notifications','show_atrio','show_kommo','show_chatrace'];
const paths = ['/dashboard/seguimiento','/dashboard/whatsapp-cloud-api','/dashboard/notificaciones'];
let checks = 0;
async function fixture(role, width, enabled = false) {
  const context = await browser.newContext({viewport:{width,height:900}});
  const expires = Math.floor(Date.now()/1000)+3600;
  const user = {id,email:'synthetic@example.invalid',aud:'authenticated',app_metadata:{},user_metadata:{}};
  const token = [Buffer.from('{}').toString('base64url'),Buffer.from(JSON.stringify({sub:id,exp:expires})).toString('base64url'),'synthetic'].join('.');
  const permissions = Object.fromEntries(keys.map(key=>[key,enabled]));
  let saved;
  await context.addInitScript(({session,id})=>{
    localStorage.setItem('sb-fdkjkzpjqfbaavylapun-auth-token',JSON.stringify(session));
    localStorage.setItem('constructor_setup_guide_hidden:'+id,'1');
  }, {session:{access_token:token,refresh_token:'synthetic',expires_at:expires,expires_in:3600,token_type:'bearer',user},id});
  // Synthetic Auth/REST/Edge transports. Never send test requests to production.
  await context.route('https://**/*',async route=>{
    const request=route.request(),url=new URL(request.url());
    if(!url.hostname.endsWith('.supabase.co'))return route.abort();
    const json = body=>route.fulfill({json:body,headers:{'access-control-allow-origin':'*'}});
    if(request.method()==='OPTIONS')return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'}});
    if(url.pathname==='/auth/v1/user')return json(user);
    if(url.pathname==='/functions/v1/list-clients')return json({users:[{id,email:user.email,nombre:'synthetic',module_visibility:permissions,show_logs:false}]});
    if(url.pathname==='/functions/v1/update-client'){
      saved=request.postDataJSON();Object.assign(permissions,saved.moduleVisibility);return json({id});
    }
    if(url.pathname==='/rest/v1/profiles')return json({id,role,nombre:'synthetic'});
    if(url.pathname==='/rest/v1/client_module_permissions')return json(permissions);
    if(url.pathname==='/rest/v1/client_subscriptions')return json({status:'active',plan_code:'starter'});
    if(url.pathname==='/rest/v1/conversions_config')return json({user_id:id,show_promotions:false,show_logs:false});
    if(url.pathname.startsWith('/rest/v1/rpc/'))return json({});
    if(url.pathname.startsWith('/rest/v1/'))return json([]);
    return route.abort();
  });
  const page=await context.newPage();
  return {context,page,permissions,get saved(){return saved;}};
}
try {
  for(const width of [1280,390]) {
    const admin=await fixture('admin',width);
    try {
      await admin.page.goto(base+'/admin/clientes/nuevo');
      await admin.page.getByText('Módulos visibles para el cliente',{exact:true}).waitFor();
      assert.equal(await admin.page.getByRole('group',{name:'Módulos visibles para el cliente'}).locator('input:checked').count(),0,'new client optional sections start disabled');
      assert.equal(await admin.page.getByLabel(/logs/i).isChecked(),false);checks++;
      assert.equal(await admin.page.locator('a[href="/admin/plan"]').count(),0,'admin has no Plans button');checks++;
      await admin.page.goto(base+`/admin/clientes/${id}/administrar`);
      const notifications=admin.page.getByLabel('Notificaciones',{exact:true});
      await notifications.waitFor();await notifications.check();
      await admin.page.getByRole('button',{name:'Guardar cambios',exact:true}).click();
      await admin.page.waitForURL('**/admin/clientes');
      assert.equal(admin.saved.moduleVisibility.show_notifications,true,'admin saves notification enablement');
      assert.equal(admin.saved.moduleVisibility.show_followups,false,'saving notifications preserves disabled followups');checks++;
      await admin.page.goto(base+'/admin/integraciones');
      await admin.page.getByText('Integración con CRM Kommo',{exact:true}).waitFor();
      assert.equal(await admin.page.getByText('con Chatrace',{exact:false}).count(),1,'superadmin retains integrations');checks++;
    } finally {await admin.context.close();}
    for(const enabled of [false,true]) {
      const client=await fixture('cliente',width,enabled);
      try {
        await client.page.goto(base+'/dashboard/inicio');
        await client.page.locator('aside nav a[href="/dashboard/inicio"]').waitFor({state:'attached'});
        for(const path of paths)assert.equal(await client.page.locator(`aside nav a[href="${path}"]`).count(),enabled?1:0);
        assert.equal(await client.page.locator('aside nav a[href="/dashboard/bots"]').count(),1);
        assert.equal(await client.page.locator('a[href="/dashboard/plan"]').count(),0,'client has no Plans button');checks++;
        if(!enabled) {
          await client.page.goto(base+'/dashboard/notificaciones');
          await client.page.waitForURL('**/dashboard/inicio');checks++;
        }
      } finally {await client.context.close();}
    }
  }
  console.log(`Browser module visibility: ${checks} checks passed on desktop and mobile (synthetic accounts).`);
} finally {await browser.close();}
