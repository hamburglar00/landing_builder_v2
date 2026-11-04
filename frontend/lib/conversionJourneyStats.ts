import type { ConversionJourneyStartRow, ConversionRow } from "./conversionsDb";

export type StatisticsChannel = "whatsapp" | "atrio";
export type StatisticsRange = { start: Date; end: Date } | null | undefined;
export type ConversionStage = "contact" | "lead" | "registration" | "purchase";
export const STATISTICS_ORIGINS = ["landing", "chatrace", "whatsapp_cloud_api"] as const;
const stages: ConversionStage[] = ["contact", "lead", "registration", "purchase"];
const text = (value: unknown) => String(value ?? "").trim();
const lower = (value: unknown) => text(value).toLowerCase();
const digits = (value: unknown) => text(value).replace(/\D/g, "");

function payload(value: unknown): Record<string, unknown> {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch { return {}; }
}

/** Origin and destination are independent. Never consult today's landing settings. */
export function statisticsOrigin(row: Pick<ConversionRow, "source_platform" | "contact_payload_raw" | "landing_id">): string {
  const origin = lower(row.source_platform);
  if (origin !== "atrio") return origin;
  const captured = lower(payload(row.contact_payload_raw).source_platform);
  return STATISTICS_ORIGINS.includes(captured as typeof STATISTICS_ORIGINS[number]) ? captured : "";
}

function capturedChannel(row: ConversionRow): StatisticsChannel | null {
  const captured = payload(row.contact_payload_raw);
  const destination = lower(captured.cta_destination);
  if (destination === "atrio" || destination === "whatsapp") return destination;
  // Legacy Contact records preserve the actual assignment, even without cta_destination.
  if (text(row.contact_event_id)) {
    if (text(row.atrio_id) || text(row.atrio_client_id)) return "atrio";
    if (digits(row.telefono_asignado)) return "whatsapp";
  }
  return null;
}

function scope(row: ConversionRow): string {
  return `${lower(row.user_id)}::${lower(row.landing_id || row.landing_name)}`;
}

function promoKey(row: ConversionRow): string {
  return text(row.promo_code) ? `${scope(row)}::promo:${lower(row.promo_code)}` : "";
}

/** Only unambiguous, same-owner captured lineage may supply a missing channel. */
export function createStatisticsChannelResolver(rows: ConversionRow[]) {
  const byId = new Map(rows.map(row => [text(row.id), row]));
  const capturedChannels = new WeakMap<ConversionRow, StatisticsChannel | null>();
  const byPromo = new Map<string, Set<StatisticsChannel>>();
  for (const row of rows) {
    const channel = capturedChannel(row), key = promoKey(row);
    capturedChannels.set(row, channel);
    if (!channel || !key) continue;
    const candidates = byPromo.get(key) ?? new Set<StatisticsChannel>();
    candidates.add(channel); byPromo.set(key, candidates);
  }
  return (row: ConversionRow): StatisticsChannel | null => {
    const captured = capturedChannels.has(row) ? capturedChannels.get(row) : capturedChannel(row);
    if (captured) return captured;
    const linked = [row.purchase_attribution_conversion_id, row.registration_attribution_conversion_id, row.lead_attribution_conversion_id]
      .map(id => byId.get(text(id)))
      .filter((candidate): candidate is ConversionRow => !!candidate && candidate.user_id === row.user_id)
      .map(capturedChannel).filter((value): value is StatisticsChannel => !!value);
    if (linked.length) return new Set(linked).size === 1 ? linked[0] : null;
    const candidates = byPromo.get(promoKey(row));
    if (candidates?.size === 1) return [...candidates][0];
    if (candidates?.size) return null;
    // Standalone events still describe their receiving channel, not an invented landing.
    if (text(row.atrio_id) || text(row.purchase_atrio_id) || text(row.lead_atrio_id) || lower(row.source_platform) === "atrio") return "atrio";
    if (digits(row.lead_bot_phone) || digits(row.registration_bot_phone) || digits(row.purchase_bot_phone) ||
      ["chatrace", "whatsapp_cloud_api"].includes(lower(row.source_platform))) return "whatsapp";
    return null;
  };
}

