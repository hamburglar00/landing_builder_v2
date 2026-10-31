# T7/T8: internal entry funnel

The collector is diagnostic and does not emit Meta events, change Contact deduplication, create accounts, or grant session authority. Existing fbclid/fbc attribution stays in the existing journey path. No names (including partial names), keystrokes, credentials, access passes, query strings, IP addresses or advertising identifiers are stored in these tables.

The first-party public landing records `page_visible`, `form_visible`, `name_focus`, `name_started`, `name_valid`, `skin_selected`, `cta_clicked`, and `destination_ready`. Input stages are emitted once per page/provider/skin; early input before the shared runtime finishes loading is retained as stage booleans and timestamps only. Gateway renderers record `account_ready` after a confirmed account result, `login_confirmed` after the exact authenticated entry confirmation, `gateway_loaded` when the final page binds the chat, and `chat_ready` only from the existing authorized iframe readiness handshake. Failures use closed error categories and optional HTTP status, never free-form upstream errors.

`flow_id` is a random diagnostic UUID, separate from device/player/account/session IDs. It resumes within the same tab and landing for up to 24 hours; another tab may represent another flow. This is neither unique people nor a count of Meta PageViews. Context crosses the gateway in encrypted diagnostic claims and a dedicated host-only HttpOnly cookie. It cannot authenticate a player. The gateway diagnostic proxy checks origin, decrypted context, matching landing/flow/template and the fixed first-party collector origin. Nothing in login waits for telemetry delivery.

Batching is nonblocking (500 ms), capped at 20 events/request and 16 KB. Failed delivery retries once with the same event IDs. Unacknowledged beacons retain their IDs for a later replay. SQL deduplicates, locks each landing/flow, limits each flow to 200 stored events and each landing to 3,000 events/minute. The service derives owner and template from `landings`; clients cannot select an owner. Stage columns are closed and tables/functions deny anon and authenticated reads/writes/execution.

Migration **20261030234129_entry_funnel_observability.sql** was applied to Builder Supabase (`fdkjkzpjqfbaavylapun`). Verified both RLS flags, invoker RPC, private grants and the active hourly retention job. Retention purges at most 10,000 events older than 90 days and 10,000 limit buckets older than two days per run. No existing data was modified. Security advisors show two expected INFO notices for the new service-only tables with no client policies; no new WARN findings.

An abandoned journey is an inference, never a fact established by `visibility_hidden`: a user can switch apps, receive a phone call or return later. Use a reporting cutoff (example: 30 minutes since last event), and recalculate when `resumed` or a later successful stage arrives. Browser blocking or process termination can also lose diagnostic events.

Example internal query, executed with authorized service/database access (substitute the landing and reporting window):

```sql
with flows as (
  select landing_id, flow_id,
    min(received_at) as first_seen, max(received_at) as last_seen,
    bool_or(event_name='page_visible') as page_seen,
    bool_or(event_name='name_started') as name_started,
    bool_or(event_name='cta_clicked') as cta_clicked,
    bool_or(event_name='account_ready') as account_ready,
    bool_or(event_name='chat_ready') as chat_ready,
    bool_or(event_name='entry_error') as error_seen,
    min(elapsed_ms) filter (where event_name='chat_ready') as to_chat_ms
  from public.entry_funnel_events
  where landing_id = '<landing-uuid>'::uuid
    and received_at >= now() - interval '7 days'
  group by landing_id, flow_id
)
select count(*) filter (where page_seen) as observed_flows,
  count(*) filter (where name_started) as started_name,
  count(*) filter (where cta_clicked) as clicked_create,
  count(*) filter (where account_ready) as account_ready,
  count(*) filter (where chat_ready) as chat_ready,
  count(*) filter (where name_started and not cta_clicked and last_seen < now()-interval '30 minutes') as inferred_exit_while_typing,
  count(*) filter (where cta_clicked and not chat_ready and error_seen) as access_with_recorded_error,
  percentile_cont(0.75) within group (order by to_chat_ms) filter (where chat_ready) as p75_to_chat_ms
from flows;
```

Validation commands:

```powershell
# No business/provider/Meta calls; public requests are intercepted and the cookie collector uses loopback only.
node scripts/check-entry-funnel-browser.mjs
# Dedicated offline Postgres container only; test creates its own fixture database.
$env:ENTRY_FUNNEL_TEST_CONTAINER='atrio-skin-validation-20261030'
node scripts/phase0/entry-funnel-database.mjs
# Frontend unit tests: entryFunnel.test.ts and template7Preparation.test.ts.
# Gateway tests: entry-funnel-server.test.ts and preparations/complete/funnel-error.test.ts.
node scripts/sync-entry-funnel.mjs --check
node scripts/sync-gateway-entry-funnel.mjs --check
```

These validations cover local browser/runtime behavior, actual PostgreSQL concurrency/permissions and mocked orchestration. They do not claim a completed real new-account E2E through API2 or Meta's physical in-app browsers.
