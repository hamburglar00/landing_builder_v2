import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "frontend/lib/atrio/template7Destination.server.ts");
const target = path.join(root, "../landing-prueba-1/lib/atrio/template7Destination.server.ts");
const contents = await readFile(source, "utf8");
if (process.argv.includes("--check")) {
  if (await readFile(target, "utf8").catch(() => "") !== contents) throw new Error("El selector de destinos de Template 7 no está sincronizado.");
  console.log("Selector de destinos sincronizado en constructor y clásico.");
} else {
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, contents);
  console.log("Selector de destinos sincronizado.");
}
