## Performance notes - 2026-08-05

Context: the Supabase project showed sustained Postgres CPU pressure and the
dashboard warning that multiple resources were being exhausted. The changes in
this batch are operational/performance-only unless noted below.

Applied migrations:

- `20260805210000_constructor_landing_phone_cache_every_5min.sql`
  - Preserves the production hotfix that changed
    `refresh_constructor_landing_phone_cache` from every 1 minute to every 5
    minutes.
  - Affects constructor phone cache freshness. If cache is stale, `landing-phone`
    falls back to live calculation.

- `20260805211000_phone_metrics_refresh_every_10min.sql`
  - Changes `refresh_phone_metrics` from every 5 minutes to every 10 minutes.
  - Affects only the freshness of the Telefonos UI metrics. It is not used for
    CTA phone assignment.

- `20260805212000_optimize_message_based_phone_assignment.sql`
  - Adds indexes for message-based fair phone assignment.
  - Does not change assignment logic. The RPC still counts live rows from
    `conversions`.

- `20260805213000_add_fk_and_inbox_hot_path_indexes.sql`
  - Adds missing FK indexes and a hot-path index for
    `conversion_inbox(user_id, action, action_event_id, created_at desc)`.
  - Helps bot LEAD/PURCHASE deduplication and referential checks without changing
    behavior.

- `20260805214000_stagger_frequent_cron_jobs.sql`
  - Staggers frequent cron jobs to avoid multiple jobs starting on the same
    minute.
  - Frequencies remain the same; only minute offsets changed.

- `20260805215000_optimize_pg_stat_top_queries.sql`
  - Adds indexes matched to the exact top `pg_stat_statements` queries observed
    after the first optimization batch.
  - Targets purchase dedupe by `purchase_coelsa_id` and
    `purchase_transaction_id`, inbox dedupe by `action_event_id`, purchase CAPI
    retry scans, conversion log backfill scans, user conversion lists, and
    normalized phone metrics lookups.
  - Does not change endpoint behavior or business logic.

- `20260806103000_optimize_phone_metrics_refresh_30min.sql`
  - Rewrites `refresh_phone_metrics` so it normalizes and filters
    `conversions` once, then derives contact and lead sets from that base.
  - Changes the Telefonos UI metrics cache refresh from every 10 minutes to
    every 30 minutes (`7,37 * * * *`).
  - Affects only the freshness of the Telefonos UI metrics. CTA phone assignment
    still counts live rows from `conversions` in `get_phone_for_landing`.

Deployed function changes:

- `supabase/functions/conversions/index.ts`
  - Adds an 8 second timeout per Meta CAPI attempt.
  - Keeps the existing 3-attempt retry behavior.
  - Returns a clear 500 when the `profiles` lookup fails, instead of returning a
    misleading 404.

Verification:

- `supabase db push --linked --yes` succeeded for every migration above,
  including `20260806103000_optimize_phone_metrics_refresh_30min.sql`.
- `supabase migration list --linked` showed the seven performance migrations in
  local and remote.
- `supabase functions deploy conversions` succeeded.
- `deno check supabase/functions/conversions/index.ts` succeeded.
- Conversion helper tests passed: 28 passed, 0 failed.
