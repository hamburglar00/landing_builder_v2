import { createRequire } from "node:module";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const canonical = new URL("../../landing-autologuin/", import.meta.url);
const source = await readFile(new URL("src/lib/gateway-entry-transition.ts", canonical), "utf8");
const { build } = createRequire(new URL("../frontend/package.json", import.meta.url))("esbuild");
const bundled = await build({ absWorkingDir: fileURLToPath(canonical), entryPoints: ["src/lib/gateway-entry-transition.ts"],
  bundle: true, write: false, platform: "node", format: "esm", target: "es2022" });
const compiled = bundled.outputFiles[0].text;
const { GATEWAY_ENTRY_TRANSITION_RUNTIME } = await import("data:text/javascript;base64," + Buffer.from(compiled).toString("base64"));
const fragment = `  // BEGIN shared entry transition\n${GATEWAY_ENTRY_TRANSITION_RUNTIME}\n  // END shared entry transition\n`;
const check = process.argv.includes("--check");
async function sync(target, expected) {
  if (check) { if (await readFile(target, "utf8") !== expected) throw Error("Transición desactualizada: " + target.pathname); }
  else await writeFile(target, expected);
}
for (const repo of ["landing-autologuin", "ases-gateway", "ganamos-gateway", "multi-skin-gateway"]) {
  const root = new URL(`../../${repo}/`, import.meta.url);
  if (repo !== "landing-autologuin") {
    await sync(new URL("src/lib/gateway-entry-transition.ts", root), source);
    for (const file of ["preparation-page.ts", "preparation-page.test.ts", "transition-layout.ts", "gateway-entry-transition.test.ts", "gateway-entry-settings.ts", "gateway-entry-settings.test.ts", "gateway-entry-response.ts", "gateway-entry-response.test.ts"]) await sync(new URL(`src/lib/${file}`, root), await readFile(new URL(`src/lib/${file}`, canonical), "utf8"));
  }
  const target = new URL("public/gateway-client.js", root);
  const client = await readFile(target, "utf8");
  const without = client.replace(/  \/\/ BEGIN shared entry transition[\s\S]*?  \/\/ END shared entry transition\n\n?/, "");
  if (without.split("  function initializeChat() {").length !== 2) throw Error("Gateway client changed");
  await sync(target, without.replace("  function initializeChat() {", fragment + "\n  function initializeChat() {"));
}
// Template 8 also reads the brand registry to prewarm the selected page.
// The landing runtime already installs its funnel. Avoid embedding that factory twice.
const builderSource = source.replace('import { GATEWAY_ENTRY_FUNNEL_SCRIPT } from "@/lib/entry-funnel-client";\n', '')
  .replace('GATEWAY_ENTRY_TRANSITION_RUNTIME = GATEWAY_ENTRY_FUNNEL_SCRIPT + ', 'GATEWAY_ENTRY_TRANSITION_RUNTIME = ')
  .replace("} as const;", "} as const;\nexport { brands as GATEWAY_ENTRY_BRANDS };");
await sync(new URL("../frontend/lib/gateway-entry-transition.ts", import.meta.url), builderSource);
console.log("Transición compartida verificada: constructor, clásico y cuatro gateways.");
