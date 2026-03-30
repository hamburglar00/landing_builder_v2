alter table public.conversions_pixel_configs
  add column if not exists send_contact_capi boolean not null default false,
  add column if not exists geo_use_ipapi boolean not null default false,
  add column if not exists geo_fill_only_when_missing boolean not null default false;

update public.conversions_pixel_configs p
set
  send_contact_capi = coalesce(c.send_contact_capi, false),
  geo_use_ipapi = coalesce(c.geo_use_ipapi, false),
  geo_fill_only_when_missing = coalesce(c.geo_fill_only_when_missing, false)
from public.conversions_config c
where c.user_id = p.user_id
  and (
    p.send_contact_capi is distinct from coalesce(c.send_contact_capi, false)
    or p.geo_use_ipapi is distinct from coalesce(c.geo_use_ipapi, false)
    or p.geo_fill_only_when_missing is distinct from coalesce(c.geo_fill_only_when_missing, false)
  );
