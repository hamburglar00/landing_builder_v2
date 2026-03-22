import type { ConversionRow, FunnelContact } from "@/lib/conversionsDb";
import { classifyContact } from "@/lib/conversionsDb";

export interface CoreStats {
  uniqueContacts: number;
  uniqueLeads: number;
  firstLoadPurchasers: number;
  totalPurchases: number;
  purchaseRepeat: number;
  repeatFromFirstInRange: number;
  firstLoadPlayers: number;
  repeatPlayers: number;
  premiumPlayers: number;
  totalRevenue: number;
  totalPurchaseCount: number;
  firstPurchaseRevenue: number;
  activeRetention30d: number;
  purchaseValues: number[];
  leadPurchaseHours: number[];
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

  const purchaseRows = conversions.filter(
    (c) => (c.purchase_event_id ?? "") !== "",
  );
  const firstPurchaseRows = purchaseRows.filter(isFirstPurchase);
  const repeatPurchaseRows = purchaseRows.filter(isRepeatPurchase);
  const phoneToFirstPurchase = dedupeByUserPhone(firstPurchaseRows);
  const firstLoadPurchasers = phoneToFirstPurchase.size;

  const totalPurchases = purchaseRows.length;
  const purchaseRepeat = dedupeByUserPhone(repeatPurchaseRows).size;
  const firstPhones = new Set(
    firstPurchaseRows.map((c) => `${c.user_id}::${c.phone}`),
  );
  const repeatPhones = new Set(
    repeatPurchaseRows.map((c) => `${c.user_id}::${c.phone}`),
  );
  const repeatFromFirstInRange = [...repeatPhones].filter((k) => firstPhones.has(k)).length;

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
    firstLoadPurchasers,
    totalPurchases,
    purchaseRepeat,
    repeatFromFirstInRange,
    firstLoadPlayers,
    repeatPlayers,
    premiumPlayers,
    totalRevenue,
    totalPurchaseCount,
    firstPurchaseRevenue,
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
