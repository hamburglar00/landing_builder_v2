import { readFile, writeFile } from "node:fs/promises";

const canonical = new URL("../../landing-autologuin/", import.meta.url);
for (const repo of ["ases-gateway", "ganamos-gateway", "multi-skin-gateway"]) {
  for (const file of ["gateway-browser-appearance.ts", "gateway-browser-appearance.test.ts"]) {
    const expected = await readFile(new URL(`src/lib/${file}`, canonical));
    const target = new URL(`../../${repo}/src/lib/${file}`, import.meta.url);
    if (process.argv.includes("--check")) {
      if (!(await readFile(target)).equals(expected)) throw new Error(`Browser appearance differs: ${repo}/${file}`);
    } else await writeFile(target, expected);
  }
}
console.log("Browser appearance shared by all four gateways.");
