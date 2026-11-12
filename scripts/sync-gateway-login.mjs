import { readFile, writeFile } from "node:fs/promises";

for (const repo of ["ases-gateway", "ganamos-gateway", "multi-skin-gateway"]) {
  for (const file of ["gateway-chat-backend.ts", "gateway-chat-backend.test.ts", "gateway-auth-view.ts", "gateway-login.ts", "gateway-login-page.ts", "gateway-login.test.ts", "gateway-agency.ts", "gateway-agency-page.ts", "gateway-agency.test.ts", "gateway-agency-routing.test.ts", "gateway-agency-recovery.ts", "gateway-agency-recovery.test.ts", "gateway-agency-browser.ts"]) {
    const expected = await readFile(new URL(`../../landing-autologuin/src/lib/${file}`, import.meta.url));
    const target = new URL(`../../${repo}/src/lib/${file}`, import.meta.url);
    if (process.argv.includes("--check")) {
      if (!(await readFile(target)).equals(expected)) throw new Error(`Ingreso compartido desactualizado: ${repo}/${file}`);
    } else await writeFile(target, expected);
  }
}
console.log("Ingreso compartido sincronizado: 4 gateways");
