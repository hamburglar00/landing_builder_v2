import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("el directorio Atrio combina webhook inmediato y reconciliacion sin crear vinculos", async () => {
  const [edgeFunction, migration] = await Promise.all([
    readFile("../supabase/functions/sync-atrio-directory/index.ts", "utf8"),
    readFile("../supabase/migrations/20261013001059_sync_atrio_advisor_directory_and_resolve_landing.sql", "utf8"),
  ]);

  assert.match(edgeFunction, /authorization === `Bearer \$\{atrioKey\}`/);
  assert.match(edgeFunction, /body\?\.cron_secret !== expectedCronSecret/);
  assert.match(edgeFunction, /\.eq\("atrio_id", body!\.advisor_id!\)/);
  assert.match(edgeFunction, /apply_atrio_advisor_directory_snapshot/);
  assert.doesNotMatch(edgeFunction, /\.from\("atrio_clients"\)\s*\.insert/);

  assert.match(migration, /sync-atrio-advisors-every-5min/);
  assert.match(migration, /updates exclusively clients Atrio already linked|already linked to a Landing Builder owner/i);
  assert.match(migration, /revoke all on function public\.apply_atrio_advisor_directory_snapshot/);
  assert.match(migration, /grant execute on function public\.apply_atrio_advisor_directory_snapshot\(jsonb\)\s+to service_role/i);
});
