-- reached_repeat: usar purchase_count > 1 en lugar de observaciones.
-- Si un contacto tiene más de 1 compra, alcanzó recarga (no depende de REPEAT en observaciones).

drop view if exists public.funnel_contacts;

create view public.funnel_contacts
with (security_invoker = true) as
select
  c.user_id,
  c.phone,
  max(c.email)        filter (where c.email <> '')        as email,
  max(c.fn)           filter (where c.fn <> '')           as fn,
  max(c.ln)           filter (where c.ln <> '')           as ln,
  max(c.ct)           filter (where c.ct <> '')           as ct,
  max(c.st)           filter (where c.st <> '')           as st,
  max(c.country)      filter (where c.country <> '')      as country,
  max(c.geo_region)   filter (where c.geo_region <> '')   as region,
  max(c.utm_campaign) filter (where c.utm_campaign <> '') as utm_campaign,
  max(c.device_type)  filter (where c.device_type <> '')  as device_type,
  max(c.landing_name) filter (where c.landing_name <> '') as landing_name,

  coalesce(sum(c.valor) filter (where c.estado = 'purchase'), 0) as total_valor,
  count(*) filter (where c.estado = 'purchase')                  as purchase_count,
  count(*) filter (where c.observaciones like '%REPEAT%')        as repeat_count,
  count(*) filter (where c.estado = 'lead')                      as lead_count,
  count(*) filter (where c.estado = 'contact')                   as contact_count,

  bool_or(c.contact_event_id <> '')  as reached_contact,
  bool_or(c.lead_event_id <> '')     as reached_lead,
  bool_or(c.purchase_event_id <> '') as reached_purchase,
  (count(*) filter (where c.estado = 'purchase') > 1)     as reached_repeat,

  max(c.created_at) as last_activity,
  min(c.created_at) as first_contact
from public.conversions c
where c.phone <> ''
group by c.user_id, c.phone;

comment on view public.funnel_contacts is 'Vista agregada por teléfono. reached_repeat = purchase_count > 1.';
