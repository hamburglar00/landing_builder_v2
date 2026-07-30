import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { handleRequest, normalizePublicIp, signClientIp } from "../src/index.js";

const SECRET = "test-secret-with-enough-entropy";
const ORIGIN = "https://landing.panelbotadmin.com";
const BUILDER_ORIGIN = "https://mkt.panelbotadmin.com";

test("normaliza IPv4 e IPv6 públicas y rechaza direcciones privadas", () => {
  assert.equal(normalizePublicIp("181.10.20.30"), "181.10.20.30");
  assert.equal(normalizePublicIp("2800:810:abcd::1"), "2800:810:abcd::1");
  assert.equal(normalizePublicIp("10.0.0.1"), "");
  assert.equal(normalizePublicIp("fe80::1"), "");
  assert.equal(normalizePublicIp("febf::1"), "");
  assert.equal(normalizePublicIp("2800::1::2"), "");
});

test("firma el mismo contrato que validan los motores", async () => {
  const issuedAt = 1_785_432_000;
  const ip = "2800:810:abcd::1";
  const proof = await signClientIp(SECRET, ip, issuedAt);
  const expected = createHmac("sha256", SECRET)
    .update(`v1\n${issuedAt}\n${ip}`)
    .digest("base64url");
  assert.equal(proof, expected);
});

test("devuelve una prueba firmada con CORS restringido", async () => {
  const response = await handleRequest(
    new Request("https://collector.example.test/", {
      headers: {
        Origin: ORIGIN,
        "CF-Connecting-IP": "2800:810:abcd::1",
      },
    }),
    {
      ALLOWED_ORIGINS: ORIGIN,
      META_IP_PROOF_SECRET: SECRET,
    },
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), ORIGIN);
  assert.equal(body.ip, "2800:810:abcd::1");
  assert.equal(body.version, "ipv6");
  assert.equal(typeof body.issued_at, "number");
  assert.equal(typeof body.proof, "string");
  assert.equal(response.headers.get("Cache-Control"), "no-store, max-age=0");
});

test("rechaza orígenes no autorizados", async () => {
  const response = await handleRequest(
    new Request("https://collector.example.test/", {
      headers: {
        Origin: "https://attacker.example",
        "CF-Connecting-IP": "2800:810:abcd::1",
      },
    }),
    {
      ALLOWED_ORIGINS: ORIGIN,
      META_IP_PROOF_SECRET: SECRET,
    },
  );

  assert.equal(response.status, 403);
});

test("admite el dominio público del motor constructor", async () => {
  const response = await handleRequest(
    new Request("https://collector.example.test/", {
      headers: {
        Origin: BUILDER_ORIGIN,
        "CF-Connecting-IP": "2800:810:abcd::1",
      },
    }),
    {
      ALLOWED_ORIGINS: `${ORIGIN},${BUILDER_ORIGIN}`,
      META_IP_PROOF_SECRET: SECRET,
    },
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), BUILDER_ORIGIN);
});
