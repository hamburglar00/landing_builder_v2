import assert from "node:assert/strict";
import test, { beforeEach, afterEach, mock } from "node:test";
import { handleReyStart as builderStart, type StartDependencies as BuilderDependencies } from "../lib/reyDeAses/start.server";
import type { handleReyStart as ClassicStart, StartDependencies as ClassicDependencies } from "../../../landing-prueba-1/lib/reyDeAses/start.server";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
const classicRoot = process.env.LANDING_CLASSIC_ROOT || fileURLToPath(new URL("../../../landing-prueba-1/", import.meta.url));
const classicStart = createRequire(import.meta.url)(path.join(classicRoot, "lib/reyDeAses/start.server.ts")).handleReyStart as typeof ClassicStart;
import { MULTI_SKIN_CODES } from "../lib/multi-skin-catalog";
import { handleTemplate7Destination } from "../lib/atrio/template7Destination.server";

beforeEach(() => { mock.method(console, "info", () => {}); });
afterEach(() => { mock.restoreAll(); });
const id = (n: number) => `a0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const advisor = { id: id(2), atrio_id: id(3), slug: "fixture", user_id: id(4), workspace_currency: "ARS" };
const player = { manager_id: 1045, agency_id: 272, advisor_id: id(3), advisor_slug: "fixture", player_id: id(5), device_id: id(6),
  player_provider_account_id: id(7), target_provider: "multi_skin" as const, created: false, provider_account_created: false };
const payload = { landing_id: id(1), landing_slug: "skin-entry", name: "Fixture", device_id: id(6), atrio_client_id: id(2),
  advisor_id: id(3), advisor_slug: "fixture", promo_code: "TEST-abc", attribution: { skin_code: "foreign-domain", target_provider: "rey_de_ases" } };
const cover = (skin?: unknown) => ({ cardCount: 1, cards: [{ targetProvider: "multi_skin", ...(skin !== undefined ? { multiSkinCode: skin } : {}) }] });

async function runEntry(raw: Record<string, unknown>, published: unknown, engine: "builder" | "classic", context: boolean, contextProvider: "multi_skin" | "ganamos_net" = "multi_skin") {
  const landing = { id: id(1), name: "skin-entry", user_id: id(4), workspace_currency: "ARS", config: raw, landing_config: published };
  const observed: unknown[] = [];
  const resolveContext = async () => ({ status: "ok" as const, provider: contextProvider, landing, advisor });
  const dependencies: BuilderDependencies & ClassicDependencies = {
    db: { landing: async () => landing, blocked: async () => false,
      assignment: async () => ({ landing_id: id(1), atrio_client_id: id(2), user_id: id(4) }), advisor: async () => advisor,
      ...(context ? { context: resolveContext } : {}),
    },
    ...(context ? { resolveContext } : {}),
    api2Status: () => null, gatewayStatus: () => null, allowStart: async () => true,
    resolvePlayer: async input => {
      observed.push("player");
      assert.equal(input.targetProvider, "multi_skin"); assert.equal(input.deviceId, id(6)); assert.equal(input.advisor.advisorId, id(3));
      return player;
    },
    resolveAccount: async input => {
      observed.push({ accountSkin: input.skin_code });
      assert.equal(input.manager_id, 1045); assert.equal(input.agency_id, 272); assert.equal(input.external_user_id, id(5)); assert.equal(input.target_provider, "multi_skin");
      return { username: "fixture-user", password: "fixture-secret", platform: "multi_skin", created: false };
    },
    linkProviderAccount: async (_advisor, incoming, account) => {
      assert.equal(incoming.player_provider_account_id, id(7));
      return { player_provider_account_id: id(7), target_provider: "multi_skin", provider_username: account.username, provider_external_account_id: null };
    },
    createHandoff: async (provider, assigned, device, incoming, account, skin) => {
      observed.push({ handoffSkin: skin });
      assert.equal(provider, "multi_skin"); assert.equal(assigned.advisorId, id(3)); assert.equal(device, id(6));
      assert.equal(incoming.player_provider_account_id, id(7)); assert.equal(account.username, "fixture-user");
      return { handoff_url: "https://gateway.test/start?t=opaque", expires_at: "2026-11-01T00:00:00Z", binding_created: false };
    },
  };
  const request = new Request("https://landing.test/api/rey-de-ases/start?skin=evil&target_provider=rey_de_ases", {
    method: "POST", headers: { "Content-Type": "application/json", Cookie: `lb_cid=${id(6)}` },
    body: JSON.stringify({ ...payload, ...(raw.template === "template8" ? { card_index: 1 } : {}) }),
  });
  const response = await (engine === "builder" ? builderStart : classicStart)(request, dependencies);
  return { response, observed };
}

test("all fourteen T7/T8 skins reach the same account and signed handoff from active, root and inactive-variant configurations", async () => {
  for (const skin of MULTI_SKIN_CODES) for (const template of ["template7", "template8"]) {
    const other = skin === "ganamos_plus" ? "bet30" : "ganamos_plus";
    const chosen = template === "template7" ? { multiSkinCode: skin } : { template8Cover: cover(skin) };
    const stale = template === "template7" ? { multiSkinCode: other } : { template8Cover: cover(other) };
    const base = { template, ctaDestination: "atrio", targetProvider: "multi_skin" };
    const configurations = [
      { ...base, ...chosen },
      { ...base, ...stale, templateConfigs: { [template]: chosen } },
      { ...base, ...chosen, templateConfigs: { [template === "template7" ? "template8" : "template7"]: stale } },
    ];
    for (const raw of configurations) for (const engine of ["builder", "classic"] as const) for (const context of [false, true]) {
      const before = JSON.stringify(raw);
      const result = await runEntry(raw, { tracking: { skin_code: other } }, engine, context);
      assert.equal(result.response.status, 200, `${engine}/${template}/${skin}/${context}`);
      assert.deepEqual(result.observed, ["player", { accountSkin: skin }, { handoffSkin: skin }]);
      assert.equal(JSON.stringify(raw), before, "Saved configuration must never be mutated");
      assert.doesNotMatch(await result.response.text(), /fixture-user|fixture-secret/);
    }
  }
});

test("legacy missing skins preserve the published selection; legacy T8 cards use Ganamos+ independently", async () => {
  for (const engine of ["builder", "classic"] as const) for (const context of [false, true]) {
    for (const skin of MULTI_SKIN_CODES) {
      const result = await runEntry({ template: "template7", ctaDestination: "atrio", targetProvider: "multi_skin" }, { tracking: { skin_code: skin } }, engine, context);
      assert.equal(result.response.status, 200); assert.deepEqual(result.observed, ["player", { accountSkin: skin }, { handoffSkin: skin }]);
    }
    for (const raw of [
      { template: "template7", ctaDestination: "atrio", targetProvider: "multi_skin" },
      { template: "template8", ctaDestination: "atrio", targetProvider: "multi_skin", multiSkinCode: "bet30", template8Cover: cover() },
    ]) {
      const result = await runEntry(raw, {}, engine, context);
      assert.equal(result.response.status, 200); assert.deepEqual(result.observed, ["player", { accountSkin: "ganamos_plus" }, { handoffSkin: "ganamos_plus" }]);
    }
  }
});

test("invalid effective skins and contradictory authorized providers cannot resolve an account or change a manager", async () => {
  for (const engine of ["builder", "classic"] as const) for (const context of [false, true]) {
    for (const template8Cover of [undefined, null]) {
      const result = await runEntry({ template: "template8", ctaDestination: "atrio", targetProvider: "multi_skin", template8Cover }, { content: { template8: cover("bet30") } }, engine, context);
      assert.equal(result.response.status, 503); assert.deepEqual(result.observed, [], "Published-only T8 cards cannot bypass the existing raw card scope");
    }
    for (const invalid of [null, "", "foreign-domain", "__proto__"]) for (const template of ["template7", "template8"]) {
      const active = template === "template7" ? { multiSkinCode: invalid } : { template8Cover: cover(invalid) };
      const result = await runEntry({ template, ctaDestination: "atrio", targetProvider: "multi_skin", multiSkinCode: "bet30", template8Cover: cover("bet30"), templateConfigs: { [template]: active } }, { tracking: { skin_code: "bet30" } }, engine, context);
      assert.equal(result.response.status, 503); assert.deepEqual(result.observed, []);
    }
    if (context) {
      const result = await runEntry({ template: "template8", ctaDestination: "atrio", targetProvider: "multi_skin", template8Cover: { cardCount: 1, cards: [{ targetProvider: "ganamos_net" }] }, templateConfigs: { template8: { template8Cover: cover("bet30") } } }, {}, engine, true, "ganamos_net");
      assert.equal(result.response.status, 503); assert.deepEqual(result.observed, []);
    }
  }
});

test("T8 destination selection uses the same active card and preserves the authorized advisor", async () => {
  for (const skin of MULTI_SKIN_CODES) {
    let selected: unknown;
    const response = await handleTemplate7Destination(new Request("https://landing.test/api/template7/destination", {
      method: "POST", headers: { Origin: "https://landing.test", "Content-Type": "application/json" }, body: JSON.stringify({ landing_id: id(1), landing_slug: "skin-entry", card_index: 1 }),
    }), id(6), {
      context: async () => ({ allowed: true, blocked: false, advisors: [advisor], landing: { id: id(1), name: "skin-entry", user_id: id(4), workspace_currency: "ARS", config: {
        template: "template8", ctaDestination: "atrio", template8Cover: { cardCount: 1, cards: [{ targetProvider: "ganamos_net" }] }, templateConfigs: { template8: { template8Cover: cover(skin) } },
      } } }),
      resolve: async input => { selected = input; return { advisor_id: id(3), advisor_slug: "fixture", target_provider: "multi_skin", connection_id: id(8) }; },
      fallback: async () => { throw Error("T8 cannot substitute another advisor"); },
    });
    assert.equal(response.status, 200);
    assert.deepEqual(selected, { landing_id: id(1), target_provider: "multi_skin", device_id: id(6), allowed_advisor_ids: [id(3)], reserve_only: true });
  }
});
