import { dirname } from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { loadProductPaths } from "./product-worktrees.mjs";

const productPath = loadProductPaths();

for (const repo of ["ases-gateway", "ganamos-gateway", "multi-skin-gateway"]) {
  const route = ["src", "app", "api", "agency-entry", "[agency]", "route.ts"];
  const sourceRoute = await readFile(productPath("landing-autologuin", ...route));
  const targetRoute = productPath(repo, ...route);
  if (process.argv.includes("--check")) {
    if (!(await readFile(targetRoute)).equals(sourceRoute)) throw new Error("Ruta por gerencia desactualizada: " + repo);
  } else {
    await mkdir(dirname(targetRoute), { recursive: true });
    await writeFile(targetRoute, sourceRoute);
  }
  for (const file of ["agency-memory.ts", "agency-memory.test.ts", "gateway-chat-backend.ts", "gateway-chat-backend.test.ts", "gateway-auth-view.ts", "gateway-login.ts", "gateway-login-page.ts", "gateway-login.test.ts", "gateway-agency.ts", "gateway-agency-page.ts", "gateway-agency.test.ts", "gateway-agency-routing.test.ts", "gateway-agency-recovery.ts", "gateway-agency-recovery.test.ts", "gateway-agency-browser.ts"]) {
    const expected = await readFile(productPath("landing-autologuin", "src/lib", file));
    const target = productPath(repo, "src/lib", file);
    if (process.argv.includes("--check")) {
      if (!(await readFile(target)).equals(expected)) throw new Error(`Ingreso compartido desactualizado: ${repo}/${file}`);
    } else await writeFile(target, expected);
  }
}
console.log("Ingreso compartido sincronizado: 4 gateways");
