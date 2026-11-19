// Run `node scripts/measure-template-gateway-chat.mjs 3` from the Builder repo.
// Add --matrix for all four providers, optional --provider=<code>,
// --engine=<engine> and --scenario=<scenario> to select a subset.
// Uses PRODUCT_WORKTREES_FILE when set. The browser renders each real form,
// the shared gateway and its corresponding chat from local source. Account
// creation, casino login, chat authorization and banking data use local
// fixtures. The bank response is held until the first message is confirmed.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { setTimeout as delay } from "node:timers/promises";
import path from "node:path";
import { loadProductPaths } from "./product-worktrees.mjs";

const product = loadProductPaths();
const frontend = product("landing-builder", "frontend");
const atrio = product("internal-chat");
const nexo = product("NexoBet");
const require = createRequire(path.join(frontend, "package.json"));
import { loadSource, compileWidget, loadGateway, targets } from "./gateway-browser-fixtures.mjs";
const { chromium } = require("playwright");
const landingOrigin = "https://landing.fixture.invalid";
const gatewayOrigin = "https://gateway.fixture.invalid";
const chatOrigin = "https://chat.fixture.invalid";
const slug = "fixture";
const policy = { enabled: true, seconds: 15, continueButtonEnabled: true };
const account = { username: "fixtureplayer", password: "fixture-key" };
const id = (n) => "a0000000-0000-4000-8000-" + String(n).padStart(12, "0");
const advisor = { atrioClientId: id(2), atrioId: id(3), atrioSlug: slug, preparationReady: false };
Object.assign(process.env, {
  GANAMOS_NET_GATEWAY_ORIGIN: gatewayOrigin,
  ASES_DEL_NORTE_GATEWAY_ORIGIN: gatewayOrigin,
  REY_GATEWAY_ORIGIN: gatewayOrigin,
  MULTI_SKIN_GATEWAY_ORIGIN: gatewayOrigin,
  GANAMOS_PLUS_GATEWAY_ORIGIN: gatewayOrigin,
  INTERNAL_CHAT_ORIGIN: chatOrigin,
  TEMPLATE7_LANDING_ORIGINS: landingOrigin,
  NEXOBET_ENCRYPTION_KEY: Buffer.alloc(32, 2).toString("base64url"),
  INTERNAL_CHAT_GATEWAY_SECRET: "benchmark-only-".repeat(5),
});

const landing = await loadSource(
  frontend,
  [
    "export {renderPublicLandingHtml} from './components/public-landing/renderPublicLandingHtml';",
    "export {buildLandingConfig} from './lib/landing/buildLandingConfig';",
    "export {DEFAULT_CONFIG} from './lib/landing/mocks';",
  ].join("\n"),
);
const classic = createRequire(product("landing-prueba-1", "package.json"))("./lib/template7/shared.cjs");
const handoffToken = "h1.fixture",
  presentationKey = "local-fixture-presentation-key";
const nexoLanding = await loadSource(nexo, "export {landingGet} from './src/lib/nexobet/public-landing.server';");
const { NextRequest } = createRequire(path.join(nexo, "package.json"))("next/server");
const nexoSlug = "nx-" + id(1),
  nexoPath = "/l/nexobet/" + nexoSlug;
const nexoRuntime = JSON.parse(await readFile(path.join(nexo, "vendor/entry-funnel.json"), "utf8")).runtime;
const [atrioWidget, nexoWidget] = await Promise.all([compileWidget(atrio), compileWidget(nexo)]);
const session = {
  advisor_id: advisor.atrioId,
  advisor_name: "Asesor",
  advisor_status: "disponible",
  advisor_avatar_url: null,
  player_id: id(4),
  conversation_id: id(5),
  player_display_name: "Fixture",
  player_platform: "desktop",
  app_installed_status: "unknown",
  quick_starters: [],
  whatsapp_url: null,
  telegram_url: null,
};
const fixtureProps = {
  advisorSlug: slug,
  deviceId: id(6),
  embedded: true,
  embeddedParentOrigin: gatewayOrigin,
  embeddedGatewaySource: "ganamos-net-gateway",
  embeddedHasActiveWallet: true,
  conversationSessionToken: "fixture-session",
  widgetTemplate: "atrio",
  initialMessages: [],
  session,
  quickStarters: [{ id: "wallet", label: "Cargar", message: "", behavior: "wallet", sortOrder: 0 }],
};
const html = (body) => ({ contentType: "text/html;charset=utf-8", body });
const message = (n, sender, content, metadata = {}) => ({
  id: id(n),
  sender,
  content,
  metadata,
  type: "texto",
  created_at: new Date(1700000000000 + 1000 * n).toISOString(),
  read_at: null,
});
const earlyMessage = message(10, "cliente", "Mensaje de prueba");
const bank = message(11, "asesor", "Datos de prueba", {
  source: "gateway_entry_wallet",
  wallet: { accountNumber: "0000000000000000000000", alias: "fixture.local", holderName: "Fixture" },
});
const durations = { account_ms: 150, login_ms: 350 };
const frontendAsset = (root, pathname) => readFile(path.join(root, "public", pathname), "utf8");

