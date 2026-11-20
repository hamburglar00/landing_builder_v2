// Chromium exercises the real agency routes, browser, bookmark cookies, session
// confirmation, casino shell and chat widget. A real Builder template also
// enters through the same signed account and cookie helpers used by /start.
// Private services, landing handoff issuance and casino login use fixtures.
// Run with node scripts/check-gateway-agency-journeys.mjs [provider_code].
// PRODUCT_WORKTREES_FILE can select the Ganamos+ Worker source.
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { loadProductPaths } from "./product-worktrees.mjs";
import { compileWidget, loadGateway, loadSource, targets } from "./gateway-browser-fixtures.mjs";

const product = loadProductPaths();
const require = createRequire(product("landing-builder", "frontend/package.json"));
const { chromium } = require("playwright");
const origin = "https://gateway.fixture.invalid",
  chat = "https://chat.fixture.invalid";
const secret = "scope-fixture-".repeat(5);
const sessionCookie = "fixture_casino_session";
const cookieOptions = { httpOnly: true, secure: true, sameSite: "lax", path: "/" };
const uuid = (n) => "a0000000-0000-4000-8000-" + String(n).padStart(12, "0");
const html = (body) => ({ contentType: "text/html; charset=utf-8", body });
const messageId = uuid(9900);
const frontend = product("landing-builder", "frontend");
const landingOrigin = "https://landing.fixture.invalid";
Object.assign(process.env, {
  GANAMOS_NET_GATEWAY_ORIGIN: origin,
  ASES_DEL_NORTE_GATEWAY_ORIGIN: origin,
  REY_GATEWAY_ORIGIN: origin,
  MULTI_SKIN_GATEWAY_ORIGIN: origin,
  GANAMOS_PLUS_GATEWAY_ORIGIN: origin,
  TEMPLATE7_LANDING_ORIGINS: landingOrigin,
});
const landing = await loadSource(
  frontend,
  [
    "export {renderPublicLandingHtml} from './components/public-landing/renderPublicLandingHtml';",
    "export {buildLandingConfig} from './lib/landing/buildLandingConfig';",
    "export {DEFAULT_CONFIG} from './lib/landing/mocks';",
  ].join("\n"),
);
const widget = await compileWidget(product("internal-chat"));
const deferred = () => Promise.withResolvers();

async function statusTypography(label) {
  await label.waitFor({ state: "visible" });
  return label.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      color: style.color,
      family: style.fontFamily,
      size: style.fontSize,
      weight: style.fontWeight,
      lineHeight: style.lineHeight,
      letterSpacing: style.letterSpacing,
    };
  });
}

async function serveNext(route, response, context, body) {
  // Feed every cookie into the actual browser cookie jar, preserving its
  // scope. Playwright's fulfill headers map cannot express repeated names.
  const headers = Object.fromEntries(response.headers);
  delete headers["set-cookie"];
  delete headers["x-middleware-set-cookie"];
  const values = response.headers.getSetCookie();
  const { ResponseCookies } = require("next/dist/compiled/@edge-runtime/cookies");
  for (const value of values) {
    const header = new Headers({ "set-cookie": value });
    const cookie = new ResponseCookies(header).getAll()[0];
    if (!cookie) continue;
    await context.addCookies([
      {
        name: cookie.name,
        value: cookie.value,
        domain: new URL(route.request().url()).hostname,
        path: cookie.path || "/",
        httpOnly: !!cookie.httpOnly,
        secure: !!cookie.secure,
        sameSite: "Lax",
        ...(cookie.maxAge === 0
          ? { expires: 1 }
          : cookie.expires
            ? { expires: Math.floor(cookie.expires.getTime() / 1000) }
            : {}),
      },
    ]);
  }
  return route.fulfill({ status: response.status, headers, body: body ?? await response.text() });
}

