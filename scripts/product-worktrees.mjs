import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const PRODUCT_NAMES = Object.freeze([
  "landing-builder", "landing-prueba-1", "internal-chat", "NexoBet",
  "landing-autologuin", "ases-gateway", "ganamos-gateway", "multi-skin-gateway",
]);

// An explicit map must be complete: a missing target must never silently write
// into a different session's canonical checkout.
export function createProductPathResolver(builderRoot, overrides) {
  const roots = Object.fromEntries(PRODUCT_NAMES.map((name) => [name,
    name === "landing-builder" ? path.resolve(builderRoot) : path.resolve(builderRoot, "..", name),
  ]));
  if (overrides !== undefined) {
    if (!overrides || typeof overrides !== "object" || Array.isArray(overrides)) throw Error("Invalid product worktree map");
    for (const name of Object.keys(overrides)) if (!PRODUCT_NAMES.includes(name)) throw Error("Unknown product: " + name);
    for (const name of PRODUCT_NAMES) {
      if (typeof overrides[name] !== "string" || !path.isAbsolute(overrides[name])) throw Error("Missing absolute product worktree: " + name);
      roots[name] = path.resolve(overrides[name]);
    }
  }
  return (name, ...segments) => {
    if (!PRODUCT_NAMES.includes(name)) throw Error("Unknown product: " + name);
    const target = path.resolve(roots[name], ...segments);
    const relative = path.relative(roots[name], target);
    if (relative === ".." || relative.startsWith(".." + path.sep) || path.isAbsolute(relative)) throw Error("Product path escapes worktree: " + name);
    return target;
  };
}

export function loadProductPaths(env = process.env) {
  const builderRoot = fileURLToPath(new URL("../", import.meta.url));
  const overrides = env.PRODUCT_WORKTREES_FILE
    ? JSON.parse(readFileSync(path.resolve(env.PRODUCT_WORKTREES_FILE), "utf8").replace(/^\uFEFF/, ""))
    : undefined;
  const resolve = createProductPathResolver(builderRoot, overrides);
  if (overrides) {
    for (const name of PRODUCT_NAMES) {
      if (!statSync(resolve(name)).isDirectory()) throw Error("Product worktree is not a directory: " + name);
    }
  }
  return resolve;
}
