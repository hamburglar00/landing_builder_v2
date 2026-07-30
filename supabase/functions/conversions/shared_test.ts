import {
  buildMetaBusinessMessagingPurchaseRequest,
  normalizeCtwaClid,
  normalizeCurrencyCode,
  normalizePurchaseAmount,
  preparePurchaseCustomDataForMeta,
  resolvePurchaseCapiDecision,
  resolvePurchaseCapiRoute,
  resolvePurchaseRetryIdentity,
  shouldSkipCapiForNonMetaOrigin,
} from "./shared.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("Currency codes are normalized and safely default to ARS", () => {
  assert(normalizeCurrencyCode(" pyg ") === "PYG", "PYG must be normalized");
  assert(normalizeCurrencyCode("ars") === "ARS", "ARS must be normalized");
  assert(
    normalizeCurrencyCode("invalid", "usd") === "USD",
    "A valid configured fallback must be used",
  );
  assert(
    normalizeCurrencyCode("", "invalid") === "ARS",
    "Invalid input and fallback must use ARS",
  );
  assert(
    normalizeCurrencyCode("ABC", "PYG") === "PYG",
    "Unknown three-letter codes must not reach Meta",
  );
});

Deno.test("Purchase amounts normalize to finite JSON numbers without separators", () => {
  const cases: Array<[unknown, number]> = [
    [100000, 100000],
    ["100000", 100000],
    ["100000.50", 100000.5],
    ["100000,50", 100000.5],
    ["100.000", 100000],
    ["100,000", 100000],
    ["1.000.000,50", 1000000.5],
    ["1,000,000.50", 1000000.5],
    ["1 000 000", 1000000],
  ];

  for (const [input, expected] of cases) {
    const result = normalizePurchaseAmount(input);
    assert(result.ok, `Expected a valid amount for ${String(input)}`);
    assert(
      result.value === expected,
      `Unexpected normalized value for ${String(input)}`,
    );
    const serialized = JSON.parse(JSON.stringify({ value: result.value })) as {
      value: unknown;
    };
    assert(
      typeof serialized.value === "number",
      "Meta value must remain a JSON number",
    );
  }
});

Deno.test("Purchase amounts reject partial, ambiguous and unsafe input", () => {
  const invalid = [
    "",
    null,
    "ARS 100000",
    "100000ARS",
    "1.23.45",
    "100.000,123",
    100000.123,
    Number.POSITIVE_INFINITY,
    Number.MIN_VALUE,
    0,
    -100,
    {},
  ];

  for (const input of invalid) {
    const result = normalizePurchaseAmount(input);
    assert(!result.ok, `Expected an invalid amount for ${String(input)}`);
  }
});

Deno.test("Meta Ads-only CAPI policy filters every non-Meta origin", () => {
  assert(
    shouldSkipCapiForNonMetaOrigin(
      { meta_ads_only_capi: true },
      { from_meta_ads: false },
    ),
    "non-Meta rows must be skipped when the policy is enabled",
  );
  assert(
    !shouldSkipCapiForNonMetaOrigin(
      { meta_ads_only_capi: true },
      { from_meta_ads: true },
    ),
    "Meta Ads rows must still be sent",
  );
  assert(
    !shouldSkipCapiForNonMetaOrigin(
      { meta_ads_only_capi: false },
      { from_meta_ads: false },
    ),
    "all origins must be allowed when the policy is disabled",
  );
});

Deno.test("Business Messaging Purchase matches Meta WhatsApp payload shape", () => {
  const request = buildMetaBusinessMessagingPurchaseRequest(
    {
      dataset_id: "123456789",
      whatsapp_business_account_id: "987654321",
      meta_access_token: "token with symbols/+",
      meta_api_version: "v25.0",
      meta_currency: "ARS",
    },
    "opaque-ctwa-click-id",
    1_700_000_000,
    12500,
  );

  assert(
    request.apiUrl ===
      "https://graph.facebook.com/v25.0/123456789/events?access_token=token%20with%20symbols%2F%2B",
    "Unexpected Business Messaging endpoint",
  );

  const data = request.body.data as Array<Record<string, unknown>>;
  const event = data[0];
  assert(event.event_name === "Purchase", "event_name must be Purchase");
  assert(
    event.action_source === "business_messaging",
    "action_source must be business_messaging",
  );
  assert(
    event.messaging_channel === "whatsapp",
    "messaging_channel must be whatsapp",
  );
  assert(
    !("event_source_url" in event),
    "website-only event_source_url must not be sent",
  );
  assert(
    !("event_id" in event),
    "Meta does not deduplicate Business Messaging events",
  );

  const userData = event.user_data as Record<string, unknown>;
  assert(
    userData.whatsapp_business_account_id === "987654321",
    "WABA ID must be sent unchanged",
  );
  assert(
    userData.ctwa_clid === "opaque-ctwa-click-id",
    "ctwa_clid must be sent raw",
  );
  assert(
    Object.keys(userData).length === 2,
    "WhatsApp attribution user_data must stay minimal",
  );

  const customData = event.custom_data as Record<string, unknown>;
  assert(customData.currency === "ARS", "currency must be preserved");
  assert(customData.value === 12500, "value must be preserved");
  assert(
    !("purchase_type" in customData),
    "Business Messaging Purchase must stay standard",
  );
});

