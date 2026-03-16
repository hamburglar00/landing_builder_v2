import { supabase } from "@/lib/supabaseClient";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ConversionsConfig {
  user_id: string;
  pixel_id: string;
  meta_access_token: string;
  meta_currency: string;
  meta_api_version: string;
  send_contact_capi: boolean;
  geo_use_ipapi: boolean;
  geo_fill_only_when_missing: boolean;
  test_event_code: string;
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

const DEFAULT_CONFIG: ConversionsConfig = {
  user_id: "",
  pixel_id: "",
  meta_access_token: "",
  meta_currency: "ARS",
  meta_api_version: "v25.0",
  send_contact_capi: false,
  geo_use_ipapi: false,
  geo_fill_only_when_missing: false,
  test_event_code: "",
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
  return data as ConversionsConfig;
}

export async function upsertConversionsConfig(
  config: ConversionsConfig,
): Promise<void> {
  const { error } = await supabase
    .from("conversions_config")
    .upsert(
      {
        user_id: config.user_id,
        pixel_id: config.pixel_id,
        meta_access_token: config.meta_access_token,
        meta_currency: config.meta_currency,
        meta_api_version: config.meta_api_version,
        send_contact_capi: config.send_contact_capi,
        geo_use_ipapi: config.geo_use_ipapi,
        geo_fill_only_when_missing: config.geo_fill_only_when_missing,
        test_event_code: config.test_event_code,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

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
  limit = 100,
  offset = 0,
): Promise<ConversionRow[]> {
  const { data, error } = await supabase
    .from("conversions")
    .select(CONVERSIONS_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return (data ?? []) as ConversionRow[];
}

export async function fetchConversionsForAdmin(
  limit = 200,
  offset = 0,
): Promise<ConversionRow[]> {
  const { data, error } = await supabase
    .from("conversions")
    .select(CONVERSIONS_SELECT)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return (data ?? []) as ConversionRow[];
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
  return (data ?? []) as ConversionLogRow[];
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
  return (data ?? []) as ConversionLogRow[];
}

/**
 * Obtiene la config de un usuario específico (para admin viendo la config de un cliente).
 */
export async function fetchConversionsConfigForUser(
  userId: string,
): Promise<ConversionsConfig> {
  return fetchConversionsConfig(userId);
}
