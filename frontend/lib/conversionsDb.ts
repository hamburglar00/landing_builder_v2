import { supabase } from "@/lib/supabaseClient";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ConversionsConfig {
  user_id: string;
  slug: string;
  pixel_id: string;
  meta_access_token: string;
  meta_currency: string;
  meta_api_version: string;
  send_contact_capi: boolean;
  geo_use_ipapi: boolean;
  geo_fill_only_when_missing: boolean;
  test_event_code: string;
  funnel_premium_threshold: number;
  visible_columns?: string[] | null;
}

export interface ConversionRow {
  id: string;
  landing_id: string | null;
  user_id: string;
  landing_name: string;
  phone: string;
  email: string;
  fn: string;
  ln: string;
  ct: string;
  st: string;
  zip: string;
  country: string;
  fbp: string;
  fbc: string;
  contact_event_id: string;
  contact_event_time: number | null;
  lead_event_id: string;
  lead_event_time: number | null;
  purchase_event_id: string;
  purchase_event_time: number | null;
  client_ip: string;
  agent_user: string;
  device_type: string;
  event_source_url: string;
  estado: string;
  valor: number;
  contact_status_capi: string;
  lead_status_capi: string;
  purchase_status_capi: string;
  observaciones: string;
  external_id: string;
  utm_campaign: string;
  telefono_asignado: string;
  promo_code: string;
  geo_city: string;
  geo_region: string;
  geo_country: string;
  created_at: string;
}

export interface ConversionLogRow {
  id: number;
  user_id: string;
  conversion_id: string | null;
  function_name: string;
  level: string;
  message: string;
  detail: string;
  created_at: string;
}

export interface FunnelContact {
  user_id: string;
  phone: string;
  email: string | null;
  fn: string | null;
  ln: string | null;
  ct: string | null;
  st: string | null;
  country: string | null;
  region: string | null;
  utm_campaign: string | null;
  device_type: string | null;
  landing_name: string | null;
  total_valor: number;
  purchase_count: number;
  repeat_count: number;
  lead_count: number;
  contact_count: number;
  reached_contact: boolean;
  reached_lead: boolean;
  reached_purchase: boolean;
  reached_repeat: boolean;
  last_activity: string;
  first_contact: string;
}

export type FunnelStage = "leads" | "primera_carga" | "recurrente" | "premium";

export function classifyContact(
  c: FunnelContact,
  premiumThreshold: number,
): FunnelStage {
  if (c.purchase_count > 0 && c.total_valor >= premiumThreshold)
    return "premium";
  if (c.repeat_count > 0) return "recurrente";
  if (c.purchase_count > 0) return "primera_carga";
  return "leads";
}

const DEFAULT_CONFIG: ConversionsConfig = {
  user_id: "",
  slug: "",
  pixel_id: "",
  meta_access_token: "",
  meta_currency: "ARS",
  meta_api_version: "v25.0",
  send_contact_capi: false,
  geo_use_ipapi: false,
  geo_fill_only_when_missing: false,
  test_event_code: "",
  funnel_premium_threshold: 50000,
  visible_columns: null,
};

// ─── Config CRUD ────────────────────────────────────────────────────────────

export async function fetchConversionsConfig(
  userId: string,
): Promise<ConversionsConfig> {
  const { data, error } = await supabase
    .from("conversions_config")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return { ...DEFAULT_CONFIG, user_id: userId };
  return data as unknown as ConversionsConfig;
}

