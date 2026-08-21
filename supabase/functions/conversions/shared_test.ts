import {
  buildFakeConversionRow,
  buildBusinessMessagingUserData,
  buildMetaBusinessMessagingPurchaseRequest,
  buildMetaBusinessMessagingRequest,
  buildMetaRequest,
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
      { from_meta_ads: false, ctwa_clid: "" },
    ),
    "non-Meta rows must be skipped when the policy is enabled",
  );
  assert(
    !shouldSkipCapiForNonMetaOrigin(
      { meta_ads_only_capi: true },
      { from_meta_ads: true, ctwa_clid: "" },
    ),
    "Meta Ads rows must still be sent",
  );
  assert(
    !shouldSkipCapiForNonMetaOrigin(
      { meta_ads_only_capi: true },
      { from_meta_ads: false, ctwa_clid: "opaque-ctwa-click-id" },
    ),
    "ctwa_clid rows must still be sent",
  );
  assert(
    shouldSkipCapiForNonMetaOrigin(
      { meta_ads_only_capi: true },
      { from_meta_ads: false, ctwa_clid: "{{ctwa_clid}}" },
    ),
    "unresolved ctwa_clid placeholders must not bypass the policy",
  );
  assert(
    !shouldSkipCapiForNonMetaOrigin(
      { meta_ads_only_capi: false },
      { from_meta_ads: false, ctwa_clid: "" },
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

Deno.test("Business Messaging Purchase can enrich user_data with hashed PII", async () => {
  const row = buildFakeConversionRow("Purchase");
  row.email = "comprador@test.com";
  row.phone = "5493518690777";
  row.fn = "Geraldine";
  row.ln = "Perez";
  row.external_id = "external-123";
  const additionalUserData = await buildBusinessMessagingUserData(row, false);
  const request = buildMetaBusinessMessagingPurchaseRequest(
    {
      dataset_id: "123456789",
      whatsapp_business_account_id: "987654321",
      meta_access_token: "token",
      meta_api_version: "v25.0",
      meta_currency: "ARS",
    },
    "opaque-ctwa-click-id",
    1_700_000_000,
    12500,
    additionalUserData,
  );

  const data = request.body.data as Array<Record<string, unknown>>;
  const event = data[0];
  const userData = event.user_data as Record<string, unknown>;
  for (const key of ["em", "ph", "fn", "ln", "external_id"]) {
    const value = String(userData[key] ?? "");
    assert(value.length === 64, `${key} must be a SHA-256 hex hash`);
  }
  assert(userData.ctwa_clid === "opaque-ctwa-click-id", "ctwa_clid stays raw");
  assert(userData.whatsapp_business_account_id === "987654321", "WABA stays raw");
});

Deno.test("Business Messaging Lead matches Meta WhatsApp payload shape", () => {
  const request = buildMetaBusinessMessagingRequest(
    {
      dataset_id: "123456789",
      whatsapp_business_account_id: "987654321",
      meta_access_token: "token",
      meta_api_version: "v25.0",
      meta_currency: "ARS",
    },
    "Lead",
    "opaque-ctwa-click-id",
    1_700_000_000,
  );

  const data = request.body.data as Array<Record<string, unknown>>;
  const event = data[0];
  assert(
    event.event_name === "LeadSubmitted",
    "Business Messaging Lead must be LeadSubmitted",
  );
  assert(
    event.action_source === "business_messaging",
    "action_source must be business_messaging",
  );
  assert(
    event.messaging_channel === "whatsapp",
    "messaging_channel must be whatsapp",
  );
  assert(!("event_source_url" in event), "website URL must not be sent");
  assert(!("event_id" in event), "event_id must not be sent");
  assert(!("custom_data" in event), "Lead must not invent custom_data");

  const userData = event.user_data as Record<string, unknown>;
  assert(
    userData.ctwa_clid === "opaque-ctwa-click-id",
    "ctwa_clid must be raw",
  );
  assert(
    userData.whatsapp_business_account_id === "987654321",
    "WABA ID must be preserved",
  );
});

Deno.test("Business Messaging Lead enrichment omits WhatsApp profile names", async () => {
  const row = buildFakeConversionRow("Lead");
  row.email = "Cliente@Test.com";
  row.phone = "5493518690777";
  row.fn = "Geraldine";
  row.ln = "Perez";
  row.ct = "Cordoba";
  row.st = "Cordoba";
  row.zip = "5000";
  row.country = "Argentina";
  const additionalUserData = await buildBusinessMessagingUserData(row, true, {
    includeNames: false,
  });
  const request = buildMetaBusinessMessagingRequest(
    {
      dataset_id: "123456789",
      whatsapp_business_account_id: "987654321",
      meta_access_token: "token",
      meta_api_version: "v25.0",
      meta_currency: "ARS",
    },
    "Lead",
    "opaque-ctwa-click-id",
    1_700_000_000,
    undefined,
    additionalUserData,
  );

  const data = request.body.data as Array<Record<string, unknown>>;
  const event = data[0];
  const userData = event.user_data as Record<string, unknown>;
  assert(userData.ctwa_clid === "opaque-ctwa-click-id", "ctwa_clid stays raw");
  assert(userData.whatsapp_business_account_id === "987654321", "WABA stays raw");
  assert(!("fn" in userData), "Lead must not send WhatsApp profile first name");
  assert(!("ln" in userData), "Lead must not send WhatsApp profile last name");
  for (const key of ["em", "ph", "ct", "st", "zp", "country"]) {
    const value = String(userData[key] ?? "");
    assert(value.length === 64, `${key} must be a SHA-256 hex hash`);
  }
  assert(userData.ph !== row.phone, "phone must not be sent raw");
  assert(!("event_id" in event), "Business Messaging Lead still omits event_id");
});

Deno.test("CompleteRegistration website CAPI uses Meta standard event shape", async () => {
  const row = buildFakeConversionRow("CompleteRegistration");
  row.pixel_id = "123456789";
  row.meta_pixel_id = "123456789";
  row.event_source_url = "https://landing.example.com/demo";

  const request = await buildMetaRequest(
    {
      user_id: row.user_id,
      pixel_id: "123456789",
      meta_access_token: "token",
      meta_currency: "ARS",
      meta_api_version: "v25.0",
      send_contact_capi: true,
      send_geo_capi: true,
      geo_use_ipapi: false,
      geo_fill_only_when_missing: false,
    },
    row,
    "CompleteRegistration",
    "registration-event-id",
    1_700_000_000,
    undefined,
    "TEST123",
  );

  assert(
    request.apiUrl ===
      "https://graph.facebook.com/v25.0/123456789/events?access_token=token",
    "CompleteRegistration must use the website Pixel events endpoint",
  );
  assert(
    request.body.test_event_code === "TEST123",
    "test_event_code must be preserved outside the event payload",
  );

  const data = request.body.data as Array<Record<string, unknown>>;
  const event = data[0];
  assert(
    event.event_name === "CompleteRegistration",
    "Meta standard event name must be exactly CompleteRegistration",
  );
  assert(event.event_time === 1_700_000_000, "event_time must be preserved");
  assert(
    event.event_id === "registration-event-id",
    "event_id must be preserved for idempotency/dedup compatibility",
  );
  assert(
    event.action_source === "website",
    "CompleteRegistration from landing journeys must be website",
  );
  assert(
    event.event_source_url === "https://landing.example.com/demo",
    "website events must include event_source_url",
  );
  assert("user_data" in event, "user_data is required by CAPI");
  assert(
    !("custom_data" in event),
    "CompleteRegistration must not invent custom_data unless explicitly provided",
  );
});

Deno.test("Website CAPI omits expired fbc values before sending to Meta", async () => {
  const row = buildFakeConversionRow("Purchase");
  row.pixel_id = "123456789";
  row.meta_pixel_id = "123456789";
  row.purchase_event_id = "purchase-event-id";
  row.purchase_type = "first";
  row.fbc = `fb.1.${Date.now() - 91 * 24 * 60 * 60 * 1000}.ExpiredClickId`;

  const request = await buildMetaRequest(
    {
      user_id: row.user_id,
      pixel_id: "123456789",
      meta_access_token: "token",
      meta_currency: "ARS",
      meta_api_version: "v25.0",
      send_contact_capi: true,
      send_purchase_capi: true,
      include_purchase_type_capi: true,
      send_first_purchase_capi: true,
      send_repeat_purchase_capi: true,
      send_geo_capi: true,
      geo_use_ipapi: false,
      geo_fill_only_when_missing: false,
    },
    row,
    "Purchase",
    "purchase-event-id",
    1_700_000_000,
    { currency: "ARS", value: 10000, purchase_type: "first" },
  );

  const data = request.body.data as Array<Record<string, unknown>>;
  const userData = data[0].user_data as Record<string, unknown>;
  assert(!("fbc" in userData), "Expired fbc must not be sent to Meta");
  assert(
    userData.fbp === row.fbp,
    "Other matching parameters must be preserved",
  );
});

Deno.test("Website CAPI preserves fresh fbc and normalizes legacy seconds timestamp", async () => {
  const row = buildFakeConversionRow("Purchase");
  row.pixel_id = "123456789";
  row.meta_pixel_id = "123456789";
  row.purchase_event_id = "purchase-event-id";
  row.purchase_type = "first";
  const freshSeconds = Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000);
  row.fbc = `fb.1.${freshSeconds}.FreshClickId`;

  const request = await buildMetaRequest(
    {
      user_id: row.user_id,
      pixel_id: "123456789",
      meta_access_token: "token",
      meta_currency: "ARS",
      meta_api_version: "v25.0",
      send_contact_capi: true,
      send_purchase_capi: true,
      include_purchase_type_capi: true,
      send_first_purchase_capi: true,
      send_repeat_purchase_capi: true,
      send_geo_capi: true,
      geo_use_ipapi: false,
      geo_fill_only_when_missing: false,
    },
    row,
    "Purchase",
    "purchase-event-id",
    1_700_000_000,
    { currency: "ARS", value: 10000, purchase_type: "first" },
  );

  const data = request.body.data as Array<Record<string, unknown>>;
  const userData = data[0].user_data as Record<string, unknown>;
  assert(
    userData.fbc === `fb.1.${freshSeconds * 1000}.FreshClickId`,
    "Fresh legacy fbc timestamps must be sent in Meta's millisecond format",
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

Deno.test("Business Messaging routing is limited to Click-to-WhatsApp sources", () => {
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
    landing.reason === "source_not_click_to_whatsapp",
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

  const whatsappCloudApi = resolvePurchaseCapiRoute({
    source_platform: "whatsapp_cloud_api",
    business_messaging_enabled: false,
    business_messaging_configured: true,
    ctwa_clid: "opaque-id",
  });
  assert(
    whatsappCloudApi.route === "business_messaging",
    "WhatsApp Cloud API with ctwa_clid must use Business Messaging",
  );
  assert(
    whatsappCloudApi.reason === "eligible_whatsapp_cloud_api_ctwa",
    "WhatsApp Cloud API route must be traceable",
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
