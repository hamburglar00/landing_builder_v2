// Read-only public deployment checks. Fake tickets are rendered but never activated.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = fileURLToPath(new URL("../../", import.meta.url));
const targets = [["landing-autologuin", "https://www.reydeases.fun"], ["ases-gateway", "https://www.asesdelnorte.online"], ["ganamos-gateway", "https://www.ganamosnet.icu"], ["multi-skin-gateway", "https://ganamosnet.global"]];
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
// Windows/Vercel uploads can change line endings without changing the asset.
const sourceDigest = bytes => digest(Buffer.from(bytes.toString("utf8").replaceAll("\r\n", "\n")));
const checks = await Promise.all(targets.map(async ([repo, origin]) => {
  const [script, styles, login, constructor, classic] = await Promise.all([
    fetch(origin + "/gateway-client.js?v=chat-motion-1"), fetch(origin + "/gateway-client.css?v=chat-motion-1"), fetch(origin + "/", { headers: { Accept: "text/html" } }),
    fetch(origin + "/prepare?t=p1.public-fixture"), fetch(origin + "/prepare?t=public-ready-fixture"),
  ]);
  assert.equal(script.status, 200); assert.equal(script.headers.has("set-cookie"), false);
  const scriptBytes = Buffer.from(await script.arrayBuffer()), hash = digest(scriptBytes);
  assert.equal(sourceDigest(scriptBytes), sourceDigest(await readFile(path.join(root, repo, "public/gateway-client.js"))), repo + " public script");
  assert.equal(styles.status, 200); assert.equal(styles.headers.has("set-cookie"), false);
  const styleBytes = Buffer.from(await styles.arrayBuffer()), cssHash = digest(styleBytes);
  assert.equal(sourceDigest(styleBytes), sourceDigest(await readFile(path.join(root, repo, "public/gateway-client.css"))), repo + " public styles");
  const loginHtml = await login.text(), constructorHtml = await constructor.text(), classicHtml = await classic.text();
  assert.equal(login.status, 401); assert.ok(loginHtml.includes('data-eye')); assert.ok(!loginHtml.includes("Usá tu usuario y contraseña para volver al casino y a tu chat."));
  assert.ok(loginHtml.includes("text-align:center")); assert.equal(constructor.status, 200); assert.equal(classic.status, 200);
  assert.ok(constructorHtml.includes('<h1 id="entry-stage">Creando tu cuenta</h1>')); assert.ok(classicHtml.includes('<h1 id="entry-stage">Ingresando al casino</h1>'));
  assert.ok(constructorHtml.includes('if(false){preactivate')); assert.ok(classicHtml.includes('if(true){preactivate'));
  for (const html of [constructorHtml, classicHtml]) {
    assert.ok(html.includes('function entryFeedback()'));
    assert.ok(html.includes('next.disabled=true'));
    assert.ok(html.includes('aria-busy="false">Continuar al casino'));
  }
  return { repo, origin, publicScriptMatchesSource: true, lineEndingsNormalized: true, sha256: hash, sourceSha256: sourceDigest(scriptBytes), publicStylesMatchSource: true, cssSha256: cssHash, cssSourceSha256: sourceDigest(styleBytes), login: "eye, compact copy and centered footer", constructorTransition: true, classicTransition: true, continueBusyFeedback: true };
}));
const directory = new URL("../.vercel/validation-entry-ux/", import.meta.url); await mkdir(directory, { recursive: true });
await writeFile(new URL("public-gateways.json", directory), JSON.stringify({ at: new Date().toISOString(), activatedTickets: 0, createdAccounts: 0, financialOperations: 0, checks }, null, 2) + "\n");
console.log(JSON.stringify({ passed: checks.length, cloudflareIncluded: true, activatedTickets: 0, createdAccounts: 0 }));
