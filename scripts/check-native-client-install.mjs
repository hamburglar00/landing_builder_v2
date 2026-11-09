// Browser-owned installation APIs are simulated; no accounts or app installs.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const workspace = fileURLToPath(new URL("../../", import.meta.url));
const require = createRequire(
  new URL("../frontend/package.json", import.meta.url),
);
const { chromium, webkit } = require("playwright");
const baseline = process.argv.includes("--baseline");
const publicCheck = process.argv.includes("--public");
const output = fileURLToPath(
  new URL("../.local/native-client-install/", import.meta.url),
);
await mkdir(output, { recursive: true });
const results = [];
const repos = [
  "landing-autologuin",
  "ases-gateway",
  "ganamos-gateway",
  "multi-skin-gateway",
];
const domains = [
  "https://reydeases-gateway.vercel.app",
  "https://ases-del-norte-gateway.vercel.app",
  "https://ganamos-net-gateway.vercel.app",
  "https://ganamosnet.global",
];
const targets = repos.map((repo, index) => ({ repo, origin: domains[index] }));
if (publicCheck)
  targets.push({
    repo: "multi-skin-gateway",
    origin: "https://multi-skin-gateway.vercel.app",
  });
const hash = (text) =>
  createHash("sha256").update(text.replaceAll("\r\n", "\n")).digest("hex");
