import { readFile, writeFile } from "node:fs/promises";
const check = process.argv.includes("--check");
const canonical = await readFile(new URL("../../internal-chat/public/atrio-pwa-guide.js", import.meta.url));
for (const product of ["NexoBet", "landing-autologuin", "ases-gateway", "ganamos-gateway", "multi-skin-gateway"]) {
  const name = product === "NexoBet" ? "atrio-pwa-guide.js" : "gateway-pwa-guide.js";
  const destination = new URL(`../../${product}/public/${name}`, import.meta.url);
  if (check) { if (!(await readFile(destination)).equals(canonical)) throw Error(`Guide differs: ${product}`); }
  else await writeFile(destination, canonical);
}
console.log("On-demand guide synchronized: NexoBet and all four gateways.");
