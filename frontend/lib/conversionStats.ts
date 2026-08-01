import type { ConversionRow, FunnelContact } from "@/lib/conversionsDb";
import { classifyContact } from "@/lib/conversionsDb";

export interface CoreStats {
  uniqueContacts: number;
  uniqueLeads: number;
  uniqueLeadsLinkedToContact: number;
  inferredLeadsFromContactPurchase: number;
  uniqueLeadsLinkedToContactWithInferred: number;
  firstLoadPurchasers: number;
  firstLoadPurchasersLinkedToLead: number;
  firstLoadPurchasersAttributed: number;
  totalPurchases: number;
  purchaseRepeat: number;
  repeatFromFirstInRange: number;
  repeatFromAttributedFirstInRange: number;
  repeatEventsFromAttributedFirstInRange: number;
  adContactJourneys: number;
  adLeadJourneysLinkedToContact: number;
  adInferredLeadJourneys: number;
  adLeadJourneysLinkedToContactWithInferred: number;
  adFirstPurchaseJourneysAttributed: number;
  adFirstPurchaseEvents: number;
  adFirstPurchaseEventsAttributed: number;
  adRepeatJourneys: number;
  adRepeatEvents: number;
  adRepeatJourneysFromAttributedFirstInRange: number;
  adRepeatEventsFromAttributedFirstInRange: number;
  firstLoadPlayers: number;
  repeatPlayers: number;
  premiumPlayers: number;
  totalRevenue: number;
  totalPurchaseCount: number;
  firstPurchaseRevenue: number;
  firstPurchaseEventRevenue: number;
  activeRetention30d: number;
  purchaseValues: number[];
  leadPurchaseHours: number[];
}

type JourneyStage = "contact" | "lead" | "purchase";

function cleanText(value: unknown): string {
  return String(value ?? "").trim();
}

function cleanDigits(value: unknown): string {
  return cleanText(value).replace(/\D/g, "");
}

function keyPart(kind: string, value: unknown): string {
  const raw = cleanText(value);
  return raw ? `${kind}:${raw.toLowerCase()}` : "";
}

function phoneKeyPart(kind: string, value: unknown): string {
  const digits = cleanDigits(value);
  return digits ? `${kind}:${digits}` : "";
}

function firstNonEmpty(...values: string[]): string {
  return values.find((value) => value !== "") ?? "";
}

function identityKey(row: ConversionRow): string {
  return firstNonEmpty(
    keyPart("player", row.purchase_player_username),
    keyPart("player", row.registration_player_username),
    keyPart("player", row.lead_player_username),
    keyPart("external", row.external_id),
    phoneKeyPart("phone", row.phone),
    keyPart("email", row.email),
    keyPart("row", row.id),
    keyPart("created", row.created_at),
  );
}

function gerenciaKey(row: ConversionRow, stage: JourneyStage): string {
  const assigned = firstNonEmpty(
    keyPart("gid", row.assigned_gerencia_id),
    keyPart("gext", row.assigned_gerencia_external_id),
    keyPart("glabel", row.assigned_gerencia_label),
    phoneKeyPart("assigned_phone", row.telefono_asignado),
  );
  const lead = firstNonEmpty(
    keyPart("gid", row.lead_gerencia_id),
    keyPart("gext", row.lead_gerencia_external_id),
    keyPart("glabel", row.lead_gerencia_label),
    phoneKeyPart("bot_phone", row.lead_bot_phone),
    assigned,
  );
  const purchase = firstNonEmpty(
    keyPart("gid", row.purchase_gerencia_id),
    keyPart("gext", row.purchase_gerencia_external_id),
    keyPart("glabel", row.purchase_gerencia_label),
    phoneKeyPart("bot_phone", row.purchase_bot_phone),
    lead,
  );

  if (stage === "purchase") return purchase;
  if (stage === "lead") return lead;
  return assigned;
}

