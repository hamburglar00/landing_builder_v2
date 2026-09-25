import {
  actionEventIdempotencyKey,
  choosePurchaseJourney,
  evaluateInboundTenantOwnership,
  evaluatePromoGerenciaCoherence,
  leadNoPromoDuplicateCandidateMatches,
} from "./event_attribution.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("case A keeps the coherent Contact -> Lead -> first Purchase journey", () => {
  const coherence = evaluatePromoGerenciaCoherence({
    promoFound: true,
    promoPlayerPhone: "5491111111111",
    eventPlayerPhone: "5491111111111",
    promoGerenciaId: 10,
    eventGerenciaId: 10,
  });
  const decision = choosePurchaseJourney({
    promoRowId: "contact-a",
    promoRowAlreadyPurchased: false,
    promoCoherence: coherence,
    hasPreviousPurchase: false,
  });

  assert(coherence === "coherent", "the same player and gerencia must match");
  assert(decision.targetId === "contact-a", "Purchase must update Contact A");
  assert(decision.purchaseType === "first", "the new promo remains first");
});

Deno.test("case B rejects stale promo B and attributes the repeat to receiver A", () => {
  const coherence = evaluatePromoGerenciaCoherence({
    promoFound: true,
    promoPlayerPhone: "5491111111111",
    eventPlayerPhone: "5491111111111",
    promoGerenciaId: 20,
    eventGerenciaId: 10,
  });
  const decision = choosePurchaseJourney({
    promoRowId: "journey-b",
    promoRowAlreadyPurchased: true,
    promoCoherence: coherence,
    receiverLeadId: "direct-lead-a",
    receiverLeadIsEligible: true,
    receiverLeadHasTrustedPromo: false,
    hasPreviousPurchase: true,
  });

  assert(coherence === "gerencia_conflict", "stale promo B must be detected");
  assert(decision.targetId === "direct-lead-a", "receiver A Lead must win");
  assert(decision.purchaseType === "repeat", "the player already purchased");
});

Deno.test("case C does not attach a direct B purchase to stale Contact A", () => {
  const coherence = evaluatePromoGerenciaCoherence({
    promoFound: true,
    promoPlayerPhone: "5491111111111",
    eventPlayerPhone: "5491111111111",
    promoGerenciaId: 10,
    eventGerenciaId: 20,
  });
  const decision = choosePurchaseJourney({
    promoRowId: "contact-a",
    promoRowAlreadyPurchased: false,
    promoCoherence: coherence,
    receiverLeadId: "direct-lead-b",
    receiverLeadIsEligible: true,
    receiverLeadHasTrustedPromo: false,
    hasPreviousPurchase: false,
  });

  assert(coherence === "gerencia_conflict", "stale promo A must be detected");
  assert(decision.targetId === "direct-lead-b", "Contact A must not be touched");
  assert(decision.purchaseType === "first", "the player's first purchase stays first");
});

Deno.test("same promo never overrides a different player phone", () => {
  const coherence = evaluatePromoGerenciaCoherence({
    promoFound: true,
    promoPlayerPhone: "5491111111111",
    eventPlayerPhone: "5492222222222",
    promoGerenciaId: 10,
    eventGerenciaId: 10,
  });
  assert(
    coherence === "player_phone_conflict",
    "promo codes cannot link two different players",
  );
});

Deno.test("action_event_id remains stable when the backend changes promo_code", () => {
  const firstAttempt = actionEventIdempotencyKey("50055");
  const retryAfterAnotherPromo = actionEventIdempotencyKey("50055");
  assert(firstAttempt === "action:50055", "the bot identity must be preserved");
  assert(
    retryAfterAnotherPromo === firstAttempt,
    "promo changes must not create another Purchase identity",
  );
});

