-- Keep the existing owner/admin RLS, delete operation and foreign-key actions.
-- Every deleted phone checks these relations; without phone-first indexes the
-- global cleanup repeatedly scans them and exceeds PostgREST's 8s timeout.
set local lock_timeout = '3s';

create index if not exists phone_assignment_scope_metrics_phone_fk_idx
  on public.phone_assignment_scope_metrics (phone_id);

create index if not exists landing_phone_availability_demands_selected_phone_fk_idx
  on public.landing_phone_availability_demands (selected_phone_id)
  where selected_phone_id is not null;

create index if not exists whatsapp_cloud_api_assignments_assigned_phone_fk_idx
  on public.whatsapp_cloud_api_assignments (assigned_phone_id)
  where assigned_phone_id is not null;
