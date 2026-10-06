import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const LANDING_ID = "00000000-0000-4000-8000-000000000001";
const EVENT_ID = "00000000-0000-4000-8000-000000000002";

function handler(options: { result?: boolean; error?: boolean; missingConfig?: boolean } = {}) {
  const calls: Array<{ name: string; params: Record<string, unknown> }> = [];
  let serve!: (request: Request) => Promise<Response>;
  const source = readFileSync(new URL("../../supabase/functions/landing-card-click/index.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  runInNewContext(compiled, {
    exports: {},
    require: (specifier: string) => {
      assert.equal(specifier, "https://esm.sh/@supabase/supabase-js@2");
      return { createClient: () => ({
        rpc: async (name: string, params: Record<string, unknown>) => {
          calls.push({ name, params });
          return { data: options.result ?? true, error: options.error ? { code: "synthetic" } : null };
        },
      }) };
    },
    Deno: {
      env: { get: (name: string) => options.missingConfig ? undefined : name },
      serve: (fn: typeof serve) => { serve = fn; },
    },
    Request, Response, console: { error: () => {} },
  });
  return { serve, calls };
}

function post(body: unknown) {
  return new Request("https://example.invalid", { method: "POST", body: JSON.stringify(body) });
}

test("card-click records a valid card once through the scoped SQL RPC", async () => {
  const h = handler();
  const response = await h.serve(post({ landingId: LANDING_ID, cardIndex: 3, eventId: EVENT_ID }));
  assert.equal(response.status, 200);
  assert.deepEqual(h.calls.map(({ name }) => name), ["record_template6_card_click"]);
  assert.equal(h.calls[0].params.p_landing_id, LANDING_ID);
  assert.equal(h.calls[0].params.p_card_index, 3);
  assert.equal(h.calls[0].params.p_event_id, EVENT_ID);
});

test("card-click rejects invalid requests before using the service role", async () => {
  const h = handler();
  assert.equal((await h.serve(new Request("https://example.invalid"))).status, 405);
  assert.equal((await h.serve(post({ landingId: LANDING_ID, cardIndex: 7, eventId: EVENT_ID }))).status, 400);
  assert.equal((await h.serve(post({ landingId: LANDING_ID, cardIndex: 1.5, eventId: EVENT_ID }))).status, 400);
  assert.equal((await h.serve(post({ landingId: "invalid", cardIndex: 1, eventId: EVENT_ID }))).status, 400);
  assert.equal(h.calls.length, 0);
});

test("card-click handles unavailable configuration and SQL rejection", async () => {
  assert.equal((await handler({ missingConfig: true }).serve(post({ landingId: LANDING_ID, cardIndex: 1, eventId: EVENT_ID }))).status, 500);
  assert.equal((await handler({ result: false }).serve(post({ landingId: LANDING_ID, cardIndex: 1, eventId: EVENT_ID }))).status, 400);
  assert.equal((await handler({ error: true }).serve(post({ landingId: LANDING_ID, cardIndex: 1, eventId: EVENT_ID }))).status, 500);
});
