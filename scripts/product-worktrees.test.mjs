import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { createProductPathResolver, PRODUCT_NAMES } from "./product-worktrees.mjs";

const root = path.resolve("synthetic-workspace", "landing-builder");
const map = Object.fromEntries(PRODUCT_NAMES.map((name) => [name, path.resolve("isolated-workspace", name + "-task")]));
test("defaults retain the canonical sibling paths", () => {
  const resolve = createProductPathResolver(root);
  assert.equal(resolve("landing-builder", "frontend"), path.join(root, "frontend"));
  assert.equal(resolve("landing-autologuin", "src/lib"), path.resolve(root, "../landing-autologuin/src/lib"));
});
test("all products use their isolated worktrees, including the source", () => {
  const resolve = createProductPathResolver(root, map);
  for (const name of PRODUCT_NAMES) assert.equal(resolve(name, "src", "file.ts"), path.join(map[name], "src/file.ts"));
});
test("partial maps cannot fall back into foreign checkouts", () => {
  const incomplete = { ...map }; delete incomplete["ganamos-gateway"];
  assert.throws(() => createProductPathResolver(root, incomplete), /Missing absolute product worktree/);
});
test("unknown products and relative or escaping paths are rejected", () => {
  assert.throws(() => createProductPathResolver(root, { ...map, API2: root }), /Unknown product/);
  assert.throws(() => createProductPathResolver(root, { ...map, NexoBet: "../relative" }), /Missing absolute/);
  const resolve = createProductPathResolver(root, map);
  assert.throws(() => resolve("panel3"), /Unknown product/);
  assert.throws(() => resolve("landing-builder", "../other/file"), /escapes/);
});