export function stageDate(row: ConversionRow, stage: ConversionStage): Date | null {
  const raw = row[`${stage}_event_time`];
  const numeric = Number(raw);
  const ms = raw !== null && raw !== undefined && text(raw) !== "" && Number.isFinite(numeric) && numeric > 0
    ? numeric * (numeric < 1e12 ? 1000 : 1)
    : Date.parse(text(raw) || row.created_at);
  return Number.isFinite(ms) ? new Date(ms) : null;
}

export function inStatisticsRange(date: Date | null, range: StatisticsRange): boolean {
  return !!date && (!range || date >= range.start && date <= range.end);
}

/** A row's insertion date is not the date of all the events subsequently attached to it. */
export function scopeStatisticsStages(rows: ConversionRow[], range: StatisticsRange): ConversionRow[] {
  return rows.flatMap(row => {
    const result = { ...row };
    for (const stage of stages) if (!inStatisticsRange(stageDate(row, stage), range)) {
      result[`${stage}_event_id`] = "";
    }
    // Legacy estado is a summary; never treat it as an additional received message.
    if (!text(result.lead_event_id)) result.estado = "";
    return stages.some(stage => text(result[`${stage}_event_id`])) ? [result] : [];
  });
}

export function dedupeStatisticsEvents(rows: ConversionRow[]): ConversionRow[] {
  const seen = new Set<string>();
  return rows.flatMap(row => {
    const result = { ...row };
    for (const stage of stages) {
      const id = text(row[`${stage}_event_id`]);
      if (!id) continue;
      const transaction = stage === "purchase" ? text(row.purchase_transaction_id || row.purchase_coelsa_id) : "";
      const key = `${row.user_id}::${stage}::${transaction || id}`;
      if (seen.has(key)) result[`${stage}_event_id`] = "";
      else seen.add(key);
    }
    if (!text(result.lead_event_id)) result.estado = "";
    return stages.some(stage => text(result[`${stage}_event_id`])) ? [result] : [];
  });
}

export function statisticsJourneyKey(row: ConversionRow): string {
  const promo = promoKey(row);
  if (promo) return promo;
  if (text(row.contact_event_id)) return `${scope(row)}::contact:${row.contact_event_id}`;
  const agency = row.purchase_agency_id || row.registration_agency_id || row.lead_agency_id || row.assigned_gerencia_external_id;
  const person = text(row.external_id) || text(row.purchase_player_username) || text(row.registration_player_username) || digits(row.phone);
  return person && agency ? `${scope(row)}::person:${lower(person)}::agency:${agency}` : `${scope(row)}::row:${row.id}`;
}

export function isStatisticsRepeat(row: ConversionRow): boolean {
  return row.purchase_type === "repeat" || row.purchase_type !== "first" && text(row.observaciones).includes("REPEAT");
}

