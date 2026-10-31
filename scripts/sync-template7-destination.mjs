import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const [sourcePath, targetPaths] of [
  ["frontend/lib/atrio/template7Destination.server.ts", ["../landing-prueba-1/lib/atrio/template7Destination.server.ts"]],
  ["frontend/lib/landing/effectiveLandingConfig.ts", ["../landing-prueba-1/lib/landing/effectiveLandingConfig.ts", "supabase/functions/_shared/effective-landing-config.ts"]],
]) {
  const contents = await readFile(path.join(root, sourcePath), "utf8");
  for (const targetPath of targetPaths) {
    const target = path.join(root, targetPath);
    if (process.argv.includes("--check")) {
      if ((await readFile(target, "utf8").catch(() => "")).replaceAll("\r\n", "\n") !== contents.replaceAll("\r\n", "\n")) throw new Error("Destino/configuración efectiva sin sincronizar: " + targetPath);
    } else {
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, contents);
    }
  }
}
console.log("Destino y configuración efectiva sincronizados en constructor, clásico y Edge Function.");
