import { readFile, writeFile } from "node:fs/promises";

// Provider routes/adapters deliberately remain separate. Only the opaque entry
// protocol and its isolated regression fixtures have one canonical source.
const files = [
  "src/lib/preparation-page.ts", "src/lib/preparation-page.test.ts",
  "src/lib/preparation-session.ts", "src/lib/preparation-session.test.ts",
  "src/lib/request-recovery.ts",
  "src/app/api/preparations/complete/early-session.test.ts",
];
for (const repo of ["ases-gateway", "ganamos-gateway", "multi-skin-gateway"]) {
  for (const file of files) {
    const expected = await readFile(new URL(`../../landing-autologuin/${file}`, import.meta.url));
    const target = new URL(`../../${repo}/${file}`, import.meta.url);
    if (process.argv.includes("--check")) {
      if (!(await readFile(target)).equals(expected)) throw new Error(`Preparación compartida desactualizada: ${repo}/${file}`);
    } else await writeFile(target, expected);
  }
}
console.log("Preparación compartida sincronizada: 4 gateways");
