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

## Production rollout — 30 October 2026 (Argentina)

All six repositories were committed, pushed and published. Gateways were promoted before the landing engines. Every Vercel deployment reached READY with the exact implementation commit below; Multi Skin was also rebuilt with OpenNext and published to Cloudflare with existing variables preserved.

| Component | Implementation commit | Published deployment |
|---|---|---|
| Builder | `e317f2865adb8ec74a6b515fde64c9b2dfb9ff8e` | `dpl_D9Y5rzJvg4nnEEKYs1rwYLCGPjm8` |
| Classic | `fa47cc4d68296acb3a7ed8f9040115c4b81e083f` | `dpl_GQpxtRf9k8g6wmU2WLEijTs1zKYo` |
| Rey de Ases | `b35ef0ba32af8feb0c7297a0cefdf26221735da6` | `dpl_2kFw9GxozqCLMNq4f29T7w6myXym` |
| Ases del Norte | `e35c20eb2692b522a68b0b64e9f47817bbbeb0ea` | `dpl_44jyPzr7iELWcynyC4rFrhqVLssX` |
| Ganamos NET | `15ef1e22d792a62e82a21d22d6640b69a536b6a3` | `dpl_556DLoxnnN63jSoeuieg7whoXyJX` |
| Multi Skin | `fd0c04c395fee5d927b76a92a9a542522ec7d7e6` | `dpl_GpqQTJTa9rZPPTY4mJXcMEEZLjzD` |

Cloudflare Worker version: `33ace3a7-fe93-46e5-9f7e-63a83caad5a5`, serving `ganamosnet.global` and its workers.dev origin. The upstream relay was unchanged.

Database changes already applied by this release:

- Builder: `20261030234129_entry_funnel_observability.sql`.
- Rey de Ases: `20261030234520_handoff_retry_capability.sql`. Existing consumed passes without a retry capability remain consumed. Verified RLS/forced RLS and no anonymous/authenticated table access.
- Atrio: `gateway_entry_settings.redirect_wait_enabled=false`. The configurable `redirect_wait_seconds=20` is retained but disabled.

This release introduces no API2 or Panel3 code changes or migrations. The separately pending real Multi Skin account/skin E2E still requires that integration and its bot configuration to be deployed.

Post-publication verification:

- 48/48 read-only gateway checks across four Vercel public origins and two Cloudflare origins: marketing parameters and diagnostic context accepted by `/prepare`; duplicate/missing access tokens and unexpected authority parameters rejected; diagnostic GET without a cookie returns 204; public gateway asset hashes match the implementation commits.
- Classic `/diana` and Builder `/l/diana` return 200 and reference the new content-hashed runtime. Both assets return 200 with one-year immutable caching and match the local manifest exactly.
- Both first-party collectors return 405 for unsupported GET, 400 for an invalid payload and 429 for a valid payload referencing a deliberately nonexistent landing. SQL checks before/after confirm zero inserted test events and rate-limit rows. These checks do not emit Contact, PageView or CAPI events.
- Migration presence and disabled artificial wait were rechecked after publication. Git working trees were clean and synchronized with upstream before this documentation-only update.

Evidence files are in the local temporary directory: `gateway-production-entry-vercel-report-20261030.json`, `gateway-production-entry-cloudflare-report-20261030.json`, `entry-funnel-prod-landing-panelbotadmin-com.json`, and `entry-funnel-prod-mkt-panelbotadmin-com.json`. They contain no access tokens, cookies or player credentials.

The browser regression matrices cover 64 gateway, 36 landing and 8 telemetry scenarios using controlled services. Four real PostgreSQL retry/concurrency checks passed. A subsequently added real lock-timeout case could not run because the local Docker daemon became read-only; the bounded transaction/rollback behavior passed its route/unit checks. Production builds passed. Real Meta in-app rendering, provider latency and campaign conversion cost must be evaluated from subsequent traffic; these checks do not establish those outcomes or guarantee delivery under every upstream failure.

