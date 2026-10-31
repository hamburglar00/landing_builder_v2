import { readFile, writeFile } from "node:fs/promises";
// Provider authentication, cookies and HTML rewrites remain in their adapters.
for (const file of ["gateway-html-stream.ts", "gateway-html-stream.test.ts"]) {
  const source = await readFile(new URL(`../../landing-autologuin/src/lib/${file}`, import.meta.url), "utf8");
  for (const repo of ["ases-gateway", "ganamos-gateway", "multi-skin-gateway"]) {
    const target = new URL(`../../${repo}/src/lib/${file}`, import.meta.url);
    if (process.argv.includes("--check")) {
      if (await readFile(target, "utf8") !== source) throw new Error(`Gateway HTML stream drift: ${repo}/${file}`);
    } else await writeFile(target, source);
  }
}
console.log("Gateway HTML prefix delivery synchronized across all four providers.");
