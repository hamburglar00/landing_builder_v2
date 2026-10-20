import assert from "node:assert/strict";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { buildTemplate7ReentryScript, guardTemplate7ReentryScripts } from "../components/public-landing/template7ReentryScript";
import { renderPublicLandingHtml, renderClassicTemplate7InlineHtml } from "../components/public-landing/renderPublicLandingHtml";
import type { PublicLandingConfig } from "../components/public-landing/types";

const nonce = "11111111-1111-4111-8111-111111111111";
function browser(url = "https://mkt.panelbotadmin.com/l/rey?fbclid=test&utm_campaign=one&phone=123#form", storage = new Map<string, string>()) {
  const navigations: string[] = [];
  const replacements: string[] = [];
  const window = {
    location: { href: url, replace(value: string) { navigations.push(value); } },
    crypto: { randomUUID: () => nonce },
    sessionStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
    history: { state: null, replaceState(_state: unknown, _title: string, value: string) { replacements.push(value); } },
    __TEMPLATE7_REENTRY_PENDING__: false,
  };
  Object.assign(window, { self: window, top: window });
  return { window, storage, navigations, replacements };
}
function execute(html: string, fixture: ReturnType<typeof browser>) {
  const sandbox = { window: fixture.window, URL, Date };
  for (const script of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) runInNewContext(script[1], sandbox);
}

test("checks the destination session without sending attribution, names or device identifiers to the gateway", () => {
  const fixture = browser();
  execute(buildTemplate7ReentryScript("https://www.reydeases.fun"), fixture);
  assert.equal(fixture.navigations.length, 1);
  const destination = new URL(fixture.navigations[0]);
  assert.equal(destination.origin, "https://www.reydeases.fun");
  assert.equal(destination.pathname, "/resume");
  assert.equal(destination.searchParams.size, 1);
  const back = new URL(destination.searchParams.get("return_to")!);
  assert.equal(back.href, `https://mkt.panelbotadmin.com/l/rey?__t7_resume=${nonce}`);
  assert.equal(fixture.window.__TEMPLATE7_REENTRY_PENDING__, true);
});

test("a gateway without a session returns once to the working form with the original attribution", () => {
  const first = browser();
  const script = buildTemplate7ReentryScript("https://www.reydeases.fun");
  execute(script, first);
  const back = new URL(first.navigations[0]).searchParams.get("return_to")!;
  const second = browser(back, first.storage);
  execute(script, second);
  assert.deepEqual(second.navigations, []);
  assert.deepEqual(second.replacements, ["/l/rey?fbclid=test&utm_campaign=one&phone=123#form"]);
  assert.equal(second.storage.size, 0);
  assert.equal(second.window.__TEMPLATE7_REENTRY_PENDING__, false);
});

test("an arbitrary query flag or a previous check for another gateway cannot bypass the session check", () => {
  const fixture = browser(`https://mkt.panelbotadmin.com/l/rey?__t7_resume=${nonce}`);
  execute(buildTemplate7ReentryScript("https://www.reydeases.fun"), fixture);
  assert.equal(fixture.navigations.length, 1);
  const other = browser(new URL(fixture.navigations[0]).searchParams.get("return_to")!, fixture.storage);
  execute(buildTemplate7ReentryScript("https://www.ganamosnet.icu"), other);
  assert.equal(new URL(other.navigations[0]).origin, "https://www.ganamosnet.icu");
});

test("restricted storage and embedded previews keep the normal landing usable", () => {
  const denied = browser();
  denied.window.sessionStorage.getItem = () => { throw new Error("storage denied"); };
  execute(buildTemplate7ReentryScript("https://www.reydeases.fun"), denied);
  assert.deepEqual(denied.navigations, []);
  assert.equal(denied.window.__TEMPLATE7_REENTRY_PENDING__, false);
  const iframe = browser();
  Object.assign(iframe.window, { top: {} });
  execute(buildTemplate7ReentryScript("https://www.reydeases.fun"), iframe);
  assert.deepEqual(iframe.navigations, []);
  const preview = browser("https://unconfigured-preview.test/l/rey");
  execute(buildTemplate7ReentryScript("https://www.reydeases.fun"), preview);
  assert.deepEqual(preview.navigations, []);
});

test("the session check suppresses identity, advisor selection and tracking until fallback", () => {
  const fixture = browser();
  const run = guardTemplate7ReentryScripts('<script>window.calls = (window.calls || 0) + 1;</script>');
  execute(buildTemplate7ReentryScript("https://www.reydeases.fun") + run, fixture);
  assert.equal((fixture.window as unknown as { calls: number }).calls, undefined);
  fixture.window.__TEMPLATE7_REENTRY_PENDING__ = false;
  execute(run, fixture);
  assert.equal((fixture.window as unknown as { calls: number }).calls, 1);
});

test("both rendering engines select the configured provider/skin while demos and other templates are unchanged", () => {
  const env = {
    REY_GATEWAY_ORIGIN: "https://www.reydeases.fun", MULTI_SKIN_GATEWAY_ORIGIN: "https://shared.example",
    GANAMOS_PLUS_GATEWAY_ORIGIN: "https://ganamosnet.global", ASES_DEL_NORTE_GATEWAY_ORIGIN: "https://www.asesdelnorte.online",
    GANAMOS_NET_GATEWAY_ORIGIN: "https://www.ganamosnet.icu",
  };
  const previous = { ...process.env };
  Object.assign(process.env, env);
  try {
    for (const provider of ["rey_de_ases", "multi_skin", "ases_del_norte", "ganamos_net"] as const) {
      const config: PublicLandingConfig = { schemaVersion: 1, id: "landing", name: "Rey", updatedAt: "", comment: "",
        layout: { template: 7, ctaPosition: "bottom" }, tracking: { pixelId: "", postUrl: "", landingTag: "LP", target_provider: provider, skin_code: "ganamos_plus" } };
      for (const html of [renderPublicLandingHtml({ slug: "rey", config }), renderClassicTemplate7InlineHtml({ slug: "rey", config }, "")]) {
        const match = html.match(/<script data-template7-reentry>([\s\S]*?)<\/script>/);
        assert.ok(match);
        const fixture = browser();
        execute(match[0], fixture);
        assert.equal(new URL(fixture.navigations[0]).origin, env[provider === "multi_skin" ? "GANAMOS_PLUS_GATEWAY_ORIGIN" : provider === "rey_de_ases" ? "REY_GATEWAY_ORIGIN" : provider === "ases_del_norte" ? "ASES_DEL_NORTE_GATEWAY_ORIGIN" : "GANAMOS_NET_GATEWAY_ORIGIN"]);
      }
      assert.doesNotMatch(renderPublicLandingHtml({ slug: "rey", config: { ...config, layout: { ...config.layout, template: 1 } } }), /data-template7-reentry/);
    }
  } finally {
    for (const key of Object.keys(env)) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; }
  }
});