Deno.test("lead without promo deduplicates by phone and agency inside 24 hours", () => {
  const now = 1_800_000_000;
  const matched = leadNoPromoDuplicateCandidateMatches({
    incomingPhone: "+54 9 3518 69-0777",
    incomingAgencyId: "50",
    nowSeconds: now,
    windowSeconds: 24 * 60 * 60,
    candidate: {
      phone: "5493518690777",
      estado: "purchase",
      purchase_agency_id: "50",
      purchase_event_time: now - 120,
      created_at: new Date((now - 30 * 60 * 60) * 1000).toISOString(),
    },
  });

  assert(matched, "a recent purchase for the same phone + agency must win");
});

Deno.test("lead without promo does not deduplicate across agencies", () => {
  const now = 1_800_000_000;
  const matched = leadNoPromoDuplicateCandidateMatches({
    incomingPhone: "5493518690777",
    incomingAgencyId: "51",
    nowSeconds: now,
    windowSeconds: 24 * 60 * 60,
    candidate: {
      phone: "5493518690777",
      estado: "purchase",
      purchase_agency_id: "50",
      purchase_event_time: now - 120,
    },
  });

  assert(!matched, "same phone on another agency is another journey context");
});

Deno.test("lead without promo does not deduplicate outside 24 hours", () => {
  const now = 1_800_000_000;
  const matched = leadNoPromoDuplicateCandidateMatches({
    incomingPhone: "5493518690777",
    incomingAgencyId: "50",
    nowSeconds: now,
    windowSeconds: 24 * 60 * 60,
    candidate: {
      phone: "5493518690777",
      estado: "lead",
      lead_agency_id: "50",
      lead_event_time: now - (25 * 60 * 60),
    },
  });

  assert(!matched, "old rows must not suppress a new lead forever");
});

Deno.test("tenant guard rejects a promo or gerencia owned by another client", () => {
  for (const kind of ["promo_code", "gerencia"] as const) {
    const decision = evaluateInboundTenantOwnership({
      receiverUserId: "golden",
      signals: [{
        kind,
        ownerUserIds: ["elmueca"],
        rejectWhenUnregistered: false,
      }],
    });

    assert(!decision.allowed, `a foreign ${kind} must be rejected`);
    assert(decision.signal === kind, `${kind} must explain rejection`);
    assert(
      decision.reason === "foreign_owner",
      "the owner conflict must remain auditable",
    );
  }
});

Deno.test("tenant guard does not invent a foreign owner for unknown identifiers", () => {
  for (const kind of ["promo_code", "gerencia"] as const) {
    const decision = evaluateInboundTenantOwnership({
      receiverUserId: "receiver",
      signals: [{ kind, ownerUserIds: [], rejectWhenUnregistered: false }],
    });
    assert(
      decision.allowed,
      `${kind} without a known owner does not prove a tenant crossing`,
    );
  }
});

Deno.test("tenant guard accepts shared contextual identifiers owned by receiver", () => {
  const decision = evaluateInboundTenantOwnership({
    receiverUserId: "receiver",
    signals: [
      {
        kind: "promo_code",
        ownerUserIds: ["receiver", "legacy-owner"],
        rejectWhenUnregistered: true,
      },
      {
        kind: "bot_phone",
        ownerUserIds: ["receiver", "shared-owner"],
        rejectWhenUnregistered: false,
      },
      {
        kind: "landing_name",
        ownerUserIds: [],
        rejectWhenUnregistered: false,
      },
    ],
  });

  assert(decision.allowed, "receiver ownership must permit shared identifiers");
});

Deno.test("tenant guard rejects a bot or landing positively owned elsewhere", () => {
  for (const kind of ["bot_phone", "landing_name"] as const) {
    const decision = evaluateInboundTenantOwnership({
      receiverUserId: "receiver",
      signals: [{
        kind,
        ownerUserIds: ["foreign"],
        rejectWhenUnregistered: false,
      }],
    });
    assert(!decision.allowed, `${kind} owned elsewhere must be rejected`);
    assert(
      decision.reason === "foreign_owner",
      `${kind} must report owner conflict`,
    );
  }
});