export function computeChannelFunnel(rows: ConversionRow[], channel: StatisticsChannel) {
  const journeys = new Map<string, Partial<Record<ConversionStage, number>> & { repeat?: number }>();
  const registrationIds = new Set<string>();
  const contactsByPromo = new Map<string, ConversionRow[]>();
  const contactsById = new Map<string, ConversionRow>();
  const contactsByEvent = new Map<string, ConversionRow>();
  const agency = (row: ConversionRow, stage: ConversionStage) => text(stage === "contact" ? row.assigned_gerencia_external_id || row.assigned_gerencia_id
    : row[`${stage}_agency_id`] || row[`${stage}_gerencia_external_id`] || row[`${stage}_gerencia_id`] || row.assigned_gerencia_external_id || row.assigned_gerencia_id);
  const keyForContact = (row: ConversionRow) => `${statisticsJourneyKey(row)}::agency:${agency(row, "contact")}::person:${digits(row.phone) || lower(row.external_id)}::advisor:${text(row.atrio_id)}`;
  for (const row of rows) if (text(row.contact_event_id)) {
    contactsById.set(text(row.id), row); contactsByEvent.set(text(row.contact_event_id), row);
    const key = promoKey(row);
    if (key) contactsByPromo.set(key, [...(contactsByPromo.get(key) ?? []), row]);
  }
  for (const row of rows) {
    for (const stage of stages) {
      if (!text(row[`${stage}_event_id`])) continue;
      // CTA CompleteRegistration lives in contact_payload_raw, never in this confirmed stage.
      if (stage === "registration") registrationIds.add(`${row.user_id}::${row.registration_event_id}`);
      let candidates = stage === "contact" ? [row] : [contactsByEvent.get(text(row.contact_event_id)),
        contactsById.get(text(row[`${stage}_attribution_conversion_id`]))].filter((value): value is ConversionRow => !!value);
      if (!candidates.length) candidates = contactsByPromo.get(promoKey(row)) ?? [];
      candidates = candidates.filter(root => root.user_id === row.user_id &&
        (!text(root.landing_id) || !text(row.landing_id) || root.landing_id === row.landing_id) &&
        (!agency(root, "contact") || !agency(row, stage) || agency(root, "contact") === agency(row, stage)) &&
        (!digits(root.phone) || !digits(row.phone) || digits(root.phone) === digits(row.phone)) &&
        (!text(root.atrio_id) || !text(row[`${stage}_atrio_id` as keyof ConversionRow]) || root.atrio_id === row[`${stage}_atrio_id` as keyof ConversionRow]));
      const roots = new Map(candidates.map(root => [keyForContact(root), root]));
      if (roots.size !== 1) continue;
      const key = [...roots.keys()][0], current = journeys.get(key) ?? {};
      const time = stageDate(row, stage)?.getTime();
      if (time === undefined) continue;
      const target = stage === "purchase" && isStatisticsRepeat(row) ? "repeat" : stage;
      current[target] = Math.min(current[target] ?? Infinity, time);
      journeys.set(key, current);
    }
  }
  const registrations = registrationIds.size;
  const after = (next: number | undefined, before: number | undefined) => next !== undefined && before !== undefined && next >= before;
  let contacts = 0, messages = 0, registered = 0, firstPurchases = 0, repeats = 0;
  for (const journey of journeys.values()) {
    if (journey.contact === undefined) continue;
    contacts++;
    if (after(journey.lead, journey.contact)) messages++;
    const preceding = channel === "atrio" ? journey.contact : after(journey.lead, journey.contact) ? journey.lead : undefined;
    if (after(journey.registration, preceding)) registered++;
    // Registration is specific to Full Carga, so it cannot gate a mixed WhatsApp funnel.
    if (after(journey.purchase, preceding)) {
      firstPurchases++;
      if (after(journey.repeat, journey.purchase)) repeats++;
    }
  }
  return { contacts, messages, registrations: registrations || null, registered: registrations ? registered : null, firstPurchases, repeats };
}

export function scopeStatisticsChannel(rows: ConversionRow[], starts: ConversionJourneyStartRow[], channel: StatisticsChannel, range: StatisticsRange) {
  if (channel === "atrio") {
    rows = rows.filter(row => statisticsOrigin(row) === "landing");
    starts = starts.filter(row => lower(row.source_platform) === "landing");
  }
  const resolve = createStatisticsChannelResolver(rows);
  const classified = rows.map(row => ({ row, channel: resolve(row) }));
  const channelRows = classified.filter(item => item.channel === channel).map(({ row }) => row.confirmed_registration_event_id
    ? { ...row, registration_event_id: row.confirmed_registration_event_id,
      registration_agency_id: row.confirmed_registration_agency_id ? String(row.confirmed_registration_agency_id) : row.registration_agency_id,
      registration_event_time: row.confirmed_registration_event_time } : row);
  const conversions = dedupeStatisticsEvents(scopeStatisticsStages(channelRows, range));
  // Only visits whose destination was captured at visit time are comparable denominators.
  const journeyStarts = starts.filter(row => row.journey_destination === channel && inStatisticsRange(new Date(row.first_seen_at), range));
  const unknownConversions = scopeStatisticsStages(classified.filter(item => !item.channel).map(item => item.row), range).length;
  const unknownStarts = starts.filter(row => !row.journey_destination && inStatisticsRange(new Date(row.first_seen_at), range)).length;
  return { conversions, allConversions: dedupeStatisticsEvents(channelRows), journeyStarts, unknownConversions, unknownStarts,
    funnel: computeChannelFunnel(conversions, channel) };
}

export function statisticsPlayerKey(row: ConversionRow): string {
  const player = lower(row.purchase_player_username) || lower(row.atrio_players_id) || digits(row.phone) || lower(row.external_id) || text(row.id);
  const agency = text(row.purchase_agency_id || row.purchase_gerencia_external_id || row.purchase_gerencia_id || row.assigned_gerencia_external_id || row.assigned_gerencia_id);
  return `${row.user_id}::${agency}::${player}`;
}

