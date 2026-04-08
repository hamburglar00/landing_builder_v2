alter table public.chatrace_client_configs
  add column if not exists gerencia_selection_mode text not null default 'weighted_random'
  check (gerencia_selection_mode in ('weighted_random', 'fair')),
  add column if not exists gerencia_fair_criterion text not null default 'usage_count'
  check (gerencia_fair_criterion in ('usage_count', 'messages_received'));
comment on column public.chatrace_client_configs.gerencia_selection_mode is
  'Modo de seleccion de gerencias para Chatrace: weighted_random (por peso) o fair (equitativa).';
comment on column public.chatrace_client_configs.gerencia_fair_criterion is
  'Criterio para gerencia_selection_mode=fair en Chatrace: usage_count o messages_received.';