## Follow-up: tolerate unknown advertising parameters

The user clarified that new advertising query fields must never require an allowlist update, and that `/gast?landing=diana` must keep selecting Diana. The first rollout's closed marketing list has been replaced in both engines and all four gateways. Only route-declared protocol fields are validated; unrelated fields, including repeated or long values, cannot reject an otherwise valid pass or select an account/redirect. Authentication URLs are rebuilt with protocol fields only. Landing routing and attribution retain their existing parameters; automatic T7/T8 account recovery now also carries fbc/fbp and the current campaign attribution. Functional duplicates, token checks, authorized origins and return nonces remain enforced. Diagnostics contain counts and fixed reasons, not arbitrary parameter names or values.

| Component | Commit | Published deployment |
|---|---|---|
| Builder | `ffe17916795b93cece8d193cad22c768da4078a1` | `dpl_DRcSQTVR5n12tPocCTSxSYznMyge` |
| Classic | `68be137d17616b04364568d61f3ce03858b20211` | `dpl_EFU6dngn1TTpfP3M5uXEFKV9hYjN` |
| Rey de Ases | `8909f50fccb5d750841abf756b4ed0aa3dc91936` | `dpl_6wjUCywiVgTmFSrhzJ6XxZx3snEu` |
| Ases del Norte | `3a5d34d975cd0d24a4b8b57811b8337a00f9953e` | `dpl_Gwgu2AYHtE34GHD5ZPRn5aymVNLe` |
| Ganamos NET | `28f2a21adefeaff00612891861565d40fd2d3451` | `dpl_CVShjYx1frz4kH8dTWE3Eyh58ZHA` |
| Multi Skin Vercel | `8bd9308a2274c29a47a270ad621081d149100ae4` | `dpl_4PrCziQPvhd8xvkFhTktCc5rqrhj` |

The public checks exposed a separate OpenNext Cloudflare adapter defect: it rebuilt `req.url` from decoded query values without re-encoding them. Nested `return_to` parameters were split, losing `landing` or the required nonce; an encoded extra containing `&t=` could become a separate protocol parameter. Commit `d894d84a9665a63f6fb55d66ee1f49cc78eaac6f` corrects only that generated Worker call site with `URLSearchParams.append`. It preserves real duplicate values and does not relax validation. Build/deploy hooks apply the idempotent patch and reject adapter drift; direct Wrangler deploy also runs the guard. No node_modules edits are required. This compatibility change is specific to Cloudflare and does not change Vercel application behavior.

The final Worker version is **`d4ba60ce-0f77-4904-a015-0b08e1425f7e`** on both public Cloudflare origins, built from `d894d84` and deployed with `--keep-vars`. No new database migrations or API2/Panel3 changes were needed.

Validation: 353 focused gateway tests, 87 Builder tests, 36 classic tests, six TypeScript checks, 64 gateway browser cases and 44 landing browser cases passed. The adapter has five passing tests against installed code/generated output, eight HTTP checks on a real local Worker and a successful Wrangler dry-run showing the guard executed. Remote Vercel builds and the final OpenNext build passed.

Final production verification passed **42/42** read-only HTTP checks across the four Vercel and two Cloudflare origins: new/repeated parameters, ignored authority-like extras, encoded values that must not inject a pass, invalid/duplicate passes, full nested landing return and rejection of foreign return origins. Both public landing engines render Diana from `/gast?landing=diana&new_meta_field=x&new_meta_field=y`, retain the query, and serve the correct new immutable runtime. All four previously published runtime assets remain available in each engine. No JavaScript, provider login, account creation or Meta/CAPI events were executed by these production checks.

Additional evidence in TEMP: `entry-query-open-production-20261030.json`, `gateway-entry-query-open-browser-report-20261030.json`, `multi-worker-query-compatibility-local-20261030.json`, and `multi-worker-query-patch-dryrun-20261030.log`.
