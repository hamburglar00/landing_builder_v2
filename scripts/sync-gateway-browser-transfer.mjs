import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { loadProductPaths } from "./product-worktrees.mjs";

const productPath = loadProductPaths();
const check = process.argv.includes("--check");
const worker = process.argv.find(argument => argument.startsWith("--worker="))?.slice(9);
const destinations = ["ases-gateway", "ganamos-gateway", "multi-skin-gateway"].map(name => productPath(name));
if (worker) destinations.push(resolve(worker));

const files = [
  "public/gateway-browser-transfer.js",
  "src/app/browser-transfer/route.ts",
  "src/lib/browser-transfer-page.ts",
  "src/lib/gateway-browser-transfer.ts",
];

for (const file of files) {
  const source = await readFile(productPath("landing-autologuin", file));
  for (const project of destinations) {
    const destination = resolve(project, file);
    if (check) {
      if (!(await readFile(destination)).equals(source)) throw new Error("Traspaso de navegador desactualizado: " + destination);
    } else {
      await mkdir(dirname(destination), { recursive: true });
      await writeFile(destination, source);
    }
  }
}
console.log(`Traspaso de navegador sincronizado: ${destinations.length + 1} copias`);
