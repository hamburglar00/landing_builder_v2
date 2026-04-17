alter table public.conversions_config
  add column if not exists show_ai_assistant boolean not null default false;

comment on column public.conversions_config.show_ai_assistant is
  'Si true, muestra el agente IA de Estadisticas en la UI del cliente.';

update public.conversions_config
set show_ai_assistant = false
where show_ai_assistant is null;
