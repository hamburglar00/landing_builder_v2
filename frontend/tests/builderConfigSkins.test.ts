import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { MULTI_SKIN_CODES } from "../lib/multi-skin-catalog";
import { renderPublicLandingHtml, renderClassicTemplate7InlineHtml } from "../components/public-landing/renderPublicLandingHtml";
import type { PublicLandingConfig } from "../components/public-landing/types";

const compiledModules = new Map<string, string>();
const name = "golden-e2e-bet30";
const published = (template = 7): PublicLandingConfig => ({
  schemaVersion: 1, updatedAt: "2026-10-31", id: "a0000000-0000-4000-8000-000000000001", name, comment: "",
  layout: { template, ctaPosition: "bottom" },
  tracking: { pixelId: "", postUrl: "", landingTag: "TEST", target_provider: "multi_skin", skin_code: "bet30" },
  content: { logoUrl: "https://example.invalid/bet30.webp", title: ["Bet30"], subtitle: [], ctaText: "Continuar" },
});

async function requestConfig(raw: Record<string, unknown>, saved: unknown = null) {
  let serve!: (request: Request) => Promise<Response>;
  const row = {
    id: published().id, name, user_id: "fixture-owner", workspace_currency: "ARS",
    post_url: "https://example.invalid/functions/v1/conversions?name=fixture",
    config: raw, landing_config: saved,
  };
  const database = {
    from(table: string) { assert.equal(table, "landings"); return this; },
    select() { return this; },
    eq(column: string, value: string) { assert.equal(column, "name"); assert.equal(value, name); return this; },
    async maybeSingle() { return { data: row, error: null }; },
  };
  const modules = new Map<string, object>();
  const load = (url: URL): object => {
    if (modules.has(url.href)) return modules.get(url.href)!;
    let compiled = compiledModules.get(url.href);
    if (!compiled) {
      compiled = ts.transpileModule(readFileSync(url, "utf8"), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      }).outputText;
      compiledModules.set(url.href, compiled);
    }
    const exports = {};
    modules.set(url.href, exports);
    runInNewContext(compiled, {
      exports,
      require: (specifier: string) => {
        if (specifier === "https://esm.sh/@supabase/supabase-js@2") return { createClient: () => database };
        assert.ok(specifier.startsWith("."), "Only local function dependencies are loaded");
        return load(new URL(specifier, url));
      },
      Deno: { env: { get: () => "fixture" }, serve: (handler: typeof serve) => { serve = handler; } },
      URL, Request, Response, console: { error() {} },
    });
    return exports;
  };
  load(new URL("../../supabase/functions/builder-config/index.ts", import.meta.url));
  return serve(new Request(`https://example.invalid/functions/v1/builder-config?name=${name}`));
}

function renderBoth(config: PublicLandingConfig) {
  return [
    renderPublicLandingHtml({ slug: name, config }),
    renderClassicTemplate7InlineHtml({ slug: name, config }, ""),
  ];
}

function runtimeConfig(html: string) {
  const source = html.match(/window\.__PUBLIC_LANDING_RUNTIME_CONFIG__=(\{.*?\});/)?.[1];
  assert.ok(source, "The public HTML must contain the actual runtime configuration");
  return JSON.parse(source);
}

test("the public Edge Function preserves every saved T7 skin into both renderers", async () => {
  for (const skin of MULTI_SKIN_CODES) {
    for (const saved of [null, published()]) {
      const response = await requestConfig({ template: "template7", targetProvider: "multi_skin", multiSkinCode: skin }, saved);
      assert.equal(response.status, 200);
      const payload = await response.json() as PublicLandingConfig;
      assert.equal(payload.tracking.skin_code, skin);
      for (const html of renderBoth(payload)) {
        assert.equal(runtimeConfig(html).skinCode, skin);
        assert.equal(runtimeConfig(html).targetProvider, "multi_skin");
      }
    }
  }
});

test("T7 keeps a published skin for missing legacy config and uses the active template draft", async () => {
  const raw = { template: "template7", targetProvider: "multi_skin" };
  assert.equal((await (await requestConfig(raw, published())).json()).tracking.skin_code, "bet30");
  assert.equal((await (await requestConfig(raw)).json()).tracking.skin_code, "ganamos_plus");
  const active = { ...raw, multiSkinCode: "jugamos", templateConfigs: { template7: { multiSkinCode: "bet30" } } };
  assert.equal((await (await requestConfig(active, published())).json()).tracking.skin_code, "bet30");
});

test("both public T8 payload branches keep each card's skin independently of the T7 skin", async () => {
  const template8Cover = {
    cardCount: 3, headerText: "Elegí", footerText: "", cards: [
      { targetProvider: "multi_skin", multiSkinCode: "bet30", text: "Bet30" },
      { targetProvider: "multi_skin", multiSkinCode: "jugamos", text: "Jugamos" },
      { targetProvider: "multi_skin", text: "Ganamos+" },
    ],
  };
  const raw = { template: "template8", targetProvider: "multi_skin", multiSkinCode: "casino_zeus", template8Cover };
  for (const saved of [null, published(8)]) {
    const response = await requestConfig(raw, saved);
    assert.equal(response.status, 200);
    const payload = await response.json() as PublicLandingConfig;
    assert.deepEqual(payload.content?.template8?.cards.map(card => card.multiSkinCode), ["bet30", "jugamos", "ganamos_plus"]);
    for (const html of renderBoth(payload)) {
      for (const skin of ["bet30", "jugamos", "ganamos_plus"]) assert.ok(html.includes(`"multiSkinCode":"${skin}"`));
    }
  }
  const saved = { ...published(8), content: { ...published(8).content, template8: template8Cover } };
  const response = await requestConfig({ template: "template8", targetProvider: "multi_skin" }, saved);
  assert.equal((await response.json()).content.template8.cards[0].multiSkinCode, "bet30");
});

test("explicit invalid T7 or T8 skins fail closed instead of routing to Ganamos+", async () => {
  for (const invalid of [null, "", "foreign-domain", "https://bet30e.lat", "__proto__"]) {
    for (const saved of [null, published()]) {
      const response = await requestConfig({ template: "template7", targetProvider: "multi_skin", multiSkinCode: invalid }, saved);
      assert.equal(response.status, 500);
      assert.equal((await response.json()).tracking, undefined);
    }
    for (const saved of [null, published(8)]) {
      const response = await requestConfig({ template: "template8", targetProvider: "multi_skin", template8Cover: {
        cardCount: 1, cards: [{ targetProvider: "multi_skin", multiSkinCode: invalid }],
      } }, saved);
      assert.equal(response.status, 500);
    }
  }
});

test("non Multi Skin providers keep their existing route without requiring a skin", async () => {
  for (const provider of ["rey_de_ases", "ases_del_norte", "ganamos_net"]) {
    const response = await requestConfig({ template: "template7", targetProvider: provider, multiSkinCode: null });
    assert.equal(response.status, 200);
    const payload = await response.json() as PublicLandingConfig;
    assert.equal(payload.tracking.target_provider, provider);
    assert.equal(payload.tracking.skin_code, undefined);
  }
});
