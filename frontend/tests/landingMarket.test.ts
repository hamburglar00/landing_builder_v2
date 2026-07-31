import assert from "node:assert/strict";
import test from "node:test";
import { buildLandingConfig } from "../lib/landing/buildLandingConfig";
import { DEFAULT_CONFIG } from "../lib/landing/mocks";

function buildForMarket(marketCountry: "AR" | "PY") {
  return buildLandingConfig({
    id: "landing-test",
    name: "landing-test",
    comment: "",
    pixelId: "123456789",
    postUrl: "https://example.com/conversions",
    landingTag: "TEST",
    config: { ...DEFAULT_CONFIG, marketCountry },
  });
}

test("Argentina publica el prefijo telefónico 54", () => {
  assert.equal(buildForMarket("AR").tracking.phoneCountryCode, "54");
});

test("Paraguay publica el prefijo telefónico 595", () => {
  assert.equal(buildForMarket("PY").tracking.phoneCountryCode, "595");
});
