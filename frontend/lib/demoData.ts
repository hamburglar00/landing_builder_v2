import type { ConversionRow, FunnelContact } from "./conversionsDb";

const NAMES = [
  { fn: "Juan", ln: "Pérez" },
  { fn: "María", ln: "González" },
  { fn: "Carlos", ln: "López" },
  { fn: "Ana", ln: "Martínez" },
  { fn: "Pedro", ln: "Rodríguez" },
  { fn: "Lucía", ln: "Fernández" },
  { fn: "Diego", ln: "García" },
  { fn: "Valentina", ln: "Sánchez" },
  { fn: "Matías", ln: "Romero" },
  { fn: "Sofía", ln: "Torres" },
  { fn: "Nicolás", ln: "Díaz" },
  { fn: "Camila", ln: "Ruiz" },
  { fn: "Joaquín", ln: "Álvarez" },
  { fn: "Florencia", ln: "Moreno" },
  { fn: "Tomás", ln: "Gutiérrez" },
  { fn: "", ln: "" },
  { fn: "", ln: "" },
  { fn: "Roberto", ln: "" },
];

const REGIONS = ["Buenos Aires", "Córdoba", "Mendoza", "Santa Fe", "Tucumán", "Salta", "Neuquén", ""];
const COUNTRIES = ["AR", "AR", "AR", "AR", "UY", "CL", "BR", ""];
const CAMPAIGNS = ["google_ads_brand", "meta_retarget_q1", "meta_lookalike", "organic", "referral", "tiktok_test", ""];
const DEVICES = ["mobile", "mobile", "mobile", "desktop", "desktop", "tablet", ""];
const LANDINGS = ["kobe-main", "kobe-promo-verano", "kobe-blackfriday", "kobe-referidos"];
const STATES: string[] = ["contact", "lead", "purchase"];

function rand<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randPhone(): string {
  return `5411${Math.floor(10000000 + Math.random() * 90000000)}`;
}

function uuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function daysAgo(d: number): string {
  return new Date(Date.now() - d * 86400000 - Math.random() * 86400000).toISOString();
}

