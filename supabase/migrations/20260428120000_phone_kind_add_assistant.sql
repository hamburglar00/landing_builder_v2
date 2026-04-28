-- Allow assistant phone kind as a fourth routing bucket.
-- The external API returns assistant.whatsapp alongside load/ads/mkt.

alter table public.landings
  drop constraint if exists landings_phone_kind_check;

alter table public.landings
  add constraint landings_phone_kind_check
  check (phone_kind in ('carga', 'ads', 'mkt', 'assistant'));

comment on column public.landings.phone_kind is
  'Tipo de teléfono preferido para esta landing: carga, ads, mkt o assistant.';

alter table public.gerencia_phones
  drop constraint if exists gerencia_phones_kind_check;

alter table public.gerencia_phones
  add constraint gerencia_phones_kind_check
  check (kind in ('carga', 'ads', 'mkt', 'assistant'));

comment on column public.gerencia_phones.kind is
  'Tipo de teléfono: carga, ads, mkt o assistant, según lo que devuelva la API externa (load/ads/mkt/assistant).';

alter table public.landings_gerencias
  drop constraint if exists landings_gerencias_phone_kind_check;

alter table public.landings_gerencias
  add constraint landings_gerencias_phone_kind_check
  check (phone_kind in ('carga', 'ads', 'mkt', 'assistant'));

comment on column public.landings_gerencias.phone_kind is
  'Tipo de teléfono preferido para esta gerencia en esta landing: carga, ads, mkt o assistant.';

alter table public.chatrace_gerencias
  drop constraint if exists chatrace_gerencias_phone_kind_check;

alter table public.chatrace_gerencias
  add constraint chatrace_gerencias_phone_kind_check
  check (phone_kind in ('carga', 'ads', 'mkt', 'assistant'));

comment on column public.chatrace_gerencias.phone_kind is
  'Tipo de teléfono preferido para esta gerencia en Chatrace: carga, ads, mkt o assistant.';

