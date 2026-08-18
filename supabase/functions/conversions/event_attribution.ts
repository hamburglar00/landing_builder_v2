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
    | "receiver_contact"
    | "created_first"
    | "created_repeat";
};

export type LeadNoPromoDuplicateCandidate = {
  phone?: unknown;
  estado?: unknown;
  created_at?: unknown;
  lead_event_time?: unknown;
  purchase_event_time?: unknown;
  lead_agency_id?: unknown;
  registration_agency_id?: unknown;
  purchase_agency_id?: unknown;
};

function normalizePhone(value: unknown): string {
  return String(value ?? "").replace(/\D/g, "");
}

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

function epochSeconds(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }
  const text = normalizeText(value);
  if (!text) return 0;
  if (/^\d+$/.test(text)) {
    const parsed = Number(text);
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
  }
  const ms = Date.parse(text);
  return Number.isFinite(ms) && ms > 0 ? Math.floor(ms / 1000) : 0;
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

export function leadNoPromoDuplicateCandidateMatches(input: {
  incomingPhone: unknown;
  incomingAgencyId: unknown;
  nowSeconds: number;
  windowSeconds: number;
  candidate: LeadNoPromoDuplicateCandidate;
}): boolean {
  const incomingPhone = normalizePhone(input.incomingPhone);
  const incomingAgencyId = normalizeText(input.incomingAgencyId);
  if (!incomingPhone || !incomingAgencyId) return false;
  if (normalizePhone(input.candidate.phone) !== incomingPhone) return false;

  const status = normalizeText(input.candidate.estado).toLowerCase();
  if (status !== "lead" && status !== "purchase") return false;

  const agencyMatches = [
    input.candidate.lead_agency_id,
    input.candidate.registration_agency_id,
    input.candidate.purchase_agency_id,
  ].some((value) => normalizeText(value) === incomingAgencyId);
  if (!agencyMatches) return false;

  const lastActivity = Math.max(
    epochSeconds(input.candidate.created_at),
    epochSeconds(input.candidate.lead_event_time),
    epochSeconds(input.candidate.purchase_event_time),
  );
  if (!lastActivity) return false;

  return input.nowSeconds - lastActivity <= input.windowSeconds;
}

export function choosePurchaseJourney(input: {
  promoRowId?: string | null;
  promoRowAlreadyPurchased?: boolean;
  promoCoherence: PromoGerenciaCoherence;
  receiverLeadId?: string | null;
  receiverLeadIsEligible?: boolean;
  receiverLeadHasTrustedPromo?: boolean;
  receiverContactId?: string | null;
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

  if (input.receiverContactId) {
    return {
      targetId: input.receiverContactId,
      purchaseType: input.hasPreviousPurchase ? "repeat" : "first",
      matchMethod: "receiver_contact",
    };
  }

  return {
    targetId: null,
    purchaseType: input.hasPreviousPurchase ? "repeat" : "first",
    matchMethod: input.hasPreviousPurchase ? "created_repeat" : "created_first",
  };
}
