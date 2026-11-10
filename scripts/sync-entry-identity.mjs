import { readFile, writeFile } from "node:fs/promises";
import { loadProductPaths } from "./product-worktrees.mjs";
const productPath = loadProductPaths();

// Provider login and storage adapters remain in their own repositories.
const canonical = (file) => productPath("landing-autologuin", "src/lib", file);
const shared = ["entry-query.ts", "entry-query.test.ts", "entry-upstream-response.ts", "entry-upstream-response.test.ts", "preparation-handoff.test.ts", "template7-return-url.ts", "entry-identity.ts", "entry-identity.test.ts", "session-recovery.ts", "session-recovery.test.ts", "entry-retry-receipt.ts", "entry-retry-receipt.test.ts", "entry-retry-server.ts", "entry-retry-server.test.ts", "chat-embed-renewal.ts", "chat-embed-renewal.test.ts", "../app/api/entry/renew/route.ts", "../app/api/preparations/finalize/identity.test.ts"];
for (const repo of ["ases-gateway", "ganamos-gateway", "multi-skin-gateway"]) {
  for (const file of shared) {
    const content = await readFile(canonical(file), "utf8");
    const target = productPath(repo, "src/lib", file);
    if (process.argv.includes("--check")) {
      if (await readFile(target, "utf8") !== content) throw Error(`Entry identity drift: ${repo}/${file}`);
    } else await writeFile(target, content);
  }
}
console.log("Entry identity and session confirmation synchronized across four gateways.");
