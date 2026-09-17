// Synthetic transport fixtures. No application computation is implemented here.
export const owner='18000000-0000-0000-0000-000000000001';
export const landingId='18000000-0000-0000-0000-000000000002';
export const at='2026-09-15T12:00:00Z';
export const user={id:owner,aud:'authenticated',role:'authenticated',email:'synthetic@example.invalid',app_metadata:{provider:'email'},user_metadata:{},created_at:at};
export function responseFor(request,currency){
  const url=new URL(request.url), endpoint=url.pathname.split('/').at(-1);
  const single=String(request.headers.Accept??request.headers.accept??'').includes('vnd.pgrst.object');
  const gerencia={id:1,user_id:owner,gerencia_id:1,nombre:'Synthetic',workspace_currency:currency,currency,fair_criterion:'messages_received'};
  const landing={id:landingId,user_id:owner,name:'synthetic-landing',workspace_currency:currency,landing_type:'internal',publish_target:'constructor',
    external_domain:'',pixel_id:'',comment:'',landing_tag:'SYNTHETIC',config:{backgroundImages:[],logoUrl:'',marketCountry:currency==='ARS'?'AR':'PY'},created_at:at,updated_at:at};
  let data;
  if(url.pathname==='/auth/v1/user')data=user;
  else if(endpoint==='profiles')data=[{id:owner,role:'client',nombre:'Synthetic',onboarding_completed:true}];
  else if(endpoint==='client_subscriptions')data=[{user_id:owner,plan_code:'premium',status:'active',max_landings:100,max_phones:100,expires_at:null,grace_days:5}];
  else if(endpoint==='conversions_config')data=[{user_id:owner,show_logs:false,show_inbox:false,show_promotions:false,phone_auto_reset_daily:false,pixel_id:'',access_token:''}];
  else if(endpoint==='get_home_overview_stats_cached_by_currency')data=[{landings_count:1,porcentaje_carga:50,carga_promedio:100,total_cargado:20000,jugadores_premium:2,retencion_activa_30d:10}];
  else if(endpoint==='landings')data=[landing];
  else if(endpoint==='settings')data=[{id:1,url_base:'https://example.invalid',show_client_landing_preview:false,revalidate_secret:''}];
  else if(endpoint==='gerencias')data=[gerencia];
  else if(endpoint==='landings_gerencias')data=[{landing_id:landingId,gerencia_id:1,weight:100,phone_mode:'fair',phone_kind:'carga',gerencias:gerencia}];
  else if(endpoint==='gerencia_phones')data=Array.from({length:10},(_,i)=>({id:i+1,gerencia_id:1,phone:`00000${i}`,status:'active',source_available:true,usage_count:i,kind:'carga',assignment_role:'acquisition',comment:'',messages_reset_at:null,created_at:at,updated_at:at}));
  else if(endpoint==='phone_metrics')data=Array.from({length:10},(_,i)=>({gerencia_phone_id:i+1,messages_received:i,messages_received_historical:i*2,calculated_at:at}));
  else if(endpoint==='conversions')data=Array.from({length:1205},(_,i)=>({id:`19000000-0000-0000-0000-${String(i+1).padStart(12,'0')}`,user_id:owner,estado:'purchase',currency,
    phone:`000${String(i).padStart(6,'0')}`,email:`synthetic-${i}@example.invalid`,external_id:`synthetic-${i}`,promo_code:`SYNTHETIC-${i}`,landing_id:landingId,landing_name:'synthetic-landing',landing_tag:'SYNTHETIC',gerencia_id:1,
    purchase_event_id:`synthetic-${i}`,purchase_type:i%2?'repeat':'first',valor:100,from_meta_ads:true,test_event_code:'',created_at:at,contact_event_id:`synthetic-contact-${i}`,lead_event_id:`synthetic-lead-${i}`}));
  else if(endpoint==='get_meta_audience_buyers_v2_payload')data={version:2,rows:Array.from({length:200},(_,i)=>[
    `synthetic-${i}`,'',`synthetic-${i}@example.invalid`,'','','','','','',currency,3,1,2,300,100,100,100,at,at,1,3,1,2,300,100,200,100,100])};
  else if(endpoint==='conversion_journey_starts')data=Array.from({length:25},(_,i)=>({id:`synthetic-journey-${i}`,user_id:owner,currency,external_id:`synthetic-${i}`,landing_tag:'SYNTHETIC',first_seen_at:at,created_at:at,from_meta_ads:true}));
  else if(['hidden_conversions','hidden_contacts','hidden_conversion_logs','hidden_conversion_inbox','conversion_pixel_configs','conversions_pixel_configs','pixel_configs','meta_audience_configs','gerencia_work_groups','atrio_clients','landing_atrio_assignments','landings_atrio','landings_atrio_clients','gerencia_work_group_members','conversions_view_settings','conversion_view_preferences'].includes(endpoint))data=[];
  else return {unknown:true,endpoint};
  if(Array.isArray(data)){
    const offset=Number(url.searchParams.get('offset')??0),limit=Number(url.searchParams.get('limit')??data.length);
    data=data.slice(offset,offset+limit);
    if(single)data=data[0]??null;
  }
  return {endpoint,data,rows:Array.isArray(data)?data.length:data?.version===2?data.rows.length:data===null?0:1};
}
