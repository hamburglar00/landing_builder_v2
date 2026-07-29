import assert from "node:assert/strict";
import test from "node:test";
import robots from "../app/robots";

test("permite landings públicas y bloquea el rastreo del panel", () => {
  const result = robots();
  const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
  const wildcard = rules.find((rule) => rule.userAgent === "*");

  assert.ok(wildcard);
  assert.deepEqual(wildcard.allow, ["/l/", "/promo/"]);
  assert.deepEqual(wildcard.disallow, [
    "/admin",
    "/dashboard",
    "/login",
    "/api/",
  ]);
});
