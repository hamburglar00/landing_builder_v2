-- Optimize message-based fair phone assignment without changing behavior.
-- The assignment RPC still counts live rows from conversions; these indexes only
-- make the existing lookups cheaper for Postgres.

set statement_timeout = '10min';

create index if not exists conversions_assignment_messages_lookup_idx
  on public.conversions (user_id, telefono_asignado, lead_event_time, created_at)
  where lead_event_id <> ''
    and telefono_asignado <> '';

comment on index public.conversions_assignment_messages_lookup_idx is
  'Supports get_phone_for_landing/get_phone_for_chatrace_client when fair_criterion=messages_received.';

create index if not exists gerencia_phones_assignment_active_kind_phone_idx
  on public.gerencia_phones (gerencia_id, kind, phone, messages_reset_at)
  where status = 'active';

comment on index public.gerencia_phones_assignment_active_kind_phone_idx is
  'Supports active phone selection and message counting by gerencia/kind during CTA phone assignment.';
