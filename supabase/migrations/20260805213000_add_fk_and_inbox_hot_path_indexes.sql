-- Add missing FK indexes and one hot-path inbox lookup index.
-- This is an additive performance-only migration: no data, logic, policies,
-- triggers, or functions are changed.

set statement_timeout = '10min';

create index if not exists conversion_inbox_conversion_id_idx
  on public.conversion_inbox (conversion_id)
  where conversion_id is not null;

create index if not exists conversion_logs_conversion_id_idx
  on public.conversion_logs (conversion_id)
  where conversion_id is not null;

create index if not exists purchase_event_claims_conversion_id_idx
  on public.purchase_event_claims (conversion_id)
  where conversion_id is not null;

create index if not exists chatrace_gerencias_gerencia_id_idx
  on public.chatrace_gerencias (gerencia_id);

create index if not exists phone_metrics_gerencia_id_idx
  on public.phone_metrics (gerencia_id);

create index if not exists promotions_winner_participant_id_idx
  on public.promotions (winner_participant_id)
  where winner_participant_id is not null;

create index if not exists conversions_lead_attribution_conversion_id_idx
  on public.conversions (lead_attribution_conversion_id)
  where lead_attribution_conversion_id is not null;

create index if not exists conversions_purchase_attribution_conversion_id_idx
  on public.conversions (purchase_attribution_conversion_id)
  where purchase_attribution_conversion_id is not null;

create index if not exists conversion_inbox_user_action_event_created_idx
  on public.conversion_inbox (user_id, action, action_event_id, created_at desc)
  where action_event_id <> '';
