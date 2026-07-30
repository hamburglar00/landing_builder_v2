import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import {
  CLIENT_IP_PROOF_MAX_AGE_SECONDS,
  normalizePublicClientIp,
  selectPreferredClientIp,
  verifyClientIpProof,
} from "../lib/tracking/clientIpProof";

const SECRET = "test-secret-with-enough-entropy";
const NOW = 1_785_432_000;

function proof(ip: string, issuedAt: number) {
  return createHmac("sha256", SECRET)
    .update(`v1\n${issuedAt}\n${ip}`)
    .digest("base64url");
}

test("acepta una IPv6 pública con prueba vigente", () => {
  const ip = "2800:810:abcd::1";
  assert.equal(
    verifyClientIpProof({
      ip,
      issuedAt: NOW,
      proof: proof(ip, NOW),
      secret: SECRET,
      nowSeconds: NOW,
    }),
    ip,
  );
});

test("rechaza pruebas alteradas, vencidas o privadas", () => {
  const ip = "2800:810:abcd::1";
  assert.equal(
    verifyClientIpProof({
      ip,
      issuedAt: NOW,
      proof: `${proof(ip, NOW)}x`,
      secret: SECRET,
      nowSeconds: NOW,
    }),
    "",
  );
  assert.equal(
    verifyClientIpProof({
      ip,
      issuedAt: NOW - CLIENT_IP_PROOF_MAX_AGE_SECONDS - 1,
      proof: proof(ip, NOW - CLIENT_IP_PROOF_MAX_AGE_SECONDS - 1),
      secret: SECRET,
      nowSeconds: NOW,
    }),
    "",
  );
  assert.equal(normalizePublicClientIp("10.0.0.1"), "");
  assert.equal(normalizePublicClientIp("fe80::1"), "");
  assert.equal(normalizePublicClientIp("febf::1"), "");
  assert.equal(normalizePublicClientIp("2800::1::2"), "");
});

test("prioriza IPv6 firmada y no permite que un fallback desplace la IP observada", () => {
  assert.deepEqual(
    selectPreferredClientIp({
      verifiedClientIp: "2800:810:abcd::1",
      observedClientIp: "181.10.20.30",
      fallbackClientIp: "190.20.30.40",
    }),
    { ip: "2800:810:abcd::1", source: "signed_dual_stack" },
  );
  assert.deepEqual(
    selectPreferredClientIp({
      verifiedClientIp: "",
      observedClientIp: "181.10.20.30",
      fallbackClientIp: "190.20.30.40",
    }),
    { ip: "181.10.20.30", source: "vercel_forwarded" },
  );
});
