import assert from "node:assert/strict";
import test from "node:test";
import { safeProvisionTiming, template7ServerTiming } from "../lib/reyDeAses/performance.server";

test("provider timings forward only bounded numeric phases and discard descriptions/unknown headers", () => {
  const timing = safeProvisionTiming('atrio_database_lookup;dur=12, atrio_provider_create;dur=940, username;desc="private", atrio_local_finalize;dur=20, atrio_provider_verify;dur=99999999');
  assert.equal(timing, "atrio_database_lookup;dur=12, atrio_provider_create;dur=940, atrio_local_finalize;dur=20");
  const result = template7ServerTiming(1000, true, { context: 50, identity: 30 }, timing);
  assert.match(result, /t7-account;dur=1000;desc="created"/);
  assert.match(result, /atrio_provider_create;dur=940/);
  assert.doesNotMatch(result, /private|username|99999999/);
  assert.equal(safeProvisionTiming("x".repeat(1025)), "");
});
