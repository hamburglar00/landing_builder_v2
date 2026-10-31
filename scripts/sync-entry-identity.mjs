import { readFile, writeFile } from "node:fs/promises";

// Provider login and storage adapters remain in their own repositories.
const canonical = new URL("../../landing-autologuin/src/lib/", import.meta.url);
const shared = ["entry-query.ts", "entry-query.test.ts", "entry-upstream-response.ts", "entry-upstream-response.test.ts", "preparation-handoff.test.ts", "template7-return-url.ts", "entry-identity.ts", "entry-identity.test.ts", "session-recovery.ts", "session-recovery.test.ts", "../app/api/preparations/finalize/identity.test.ts"];
for (const repo of ["ases-gateway", "ganamos-gateway", "multi-skin-gateway"]) {
  for (const file of shared) {
    const content = await readFile(new URL(file, canonical), "utf8");
    const target = new URL(`../../${repo}/src/lib/${file}`, import.meta.url);
    if (process.argv.includes("--check")) {
      if (await readFile(target, "utf8") !== content) throw Error(`Entry identity drift: ${repo}/${file}`);
    } else await writeFile(target, content);
  }
}
console.log("Entry identity and session confirmation synchronized across four gateways.");
