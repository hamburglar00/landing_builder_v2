// Scoped dependency schema, NOT a replacement for the full migration replay.
// Real base DDL, uniqueness constraints and Purchase claim RPCs are executed unchanged.
// Additional nullable columns mirror the current TypeScript row interfaces.
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { read,root } from './local-runtime.mjs';
const ts=createRequire(join(root,'frontend/package.json'))('typescript');
export function handlerSchema(db){
 const source=ts.createSourceFile('index.ts',read('supabase/functions/conversions/index.ts'),ts.ScriptTarget.Latest,true);
 const columns=(table,iface)=>{
  const node=source.statements.find(s=>ts.isInterfaceDeclaration(s)&&s.name.text===iface);
  if(!node)throw Error(`Interface missing: ${iface}`);
  const ddl=[];for(const m of node.members){
   const name=m.name?.getText(source),type=m.type?.getText(source)??'';
   if(!name||name==='id')continue;
   const sqlType=/boolean/.test(type)?'boolean':/number/.test(type)?'numeric':/Record</.test(type)?'jsonb':'text';
   ddl.push(`alter table public.${table} add column if not exists "${name}" ${sqlType};`);
  }
  db.sql(ddl.join('\n'));
 };
 const migration=file=>db.sql(read('supabase/migrations/'+file));
 db.sql(read('scripts/phase0/local-schema.sql').split('create table public.conversions (')[0]);
 db.sql(`create table public.profiles(id uuid primary key,role text default 'client',nombre text);
 create table public.landings(id uuid primary key,name text,user_id uuid,workspace_currency text,pixel_id text,landing_tag text);
 create table public.gerencias(id integer primary key,user_id uuid,gerencia_id integer,name text,label text,workspace_currency text);
 create table public.gerencia_phones(id bigint primary key,gerencia_id integer,phone text,kind text,status text);
 create table public.landings_gerencias(landing_id uuid,gerencia_id integer);
 create table public.settings(id integer primary key,url_base text);
 create table public.cron_config(key text primary key,value text);
 create table public.ar_name_inferred_sex(name_normalized text,sex text);
 create table public.ar_phone_area_codes(codigo_de_area text,localidad text,provincia text,zip_exacto text,zip_aproximado text);
 create table public.whatsapp_cloud_api_assignments(id uuid,user_id uuid,promo_code text,conversion_id uuid,gerencia_id integer,gerencia_phone_id bigint,created_at timestamptz,assigned_gerencia_id integer,assigned_gerencia_external_id integer,assigned_gerencia_name text,assigned_gerencia_label text);
 create table public.chatrace_client_configs(user_id uuid,active boolean,send_meta_capi_events boolean,send_business_messaging_purchase_capi boolean,whatsapp_business_account_id text,meta_messaging_dataset_id text,meta_messaging_access_token text,meta_pixel_id text);
 create table public.whatsapp_cloud_api_configs(user_id uuid,active boolean,phone_number_id text,whatsapp_business_account_id text,meta_messaging_dataset_id text,enrich_business_messaging_user_data boolean,send_business_messaging_purchase_type_capi boolean,meta_access_token text,meta_api_version text,updated_at timestamptz);`);
 migration('20260416100001_conversions.sql');columns('conversions','ConversionRow');
 migration('20260416100000_conversions_config.sql');columns('conversions_config','ConversionsConfig');
 migration('20260330160000_conversions_multi_pixel_configs.sql');columns('conversions_pixel_configs','PixelConfigRow');
 migration('20260416200000_conversion_logs.sql');
 db.sql(`alter table public.conversion_logs add column if not exists workspace_currency text,
 add column if not exists payload_received text,add column if not exists result text,
 add column if not exists payload_meta text,add column if not exists response_meta text;`);
 for(const file of ['20260326235900_conversion_inbox.sql','20260328001000_conversion_inbox_action_event_id.sql','20260430170000_conversion_inbox_deferred_status.sql',
 '20260427200000_conversions_contact_dedupe_unique_indexes.sql','20260506103000_purchase_coelsa_id_dedupe.sql','20260514120000_purchase_transaction_id_dedupe.sql',
 '20260609120000_lead_inbox_dedupe_by_promo.sql','20260609123000_purchase_inbox_dedupe_by_promo_without_strong_ids.sql',
 '20260613120000_contact_lead_capi_retry_flags.sql','20260728163000_purchase_event_atomic_claims.sql',
 '20260609213000_conversion_log_lead_backfill_replays.sql'])migration(file);
 db.sql('alter table public.conversion_inbox add column if not exists workspace_currency text; grant usage on schema public,auth to service_role; grant all on all tables in schema public to service_role; grant all on all sequences in schema public to service_role; grant execute on all functions in schema public to service_role;');
}