async function source(repo, file, origin) {
  if (baseline)
    return execFileSync("git", ["show", `HEAD:${file}`], {
      cwd: path.join(workspace, repo),
      encoding: "utf8",
    });
  const local = await readFile(path.join(workspace, repo, file), "utf8");
  if (!publicCheck) return local;
  const response = await fetch(origin + "/" + file.slice("public/".length), {
    signal: AbortSignal.timeout(15000),
  });
  assert.equal(response.status, 200);
  const published = await response.text();
  assert.equal(
    hash(published),
    hash(local),
    `Published source differs: ${origin} ${file}`,
  );
  return published;
}
for (const [engine, launcher] of process.argv.includes("--quick")
  ? [["chromium", chromium]]
  : [
      ["chromium", chromium],
      ["webkit", webkit],
    ]) {
  const browser = await launcher.launch();
  try {
    for (const { repo, origin } of targets) {
      const sdk = await source(repo, "public/gateway-app-sdk.js", origin);
      const client = await source(repo, "public/gateway-client.js", origin);
      const css = await source(repo, "public/gateway-client.css", origin);
      const names = [
        "closeNotice",
        "createNotice",
        "registerServiceWorker",
        "showInstallNotice",
        "refreshInstallNotice",
        "initializeInstallAndPush",
      ];
      const functions = names
        .map((name) => {
          const match = client.match(
            name === "registerServiceWorker"
              ? /  function registerServiceWorker[^\r\n]+/
              : new RegExp(
                  `  (?:async )?function ${name}\\([^]*?\\n  }\\r?(?=\\n|$)`,
                ),
          );
          if (!match && !(baseline && name === "refreshInstallNotice"))
            throw Error(`Missing ${name}: ${repo}`);
          return match?.[0] || "";
        })
        .join("\n");
      await writeFile(path.join(output, "fixture-functions.js"), functions);
      for (const mode of baseline
        ? ["dismissed"]
        : ["accepted", "dismissed", "error", "late", "ios", "replaced"]) {
        const context = await browser.newContext({
          viewport: { width: 360, height: 740 },
          userAgent:
            mode === "ios"
              ? "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile Safari/604.1"
              : "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36",
        });
        const page = await context.newPage(),
          errors = [],
          external = [];
        page.on("pageerror", (error) => errors.push(error.message));
        await context.route("**/*", (route) => {
          const url = new URL(route.request().url());
          if (url.origin !== "https://install.fixture.test") {
            external.push(url.origin);
            return route.abort();
          }
          return route.fulfill({
            contentType: "text/html",
            body: "<!doctype html><html><head><meta name=viewport content='width=device-width,initial-scale=1'></head><body></body></html>",
          });
        });
        try {
          await page.goto("https://install.fixture.test");
          await page.addStyleTag({ content: css });
          await page.evaluate(
            ({ mode }) => {
              window.installMode = mode;
              window.nativeCalls = 0;
              window.gestureAtPrompt = false;
              Object.defineProperty(navigator, "serviceWorker", {
                configurable: true,
                value: {
                  register: () => Promise.resolve(null),
                  ready: Promise.resolve(null),
                },
              });
              window.emitInstall = () => {
                const event = new Event("beforeinstallprompt", {
                  cancelable: true,
                });
                event.prompt = () => {
                  window.nativeCalls++;
                  window.gestureAtPrompt =
                    navigator.userActivation?.isActive === true;
                  if (mode === "error") throw Error("synthetic prompt error");
                  return Promise.resolve();
                };
                event.userChoice = new Promise((resolve) => {
                  window.finishInstall = (outcome) => resolve({ outcome });
                });
                window.dispatchEvent(event);
              };
            },
            { mode },
          );
          await page.addScriptTag({ content: sdk });
          await page.addScriptTag({
            content: `let notice = null, noticePriority = -1;
            const app = window.GatewayApp, standalone = false, appFeaturesInitialized = true, appNoticeDeferredForChat = true;
            const config = {displayName:'Fixture casino',appIcon:'/icon.svg'};
            const storageGet=(storage,key)=>storage.getItem(key),storageSet=(storage,key,value)=>storage.setItem(key,value);
            const invitationStorageKey=invitation=>'fixture:invite:'+invitation.id;
            const platform=()=>window.installMode==='ios'?'ios':'android';
            const reportReminderResult=()=>{},publishInstallOfferState=()=>{};
            ${functions}
            initializeInstallAndPush();
            window.openInvitation=(id='install-one',body=app.installationInstructions(platform()))=>showInstallNotice(true,{id,action:'install_app',title:'INSTALAR',body});`,
          });
          assert.deepEqual(
            errors,
            [],
            "fixture must initialize before testing installation",
          );
          if (mode !== "late") await page.evaluate(() => window.emitInstall());
          await page.evaluate(() => window.openInvitation());
          const dialog = page.getByRole("dialog"),
            primary = dialog.locator(".gateway-primary");
          await dialog.waitFor();
          assert.equal(
            await page.evaluate(() => window.nativeCalls),
            0,
            "arrival must never open a native prompt",
          );
          if (mode === "ios") {
            assert.equal(await primary.innerText(), "Entendido");
            assert.match(await dialog.innerText(), /Desde Safari/);
            assert.equal(
              await page.evaluate(() => window.GatewayApp.canInstall()),
              false,
            );
            await primary.click();
            assert.equal(await page.evaluate(() => window.nativeCalls), 0);
          } else {
            if (mode === "late") {
              assert.equal(await primary.innerText(), "Entendido");
              assert.match(
                await dialog.innerText(),
                /Abrí la página en Chrome/,
              );
              await page.evaluate(() => window.emitInstall());
            }
            if (!baseline) {
              assert.equal(await primary.innerText(), "Instalar app");
              const guide = dialog.locator("details");
              assert.equal(await guide.getAttribute("open"), null);
              await guide.locator("summary").click();
              assert.match(
                await guide.innerText(),
                /Elegí Instalar App o Agregar a pantalla principal/,
              );
              assert.ok(
                Number(
                  await guide
                    .locator("summary")
                    .evaluate((n) => getComputedStyle(n).fontWeight),
                ) >= 700,
              );
              if (mode === "accepted" && engine === "chromium")
                await page.screenshot({
                  path: path.join(
                    output,
                    `${publicCheck ? "public-" : ""}${repo}-ready.png`,
                  ),
                });
            }
            await primary.click();
            assert.equal(await page.evaluate(() => window.nativeCalls), 1);
            if (engine === "chromium")
              assert.equal(
                await page.evaluate(() => window.gestureAtPrompt),
                true,
              );
            if (mode !== "error") {
              if (!baseline) {
                assert.equal(await primary.isDisabled(), true);
                assert.match(
                  await primary.innerText(),
                  /Confirmá en tu navegador/,
                );
                await primary.evaluate((button) => button.click());
                assert.equal(await page.evaluate(() => window.nativeCalls), 1);
              }
              if (mode === "replaced")
                await page.evaluate(() =>
                  window.openInvitation(
                    "install-two",
                    "Instructivo de la invitación nueva",
                  ),
                );
              await page.evaluate(
                (outcome) => window.finishInstall(outcome),
                mode === "dismissed" ? "dismissed" : "accepted",
              );
            }
            if (mode === "dismissed" || mode === "error") {
              await page.waitForFunction(
                () =>
                  document.querySelector(".gateway-primary")?.textContent ===
                  "Entendido",
              );
              assert.equal(
                await dialog.locator("details").getAttribute("open"),
                "",
              );
              assert.match(
                await dialog.innerText(),
                /Abrí la página en Chrome/,
              );
              assert.equal(
                await page.evaluate(() =>
                  localStorage.getItem("fixture:invite:install-one"),
                ),
                null,
              );
              await page.screenshot({
                path: path.join(output, `${repo}-${engine}-${mode}.png`),
              });
            } else if (mode === "replaced") {
              await page.waitForFunction(
                () =>
                  document.querySelector(".gateway-primary")?.disabled ===
                  false,
              );
              assert.match(
                await dialog.innerText(),
                /Instructivo de la invitación nueva/,
              );
              assert.equal(
                await page.evaluate(() =>
                  localStorage.getItem("fixture:invite:install-two"),
                ),
                null,
              );
            } else {
              await dialog.waitFor({ state: "detached" });
              assert.equal(
                await page.evaluate(() =>
                  localStorage.getItem("gateway:installed"),
                ),
                null,
                "accepting is not installation confirmation",
              );
              await page.evaluate(() => {
                window.dispatchEvent(new Event("appinstalled"));
                window.emitInstall();
              });
              assert.equal(
                await page.evaluate(() => window.GatewayApp.canInstall()),
                false,
              );
            }
          }
          assert.equal(
            await page.evaluate(
              () => document.documentElement.scrollWidth > innerWidth,
            ),
            false,
          );
          assert.deepEqual(errors, []);
          assert.deepEqual(external, []);
          results.push({
            repo,
            engine,
            mode,
            ...(publicCheck ? { origin } : {}),
          });
          console.log(`PASS native install ${repo} ${engine} ${mode}`);
        } finally {
          await context.close();
        }
      }
    }
  } finally {
    await browser.close();
  }
}
await writeFile(
  path.join(output, publicCheck ? "public-results.json" : "results.json"),
  JSON.stringify(
    { simulatedBrowserApi: true, realInstalls: 0, results },
    null,
    2,
  ),
);