async function run(browser, template, engine, target, scenario = "new") {
  const { host, root: gateway, code: providerCode, appId, provider, casinoHtml } = target;
  const returning = scenario.startsWith("return-") || scenario === "direct";
  const direct = scenario === "direct" || scenario === "new-direct";
  const late = scenario === "return-late";
  const presentation = returning || direct ? { enabled: false, seconds: policy.seconds, continueButtonEnabled: false } : policy;
  const prepareHtml = host.renderPreparationPage("p1.fixture", host.gatewayPreparationTheme(providerCode));
  const entryHtml = casinoHtml(chatOrigin + "/embed/fixture?token=fixture");
  const context = await browser.newContext({ viewport: { width: 1365, height: 900 }, serviceWorkers: "block" });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  const errors = [],
    traces = [],
    marks = new Map();
  const mark = (name, at = Date.now()) => {
    if (!marks.has(name)) marks.set(name, at);
  };
  let releaseLogin,
    releaseBank,
    prepares = 0,
    confirms = 0,
    messages = 0,
    logins = 0,
    accounts = 0,
    previews = 0;
  const loginGate = new Promise((resolve) => {
    releaseLogin = resolve;
  });
  const bankGate = new Promise((resolve) => {
    releaseBank = resolve;
  });
  const config = landing.buildLandingConfig({
    id: id(1),
    name: slug,
    comment: "",
    pixelId: "",
    postUrl: "",
    landingTag: "TEST",
    config: {
      ...landing.DEFAULT_CONFIG,
      template: "template" + template,
      ctaDestination: "atrio",
      targetProvider: providerCode,
      multiSkinCode: "ganamos_plus",
      gatewayEntry: { mode: direct ? "direct" : "credentials", seconds: policy.seconds },
    },
  });
  const formHtml =
    engine === "classic"
      ? classic.renderClassicPublicLandingHtml({ slug, config }, 'function getOrCreateDeviceId(){return "' + id(6) + '";}')
      : landing.renderPublicLandingHtml({ slug, config });
  const native = engine === "nexobet";
  const widget = native ? nexoWidget : atrioWidget;
  const handoff = new URL("/prepare?t=" + handoffToken, gatewayOrigin);
  host.addGatewayEntryWaitToHandoff(
    handoff,
    presentation,
    presentationKey,
    300,
    Date.now(),
    !returning,
    returning ? (direct ? "direct" : true) : undefined,
  );
  const widgetHtml = html(
    '<!doctype html><meta charset="utf-8"><style>' +
      widget.css +
      '</style><div id="root"></div><script>window.fixtureProps=' +
      JSON.stringify({ ...fixtureProps, embeddedGatewaySource: appId.replaceAll("_", "-") }) +
      '</script><script src="/fixture-widget.js"></script>',
  );
  page.on("pageerror", (e) => errors.push(e.stack || e.message));
  await page.exposeBinding("benchmarkMark", (_, name, time) => mark(name, time));
  await context.addInitScript(() => {
    const record = (n) => window.benchmarkMark(n, Math.round(performance.timeOrigin + performance.now()));
    let observedForm = false,
      observedStage = false;
    const credentials = new MutationObserver(() => {
      const formStatus = document.querySelector("[data-template7-creating]");
      if (!observedForm && formStatus?.getClientRects().length && formStatus.textContent.includes("Creando tu cuenta")) {
        record("creating_form");
        observedForm = true;
      }
      const stage = document.querySelector("#entry-stage");
      if (!observedStage && stage?.getClientRects().length && stage.textContent === "Creando tu cuenta…") {
        record("creating_gateway");
        observedStage = true;
      }
      const button = document.querySelector("#continue");
      if (
        button &&
        !button.disabled &&
        button.getClientRects().length &&
        document.querySelector("#state[data-created='true']") &&
        !document.querySelector("#copy-password")?.disabled
      ) {
        record("credentials");
        credentials.disconnect();
      }
    });
    credentials.observe(document, { subtree: true, childList: true, attributes: true });
    document.addEventListener(
      "click",
      (e) => {
        if (e.target.closest("[data-public-landing-cta]")) record("submit");
        if (e.target.closest("#continue")) record("continue");
      },
      true,
    );
    window.addEventListener("message", (e) => {
      if (
        e.origin !== "https://chat.fixture.invalid" ||
        e.source !== document.querySelector("#gateway-chat-shell iframe")?.contentWindow ||
        e.data?.source !== "atrio-widget" ||
        e.data.visibleEntry !== true
      )
        return;
      if (e.data.type === "atrio.widget.ready") record("chat_ready");
      if (e.data.type === "atrio.widget.usable") {
        record("chat_usable");
        window.benchmarkChatUsable = true;
      }
    });
  });
  await context.route("**/*", async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      p = url.pathname;
    traces.push(p);
    if (native && url.origin === "https://nexobet.fun" && p === nexoRuntime.url)
      return route.fulfill({ contentType: "text/javascript", body: await readFile(path.join(nexo, nexoRuntime.file)) });
    if (url.origin === landingOrigin) {
      if (req.isNavigationRequest()) return route.fulfill(html(formHtml));
      if (p.startsWith("/public-assets/template-entry/")) {
        const root = engine === "classic" ? product("landing-prueba-1") : frontend;
        return route.fulfill({ contentType: "text/javascript", body: await frontendAsset(root, p) });
      }
      if (p === "/api/template7/destination")
        return route.fulfill({
          json: returning
            ? { ...advisor, preparationReady: true, existingName: "Nombre visible", promoCode: "FIXTURE" }
            : advisor,
        });
      if (p === "/api/template7/warm") return route.fulfill({ json: { gateway_origin: gatewayOrigin } });
      if (p === "/api/template7/prepare" || p === "/api/template7/start") {
        prepares++;
        return route.fulfill({ json: { handoff_url: gatewayOrigin + "/prepare?t=p1.fixture" } });
      }
      if (p.startsWith("/api/")) return route.fulfill({ json: { ok: true } });
    }
    if (url.origin === gatewayOrigin) {
      if (native && p === nexoPath) {
        const response = await nexoLanding.landingGet(
          new NextRequest(req.url(), { headers: await req.allHeaders() }),
          nexoSlug,
          undefined,
          {
            origin: gatewayOrigin,
            provider: providerCode,
            skin: providerCode === "multi_skin" ? "ganamos_plus" : null,
            landing: {
              id: id(1),
              slug: nexoSlug,
              platform: target.platform,
              origin: gatewayOrigin,
              capture_phone: false,
              pixel_id: null,
              skin: providerCode === "multi_skin" ? "ganamos_plus" : null,
              published_config: {
                template: "template9",
                publishTarget: "gateway",
                gatewayEntry: { mode: direct ? "direct" : "credentials", seconds: policy.seconds },
              },
            },
          },
        );
        assert.equal(response.status, 200);
        return route.fulfill({ headers: Object.fromEntries(response.headers), body: await response.text() });
      }
      if (native && p === nexoPath + "/_api/entry") {
        const body = req.postDataJSON();
        if (body.action === "visit") return route.fulfill({ json: { recorded: true } });
        assert.match(req.headers().cookie || "", /nx_landing_device=/);
        if (body.action === "resume") {
          assert.ok(returning);
          prepares++;
          return route.fulfill({ json: { active: true, url: handoff.href } });
        }
        assert.equal(body.name, "Fixture");
        accounts++;
        prepares++;
        await delay(durations.account_ms);
        return route.fulfill({ json: { url: handoff.href } });
      }
      if (p === "/prepare") {
        if (native) {
          assert.equal(url.searchParams.get("t"), handoffToken);
          const claims = host.readGatewayEntryPresentation(url, presentationKey);
          assert.equal(Boolean(claims?.newAccount), !returning && !direct);
          assert.equal(claims?.returningAccount, returning ? (direct ? "direct" : true) : undefined);
          return route.fulfill(
            html(
              host.renderPreparationPage(handoffToken, host.gatewayPreparationTheme(providerCode), "", {
                newAccount: claims?.newAccount,
                returningAccount: claims?.returningAccount === true,
                entryWaitProof: url.searchParams.get("ew"),
              }),
            ),
          );
        }
        return route.fulfill(html(prepareHtml));
      }
      if (native && p === "/api/entry/presentation") {
        const body = req.postDataJSON();
        assert.equal(body.token, handoffToken);
        assert.equal(body.proof, handoff.searchParams.get("ew"));
        assert.match(body.nonce, /^[a-f0-9]{64}$/);
        previews++;
        return route.fulfill({
          json: returning
            ? { username: account.username, returning_account: true, entry_wait: presentation }
            : { ...account, entry_wait: policy },
        });
      }
      if (p === "/api/preparations/complete") {
        if (!returning) accounts++;
        await delay(durations.account_ms);
        return route.fulfill({
          json: {
            ...(returning ? { username: account.username, returning_account: !direct } : { ...account, account_created: true }),
            entry_wait: presentation,
            continuation_token: "c1.fixture",
            entry_token: "ge1.fixture",
            handoff_url: gatewayOrigin + "/start?t=h1.fixture",
            target_provider: providerCode,
          },
        });
      }
      if (p === "/start") {
        logins++;
        mark("login_started");
        await Promise.all([loginGate, delay(durations.login_ms)]);
        mark("login_ready");
        return route.fulfill({
          json: {
            ...(returning ? { username: account.username, returning_account: !direct } : account),
            entry_wait: presentation,
            entry_confirmation: "ge1.confirmed",
            entry_id: "entry-fixture",
            redirect_url: gatewayOrigin + "/entry",
          },
          headers: { "Set-Cookie": "fixture_session=ok; Path=/; HttpOnly; Secure; SameSite=Lax" },
        });
      }
      if (p === "/api/session/recover") {
        assert.match(req.headers().cookie || "", /fixture_session=ok/);
        if (!("entry_confirmation" in req.postDataJSON())) {
          // The casino shell also refreshes the already confirmed session.
          assert.ok(confirms);
          return route.fulfill({ json: { active: true } });
        }
        assert.equal(req.postDataJSON().entry_confirmation, "ge1.confirmed");
        confirms++;
        return route.fulfill({ json: { active: true, entry_confirmed: true, entry_id: "entry-fixture" } });
      }
      if (p === "/entry") {
        assert.equal(confirms, 1);
        return route.fulfill(html(entryHtml));
      }
      if (p === provider.homePath) return route.fulfill(html("<!doctype html><title>Casino de prueba</title>"));
      if (p === "/gateway-client.js" || p === "/gateway-client.css" || p === "/gateway-app-sdk.js") {
        return route.fulfill({
          contentType: p.endsWith(".css") ? "text/css" : "text/javascript",
          body: await frontendAsset(gateway, p),
        });
      }
      if (p.startsWith("/api/")) return route.fulfill({ json: { messages: [], active: false } });
    }
    if (url.origin === chatOrigin) {
      if (p === "/embed/fixture") return route.fulfill(widgetHtml);
      if (p === "/fixture-widget.js") return route.fulfill({ contentType: "text/javascript", body: widget.js });
      if (p === "/api/gateway/chat") {
        assert.equal(req.headers().authorization, "Bearer fixture-session");
        const body = req.method() === "POST" ? req.postDataJSON() : {};
        if (body.action === "visible_entry") {
          await bankGate;
          return route.fulfill({
            json: { messages: [earlyMessage, bank], walletReady: true, walletRequestCompleted: true, entryDiagnostics: [] },
          });
        }
        if (body.action === "message") {
          assert.equal(body.content, earlyMessage.content);
          messages++;
          return route.fulfill({ json: { message: earlyMessage } });
        }
        return route.fulfill({ json: { messages: messages ? [earlyMessage] : [] } });
      }
      if (p.startsWith("/api/")) return route.fulfill({ json: { ok: true, profile: {} } });
    }
    // Images, third party scripts and analytics are never sent to the network.
    return route.fulfill({ status: 204 });
  });
  try {
    await page.goto(native ? gatewayOrigin + nexoPath : landingOrigin + (engine === "classic" ? "/" : "/l/") + slug);
    if (native && returning) {
      await page.locator('[name="firstName"]').waitFor();
      await page.reload();
    }
    if (!returning) {
      await page.locator(native ? '[name="firstName"]' : "[data-template7-name]").fill("Fixture");
      await page.locator("[data-public-landing-cta]").click();
    }
    const next = page.locator("#continue");
    if (direct) {
      releaseLogin();
    } else {
      await next.waitFor({ state: "visible" });
      if (returning) {
        assert.equal(await page.locator("#account-title").innerText(), "¡Hola de nuevo, " + account.username + "!");
        assert.equal(await next.innerText(), "Acceder a mi cuenta");
        assert.equal(await page.getByText(account.password, { exact: true }).count(), 0);
      } else {
        assert.equal(await page.locator("#username").innerText(), account.username);
        assert.equal(await page.locator("#password").innerText(), account.password);
      }
      if (late) {
        const started = page.waitForResponse((r) => new URL(r.url()).pathname === "/start");
        releaseLogin();
        await started;
      }
      await next.click();
      if (!late) assert.equal(marks.has("login_ready"), false, "the CTA works before login completes");
      releaseLogin();
    }
    const frame = page.frameLocator("#gateway-chat-shell iframe");
    const composer = frame.getByPlaceholder("Escribi un mensaje...");
    await page.waitForFunction(() => window.benchmarkChatUsable);
    await composer.click();
    assert.equal(await composer.isEditable(), true);
    await composer.fill(earlyMessage.content);
    await composer.press("Enter");
    await frame.locator('[data-chat-message-id="' + earlyMessage.id + '"]').waitFor();
    mark("sent");
    assert.equal(await frame.getByText("fixture.local", { exact: true }).count(), 0, "confirmed send precedes the bank response");
    releaseBank();
    await frame.getByText("fixture.local", { exact: true }).first().waitFor();
    mark("bank");
    if (!returning && !direct) assert.ok(marks.has("creating_form"), "the landing shows inline progress before navigating");
    if (!returning && !direct)
      assert.ok(marks.has("creating_gateway"), "the gateway keeps the creation feedback until credentials are ready");
    if (direct) assert.equal(marks.has("credentials"), false);
    if (!returning && !direct) assert.ok(marks.has("credentials"), "both credentials and the enabled CTA were visible together");
    assert.ok(marks.has("chat_ready"), "gateway received the signed embed ready event which dismisses its loading overlay");
    assert.ok(marks.has("chat_usable"), "visible, authorized composer reported by the widget");
    assert.deepEqual(
      { prepares, accounts, logins, confirms, messages },
      { prepares: 1, accounts: returning ? 0 : 1, logins: 1, confirms: 1, messages: 1 },
    );
    assert.equal(previews, native && !direct ? 1 : 0);
    assert.deepEqual(errors, []);
    const elapsed = (end, start) => marks.get(end) - marks.get(start);
    if (returning || direct) return { provider: providerCode, engine, template, scenario, ok: true };
    return {
      provider: providerCode,
      engine,
      template,
      scenario,
      name_to_credentials_ms: elapsed("credentials", "submit"),
      continue_to_usable_ms: elapsed("chat_usable", "continue"),
      name_to_chat_ready_ms: elapsed("chat_ready", "submit"),
      credentials_to_continue_ms: elapsed("continue", "credentials"),
      name_to_usable_ms: elapsed("chat_usable", "submit"),
      name_to_confirmed_message_ms: elapsed("sent", "submit"),
      name_to_bank_ms: elapsed("bank", "submit"),
    };
  } catch (error) {
    throw new Error(
      JSON.stringify({
        provider: providerCode,
        scenario,
        engine,
        template,
        url: page.url(),
        errors,
        requests: [...new Set(traces)],
      }),
      { cause: error },
    );
  } finally {
    releaseLogin();
    releaseBank();
    await context.close();
  }
}
const browser = await chromium.launch({ headless: true });
try {
  const rows = [];
  const matrix = process.argv.includes("--matrix");
  const samples = Number(process.argv.slice(2).find((s) => /^\d+$/.test(s)) || 1);
  assert.ok(Number.isInteger(samples) && samples >= 1 && samples <= 20);
  const filter = (field) => process.argv.find((s) => s.startsWith("--" + field + "="))?.split("=")[1];
  const selected = (matrix ? targets : targets.filter((t) => t.code === "ganamos_net")).filter(
    (t) => !filter("provider") || t.code === filter("provider"),
  );
  for (const item of selected) {
    const target = await loadGateway(item);
    for (let n = 0; n < samples; n++) {
      const cases = [
        ["constructor", 7],
        ["constructor", 9],
        ["classic", 7],
        ["classic", 9],
        ["nexobet", 9],
      ];
      for (const [engine, template] of cases) {
        if (filter("engine") && filter("engine") !== engine) continue;
        for (const scenario of matrix
          ? ["new", template === 7 ? "return-early" : "return-late", "direct", "new-direct"]
          : ["new"]) {
          if (filter("scenario") && filter("scenario") !== scenario) continue;
          rows.push(await run(browser, template, engine, target, scenario));
          if (matrix) console.log([target.code, engine, template, scenario, "PASS"].join(" "));
        }
      }
    }
  }
  assert.ok(rows.length, "No gateway journeys matched the supplied filters");
  console.log(JSON.stringify({ fixture: durations, samples_per_case: samples, rows }, null, 2));
} finally {
  await browser.close();
}
