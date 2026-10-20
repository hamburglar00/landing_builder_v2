import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const source = await readFile(new URL("../../internal-chat/public/atrio-push-delivery.js", import.meta.url));
for (const name of ["landing-autologuin","ases-gateway","ganamos-gateway","multi-skin-gateway"]) {
  const file = new URL(`../../${name}/public/atrio-push-delivery.js`, import.meta.url);
  if (process.argv.includes("--check")) {
    if (!(await readFile(file)).equals(source)) throw Error(`Push delivery helper desactualizado: ${name}`);
  } else await writeFile(file, source);
}
console.log(JSON.stringify({ gateways: 4, sha256: createHash("sha256").update(source).digest("hex") }));