export async function upsertConversionsConfig(
  config: ConversionsConfig,
): Promise<void> {
  const { error } = await supabase
    .from("conversions_config")
    .upsert(
      {
        user_id: config.user_id,
        slug: config.slug,
        pixel_id: config.pixel_id,
        meta_access_token: config.meta_access_token,
        meta_currency: config.meta_currency,
        meta_api_version: config.meta_api_version,
        send_contact_capi: config.send_contact_capi,
        geo_use_ipapi: config.geo_use_ipapi,
        geo_fill_only_when_missing: config.geo_fill_only_when_missing,
        test_event_code: config.test_event_code,
        funnel_premium_threshold: config.funnel_premium_threshold,
        visible_columns: config.visible_columns ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

  if (error) throw error;
}

export async function updateAllVisibleColumns(
  columns: string[] | null,
): Promise<void> {
  const { error } = await supabase
    .from("conversions_config")
    // PostgREST requiere un WHERE para UPDATE bajo RLS.
    // Usamos una condición amplia sobre user_id para aplicar el cambio a todos los registros reales.
    .update({ visible_columns: columns ?? null })
    .not("user_id", "is", null);

  if (error) throw error;
}

// ─── Conversions list ───────────────────────────────────────────────────────

const CONVERSIONS_SELECT = `
  id, landing_id, user_id, landing_name,
  phone, email, fn, ln, ct, st, zip, country,
  fbp, fbc,
  contact_event_id, contact_event_time,
  lead_event_id, lead_event_time,
  purchase_event_id, purchase_event_time,
  client_ip, agent_user, device_type, event_source_url,
  estado, valor,
  contact_status_capi, lead_status_capi, purchase_status_capi,
  observaciones,
  external_id, utm_campaign, telefono_asignado, promo_code,
  geo_city, geo_region, geo_country,
  created_at
`.replace(/\s+/g, " ").trim();

export async function fetchConversions(
  userId: string,
  limit = 200,
  offset = 0,
): Promise<ConversionRow[]> {
  const { data, error } = await supabase
    .from("conversions")
    .select(CONVERSIONS_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return (data ?? []) as unknown as ConversionRow[];
}

export async function fetchConversionsForAdmin(
  limit = 500,
  offset = 0,
): Promise<ConversionRow[]> {
  const { data, error } = await supabase
    .from("conversions")
    .select(CONVERSIONS_SELECT)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return (data ?? []) as unknown as ConversionRow[];
}

/** Fetch conversions excluyendo los ocultos por hiddenBy. */
export async function fetchConversionsFiltered(
  userId: string,
  limit: number,
  hiddenBy: string,
): Promise<ConversionRow[]> {
  const [rows, hiddenIds, hiddenContactKeys] = await Promise.all([
    supabase
      .from("conversions")
      .select(CONVERSIONS_SELECT)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(0, limit - 1)
      .then(({ data, error }) => {
        if (error) throw error;
        return (data ?? []) as ConversionRow[];
      }),
    fetchHiddenConversionIds(hiddenBy),
    fetchHiddenContacts(hiddenBy),
  ]);
  return rows.filter(
    (r) =>
      !hiddenIds.has(r.id) &&
      !hiddenContactKeys.has(`${r.user_id}::${r.phone}`),
  );
}

/** Fetch conversions for admin excluyendo los ocultos por hiddenBy. */
export async function fetchConversionsForAdminFiltered(
  limit: number,
  hiddenBy: string,
): Promise<ConversionRow[]> {
  const [rows, hiddenIds, hiddenContactKeys] = await Promise.all([
    supabase
      .from("conversions")
      .select(CONVERSIONS_SELECT)
      .order("created_at", { ascending: false })
      .range(0, limit - 1)
      .then(({ data, error }) => {
        if (error) throw error;
        return (data ?? []) as ConversionRow[];
      }),
    fetchHiddenConversionIds(hiddenBy),
    fetchHiddenContacts(hiddenBy),
  ]);
  return rows.filter(
    (r) =>
      !hiddenIds.has(r.id) &&
      !hiddenContactKeys.has(`${r.user_id}::${r.phone}`),
  );
}

// ─── Funnel contacts (aggregated by phone) ──────────────────────────────────

const FUNNEL_SELECT = `
  user_id, phone, email, fn, ln, ct, st, country, region,
  utm_campaign, device_type, landing_name,
  total_valor, purchase_count, repeat_count, lead_count, contact_count,
  reached_contact, reached_lead, reached_purchase, reached_repeat,
  last_activity, first_contact
`.replace(/\s+/g, " ").trim();

export async function fetchFunnelContacts(
  userId: string,
): Promise<FunnelContact[]> {
  const { data, error } = await supabase
    .from("funnel_contacts")
    .select(FUNNEL_SELECT)
    .eq("user_id", userId)
    .order("last_activity", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as FunnelContact[];
}

export async function fetchFunnelContactsForAdmin(): Promise<FunnelContact[]> {
  const { data, error } = await supabase
    .from("funnel_contacts")
    .select(FUNNEL_SELECT)
    .order("last_activity", { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as FunnelContact[];
}

/** Fetch funnel contacts excluyendo los ocultos por hiddenBy. */
export async function fetchFunnelContactsFiltered(
  userId: string,
  hiddenBy: string,
): Promise<FunnelContact[]> {
  const [rows, hiddenContactKeys] = await Promise.all([
    supabase
      .from("funnel_contacts")
      .select(FUNNEL_SELECT)
      .eq("user_id", userId)
      .order("last_activity", { ascending: false })
      .then(({ data, error }) => {
        if (error) throw error;
        return (data ?? []) as FunnelContact[];
      }),
    fetchHiddenContacts(hiddenBy),
  ]);
  return rows.filter(
    (c) => !hiddenContactKeys.has(`${c.user_id}::${c.phone}`),
  );
}

/** Fetch funnel contacts for admin excluyendo los ocultos por hiddenBy. */
export async function fetchFunnelContactsForAdminFiltered(
  hiddenBy: string,
): Promise<FunnelContact[]> {
  const [rows, hiddenContactKeys] = await Promise.all([
    supabase
      .from("funnel_contacts")
      .select(FUNNEL_SELECT)
      .order("last_activity", { ascending: false })
      .then(({ data, error }) => {
        if (error) throw error;
        return (data ?? []) as FunnelContact[];
      }),
    fetchHiddenContacts(hiddenBy),
  ]);
  return rows.filter(
    (c) => !hiddenContactKeys.has(`${c.user_id}::${c.phone}`),
  );
}

// ─── Logs ───────────────────────────────────────────────────────────────────

const LOGS_SELECT =
  "id, user_id, conversion_id, function_name, level, message, detail, created_at";

export async function fetchConversionLogs(
  userId: string,
  limit = 200,
  offset = 0,
): Promise<ConversionLogRow[]> {
  const { data, error } = await supabase
    .from("conversion_logs")
    .select(LOGS_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return (data ?? []) as unknown as ConversionLogRow[];
}

export async function fetchConversionLogsForAdmin(
  limit = 200,
  offset = 0,
): Promise<ConversionLogRow[]> {
  const { data, error } = await supabase
    .from("conversion_logs")
    .select(LOGS_SELECT)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return (data ?? []) as unknown as ConversionLogRow[];
}

export async function fetchConversionsConfigForUser(
  userId: string,
): Promise<ConversionsConfig> {
  return fetchConversionsConfig(userId);
}

export async function updateConversionEmail(
  conversionId: string,
  email: string,
): Promise<void> {
  const { error } = await supabase
    .from("conversions")
    .update({ email })
    .eq("id", conversionId);
  if (error) throw error;
}

// ─── Hidden conversions / contacts (persistente en BD) ─────────────────────────

export async function fetchHiddenConversionIds(
  hiddenBy: string,
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("hidden_conversions")
    .select("conversion_id")
    .eq("hidden_by", hiddenBy);
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.conversion_id));
}

export async function fetchHiddenContacts(
  hiddenBy: string,
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("hidden_contacts")
    .select("user_id, phone")
    .eq("hidden_by", hiddenBy);
  if (error) throw error;
  return new Set(
    (data ?? []).map((r) => `${r.user_id}::${r.phone}`),
  );
}

export async function hideConversions(
  conversionIds: string[],
  hiddenBy: string,
): Promise<void> {
  if (conversionIds.length === 0) return;
  const rows = conversionIds.map((id) => ({
    conversion_id: id,
    hidden_by: hiddenBy,
  }));
  const { error } = await supabase
    .from("hidden_conversions")
    .upsert(rows, {
      onConflict: "conversion_id,hidden_by",
      ignoreDuplicates: true,
    });
  if (error) throw error;
}

export async function hideContacts(
  contacts: Array<{ user_id: string; phone: string }>,
  hiddenBy: string,
): Promise<void> {
  if (contacts.length === 0) return;
  const rows = contacts.map(({ user_id, phone }) => ({
    user_id,
    phone,
    hidden_by: hiddenBy,
  }));
  const { error } = await supabase
    .from("hidden_contacts")
    .upsert(rows, {
      onConflict: "user_id,phone,hidden_by",
      ignoreDuplicates: true,
    });
  if (error) throw error;
}
