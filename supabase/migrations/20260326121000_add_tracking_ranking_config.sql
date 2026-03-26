alter table public.conversions_config
  add column if not exists tracking_ranking_config jsonb;

comment on column public.conversions_config.tracking_ranking_config is
  'Configuracion persistente del ranking de Seguimiento (reglas, indicador final y criterio de orden).';

