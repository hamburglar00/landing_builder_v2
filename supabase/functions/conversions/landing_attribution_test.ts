import { guardNewContactLandingAttribution as guard, hasLandingAttributionV2 } from "./landing_attribution.ts";

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

const now = Date.UTC(2026, 9, 31, 18);
const day = 86_400_000;
const landing = {
  id: "11111111-1111-4111-8111-111111111111",
  attribution_scope_resolved: true,
  workspace_currency: "ARS",
  pixel_id: "123456789",
};
function payload(at = now) {
  return {
    source_platform: "landing", meta_pixel_id: landing.pixel_id, currency: "ARS",
    fbc: `fb.1.${at}.fixtureClick`, fbp: "fixture-fbp", from_meta_ads: true,
    landing_attribution: {
      version: 2, landing_id: landing.id, workspace_currency: "ARS", pixel_id: landing.pixel_id,
      entry_source: "url", fbc_source: "url", captured_at: at, legacy_fbc_quarantined: false,
    },
  };
}

for (const source of ["url", "referrer", "sdk_fresh"]) {
  Deno.test(`V2 accepts consistent ${source} and keeps the original timestamp`, () => {
    const p = payload(now - 1000);
    Object.assign(p.landing_attribution, { entry_source: source, fbc_source: source });
    const result = guard(p, landing, now);
    assert(result.fbc === p.fbc && result.from_meta_ads, "Current click should survive");
    assert(result.landing_attribution.captured_at === now - 1000, "Never refresh creation time");
  });
}

Deno.test("V2 accepts a direct return only with scoped persisted origin and original age", () => {
  const p = payload(now - 89 * day);
  Object.assign(p.landing_attribution, { entry_source: "direct", fbc_source: "persisted" });
  assert(guard(p, landing, now).fbc === p.fbc, "Same-scope return should retain click");
  assert(guard(p, landing, now + 2 * day).fbc === "", "Return cannot extend expiry");
});

for (const [label, patch] of [
  ["another landing", { landing_id: "22222222-2222-4222-8222-222222222222" }],
  ["another workspace", { workspace_currency: "PYG" }],
  ["another pixel", { pixel_id: "999" }],
  ["direct claimed as fresh", { entry_source: "direct", fbc_source: "sdk_fresh" }],
  ["persisted claimed as URL", { entry_source: "url", fbc_source: "persisted" }],
  ["unknown provenance", { fbc_source: "cookie" }],
  ["captured time refreshed", { captured_at: now + 1 }],
  ["captured time in seconds", { captured_at: now / 1000 }],
  ["missing captured time", { captured_at: null }],
] as const) {
  Deno.test(`V2 discards FBC for ${label} without changing the contact or UTM`, () => {
    const p = { ...payload(), utm_campaign: "explicit-campaign", phone: "fixture-phone" };
    Object.assign(p.landing_attribution, patch);
    const result = guard(p, landing, now);
    assert(result.fbc === "" && result.from_meta_ads === false, "Inconsistent FBC must be cleared");
    assert(result.phone === p.phone && result.fbp === p.fbp, "Identity and FBP must survive");
    assert(result.utm_campaign === p.utm_campaign, "Existing UTM classification remains independent");
    assert(result.landing_attribution === p.landing_attribution, "Keep provenance metadata for diagnosis");
    assert(p.fbc !== "", "Input is not mutated");
  });
}

Deno.test("V2 rejects unverified resolver fallback and conflicting transport scope", () => {
  for (const context of [{ ...landing, attribution_scope_resolved: false }, { ...landing, attribution_scope_resolved: undefined }]) {
    assert(guard(payload(), context, now).fbc === "", "Fallback IDs are not a DB resolution");
  }
  assert(guard({ ...payload(), meta_pixel_id: "999" }, landing, now).fbc === "", "Payload pixel also needs coherence");
  assert(guard({ ...payload(), workspace_currency: "PYG" }, landing, now).fbc === "", "Currency aliases cannot disagree");
});

Deno.test("V2 age boundaries match 90 days and five minutes of future clock tolerance", () => {
  for (const [at, accepted] of [[now - 90 * day, true], [now - 90 * day - 1, false], [now + 300_000, true], [now + 300_001, false]] as const) {
    assert(Boolean(guard(payload(at), landing, now).fbc) === accepted, `Unexpected boundary ${at}`);
  }
  for (const fbc of ["rawClickId", `fb.1.${now / 1000}.seconds`, `fb.1.${now}.invalid&click`, "fb.1.NaN.click"]) {
    assert(guard({ ...payload(), fbc }, landing, now).fbc === "", "Malformed/legacy wrapping is not V2");
  }
});

Deno.test("V2 direct empty and quarantined legacy flags never resurrect global FBC", () => {
  const p = payload();
  Object.assign(p.landing_attribution, { entry_source: "direct", fbc_source: "none", captured_at: null, legacy_fbc_quarantined: false });
  assert(guard(p, landing, now).fbc === "", "A false quarantine flag does not grant permission");
  const valid = payload();
  valid.landing_attribution.legacy_fbc_quarantined = true;
  assert(guard(valid, landing, now).fbc === valid.fbc, "A foreign global cookie must not suppress the valid scoped click");
});

Deno.test("V2 trusts the published database pixel, including explicit empty, instead of another configured pixel", () => {
  const context = { ...landing, pixel_id: "999", landing_config: { tracking: { pixelId: landing.pixel_id } } };
  assert(guard(payload(), context, now).fbc !== "", "Published pixel must match the public config branch");
  const p = payload();
  p.meta_pixel_id = ""; p.landing_attribution.pixel_id = "";
  assert(guard(p, { ...landing, landing_config: { tracking: { pixelId: "" } } }, now).fbc !== "", "Empty published pixel must not fall back to root");
  assert(guard(payload(), { ...landing, landing_config: { tracking: {} } }, now).fbc === "", "Missing published pixel must not borrow root");
});

Deno.test("legacy payloads and messaging channels remain exactly unchanged", () => {
  const legacy = { source_platform: "landing", fbc: "legacy-cookie", from_meta_ads: true };
  assert(guard(legacy, landing, now) === legacy, "Legacy object must not change");
  for (const source_platform of ["chatrace", "whatsapp_cloud_api", "atrio"]) {
    const p = { ...payload(), source_platform, ctwa_clid: "existing-ctwa" };
    assert(!hasLandingAttributionV2(p) && guard(p, landing, now) === p, "Other channels must remain untouched");
  }
});
