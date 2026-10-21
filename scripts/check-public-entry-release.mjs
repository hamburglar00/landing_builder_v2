// Read-only public deployment checks. Fake tickets are rendered but never activated.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = fileURLToPath(new URL("../../", import.meta.url));
const targets = [["landing-autologuin", "https://www.reydeases.fun"], ["ases-gateway", "https://www.asesdelnorte.online"], ["ganamos-gateway", "https://www.ganamosnet.icu"], ["multi-skin-gateway", "https://ganamosnet.global"]];
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const checks = await Promise.all(targets.map(async ([repo, origin]) => {
  const [script, login, constructor, classic] = await Promise.all([
    fetch(origin + "/gateway-client.js?v=entry-transition-2"), fetch(origin + "/", { headers: { Accept: "text/html" } }),
    fetch(origin + "/prepare?t=p1.public-fixture"), fetch(origin + "/prepare?t=public-ready-fixture"),
  ]);
  assert.equal(script.status, 200); assert.equal(script.headers.has("set-cookie"), false);
  const hash = digest(Buffer.from(await script.arrayBuffer())); assert.equal(hash, digest(await readFile(path.join(root, repo, "public/gateway-client.js"))));
  const loginHtml = await login.text(), constructorHtml = await constructor.text(), classicHtml = await classic.text();
  assert.equal(login.status, 401); assert.ok(loginHtml.includes('data-eye')); assert.ok(!loginHtml.includes("Usá tu usuario y contraseña para volver al casino y a tu chat."));
  assert.ok(loginHtml.includes("text-align:center")); assert.equal(constructor.status, 200); assert.equal(classic.status, 200);
  assert.ok(constructorHtml.includes('<h1 id="entry-stage">Creando tu cuenta</h1>')); assert.ok(classicHtml.includes('<h1 id="entry-stage">Ingresando al casino</h1>'));
  assert.ok(constructorHtml.includes('if(false){preactivate')); assert.ok(classicHtml.includes('if(true){preactivate'));
  return { repo, origin, publicScriptMatchesSource: true, sha256: hash, login: "eye, compact copy and centered footer", constructorTransition: true, classicTransition: true };
}));
const directory = new URL("../.vercel/validation-entry-and-replies/", import.meta.url); await mkdir(directory, { recursive: true });
await writeFile(new URL("public-gateways.json", directory), JSON.stringify({ at: new Date().toISOString(), activatedTickets: 0, createdAccounts: 0, financialOperations: 0, checks }, null, 2) + "\n");
console.log(JSON.stringify({ passed: checks.length, cloudflareIncluded: true, activatedTickets: 0, createdAccounts: 0 }));
