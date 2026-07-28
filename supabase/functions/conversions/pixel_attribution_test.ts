import {
  choosePurchasePixelAttribution,
  type PurchasePixelCandidate,
} from "./pixel_attribution.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const PIXEL_A = "880464554785896";
const PIXEL_B = "989122687083119";

Deno.test("repeat resolves pixel from the Contact root of the same promo", () => {
  const latestRepeat: PurchasePixelCandidate = {
    id: "latest-repeat",
    pixel_id: PIXEL_A,
    contact_event_id: "",
    contact_payload_raw: "",
    source_platform: "landing",
  };
  const contactRoot: PurchasePixelCandidate = {
    id: "contact-root",
    pixel_id: PIXEL_A,
    contact_event_id: "contact-event",
    contact_payload_raw: JSON.stringify({ meta_pixel_id: PIXEL_A }),
    source_platform: "landing",
    created_at: "2026-07-08T16:39:09Z",
  };

  const result = choosePurchasePixelAttribution({
    currentRow: latestRepeat,
    promoRoots: [latestRepeat, contactRoot],
    configuredPixelIds: [PIXEL_A, PIXEL_B],
  });

  assert(result?.pixelId === PIXEL_A, "must recover the Contact pixel");
  assert(result?.source === "promo_root", "must record promo_root");
  assert(
    result?.sourceConversionId === "contact-root",
    "must preserve root traceability",
  );
});

Deno.test("explicit pixel wins for a new promo tied to another ad", () => {
  const result = choosePurchasePixelAttribution({
    inboundPixelId: PIXEL_B,
    promoRoots: [{
      id: "old-root",
      pixel_id: PIXEL_A,
      contact_event_id: "old-contact",
    }],
    configuredPixelIds: [PIXEL_A, PIXEL_B],
  });

  assert(result?.pixelId === PIXEL_B, "explicit pixel must win");
  assert(
    result?.source === "explicit_payload",
    "source must be explicit_payload",
  );
});

Deno.test("unique landing tag resolves a pixel but ambiguous tags do not", () => {
  const unique = choosePurchasePixelAttribution({
    landingTagMatches: [
      { id: "landing-1", pixel_id: PIXEL_B },
      { id: "landing-2", pixel_id: PIXEL_B },
    ],
    configuredPixelIds: [PIXEL_A, PIXEL_B],
  });
  assert(unique?.pixelId === PIXEL_B, "same unique pixel is safe");
  assert(unique?.source === "landing_tag", "source must be landing_tag");

  const ambiguous = choosePurchasePixelAttribution({
    landingTagMatches: [
      { id: "landing-1", pixel_id: PIXEL_A },
      { id: "landing-2", pixel_id: PIXEL_B },
    ],
    configuredPixelIds: [PIXEL_A, PIXEL_B],
  });
  assert(
    ambiguous === null,
    "ambiguous multi-pixel attribution must be skipped",
  );
});

Deno.test("single configured pixel is a safe final fallback", () => {
  const result = choosePurchasePixelAttribution({
    configuredPixelIds: [PIXEL_A],
  });
  assert(result?.pixelId === PIXEL_A, "single configured pixel must resolve");
  assert(
    result?.source === "single_configured_pixel",
    "source must explain the safe fallback",
  );
});

Deno.test("stored attribution keeps the original root conversion", () => {
  const result = choosePurchasePixelAttribution({
    currentRow: {
      id: "latest-repeat",
      pixel_id: PIXEL_A,
      pixel_attribution_source: "promo_root",
      pixel_attribution_conversion_id: "contact-root",
    },
    configuredPixelIds: [PIXEL_A, PIXEL_B],
  });

  assert(result?.pixelId === PIXEL_A, "stored trusted pixel must be reused");
  assert(
    result?.sourceConversionId === "contact-root",
    "the Contact root must survive across repeat purchases",
  );
});
