import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPhoneNormalizerScript,
  normalizeLandingPhone,
} from "../components/public-landing/trackingScriptHelpers";

test("normaliza números argentinos locales sin alterar los internacionales", () => {
  assert.equal(normalizeLandingPhone("11 5555-1234", "54"), "541155551234");
  assert.equal(normalizeLandingPhone("+54 11 5555-1234", "54"), "541155551234");
});

test("normaliza números paraguayos locales sin alterar los internacionales", () => {
  assert.equal(normalizeLandingPhone("0981 123 456", "595"), "595981123456");
  assert.equal(normalizeLandingPhone("+595 981 123 456", "595"), "595981123456");
});

test("el helper emitido para las landings conserva la misma normalización", () => {
  const script = `${buildPhoneNormalizerScript("normalizePhone")}; return normalizePhone;`;
  const runtimeNormalize = new Function(script)() as (
    raw: unknown,
    countryCallingCode: unknown,
  ) => string;

  for (const [raw, code] of [
    ["11 5555-1234", "54"],
    ["+54 11 5555-1234", "54"],
    ["0981 123 456", "595"],
    ["+595 981 123 456", "595"],
  ]) {
    assert.equal(runtimeNormalize(raw, code), normalizeLandingPhone(raw, code));
  }
});
