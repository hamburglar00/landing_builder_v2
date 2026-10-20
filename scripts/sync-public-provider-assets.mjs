import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const canonical = new URL("../../landing-autologuin/src/lib/public-provider-assets.ts", import.meta.url);
const source = await readFile(canonical);
for (const repo of ["ases-gateway", "ganamos-gateway", "multi-skin-gateway"]) {
  for (const file of ["public-provider-assets.ts", "public-provider-assets.test.ts"]) {
    const expected = await readFile(new URL(`../../landing-autologuin/src/lib/${file}`, import.meta.url));
    const destination = new URL(`../../${repo}/src/lib/${file}`, import.meta.url);
    if (process.argv.includes("--check")) {
      if (!(await readFile(destination)).equals(expected)) throw new Error(`Assets públicos desactualizados: ${repo}/${file}`);
    } else {
      await writeFile(destination, expected);
    }
  }
}
console.log(JSON.stringify({ gateways: 4, sha256: createHash("sha256").update(source).digest("hex") }));
