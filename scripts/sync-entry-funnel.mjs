import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
for (const relative of ["lib/landing/entryFunnel.ts", "lib/landing/entryFunnel.server.ts", "app/api/entry-funnel/route.ts"]) {
  const source = await readFile(path.join(root, "frontend", relative), "utf8");
  const target = path.resolve(root, "../landing-prueba-1", relative);
  if (process.argv.includes("--check")) {
    if (await readFile(target, "utf8") !== source) throw new Error("Entry funnel classic out of sync: " + relative);
  } else { await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, source); }
}
console.log("Entry funnel collector is synchronized for constructor/classic.");
const gatewayRoot = path.resolve(root, "../landing-autologuin");
const browser = (await readFile(path.join(root, "frontend/lib/landing/entryFunnel.client.ts"), "utf8"))
  .replace('from "./entryFunnel"', 'from "./entry-funnel-contract"');
const contract = await readFile(path.join(root, "frontend/lib/landing/entryFunnel.ts"), "utf8");
const gateway = await readFile(path.join(gatewayRoot, "src/lib/entry-funnel-client.ts"), "utf8");
const builderGatewayTarget = path.join(root, "frontend/lib/entry-funnel-client.ts");
const builderGateway = gateway.replace('from "./entry-funnel-browser"', 'from "./landing/entryFunnel.client"');
if (process.argv.includes("--check")) {
  if (await readFile(builderGatewayTarget, "utf8") !== builderGateway) throw new Error("Builder entry funnel gateway bridge out of sync");
} else await writeFile(builderGatewayTarget, builderGateway);
for (const repo of ["landing-autologuin", "ases-gateway", "ganamos-gateway", "multi-skin-gateway"]) {
  for (const [name, source] of [["entry-funnel-browser.ts", browser], ["entry-funnel-contract.ts", contract], ["entry-funnel-client.ts", gateway]]) {
    const target = path.resolve(root, "..", repo, "src/lib", name);
    if (process.argv.includes("--check")) {
      if (await readFile(target, "utf8") !== source) throw new Error("Gateway entry funnel out of sync: " + repo + "/" + name);
    } else await writeFile(target, source);
  }
}
console.log("Entry funnel browser helpers are synchronized for all four gateways.");
