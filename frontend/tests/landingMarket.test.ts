import assert from "node:assert/strict";
import test from "node:test";
import { buildLandingConfig } from "../lib/landing/buildLandingConfig";
import { DEFAULT_CONFIG } from "../lib/landing/mocks";

function buildForWorkspace(
  workspaceCurrency: "ARS" | "PYG",
  marketCountry: "AR" | "PY",
) {
  return buildLandingConfig({
    id: "landing-test",
    name: "landing-test",
    comment: "",
    workspaceCurrency,
    pixelId: "123456789",
    postUrl: "https://example.com/conversions",
    landingTag: "TEST",
    config: { ...DEFAULT_CONFIG, marketCountry },
  });
}

test("ARS publica el prefijo telefonico 54 aunque la config vieja diga PY", () => {
  assert.equal(buildForWorkspace("ARS", "PY").tracking.phoneCountryCode, "54");
});

test("PYG publica el prefijo telefonico 595 aunque la config vieja diga AR", () => {
  assert.equal(buildForWorkspace("PYG", "AR").tracking.phoneCountryCode, "595");
});
