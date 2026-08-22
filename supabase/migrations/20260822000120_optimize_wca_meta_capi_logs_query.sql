create index if not exists conversion_logs_wca_capi_recent_idx
  on public.conversion_logs (user_id, workspace_currency, created_at desc)
  where payload_meta <> ''
    and conversion_id is not null;
