import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("GRU is scoped to Template 7 destination, token issuance and account orchestration; Builder keeps PDX", async () => {
  const config = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));
  assert.deepEqual(config.regions, ["pdx1"]);
  assert.deepEqual(config.functions, {
    "app/api/template7/destination/route.ts": { regions: ["gru1"] },
    "app/api/template7/prepare/route.ts": { regions: ["gru1"] },
    "app/api/template7/preparations/account/route.ts": { regions: ["gru1"] },
  });
});