async function run(browser, target) {
  const { host, root, provider } = target;
  const { NextRequest, NextResponse } = createRequire(path.join(root, "package.json"))("next/server");
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const accountNumber = String(123450000 + target.platform).padStart(22, "0");
  const walletMessage = {
    id: uuid(9901), sender: "asesor", type: "texto", content: "Datos para transferir",
    created_at: new Date().toISOString(), read_at: null,
    metadata: { wallet: { accountNumber, holderName: "Titular de prueba" } },
  };
  const traces = [];
  const errors = [],
    calls = [],
    confirmed = [],
    chats = [],
    sent = [];
  const accounts = new Map(),
    sessions = new Map();
  const template = target.platform % 2 === 0 ? "template7" : "template9";
  const config = landing.buildLandingConfig({
    id: uuid(31),
    name: "cruce",
    comment: "",
    pixelId: "",
    postUrl: "",
    landingTag: "TEST",
    config: {
      ...landing.DEFAULT_CONFIG,
      template,
      ctaDestination: "atrio",
      targetProvider: target.code,
      multiSkinCode: "ganamos_plus",
      gatewayEntry: { mode: "credentials", seconds: 15 },
    },
  });
  const form = landing.renderPublicLandingHtml({ slug: "cruce", config });
  const otherLanding = landing.renderPublicLandingHtml({
    slug: "segunda",
    config: { ...config, id: uuid(32), name: "segunda" },
  });
  const identityFor = (agency, device) => ({
    target_provider: target.code,
    device_id: device,
    advisor_id: uuid(100 + agency),
    advisor_slug: "asesor-" + agency,
    player_id: uuid(200 + agency),
    player_provider_account_id: uuid(300 + agency),
    username: "cliente" + agency,
    promo_code: null,
  });
  const waitPolicy = { enabled: true, seconds: 15, continueButtonEnabled: true };
  const returnPolicy = { enabled: false, seconds: 4, continueButtonEnabled: false };
  let landingIssued = false,
    landingCreations = 0,
    landingReturning = false;
  let landingAdvisorAvailable = true;
  let unavailableLookup;
  let login = deferred(),
    recovery = deferred(),
    holdConfirmation = false,
    authCount = 0,
    retryLogin = false;
  const recoveryId = (identity) => ({
    targetProvider: target.code,
    advisorSlug: identity.advisor_slug,
    playerId: identity.player_id,
    playerProviderAccountId: identity.player_provider_account_id,
    username: identity.username,
  });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    assert.equal(String(url), chat + "/api/gateway/agencies");
    assert.equal(init.headers.Authorization, "Bearer " + secret);
    const body = JSON.parse(init.body);
    assert.equal(body.target_provider, target.code);
    assert.equal(body.origin, origin);
    if (target.code === "multi_skin") assert.equal(body.skin_code, "ganamos_plus");
    calls.push({ agency: body.agency_id, action: body.action });
    if (body.agency_id === 313) return Response.json({ error: "destination_unavailable" }, { status: 404 });
    if (body.action === "destination" || body.action === "attempt") return Response.json({ available: true });
    const agency = body.agency_id,
      existing = accounts.get(agency);
    if (body.action === "register") {
      const identity = existing ?? identityFor(agency, body.device_id);
      accounts.set(agency, identity);
      return Response.json({ newlyCreated: !existing, identity, password: "clave" + agency });
    }
    assert.equal(body.action, "resume");
    const active =
      !!existing && ["username", "advisor_slug", "player_id", "player_provider_account_id"].every((k) => existing[k] === body[k]);
    return Response.json({ active });
  };
  const handlers = host.createGatewayAgencyHandlers({
    provider: target.code,
    config: () => ({
      gatewayPublicOrigin: origin,
      internalChatEmbedUrl: chat + "/embed",
      internalChatGatewaySecret: secret,
      sessionEncryptionKey: secret,
      defaultSkinCode: target.code === "multi_skin" ? "ganamos_plus" : undefined,
    }),
    authenticate: async (username, password) => {
      assert.equal(password, "clave" + username.replace("cliente", ""));
      authCount++;
      await login.promise;
      if (retryLogin) {
        retryLogin = false;
        throw Error("temporary provider failure");
      }
      return { username };
    },
    establish: async (request, identity, password, auth) => {
      assert.equal(auth.username, identity.username);
      const token = randomUUID();
      sessions.set(token, identity);
      const response = NextResponse.json({ redirect_url: "/entry?gateway_chat=open" });
      response.cookies.set(sessionCookie, token, cookieOptions);
      return { response, token };
    },
    recover: (req, saved, exactToken) =>
      host.recoverAgencySession(
        req,
        saved,
        {
          cookie: sessionCookie,
          secrets: [secret],
          resolve: (token) => sessions.get(token) ?? null,
          identity: recoveryId,
          redirectUrl: "/entry?gateway_chat=open",
          write: (response, session, token) => response.cookies.set(sessionCookie, token, cookieOptions),
        },
        exactToken,
      ),
  });
  page.on("pageerror", (e) => errors.push(e.message));
  let lastResponse, lastProof;
  const returningDestination = deferred();
  const returningPreparation = deferred();
  await context.route("**/*", async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      p = url.pathname;
    traces.push(url.pathname);
    try {
      if (url.origin === landingOrigin) {
        if (request.isNavigationRequest()) return route.fulfill(html(p === "/l/segunda" ? otherLanding : form));
        if (p.startsWith("/public-assets/template-entry/"))
          return route.fulfill({ contentType: "text/javascript", body: await readFile(path.join(frontend, "public", p)) });
        if (p === "/api/template7/destination") {
          const { landing_id, landing_slug } = request.postDataJSON();
          if (landing_slug === "segunda") {
            assert.equal(landing_id, uuid(32));
            return route.fulfill({
              json: { atrioClientId: uuid(2), atrioId: uuid(132), atrioSlug: "asesor-32", preparationReady: false },
            });
          }
          if (landingIssued) await returningDestination.promise;
          if (!landingAdvisorAvailable) {
            if (unavailableLookup) await unavailableLookup.promise;
            return route.fulfill({ json: { entryUnavailable: true } });
          }
          return route.fulfill({
            json: {
              atrioClientId: uuid(2),
              atrioId: uuid(131),
              atrioSlug: "asesor-31",
              preparationReady: landingIssued,
              ...(landingIssued ? { existingName: "Prueba landing", promoCode: "FIXTURE" } : {}),
            },
          });
        }
        if (p === "/api/template7/warm") return route.fulfill({ json: { gateway_origin: origin } });
        if (p === "/api/template7/prepare" || p === "/api/template7/start")
          return route.fulfill({ json: { handoff_url: origin + "/prepare?t=p1.cross" } });
        if (p.startsWith("/api/")) return route.fulfill({ json: { ok: true } });
      }
      if (url.origin === origin) {
        const req = new NextRequest(url, {
          method: request.method(),
          headers: await request.allHeaders(),
          ...(request.method() === "POST" ? { body: request.postData() } : {}),
        });
        if (p === "/resume") {
          const response = await host.resumeLanding(req);
          assert.equal(response.status, 303);
          const back = new URL(response.headers.get("location"));
          assert.equal(back.origin, landingOrigin);
          return route.fulfill(html("<script>location.replace(" + JSON.stringify(back.href) + ")</script>"));
        }
        if (p === "/prepare")
          return route.fulfill(html(host.renderPreparationPage("p1.cross", host.gatewayPreparationTheme(target.code))));
        if (p === "/api/preparations/complete") {
          landingReturning = landingIssued;
          if (landingReturning) await returningPreparation.promise;
          if (!landingIssued) {
            accounts.set(31, identityFor(31, uuid(31)));
            landingIssued = true;
            landingCreations++;
          }
          const identity = accounts.get(31);
          const entry = host.issueEntryIdentity(identity.username, "h1.cross", "c1.cross", secret, origin);
          return route.fulfill({
            json: {
              username: identity.username,
              ...(landingReturning ? { returning_account: true } : { account_created: true, password: "clave31" }),
              entry_wait: landingReturning ? returnPolicy : waitPolicy,
              continuation_token: "c1.cross",
              entry_token: entry,
              handoff_url: origin + "/start?t=h1.cross",
              target_provider: target.code,
            },
          });
        }
        if (p === "/start") {
          // Exactly the account-scoping functions called by all four real
          // /start adapters, after the fixture casino has established a session.
          const identity = accounts.get(31),
            token = randomUUID();
          sessions.set(token, identity);
          const response = NextResponse.json({
            username: identity.username,
            ...(landingReturning ? { returning_account: true } : { password: "clave31" }),
            entry_wait: landingReturning ? returnPolicy : waitPolicy,
            redirect_url: "/entry?gateway_chat=open",
          });
          response.cookies.set(sessionCookie, token, cookieOptions);
          host.rememberAgency(response, req, secret, 31, identity.player_provider_account_id, "atrio", token, sessionCookie);
          return await serveNext(
            route,
            await host.withGatewayEntryIdentity(req, async () => response, sessionCookie, [secret]),
            context,
          );
        }
        if (/^\/(17|23|31|313)$/.test(p)) return await serveNext(route, await handlers.GET(req), context);
        if (/^\/api\/agency-entry\/(17|23|31)$/.test(p)) {
          const response = await handlers.POST(req);
          const body = await response.text();
          const data = JSON.parse(body);
          lastResponse = {
            action: request.postDataJSON().action,
            status: response.status,
            fields: Object.keys(data),
            error: data.error,
          };
          return await serveNext(route, response, context, body);
        }
        const token = req.cookies.get(sessionCookie)?.value;
        if (p === "/api/session/recover") {
          const body = request.postDataJSON();
          if (!body?.entry_confirmation) return route.fulfill({ json: { active: !!token } });
          if (holdConfirmation) await recovery.promise;
          const proof = host.confirmEntrySession(body.entry_confirmation, token || "", [secret], origin);
          assert.ok(proof);
          assert.equal(proof.username, sessions.get(token).username);
          lastProof = token;
          confirmed.push(proof.username);
          return route.fulfill({ json: { active: true, entry_confirmed: true, entry_id: proof.entryId } });
        }
        if (p === "/entry") {
          assert.ok(token && token === lastProof, "must confirm the cookie for this exact session before redirecting");
          const identity = sessions.get(token);
          const embed = host.createChatEmbedUrl({
            appId: target.appId,
            advisorSlug: identity.advisor_slug,
            playerId: identity.player_id,
            playerProviderAccountId: identity.player_provider_account_id,
            targetProvider: target.code,
            parentOrigin: origin,
            baseUrl: chat + "/embed",
            secret,
            initialAction: "wallet",
          });
          return route.fulfill(html(target.casinoHtml(embed)));
        }
        if (p === provider.homePath) return route.fulfill(html("<!doctype html><title>Casino de prueba</title>"));
        if (["/gateway-client.js", "/gateway-client.css", "/gateway-app-sdk.js"].includes(p))
          return route.fulfill({
            contentType: p.endsWith(".css") ? "text/css" : "text/javascript",
            body: await readFile(path.join(root, "public", p)),
          });
        if (p.startsWith("/api/")) return route.fulfill({ json: { active: false, messages: [] } });
      }
      if (url.origin === chat) {
        if (p.startsWith("/embed/")) {
          const [version, data, signature] = url.searchParams.get("token").split(".");
          assert.equal(
            signature,
            createHmac("sha256", secret)
              .update(version + "." + data)
              .digest("base64url"),
          );
          const claims = JSON.parse(Buffer.from(data, "base64url"));
          const identity = [...accounts.values()].find((account) => account.player_id === claims.playerId);
          assert.equal(claims.appId, target.appId);
          assert.equal(claims.parentOrigin, origin);
          assert.equal(claims.targetProvider, target.code);
          assert.equal(claims.playerProviderAccountId, identity.player_provider_account_id);
          assert.equal(p, "/embed/" + identity.advisor_slug);
          assert.equal(claims.advisorSlug, identity.advisor_slug);
          chats.push(identity.username);
          const session = {
            advisor_id: identity.advisor_id,
            advisor_name: identity.advisor_slug,
            advisor_status: "disponible",
            advisor_avatar_url: null,
            player_id: identity.player_id,
            conversation_id: identity.player_provider_account_id,
            player_display_name: identity.username,
            player_platform: "desktop",
            app_installed_status: "unknown",
            quick_starters: [],
            whatsapp_url: null,
            telegram_url: null,
          };
          const props = {
            advisorSlug: identity.advisor_slug,
            deviceId: identity.device_id,
            embedded: true,
            embeddedParentOrigin: origin,
            embeddedGatewaySource: target.appId.replaceAll("_", "-"),
            embeddedHasActiveWallet: true,
            conversationSessionToken: "local-" + identity.username,
            widgetTemplate: "atrio",
            initialMessages: [walletMessage],
            session,
            quickStarters: [],
          };
          return route.fulfill(
            html(
              '<meta charset="utf-8"><style>' +
                widget.css +
                '</style><div id="root"></div><script>window.fixtureProps=' +
                JSON.stringify(props) +
                '</script><script src="/fixture-widget.js"></script>',
            ),
          );
        }
        if (p === "/fixture-widget.js") return route.fulfill({ contentType: "text/javascript", body: widget.js });
        if (p === "/api/gateway/chat") {
          const body = request.method() === "POST" ? request.postDataJSON() : {};
          if (body.action === "message") {
            const username = request.headers().authorization.slice("Bearer local-".length);
            assert.equal(body.content, "Hola " + username);
            sent.push(username);
            return route.fulfill({
              json: {
                message: {
                  id: messageId,
                  sender: "cliente",
                  content: body.content,
                  type: "texto",
                  created_at: new Date().toISOString(),
                  read_at: null,
                  metadata: {},
                },
              },
            });
          }
          return route.fulfill({
            json: { messages: [], walletReady: false, walletRequestCompleted: false, entryDiagnostics: [] },
          });
        }
        if (p.startsWith("/api/")) return route.fulfill({ json: { ok: true, profile: {} } });
      }
      return route.fulfill({ status: 204 });
    } catch (error) {
      errors.push(url.pathname + ": " + (error.stack || error.message));
      return route.abort();
    }
  });
  async function send(agency) {
    const frame = page.frameLocator("#gateway-chat-shell iframe"),
      composer = frame.getByPlaceholder("Escribi un mensaje...");
    const clipboard = await composer.evaluate(() => ({
      write: document.featurePolicy.allowsFeature("clipboard-write"),
      read: document.featurePolicy.allowsFeature("clipboard-read"),
    }));
    assert.deepEqual(clipboard, { write: true, read: false }, "Atrio can copy the CBU in the embedded chat");
    await composer.fill("Hola cliente" + agency);
    await composer.press("Enter");
    await frame.locator('[data-chat-message-id="' + messageId + '"]').waitFor();
    if (sent.length === 1) {
      // Headless shell cannot display a permission prompt. This grant does
      // not override the cross-origin iframe's Permissions Policy.
      await context.grantPermissions(["clipboard-write"]);
      await frame.getByRole("button", { name: "Copiar CBU", exact: true }).click();
      await frame.getByRole("button", { name: "CBU copiado", exact: true }).waitFor();
      // Headless shell uses its own in-memory clipboard. Paste into a separate
      // document using a user gesture; the chat never needs clipboard-read.
      const transfer = await context.newPage();
      try {
        await transfer.setContent('<label>CBU para la transferencia<input></label>');
        const destination = transfer.getByLabel("CBU para la transferencia");
        await destination.press("ControlOrMeta+v");
        assert.equal(await destination.inputValue(), accountNumber);
      } finally {
        await transfer.close();
      }
    }
  }
  try {
    for (const agency of [17, 23]) {
      login = deferred();
      await page.goto(origin + "/" + agency);
      await page.locator("#toggle").click();
      assert.equal(await page.locator("#error").innerText(), "");
      await page.locator("#name").fill("Prueba " + agency);
      await page.locator("#submit").evaluate((el) => {
        el.click();
        el.click();
      });
      const next = page.locator("#agency-continue");
      await next.waitFor();
      assert.equal(await page.locator("#agency-account-username").innerText(), "cliente" + agency);
      assert.equal(await page.locator("#agency-account-password").innerText(), "clave" + agency);
      assert.equal(await next.textContent(), "Continuar a mi cuenta");
      assert.equal(await page.evaluate(() => JSON.stringify(localStorage).includes("clave")), false);
      if (agency === 17) {
        retryLogin = true;
        await next.evaluate((el) => {
          el.click();
          el.click();
        });
        assert.equal(await next.innerText(), "Ingresando a tu cuenta…");
        assert.equal(await next.getAttribute("aria-busy"), "true");
        assert.equal(await page.getByRole("progressbar").count(), 0);
        assert.equal(new URL(page.url()).pathname, "/17");
        login.resolve();
        await page.locator("#agency-account-login").waitFor();
        assert.equal(await next.isEnabled(), true);
        assert.equal(await next.textContent(), "Continuar a mi cuenta");
        await next.click();
      } else {
        const done = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/session/recover");
        login.resolve();
        await done;
        assert.equal(new URL(page.url()).pathname, "/23");
        await next.click();
      }
      await send(agency);
    }
    // The most recently active account is 23. Both saved destinations
    // must continue to resolve independently on repeated visits.
    for (const agency of [17, 23]) {
      recovery = deferred();
      holdConfirmation = true;
      await page.goto(origin + "/" + agency);
      const next = page.locator("#agency-continue");
      await next.waitFor();
      assert.equal(await page.locator("#agency-account-title").innerText(), "¡Hola de nuevo, cliente" + agency + "!");
      assert.equal(await page.locator("#agency-account-password").isVisible(), false);
      assert.equal(await next.textContent(), "Acceder a mi cuenta");
      if (agency === 17) {
        await next.click();
        assert.equal(await next.innerText(), "Ingresando a tu cuenta…");
        assert.equal(await next.getAttribute("aria-busy"), "true");
        assert.equal(await page.getByRole("progressbar").count(), 0);
        assert.equal(new URL(page.url()).pathname, "/17");
        recovery.resolve();
      } else {
        const done = page.waitForResponse((r) => new URL(r.url()).pathname === "/api/session/recover");
        recovery.resolve();
        await done;
        await next.click();
      }
      holdConfirmation = false;
      await send(agency);
    }
    const order = ["cliente17", "cliente23", "cliente17", "cliente23"];
    assert.deepEqual(chats, order);
    assert.deepEqual(sent, order);
    assert.deepEqual(confirmed, ["cliente17", "cliente23", "cliente23", "cliente17", "cliente23", "cliente23"]);
    assert.equal(authCount, 3);
    assert.equal(calls.filter((x) => x.action === "register").length, 2);
    assert.equal(accounts.size, 2);
    assert.deepEqual(errors, []);
    // Start a third account from a real template. Then use the agency's
    // independently scoped cookies in the same browser, switch to a different
    // account and reopen the original template with its existing binding.
    await page.goto(landingOrigin + "/l/cruce", { waitUntil: "commit" });
    await page.locator("[data-template7-name]").fill("Prueba landing");
    await page.locator("[data-public-landing-cta]").click();
    await page.locator("#continue").waitFor();
    assert.equal(await page.locator("#username").innerText(), "cliente31");
    assert.equal(await page.locator("#password").innerText(), "clave31");
    await page.locator("#continue").click();
    await send(31);
    for (const agency of [31, 17]) {
      await page.goto(origin + "/" + agency);
      await page.locator("#agency-continue").waitFor();
      assert.equal(await page.locator("#agency-account-title").innerText(), "¡Hola de nuevo, cliente" + agency + "!");
      await page.locator("#agency-continue").click();
      await send(agency);
    }
    // A paused agency link must not disturb the account and chat saved by the landing.
    const paused = await page.goto(origin + "/313");
    assert.equal(paused.status(), 404);
    assert.equal(await page.locator("#username").isVisible(), false);
    // A different landing on the same host can have the same casino and device
    // but no existing account. Its visitor must be able to fill in their name.
    const otherDestination = page.waitForResponse((response) =>
      new URL(response.url()).pathname === "/api/template7/destination"
      && response.request().postDataJSON()?.landing_slug === "segunda",
    );
    await page.goto(landingOrigin + "/l/segunda");
    await otherDestination;
    const otherName = page.locator("[data-template7-name]");
    await otherName.fill("Prueba segunda landing");
    assert.equal(await otherName.isVisible(), true);
    assert.equal(await page.locator("[data-public-landing-cta]").isEnabled(), true);
    assert.equal(await page.getByText(/¡Hola de nuevo/).isVisible(), false);
    assert.equal(new URL(page.url()).pathname, "/l/segunda");
    assert.equal(landingCreations, 1);
    await page.goto(landingOrigin + "/l/cruce", { waitUntil: "commit" });
    // Hold the real return in the same browser after an earlier confirmed signup.
    const returningScreen = page.locator("#gateway-entry-transition");
    const verificationText = "Verificando tu cuenta…";
    const landingStyle = await statusTypography(returningScreen.getByText(verificationText, { exact: true }));
    assert.equal(await returningScreen.locator("[data-entry-progress]").isVisible(), false);
    assert.equal(await page.locator("[data-template7-name]").isVisible(), false);
    returningDestination.resolve();
    const gatewayStyle = await statusTypography(page.locator("#entry-stage").filter({ hasText: verificationText }));
    assert.deepEqual(gatewayStyle, landingStyle, target.code + ": verification style across domains");
    assert.equal(gatewayStyle.color, "rgb(255, 255, 255)");
    returningPreparation.resolve();
    await page.locator("#continue").waitFor();
    assert.equal(await page.locator("#account-title").innerText(), "¡Hola de nuevo, cliente31!");
    await page.locator("#continue").click();
    await send(31);
    assert.deepEqual(chats.slice(-4), ["cliente31", "cliente31", "cliente17", "cliente31"]);
    assert.deepEqual(sent, chats);
    // If this device's own advisor disappears, never fall through to a new
    // signup, the casino's last session, or another advisor.
    landingAdvisorAvailable = false;
    const beforeUnavailable = traces.length;
    await page.goto(landingOrigin + "/l/cruce");
    await page.getByText(/Tu acceso está temporalmente fuera de servicio/i).first().waitFor();
    assert.equal(await page.locator("[data-template7-name]").isVisible(), false);
    assert.equal(await page.locator("[data-public-landing-cta]").isVisible(), false);
    assert.equal(new URL(page.url()).origin, landingOrigin);
    assert.ok(!traces.slice(beforeUnavailable).some((p) => ["/api/template7/start", "/api/template7/prepare"].includes(p)));
    // A legacy browser can still have its binding with no recent presentation
    // hint. Even submitting before the lookup finishes must respect the result.
    unavailableLookup = deferred();
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator("[data-template7-name]").fill("Prueba landing");
    await page.locator("[data-public-landing-cta]").click();
    unavailableLookup.resolve();
    await page.getByText(/Tu acceso está temporalmente fuera de servicio/i).first().waitFor();
    assert.equal(await page.locator("[data-public-landing-cta]").isVisible(), false);
    assert.ok(!traces.slice(beforeUnavailable).some((p) => ["/api/template7/start", "/api/template7/prepare"].includes(p)));
    assert.equal(landingCreations, 1);
    assert.equal(calls.filter((x) => x.action === "register").length, 2);
    assert.deepEqual(errors, []);
    console.log(
      target.code +
        " PASS: three creations, eight exact chats and messages, CBU copied and pasted, early/late CTA, retry, agency and template both ways",
    );
  } catch (error) {
    console.error(error.message, JSON.stringify({ url: page.url(), traces: traces.slice(-50), errors }));
    throw new Error(
      JSON.stringify({ provider: target.code, url: page.url(), lastResponse, errors, calls, confirmed, chats, sent }),
      { cause: error },
    );
  } finally {
    unavailableLookup?.resolve();
    returningDestination.resolve();
    returningPreparation.resolve();
    login.resolve();
    recovery.resolve();
    globalThis.fetch = originalFetch;
    await context.close();
  }
}

const browser = await chromium.launch({ headless: true });
try {
  const selected = targets.filter((target) => !process.argv[2] || target.code === process.argv[2]);
  assert.ok(selected.length, "Unknown gateway provider");
  for (const spec of selected) await run(browser, await loadGateway(spec));
} finally {
  await browser.close();
}
