drop function if exists public.get_whatsapp_cloud_api_config(uuid);
drop function if exists public.get_whatsapp_cloud_api_config(uuid, text);

alter table public.whatsapp_cloud_api_configs
  drop constraint if exists whatsapp_cloud_api_configs_user_name_unique;

alter table public.whatsapp_cloud_api_configs
  add constraint whatsapp_cloud_api_configs_user_workspace_name_unique
  unique (user_id, workspace_currency, name);

delete from public.whatsapp_cloud_api_gerencias wg
using public.whatsapp_cloud_api_configs cfg, public.gerencias g
where wg.config_id = cfg.id
  and wg.gerencia_id = g.id
  and (
    wg.user_id <> cfg.user_id
    or g.user_id <> cfg.user_id
    or coalesce(g.workspace_currency, 'ARS') <> coalesce(cfg.workspace_currency, 'ARS')
  );

create or replace function public.enforce_whatsapp_cloud_api_assignment_workspace()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_config_user_id uuid;
  v_config_workspace text;
  v_gerencia_user_id uuid;
  v_gerencia_workspace text;
begin
  select c.user_id, coalesce(nullif(c.workspace_currency, ''), 'ARS')
    into v_config_user_id, v_config_workspace
  from public.whatsapp_cloud_api_configs c
  where c.id = new.config_id;

  if v_config_user_id is null then
    raise exception 'Configuracion WhatsApp Cloud API no encontrada';
  end if;

  select g.user_id, coalesce(nullif(g.workspace_currency, ''), 'ARS')
    into v_gerencia_user_id, v_gerencia_workspace
  from public.gerencias g
  where g.id = new.gerencia_id;

  if v_gerencia_user_id is null then
    raise exception 'Gerencia no encontrada';
  end if;

  if new.user_id <> v_config_user_id or v_gerencia_user_id <> v_config_user_id then
    raise exception 'La gerencia no pertenece al cliente de la configuracion';
  end if;

  if v_gerencia_workspace <> v_config_workspace then
    raise exception 'La gerencia pertenece a otro workspace';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_whatsapp_cloud_api_assignment_workspace
  on public.whatsapp_cloud_api_gerencias;

create trigger trg_whatsapp_cloud_api_assignment_workspace
before insert or update of config_id, user_id, gerencia_id
on public.whatsapp_cloud_api_gerencias
for each row
execute function public.enforce_whatsapp_cloud_api_assignment_workspace();

create or replace function public.get_whatsapp_cloud_api_config(
  p_user_id uuid default null,
  p_workspace_currency text default null
)
returns table (
  id uuid,
  user_id uuid,
  name text,
  active boolean,
  workspace_currency text,
  phone_number_id text,
  whatsapp_business_account_id text,
  display_phone_number text,
  meta_access_token text,
  meta_app_secret text,
  has_meta_access_token boolean,
  has_meta_app_secret boolean,
  meta_api_version text,
  webhook_verify_token text,
  meta_messaging_dataset_id text,
  landing_tag text,
  gerencia_selection_mode text,
  gerencia_fair_criterion text,
  send_contact_capi boolean,
  redirect_message_template text,
  fallback_message_template text,
  redirect_use_cta_button boolean,
  redirect_cta_button_title text,
  phone_number_status text,
  quality_rating text,
  messaging_limit_tier text,
  health_checked_at timestamptz,
  health_last_error text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = public, pg_temp
as $$
  with viewer as (
    select
      (select auth.uid()) as uid,
      exists (
        select 1
        from public.profiles p
        where p.id = (select auth.uid())
          and p.role = 'admin'
      ) as is_admin
  ),
  request_scope as (
    select
      coalesce(p_user_id, (select uid from viewer)) as uid,
      case
        when upper(coalesce(nullif(btrim(p_workspace_currency), ''), '')) in ('ARS', 'PYG')
          then upper(btrim(p_workspace_currency))
        else 'ARS'
      end as workspace_currency
  )
  select
    c.id,
    c.user_id,
    c.name,
    c.active,
    c.workspace_currency,
    c.phone_number_id,
    c.whatsapp_business_account_id,
    c.display_phone_number,
    c.meta_access_token,
    c.meta_app_secret,
    length(btrim(coalesce(c.meta_access_token, ''))) > 0 as has_meta_access_token,
    length(btrim(coalesce(c.meta_app_secret, ''))) > 0 as has_meta_app_secret,
    c.meta_api_version,
    c.webhook_verify_token,
    c.meta_messaging_dataset_id,
    c.landing_tag,
    c.gerencia_selection_mode,
    c.gerencia_fair_criterion,
    c.send_contact_capi,
    c.redirect_message_template,
    c.fallback_message_template,
    c.redirect_use_cta_button,
    c.redirect_cta_button_title,
    c.phone_number_status,
    c.quality_rating,
    c.messaging_limit_tier,
    c.health_checked_at,
    c.health_last_error,
    c.created_at,
    c.updated_at
  from public.whatsapp_cloud_api_configs c
  cross join viewer v
  cross join request_scope rs
  where v.uid is not null
    and rs.uid is not null
    and c.user_id = rs.uid
    and c.workspace_currency = rs.workspace_currency
    and (v.is_admin or c.user_id = v.uid)
  order by c.created_at desc
  limit 1;
$$;

comment on function public.get_whatsapp_cloud_api_config(uuid, text) is
  'Devuelve la configuracion de WhatsApp Cloud API del cliente filtrada por workspace ARS/PYG.';

revoke all on function public.get_whatsapp_cloud_api_config(uuid, text) from public, anon;
grant execute on function public.get_whatsapp_cloud_api_config(uuid, text) to authenticated;

create or replace function public.get_whatsapp_cloud_api_config(
  p_user_id uuid default null
)
returns table (
  id uuid,
  user_id uuid,
  name text,
  active boolean,
  workspace_currency text,
  phone_number_id text,
  whatsapp_business_account_id text,
  display_phone_number text,
  meta_access_token text,
  meta_app_secret text,
  has_meta_access_token boolean,
  has_meta_app_secret boolean,
  meta_api_version text,
  webhook_verify_token text,
  meta_messaging_dataset_id text,
  landing_tag text,
  gerencia_selection_mode text,
  gerencia_fair_criterion text,
  send_contact_capi boolean,
  redirect_message_template text,
  fallback_message_template text,
  redirect_use_cta_button boolean,
  redirect_cta_button_title text,
  phone_number_status text,
  quality_rating text,
  messaging_limit_tier text,
  health_checked_at timestamptz,
  health_last_error text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select *
  from public.get_whatsapp_cloud_api_config(p_user_id, 'ARS');
$$;

revoke all on function public.get_whatsapp_cloud_api_config(uuid) from public, anon;
grant execute on function public.get_whatsapp_cloud_api_config(uuid) to authenticated;

revoke all on function public.enforce_whatsapp_cloud_api_assignment_workspace() from public, anon, authenticated;
grant execute on function public.enforce_whatsapp_cloud_api_assignment_workspace() to service_role;