/** Monetary event totals and distinct players are different statistics. Rows are period-scoped. */
export function computeStatisticsPurchasePlayers(rows: ConversionRow[]) {
  const firsts = new Map<string, number>();
  const repeats: Array<{ key: string; time: number }> = [];
  for (const row of dedupeStatisticsEvents(rows)) {
    if (!text(row.purchase_event_id)) continue;
    const key = statisticsPlayerKey(row), time = stageDate(row, "purchase")?.getTime();
    if (time === undefined) continue;
    if (isStatisticsRepeat(row)) repeats.push({ key, time });
    else firsts.set(key, Math.min(firsts.get(key) ?? Infinity, time));
  }
  const repeatsFromFirst = repeats.filter(repeat => firsts.has(repeat.key) && repeat.time >= firsts.get(repeat.key)!);
  return { firstPlayers: firsts.size, repeatPlayers: new Set(repeats.map(repeat => repeat.key)).size,
    repeatPlayersFromFirst: new Set(repeatsFromFirst.map(repeat => repeat.key)).size,
    repeatEventsFromFirst: repeatsFromFirst.length };
}

export function statisticsRate(numerator: number | null, denominator: number | null): string {
  return numerator === null || denominator === null || denominator <= 0 ? "—" : `${(100 * numerator / denominator).toFixed(1)}%`;
}

export function countStatisticsVisitConversions(starts: ConversionJourneyStartRow[], rows: ConversionRow[]): number {
  const candidates = new Map<string, ConversionJourneyStartRow[]>();
  const identity = (row: { user_id: string; landing_id: string | null; external_id: string; source_platform?: string }) =>
    `${row.user_id}::${lower(row.source_platform)}::${row.landing_id}::${row.external_id}`;
  for (const start of starts) {
    const key = identity(start);
    candidates.set(key, [...(candidates.get(key) ?? []), start]);
  }
  const converted = new Set<string>();
  for (const row of rows) if (text(row.contact_event_id)) {
    const time = stageDate(row, "contact")?.getTime() ?? 0;
    const eligible = (candidates.get(identity(row)) ?? []).filter(start => Date.parse(start.first_seen_at) <= time + 999)
      .sort((a, b) => Date.parse(b.first_seen_at) - Date.parse(a.first_seen_at));
    if (eligible[0]) converted.add(eligible[0].id);
  }
  return converted.size;
}

/** Validated PostgREST range: later milestones can be attached to older rows. */
export function statisticsEventRangeFilter(startIso?: string | null, endIso?: string | null): string {
  const start = startIso ? new Date(startIso) : null, end = endIso ? new Date(endIso) : null;
  return ["created_at", ...stages.map(stage => `${stage}_event_time`)].map(column => {
    const numeric = column !== "created_at";
    const parts = [start && Number.isFinite(start.getTime()) ? `${column}.gte.${numeric ? Math.ceil(start.getTime() / 1000) : start.toISOString()}` : "",
      end && Number.isFinite(end.getTime()) ? `${column}.lte.${numeric ? Math.floor(end.getTime() / 1000) : end.toISOString()}` : ""].filter(Boolean);
    return parts.length > 1 ? `and(${parts.join(",")})` : parts[0];
  }).filter(Boolean).join(",");
}

/** Independent chart points retain the date of their corresponding milestone. */
export function statisticsTemporalRows(rows: ConversionRow[], channel: StatisticsChannel): ConversionRow[] {
  const activity: ConversionStage = channel === "atrio" ? "contact" : "lead";
  return rows.flatMap(row => ([activity, "purchase"] as ConversionStage[]).flatMap(stage => {
    if (!text(row[`${stage}_event_id`])) return [];
    const date = stageDate(row, stage);
    if (!date) return [];
    return [{ ...row, created_at: date.toISOString(),
      contact_event_id: stage === "contact" ? row.contact_event_id : "",
      lead_event_id: stage === "lead" ? row.lead_event_id : "",
      registration_event_id: "", purchase_event_id: stage === "purchase" ? row.purchase_event_id : "", estado: "" }];
  }));
}
