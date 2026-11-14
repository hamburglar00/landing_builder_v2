import {
  classifyMetaOrigin,
  journeyCaptureIsAfterEvent,
  journeyCaptureTime,
  metaOriginPatch,
} from "./meta_origin.ts";
const at = 1794672000;
const fbc = `fb.1.${at * 1000 - 1000}.AbCdEfG_hi123`;
function assert(v: unknown, msg = "assertion failed"): asserts v {
  if (!v) throw Error(msg);
}
Deno.test("campaign name, browser ID and claimed flags alone never prove Meta Ads", () => {
  for (
    const p of [
      { utm_campaign: "summer" },
      { fbp: "fb.1.123.456" },
      { from_meta_ads: true },
      { meta_origin_evidence: { version: 1, classification: "meta_ads" } },
      {
        event_source_url:
          "https://fixture.test/?utm_source=google&utm_medium=cpc&utm_campaign=sale",
      },
    ]
  ) {
    assert(classifyMetaOrigin(p, at).classification === "unidentified");
  }
});
Deno.test("valid FBC records the actual parameter and its original value", () => {
  const e = classifyMetaOrigin({ fbc }, at);
  assert(e.method === "fbc");
  assert(e.parameters.join() === "fbc");
  assert(e.values.fbc === fbc);
  for (
    const invalid of [
      "fb.1.1.bad",
      `fb.1.${(at + 600) * 1000}.future`,
      `fb.1.${(at - 91 * 86400) * 1000}.old`,
      "{{fbc}}",
    ]
  ) {
    assert(
      classifyMetaOrigin({ fbc: invalid }, at).classification ===
        "unidentified",
    );
  }
});
Deno.test("explicit Meta paid parameters retain all three names and weaker method, organic social does not qualify", () => {
  const e = classifyMetaOrigin({
    event_source_url:
      "https://fixture.test/?utm_source=instagram&utm_medium=paid_social&utm_campaign=noviembre",
  }, at);
  assert(e.method === "meta_paid_parameters");
  assert(e.parameters.join(",") === "utm_source,utm_medium,utm_campaign");
  assert(e.values.utm_source === "instagram");
  for (const medium of ["social", "organic", "email", ""]) {
    assert(
      classifyMetaOrigin({
        utm_source: "facebook",
        utm_medium: medium,
        utm_campaign: "sale",
      }, at).classification === "unidentified",
    );
  }
});
Deno.test("a rejected v2 click cannot be rescued from an unscoped URL", () => {
  const event_source_url = "https://fixture.test/?fbclid=AbCdEfG_hi123";
  assert(classifyMetaOrigin({ event_source_url }, at).method === "fbclid");
  assert(
    classifyMetaOrigin({
      event_source_url,
      landing_attribution: { version: 2 },
      fbc: "",
    }, at).classification === "unidentified",
  );
});
Deno.test("journey lineage retains evidence and original observation; a different journey uses its own parameters", () => {
  const first = metaOriginPatch({ fbc, event_time: at });
  const second = metaOriginPatch({ event_time: at + 86400 }, {
    id: "first",
    ...first,
  });
  assert(
    second.meta_origin_evidence.observed_at ===
      first.meta_origin_evidence.observed_at,
  );
  assert(second.meta_origin_evidence.source_conversion_id === "first");
  assert(second.meta_origin_evidence.values.fbc === fbc);
  assert(metaOriginPatch({ event_time: at + 86400 }).from_meta_ads === false);
});
Deno.test("legacy UTM-only rows are not promoted and legacy valid capture evidence is recovered", () => {
  assert(
    !metaOriginPatch({ event_time: at }, {
      from_meta_ads: true,
      utm_campaign: "email_sale",
      contact_event_time: at,
    }).from_meta_ads,
  );
  const inherited = metaOriginPatch({ event_time: at + 1000 }, {
    id: "root",
    fbc,
    contact_event_time: at,
  });
  assert(inherited.from_meta_ads);
  assert(inherited.meta_origin_evidence.source_conversion_id === "root");
});
Deno.test("later cookies cannot reclassify a captured unidentified journey as an ad acquisition", () => {
  const first = metaOriginPatch({ event_time: at });
  const later = metaOriginPatch({ fbc, event_time: at + 1000 }, {
    id: "direct-root",
    ...first,
  });
  assert(!later.from_meta_ads);
  assert(later.meta_origin_evidence.method === "no_supported_evidence");
  assert(later.meta_origin_evidence.source_conversion_id === "direct-root");
  assert(
    later.meta_origin_evidence.observed_at ===
      first.meta_origin_evidence.observed_at,
  );
  assert(Object.keys(later.meta_origin_evidence.values).length === 0);
});
Deno.test("secondary messaging conventions stay explicit, a landing promo alone proves no advertising", () => {
  assert(
    classifyMetaOrigin({
      source_platform: "whatsapp_cloud_api",
      ctwa_clid: "abc123",
    }, at).method === "ctwa_clid",
  );
  assert(
    classifyMetaOrigin({ source_platform: "chatrace", promo_code: "P-123" }, at)
      .method === "legacy_chatrace_promo",
  );
  assert(
    classifyMetaOrigin({ source_platform: "landing", promo_code: "P-123" }, at)
      .classification === "unidentified",
  );
});
Deno.test("a delayed Purchase cannot destroy the original acquisition evidence or disguise its future date", () => {
  const purchase = Date.parse("2026-11-10T12:00:00Z") / 1000,
    capture = Date.parse("2026-11-13T12:00:00Z") / 1000;
  const original = metaOriginPatch({
    fbc: `fb.1.${capture * 1000}.OriginalClick123`,
    event_time: capture,
  });
  const lineage = {
    id: "future-cta",
    contact_event_id: "cta",
    contact_event_time: capture,
    ...original,
  };
  const delayed = metaOriginPatch({ event_time: purchase }, lineage);
  assert(
    delayed.from_meta_ads,
    "acquisition remains factual even when a particular event predates it",
  );
  assert(
    delayed.meta_origin_evidence.observed_at ===
      original.meta_origin_evidence.observed_at,
  );
  assert(journeyCaptureIsAfterEvent(lineage, purchase));
  assert(
    journeyCaptureIsAfterEvent(
      { id: "derived-purchase", ...delayed },
      purchase,
    ),
    "derived rows retain the temporal guard without Contact fields",
  );
  assert(
    !journeyCaptureIsAfterEvent(lineage, capture + 86400),
    "a later actual event may use the same acquisition",
  );
});
Deno.test("capture chronology uses the original occurrence, not late ingestion or an inherited row creation", () => {
  const occurred = Date.parse("2026-11-10T10:00:00Z") / 1000,
    purchase = occurred + 3600;
  const contact = {
    id: "root",
    contact_event_id: "cta",
    created_at: "2026-11-14T12:00:00Z",
    contact_payload_raw: JSON.stringify({
      event_id: "cta",
      event_time: occurred,
    }),
  };
  assert(journeyCaptureTime(contact) === occurred);
  assert(!journeyCaptureIsAfterEvent(contact, purchase));
  assert(
    journeyCaptureTime({
      id: "derived",
      pixel_attribution_conversion_id: "root",
      created_at: "2026-11-14T12:00:00Z",
    }) === null,
  );
  assert(
    !journeyCaptureIsAfterEvent({
      contact_event_id: "old",
      created_at: "invalid",
    }, purchase),
  );
  assert(
    !journeyCaptureIsAfterEvent(
      { contact_event_time: purchase + 300 },
      purchase,
    ),
  );
  assert(
    journeyCaptureIsAfterEvent(
      { contact_event_time: purchase + 301 },
      purchase,
    ),
  );
});