function adJourneyKey(row: ConversionRow, stage: JourneyStage): string {
  const promo = keyPart("promo", row.promo_code) || keyPart("promo", `${stage}:${row.id || row.created_at}`);
  const gerencia = gerenciaKey(row, stage) || keyPart("gerencia", "unknown");
  return `${cleanText(row.user_id)}::${identityKey(row)}::${promo}::${gerencia}`;
}

export function dedupeByUserPhone(rows: ConversionRow[]): Map<string, ConversionRow> {
  const map = new Map<string, ConversionRow>();
  for (const r of rows) {
    const phoneKey = (r.phone ?? "").trim();
    const fallback =
      r.contact_event_id ||
      r.lead_event_id ||
      r.purchase_event_id ||
      r.id ||
      r.created_at;
    const key = phoneKey ? `${r.user_id}::${phoneKey}` : `${r.user_id}::__fallback__${fallback}`;
    const existing = map.get(key);
    if (!existing || new Date(r.created_at) < new Date(existing.created_at)) {
      map.set(key, r);
    }
  }
  return map;
}

export function computeCoreStats(
  conversions: ConversionRow[],
  funnelContacts: FunnelContact[],
  allConversions: ConversionRow[],
  premiumThreshold: number,
): CoreStats {
  const isRepeatPurchase = (c: ConversionRow): boolean => {
    if ((c.purchase_event_id ?? "") === "") return false;
    if (c.purchase_type === "repeat") return true;
    if (c.purchase_type === "first") return false;
    return (c.observaciones ?? "").includes("REPEAT");
  };
  const isFirstPurchase = (c: ConversionRow): boolean => {
    if ((c.purchase_event_id ?? "") === "") return false;
    if (c.purchase_type === "first") return true;
    if (c.purchase_type === "repeat") return false;
    return !(c.observaciones ?? "").includes("REPEAT");
  };

  const contactRows = conversions.filter(
    (c) => (c.contact_event_id ?? "") !== "",
  );
  const uniqueContacts = dedupeByUserPhone(contactRows).size;

  const leadRows = conversions.filter(
    (c) => (c.lead_event_id ?? "") !== "",
  );
  const uniqueLeads = dedupeByUserPhone(leadRows).size;
  const contactExternalKeys = new Set(
    contactRows
      .map((c) => ({ userId: c.user_id, ext: String(c.external_id ?? "").trim() }))
      .filter((x) => x.ext !== "")
      .map((x) => `${x.userId}::${x.ext}`),
  );
  const leadExternalKeys = new Set(
    leadRows
      .map((c) => ({ userId: c.user_id, ext: String(c.external_id ?? "").trim() }))
      .filter((x) => x.ext !== "")
      .map((x) => `${x.userId}::${x.ext}`),
  );
  const leadExternalKeysLinkedToContact = new Set(
    [...leadExternalKeys].filter((k) => contactExternalKeys.has(k)),
  );
  const uniqueLeadsLinkedToContact = leadExternalKeysLinkedToContact.size;

  const purchaseRows = conversions.filter(
    (c) => (c.purchase_event_id ?? "") !== "",
  );
  const firstPurchaseRows = purchaseRows.filter(isFirstPurchase);
  const repeatPurchaseRows = purchaseRows.filter(isRepeatPurchase);
  const phoneToFirstPurchase = dedupeByUserPhone(firstPurchaseRows);
  const firstLoadPurchasers = phoneToFirstPurchase.size;
  let firstLoadPurchasersLinkedToLead = 0;
  const firstExternalKeysLinkedToLead = new Set<string>();
  const firstExternalKeysAttributed = new Set<string>();
  let inferredLeadsFromContactPurchase = 0;
  for (const c of phoneToFirstPurchase.values()) {
    const ext = String(c.external_id ?? "").trim();
    if (!ext) continue;
    const key = `${c.user_id}::${ext}`;
    if (leadExternalKeysLinkedToContact.has(key)) {
      firstLoadPurchasersLinkedToLead++;
      firstExternalKeysLinkedToLead.add(key);
      firstExternalKeysAttributed.add(key);
    } else if (contactExternalKeys.has(key)) {
      // If a first purchase is tied to a prior Contact but the Lead was lost,
      // infer that one conversation happened so the funnel denominator stays fair.
      inferredLeadsFromContactPurchase++;
      firstExternalKeysAttributed.add(key);
    }
  }
  const uniqueLeadsLinkedToContactWithInferred = uniqueLeadsLinkedToContact + inferredLeadsFromContactPurchase;
  const firstLoadPurchasersAttributed = firstLoadPurchasersLinkedToLead + inferredLeadsFromContactPurchase;

  const totalPurchases = purchaseRows.length;
  const purchaseRepeat = dedupeByUserPhone(repeatPurchaseRows).size;
  const repeatExternalKeys = new Set(
    repeatPurchaseRows
      .map((c) => ({ userId: c.user_id, ext: String(c.external_id ?? "").trim() }))
      .filter((x) => x.ext !== "")
      .map((x) => `${x.userId}::${x.ext}`),
  );
  const repeatFromFirstInRange = [...repeatExternalKeys].filter((k) => firstExternalKeysLinkedToLead.has(k)).length;
  const repeatFromAttributedFirstInRange = [...repeatExternalKeys].filter((k) => firstExternalKeysAttributed.has(k)).length;
  const repeatEventsFromAttributedFirstInRange = repeatPurchaseRows.filter((c) => {
    const ext = String(c.external_id ?? "").trim();
    return ext !== "" && firstExternalKeysAttributed.has(`${c.user_id}::${ext}`);
  }).length;
  const firstPurchaseEventRevenue = firstPurchaseRows.reduce((sum, c) => sum + (Number(c.valor) || 0), 0);

  type AdJourney = {
    hasContact: boolean;
    hasLead: boolean;
    firstEvents: number;
    repeatEvents: number;
  };
  const adJourneys = new Map<string, AdJourney>();
  const getAdJourney = (key: string): AdJourney => {
    const current = adJourneys.get(key);
    if (current) return current;
    const created: AdJourney = { hasContact: false, hasLead: false, firstEvents: 0, repeatEvents: 0 };
    adJourneys.set(key, created);
    return created;
  };

  for (const row of contactRows) {
    getAdJourney(adJourneyKey(row, "contact")).hasContact = true;
  }
  for (const row of leadRows) {
    getAdJourney(adJourneyKey(row, "lead")).hasLead = true;
  }
  for (const row of firstPurchaseRows) {
    getAdJourney(adJourneyKey(row, "purchase")).firstEvents += 1;
  }
  for (const row of repeatPurchaseRows) {
    getAdJourney(adJourneyKey(row, "purchase")).repeatEvents += 1;
  }

  let adContactJourneys = 0;
  let adLeadJourneysLinkedToContact = 0;
  let adInferredLeadJourneys = 0;
  let adFirstPurchaseJourneysAttributed = 0;
  let adFirstPurchaseEventsAttributed = 0;
  let adRepeatJourneys = 0;
  let adRepeatEvents = 0;
  let adRepeatJourneysFromAttributedFirstInRange = 0;
  let adRepeatEventsFromAttributedFirstInRange = 0;

  for (const journey of adJourneys.values()) {
    if (journey.hasContact) adContactJourneys++;
    if (journey.hasContact && journey.hasLead) adLeadJourneysLinkedToContact++;
    const inferredLead = journey.hasContact && !journey.hasLead && journey.firstEvents > 0;
    if (inferredLead) adInferredLeadJourneys++;
    const hasLeadOrInference = journey.hasLead || inferredLead;
    const hasAttributedFirst = journey.hasContact && hasLeadOrInference && journey.firstEvents > 0;
    if (hasAttributedFirst) {
      adFirstPurchaseJourneysAttributed++;
      adFirstPurchaseEventsAttributed += journey.firstEvents;
      if (journey.repeatEvents > 0) {
        adRepeatJourneysFromAttributedFirstInRange++;
        adRepeatEventsFromAttributedFirstInRange += journey.repeatEvents;
      }
    }
    if (journey.repeatEvents > 0) adRepeatJourneys++;
    adRepeatEvents += journey.repeatEvents;
  }
  const adLeadJourneysLinkedToContactWithInferred = adLeadJourneysLinkedToContact + adInferredLeadJourneys;

  let firstLoadPlayers = 0;
  let repeatPlayers = 0;
  let premiumPlayers = 0;
  let totalRevenue = 0;
  let totalPurchaseCount = 0;

  for (const c of funnelContacts) {
    const stage = classifyContact(c, premiumThreshold);
    if (stage === "primera_carga") firstLoadPlayers++;
    else if (stage === "recurrente") repeatPlayers++;
    else if (stage === "premium") premiumPlayers++;
  }
  totalRevenue = purchaseRows.reduce((sum, c) => sum + (Number(c.valor) || 0), 0);
  totalPurchaseCount = purchaseRows.length;

  let firstPurchaseRevenue = 0;
  for (const c of phoneToFirstPurchase.values()) {
    firstPurchaseRevenue += c.valor;
  }

  const purchaseValues = conversions
    .filter((c) => (c.purchase_event_id ?? "") !== "")
    .map((c) => Number(c.valor))
    .filter((n) => Number.isFinite(n) && n > 0);

  const leadPurchaseHours = conversions
    .map((c) => {
      const leadT = Number(c.lead_event_time ?? 0);
      const purchaseT = Number(c.purchase_event_time ?? 0);
      if (leadT > 0 && purchaseT > 0 && purchaseT >= leadT) return (purchaseT - leadT) / 3600;
      return null;
    })
    .filter((v): v is number => v !== null);

  const now = new Date();
  const cutoff30 = new Date(now.getTime() - 30 * 86400000);
  const cutoff7 = new Date(now.getTime() - 7 * 86400000);
  const phoneMap = new Map<string, { firstPurchase: Date | null; recentCount: number }>();

  for (const c of allConversions) {
    if ((c.purchase_event_id ?? "") === "" || !c.created_at || !c.phone) continue;
    const d = new Date(c.created_at);
    const rec = phoneMap.get(c.phone) ?? { firstPurchase: null, recentCount: 0 };
    if (!rec.firstPurchase || d < rec.firstPurchase) rec.firstPurchase = d;
    if (d >= cutoff30) rec.recentCount++;
    phoneMap.set(c.phone, rec);
  }

  let activeRetention30d = 0;
  for (const rec of phoneMap.values()) {
    if (!rec.firstPurchase) continue;
    if (rec.recentCount >= 4 && rec.firstPurchase <= cutoff7) {
      activeRetention30d++;
    }
  }

  return {
    uniqueContacts,
    uniqueLeads,
    uniqueLeadsLinkedToContact,
    inferredLeadsFromContactPurchase,
    uniqueLeadsLinkedToContactWithInferred,
    firstLoadPurchasers,
    firstLoadPurchasersLinkedToLead,
    firstLoadPurchasersAttributed,
    totalPurchases,
    purchaseRepeat,
    repeatFromFirstInRange,
    repeatFromAttributedFirstInRange,
    repeatEventsFromAttributedFirstInRange,
    adContactJourneys,
    adLeadJourneysLinkedToContact,
    adInferredLeadJourneys,
    adLeadJourneysLinkedToContactWithInferred,
    adFirstPurchaseJourneysAttributed,
    adFirstPurchaseEvents: firstPurchaseRows.length,
    adFirstPurchaseEventsAttributed,
    adRepeatJourneys,
    adRepeatEvents,
    adRepeatJourneysFromAttributedFirstInRange,
    adRepeatEventsFromAttributedFirstInRange,
    firstLoadPlayers,
    repeatPlayers,
    premiumPlayers,
    totalRevenue,
    totalPurchaseCount,
    firstPurchaseRevenue,
    firstPurchaseEventRevenue,
    activeRetention30d,
    purchaseValues,
    leadPurchaseHours,
  };
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}
