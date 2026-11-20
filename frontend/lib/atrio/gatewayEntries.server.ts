type ScopedJourney = {
  id: string; landing_id: string; atrio_id: string; atrio_players_id: string | null; promo_code: string;
  contact_event_time: number | null; cta_clicked_event_time: number | null; contact_payload_raw: string | null;
};
const providers = new Set(["rey_de_ases", "ases_del_norte", "ganamos_net", "multi_skin"]);
const validMessageId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function gatewayEntryEvidence(journeys: ScopedJourney[]) {
  const requests = journeys.flatMap(j => {
    const capture = JSON.parse(j.contact_payload_raw || "{}");
    const eventTime = Number(j.cta_clicked_event_time || j.contact_event_time);
    const cta_time = Math.floor(eventTime > 1e12 ? eventTime / 1000 : eventTime);
    if (!Number.isSafeInteger(cta_time) || cta_time <= 0 || cta_time > Date.now() / 1000 + 300) return [];
    const attribution = capture.landing_attribution || {};
    const target = capture.target_provider || attribution.target_provider || null;
    const skin = capture.skin_code || attribution.skin_code || null;
    if (target !== null && !providers.has(target) ||
        skin !== null && (typeof skin !== "string" || !/^[a-z0-9_]{1,64}$/.test(skin)) ||
        !/^[a-z0-9][a-z0-9_-]{0,127}$/i.test(j.promo_code)) return [];
    return [{ conversion_id: j.id, landing_id: j.landing_id, advisor_id: j.atrio_id, player_id: j.atrio_players_id,
      promo_code: j.promo_code, cta_time, target_provider: target, skin_code: skin }];
  });
  if (!requests.length) return { measured: [], entries: [] };
  const origin = new URL(process.env.INTERNAL_CHAT_ORIGIN || "");
  const secret = process.env.INTERNAL_CHAT_PLAYER_RESOLVE_KEY;
  if (origin.protocol !== "https:" || origin.pathname !== "/" || origin.username || origin.password || origin.search || origin.hash || !secret)
    throw new Error("unavailable");
  const response = await fetch(new URL("/api/internal/landing-gateway-entries", origin), {
    method: "POST", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(6000),
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    body: JSON.stringify(requests),
  });
  if (!response.ok) throw new Error("unavailable");
  const { entries } = await response.json();
  const requestTimes = new Map(requests.map(j => [j.conversion_id, j.cta_time]));
  if (!Array.isArray(entries) || entries.length > requests.length) throw new Error("invalid_response");
  const measured = new Set<string>();
  const confirmed: { conversion_id: string; message_id: string; event_time: number }[] = [];
  for (const entry of entries) {
    const ctaTime = requestTimes.get(entry?.conversion_id);
    if (ctaTime === undefined || measured.has(entry.conversion_id)) throw new Error("invalid_response");
    measured.add(entry.conversion_id);
    if (entry.message_id === null && entry.event_time === null) continue;
    if (typeof entry.message_id !== "string" || !validMessageId.test(entry.message_id) ||
        !Number.isSafeInteger(entry.event_time) || entry.event_time < ctaTime) throw new Error("invalid_response");
    confirmed.push({ conversion_id: entry.conversion_id, message_id: entry.message_id, event_time: entry.event_time });
  }
  return { measured: [...measured], entries: confirmed };
}
