import assert from "node:assert/strict";
import test from "node:test";
import { isSameOriginRequest } from "../lib/http/sameOrigin";

test("same-origin checks use the real Host when Next normalizes loopback URLs", () => {
  const input = (origin: string, host = "127.0.0.1:3137") => new Request("http://localhost:3137/api/bots", { headers: { origin, host } });
  assert.equal(isSameOriginRequest(input("http://127.0.0.1:3137")), true);
  assert.equal(isSameOriginRequest(input("http://localhost:3137", "localhost:3137")), true);
  assert.equal(isSameOriginRequest(input("http://localhost:3137")), false);
  assert.equal(isSameOriginRequest(input("http://127.0.0.1:3138")), false);
  assert.equal(isSameOriginRequest(input("https://127.0.0.1:3137")), false);
});

test("foreign, null, credentialed and forged forwarded origins stay rejected", () => {
  for (const origin of ["https://attacker.invalid", "null", "https://constructor.panelbotadmin.com/path", "https://user@constructor.panelbotadmin.com"]) {
    assert.equal(isSameOriginRequest(new Request("https://constructor.panelbotadmin.com/api/bots", { headers: { origin, host: "constructor.panelbotadmin.com", "x-forwarded-host": "attacker.invalid" } })), false);
  }
  assert.equal(isSameOriginRequest(new Request("https://constructor.panelbotadmin.com/api/bots", { headers: { origin: "https://attacker.invalid", host: "constructor.panelbotadmin.com", "x-forwarded-host": "attacker.invalid", "x-forwarded-proto": "https" } })), false);
  assert.equal(isSameOriginRequest(new Request("https://constructor.panelbotadmin.com/api/bots", { headers: { origin: "https://constructor.panelbotadmin.com", host: "constructor.panelbotadmin.com" } })), true);
  assert.equal(isSameOriginRequest(new Request("https://constructor.panelbotadmin.com/api/bots")), true);
});