export function generateDemoConversions(count = 80): ConversionRow[] {
  const phones = Array.from({ length: 25 }, randPhone);
  const rows: ConversionRow[] = [];
  const phoneHasFirstPurchase = new Set<string>();

  for (let i = 0; i < count; i++) {
    const phone = rand(phones);
    const name = rand(NAMES);
    const estado = rand(STATES);
    const purchaseType =
      estado === "purchase"
        ? (phoneHasFirstPurchase.has(phone) ? "repeat" : "first")
        : null;
    const isRepeat = purchaseType === "repeat";
    const valor = estado === "purchase" ? Math.round(5000 + Math.random() * 95000) : 0;
    const region = rand(REGIONS);
    const campaign = rand(CAMPAIGNS);
    const device = rand(DEVICES);
    const landing = rand(LANDINGS);
    const created = daysAgo(Math.floor(Math.random() * 60));
    const hasEmail = Math.random() > 0.4;
    const contactEvId = uuid();
    const leadEvId = estado !== "contact" ? uuid() : "";
    const purchEvId = estado === "purchase" ? uuid() : "";
    const ts = Math.floor(new Date(created).getTime() / 1000);

    rows.push({
      id: uuid(),
      internal_id: i + 1,
      landing_id: uuid(),
      user_id: "demo",
      landing_name: landing,
      phone,
      email: hasEmail ? `${name.fn.toLowerCase() || "user"}${Math.floor(Math.random() * 100)}@mail.com` : "",
      fn: name.fn,
      ln: name.ln,
      ct: region ? `Ciudad de ${region}` : "",
      st: region,
      zip: region ? `${1000 + Math.floor(Math.random() * 9000)}` : "",
      country: rand(COUNTRIES),
      fbp: Math.random() > 0.3 ? `fb.1.${Date.now()}.${Math.floor(Math.random() * 1e9)}` : "",
      fbc: Math.random() > 0.7 ? `fb.1.${Date.now()}.${uuid()}` : "",
      contact_event_id: contactEvId,
      contact_event_time: ts,
      lead_event_id: leadEvId,
      lead_event_time: leadEvId ? ts + 3600 : null,
      lead_payload_raw: "",
      purchase_event_id: purchEvId,
      purchase_event_time: purchEvId ? ts + 7200 : null,
      purchase_payload_raw: "",
      purchase_type: purchaseType,
      client_ip: `${100 + Math.floor(Math.random() * 155)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`,
      agent_user: `Mozilla/5.0 (${rand(["Linux", "Windows NT 10.0", "Macintosh"])})`,
      device_type: device,
      event_source_url: `https://landing.example.com/${landing}`,
      estado,
      valor,
      contact_status_capi: Math.random() > 0.1 ? "enviado" : "error",
      lead_status_capi: leadEvId ? (Math.random() > 0.1 ? "enviado" : "error") : "",
      purchase_status_capi: purchEvId ? (Math.random() > 0.15 ? "enviado" : "error") : "",
      observaciones: isRepeat ? "✅ CONTACT OK | ✅ LEAD OK | ✅ PURCHASE REPEAT OK" : estado === "purchase" ? "✅ CONTACT OK | ✅ LEAD OK | ✅ PURCHASE OK" : estado === "lead" ? "✅ CONTACT OK | ✅ LEAD OK" : "✅ CONTACT OK",
      external_id: Math.random() > 0.5 ? uuid() : "",
      utm_campaign: campaign,
      telefono_asignado: Math.random() > 0.7 ? randPhone() : "",
      promo_code: Math.random() > 0.6 ? `PROMO${Math.floor(Math.random() * 999)}` : "",
      geo_city: region ? `Ciudad de ${region}` : "",
      geo_region: region,
      geo_country: rand(COUNTRIES),
      created_at: created,
    });

    if (estado === "purchase" && purchaseType === "first") {
      phoneHasFirstPurchase.add(phone);
    }
  }

  return rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function generateDemoFunnelContacts(conversions: ConversionRow[]): FunnelContact[] {
  const phoneMap = new Map<string, ConversionRow[]>();
  for (const c of conversions) {
    if (!c.phone) continue;
    const arr = phoneMap.get(c.phone) ?? [];
    arr.push(c);
    phoneMap.set(c.phone, arr);
  }

  const contacts: FunnelContact[] = [];
  for (const [phone, rows] of phoneMap) {
    const purchases = rows.filter((r) => r.estado === "purchase");
    const leads = rows.filter((r) => r.estado === "lead");
    const contactRows = rows.filter((r) => r.estado === "contact");
    const repeats = rows.filter((r) =>
      (r.purchase_event_id !== "") &&
      (r.purchase_type === "repeat" || (r.purchase_type == null && r.observaciones.includes("REPEAT")))
    );

    const latest = rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
    const earliest = rows.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0];

    const email = rows.find((r) => r.email)?.email ?? null;
    const fn = rows.find((r) => r.fn)?.fn ?? null;
    const ln = rows.find((r) => r.ln)?.ln ?? null;

    contacts.push({
      user_id: "demo",
      phone,
      email,
      fn,
      ln,
      ct: latest.ct || null,
      st: latest.st || null,
      country: latest.country || null,
      region: latest.geo_region || null,
      utm_campaign: rows.find((r) => r.utm_campaign)?.utm_campaign ?? null,
      device_type: rows.find((r) => r.device_type)?.device_type ?? null,
      landing_name: rows.find((r) => r.landing_name)?.landing_name ?? null,
      total_valor: purchases.reduce((sum, r) => sum + r.valor, 0),
      purchase_count: purchases.length,
      repeat_count: repeats.length,
      lead_count: leads.length,
      contact_count: contactRows.length,
      reached_contact: rows.some((r) => r.contact_event_id !== ""),
      reached_lead: rows.some((r) => r.lead_event_id !== ""),
      reached_purchase: rows.some((r) => r.purchase_event_id !== ""),
      reached_repeat: repeats.length > 0,
      last_activity: latest.created_at,
      first_contact: earliest.created_at,
    });
  }

  return contacts.sort((a, b) => new Date(b.last_activity).getTime() - new Date(a.last_activity).getTime());
}
