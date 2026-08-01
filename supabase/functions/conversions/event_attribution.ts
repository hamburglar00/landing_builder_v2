export type PromoGerenciaCoherence =
  | "coherent"
  | "unverifiable"
  | "not_found"
  | "player_phone_conflict"
  | "gerencia_conflict";

export type PurchaseJourneyDecision = {
  targetId: string | null;
  purchaseType: "first" | "repeat";
  matchMethod:
    | "promo_code"
    | "receiver_lead"
    | "created_first"
    | "created_repeat";
};

function normalizePhone(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "");
}

function normalizeGerenciaId(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function actionEventIdempotencyKey(value: unknown): string {
  const normalized = String(value ?? "").trim();
  return normalized ? `action:${normalized}` : "";
}

export function evaluatePromoGerenciaCoherence(input: {
  promoFound: boolean;
  promoPlayerPhone?: unknown;
  eventPlayerPhone?: unknown;
  promoGerenciaId?: unknown;
  eventGerenciaId?: unknown;
}): PromoGerenciaCoherence {
  if (!input.promoFound) return "not_found";

  const promoPhone = normalizePhone(input.promoPlayerPhone);
  const eventPhone = normalizePhone(input.eventPlayerPhone);
  if (promoPhone && eventPhone && promoPhone !== eventPhone) {
    return "player_phone_conflict";
  }

  const promoGerenciaId = normalizeGerenciaId(input.promoGerenciaId);
  const eventGerenciaId = normalizeGerenciaId(input.eventGerenciaId);
  if (promoGerenciaId && eventGerenciaId) {
    return promoGerenciaId === eventGerenciaId
      ? "coherent"
      : "gerencia_conflict";
  }

  // Backwards-compatible path for emitters or historical rows that do not yet
  // provide enough gerencia context. It is auditable but not a proven match.
  return "unverifiable";
}

export function canUsePromoForJourney(
  coherence: PromoGerenciaCoherence,
): boolean {
  return coherence === "coherent" || coherence === "unverifiable";
}

export function choosePurchaseJourney(input: {
  promoRowId?: string | null;
  promoRowAlreadyPurchased?: boolean;
  promoCoherence: PromoGerenciaCoherence;
  receiverLeadId?: string | null;
  receiverLeadIsEligible?: boolean;
  receiverLeadHasTrustedPromo?: boolean;
  hasPreviousPurchase: boolean;
}): PurchaseJourneyDecision {
  if (input.promoRowId && canUsePromoForJourney(input.promoCoherence)) {
    if (input.promoRowAlreadyPurchased) {
      return {
        targetId: null,
        purchaseType: "repeat",
        matchMethod: "created_repeat",
      };
    }
    return {
      targetId: input.promoRowId,
      purchaseType: "first",
      matchMethod: "promo_code",
    };
  }

  if (input.receiverLeadId && input.receiverLeadIsEligible) {
    const purchaseType = input.receiverLeadHasTrustedPromo
      ? "first"
      : (input.hasPreviousPurchase ? "repeat" : "first");
    return {
      targetId: input.receiverLeadId,
      purchaseType,
      matchMethod: "receiver_lead",
    };
  }

  return {
    targetId: null,
    purchaseType: input.hasPreviousPurchase ? "repeat" : "first",
    matchMethod: input.hasPreviousPurchase
      ? "created_repeat"
      : "created_first",
  };
}