Deno.test("Purchase master switch disables every website Purchase", () => {
  const decision = resolvePurchaseCapiDecision(
    {
      send_purchase_capi: false,
      include_purchase_type_capi: false,
      send_first_purchase_capi: true,
      send_repeat_purchase_capi: true,
    },
    "first",
  );
  assert(!decision.enabled, "Master switch must disable Purchase");
  assert(
    decision.reason === "purchase_disabled",
    "Master switch skip reason must be traceable",
  );
});

Deno.test("Standard Purchase mode sends all purchases without purchase_type", () => {
  const decision = resolvePurchaseCapiDecision(
    {
      send_purchase_capi: true,
      include_purchase_type_capi: false,
      send_first_purchase_capi: false,
      send_repeat_purchase_capi: false,
    },
    "repeat",
  );
  assert(decision.enabled, "Standard mode must not apply subtype filters");
  assert(
    decision.reason === "enabled_standard",
    "Standard mode must be traceable",
  );
  const prepared = preparePurchaseCustomDataForMeta(
    { currency: "ARS", value: 2500, purchase_type: "repeat" },
    decision.includePurchaseType,
  );
  assert(
    !("purchase_type" in prepared),
    "Standard mode must omit purchase_type from Meta custom_data",
  );
  assert(prepared.currency === "ARS", "Standard mode must preserve currency");
  assert(prepared.value === 2500, "Standard mode must preserve value");
});

Deno.test("Segmented Purchase mode preserves first/repeat filters and parameter", () => {
  const config = {
    send_purchase_capi: true,
    include_purchase_type_capi: true,
    send_first_purchase_capi: true,
    send_repeat_purchase_capi: false,
  };
  const first = resolvePurchaseCapiDecision(config, "first");
  const repeat = resolvePurchaseCapiDecision(config, "repeat");
  assert(first.enabled, "Enabled first purchases must be sent");
  assert(!repeat.enabled, "Disabled repeat purchases must be skipped");
  assert(repeat.reason === "repeat_disabled", "Subtype skip must be traceable");

  const prepared = preparePurchaseCustomDataForMeta(
    { currency: "ARS", value: 2500, purchase_type: "first" },
    first.includePurchaseType,
  );
  assert(
    prepared.purchase_type === "first",
    "Segmented mode must include the internal purchase_type",
  );
});

Deno.test("ctwa_clid validation rejects unresolved Chatrace placeholders", () => {
  assert(
    normalizeCtwaClid("  real-opaque-id  ") === "real-opaque-id",
    "Valid ID must be trimmed",
  );
  assert(
    normalizeCtwaClid("{{ctwa_clid}}") === "",
    "Template placeholder must be rejected",
  );
  assert(
    normalizeCtwaClid("undefined") === "",
    "undefined sentinel must be rejected",
  );
  assert(normalizeCtwaClid("") === "", "Empty ID must be rejected");
});

Deno.test("Business Messaging routing is exclusive to eligible Chatrace purchases", () => {
  const landing = resolvePurchaseCapiRoute({
    source_platform: "landing",
    business_messaging_enabled: true,
    business_messaging_configured: true,
    ctwa_clid: "opaque-id",
  });
  assert(
    landing.route === "website",
    "Landing purchases must stay on website CAPI",
  );
  assert(
    landing.reason === "source_not_chatrace",
    "Landing route must be traceable",
  );

  const disabled = resolvePurchaseCapiRoute({
    source_platform: "chatrace",
    business_messaging_enabled: false,
    business_messaging_configured: true,
    ctwa_clid: "opaque-id",
  });
  assert(
    disabled.route === "website",
    "Disabled opt-in must preserve the current route",
  );

  const missingCtwa = resolvePurchaseCapiRoute({
    source_platform: "chatrace",
    business_messaging_enabled: true,
    business_messaging_configured: true,
    ctwa_clid: "{{ctwa_clid}}",
  });
  assert(
    missingCtwa.route === "website",
    "Unresolved ctwa_clid must never be sent",
  );
  assert(
    missingCtwa.reason === "missing_ctwa_clid",
    "Missing ctwa_clid must be traceable",
  );

  const eligible = resolvePurchaseCapiRoute({
    source_platform: "chatrace",
    business_messaging_enabled: true,
    business_messaging_configured: true,
    ctwa_clid: "opaque-id",
  });
  assert(
    eligible.route === "business_messaging",
    "Eligible Chatrace purchases must use Business Messaging",
  );
  assert(
    eligible.reason === "eligible_chatrace_ctwa",
    "Eligible route must be traceable",
  );
});

Deno.test("Purchase retries reuse a persisted Meta identity", () => {
  const identity = resolvePurchaseRetryIdentity(
    " purchase-event-123 ",
    1773792243,
    1999999999,
    () => "must-not-be-used",
  );

  assert(
    identity.eventId === "purchase-event-123",
    "A retry must reuse the stored event_id",
  );
  assert(
    identity.eventTime === 1773792243,
    "A retry must reuse the stored event_time",
  );
  assert(
    !identity.needsPersistence,
    "A complete stored identity must not be rewritten",
  );
});

Deno.test("Purchase retries persist generated identity before delivery", () => {
  const identity = resolvePurchaseRetryIdentity(
    "",
    null,
    1773792243,
    () => "generated-once",
  );

  assert(
    identity.eventId === "generated-once",
    "A missing legacy event_id must be generated once",
  );
  assert(
    identity.eventTime === 1773792243,
    "A missing legacy event_time must be frozen before delivery",
  );
  assert(
    identity.needsPersistence,
    "Generated retry identity must be persisted before calling Meta",
  );
});
