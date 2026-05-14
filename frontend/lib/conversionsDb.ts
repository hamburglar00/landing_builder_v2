import { supabase } from "@/lib/supabaseClient";

function normalizePixelId(value: string): string {
  return String(value ?? "").replace(/\D/g, "");
}

// Types

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
  funnel_premium_threshold: number;
  visible_columns?: string[] | null;
  show_logs?: boolean;
  show_inbox?: boolean;
  show_ai_assistant?: boolean;
  show_promotions?: boolean;
  tracking_ranking_config?: TrackingRankingConfig | null;
}

export interface PixelConfig {
  id: string;
  user_id: string;
  pixel_id: string;
  meta_access_token: string;
  meta_currency: string;
  meta_api_version: string;
  send_contact_capi: boolean;
  geo_use_ipapi: boolean;
  geo_fill_only_when_missing: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface TrackingRankingRule {
  id: string;
  indicator: string;
  maxTotal: number;
}

export interface TrackingRankingConfig {
  rules: TrackingRankingRule[];
  overflowIndicator: string;
  sortMode: "last_active_desc" | "total_loaded_desc" | "loads_desc" | "avg_load_desc";
  gerenciaFilter?: string;
}

export interface HomeOverviewStats {
  landingsCount: number;
  porcentajeCarga: number;
  cargaPromedio: number;
  totalCargado: number;
  premium: number;
  retencionActiva30d: number;
}

export interface GerenciaAvailabilitySummary {
  label: string;
  sampleCount: number;
  activeSampleCount: number;
  availabilityPct: number | null;
}

export interface ConversionRow {
  id: string;
  internal_id: number | null;
  landing_id: string | null;
  user_id: string;
  landing_name: string;
  phone: string;
  email: string;
  cuit_cuil?: string;
  inferred_sex?: string;
  sex_source?: string;
  fn: string;
  ln: string;
  ct: string;
  st: string;
  zip: string;
  country: string;
  fbp: string;
  fbc: string;
  from_meta_ads: boolean;
  geo_source?: string;
  meta_pixel_id: string;
  source_platform?: string;
  pixel_id: string;
  contact_event_id: string;
  contact_event_time: number | null;
  sendContactPixel: boolean;
  contact_payload_raw: string;
  lead_event_id: string;
  lead_event_time: number | null;
  lead_payload_raw: string;
  purchase_event_id: string;
  purchase_event_time: number | null;
  purchase_payload_raw: string;
  purchase_coelsa_id?: string | null;
  purchase_transaction_id?: string | null;
  test_event_code?: string;
  purchase_type?: "first" | "repeat" | null;
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
  payload_received?: string | null;
  result?: string | null;
  payload_meta?: string | null;
  response_meta?: string | null;
  created_at: string;
}

export interface ConversionInboxRow {
  id: string;
  user_id: string;
  conversion_id: string | null;
  landing_name: string;
  action: string;
  action_event_id?: string | null;
  coelsa_id?: string | null;
  transaction_id?: string | null;
  promo_code: string;
  phone: string;
  payload_raw: string;
  status: string;
  http_status: number | null;
  response_body: string;
  processed_at: string | null;
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
  telefono_asignado?: string | null;
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
  current_status?: "lead" | "purchase" | string | null;
  current_purchase_type?: "first" | "repeat" | null;
}

export type FetchDateRange = {
  start?: Date | string | null;
  end?: Date | string | null;
};

function toIsoIfValid(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    const t = value.getTime();
    if (!Number.isFinite(t)) return null;
    return value.toISOString();
  }
  const d = new Date(value);
  const t = d.getTime();
  if (!Number.isFinite(t)) return null;
  return d.toISOString();
}

export type FunnelStage = "leads" | "primera_carga" | "recurrente" | "premium";

export function classifyContact(
  c: FunnelContact,
  premiumThreshold: number,
): FunnelStage {
  // Regla de negocio para UI del funnel:
  // si el contacto tiene al menos una compra registrada, no debe mostrarse en LEADS.
  if (c.purchase_count > 0) {
    if (c.total_valor >= premiumThreshold) return "premium";
    if (c.repeat_count > 0 || c.purchase_count > 1) return "recurrente";
    return "primera_carga";
  }

  if (c.current_status === "purchase") {
    if (c.total_valor >= premiumThreshold) return "premium";
    if (c.current_purchase_type === "repeat") return "recurrente";
    if (c.current_purchase_type === "first") return "primera_carga";
  }
  if (c.current_status === "lead") return "leads";
  if (c.purchase_count > 0 && c.total_valor >= premiumThreshold) return "premium";
  if (c.purchase_count > 1) return "recurrente";
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
  funnel_premium_threshold: 50000,
  visible_columns: [],
  show_logs: true,
  show_inbox: false,
  show_ai_assistant: false,
  show_promotions: false,
  tracking_ranking_config: null,
};

// Config CRUD

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
        pixel_id: normalizePixelId(config.pixel_id),
        meta_access_token: config.meta_access_token,
        meta_currency: config.meta_currency,
        meta_api_version: config.meta_api_version,
        send_contact_capi: config.send_contact_capi,
        geo_use_ipapi: config.geo_use_ipapi,
        geo_fill_only_when_missing: config.geo_fill_only_when_missing,
        funnel_premium_threshold: config.funnel_premium_threshold,
        visible_columns: config.visible_columns ?? [],
        show_logs: config.show_logs ?? true,
        show_inbox: config.show_inbox ?? false,
        show_ai_assistant: config.show_ai_assistant ?? false,
        show_promotions: config.show_promotions ?? false,
        tracking_ranking_config: config.tracking_ranking_config ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

  if (error) throw error;
}

export async function fetchPixelConfigs(userId: string): Promise<PixelConfig[]> {
  const { data, error } = await supabase
    .from("conversions_pixel_configs")
    .select("*")
    .eq("user_id", userId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as PixelConfig[];
}

export async function upsertPixelConfig(input: {
  user_id: string;
  pixel_id: string;
  meta_access_token: string;
  meta_currency?: string;
  meta_api_version?: string;
  send_contact_capi?: boolean;
  geo_use_ipapi?: boolean;
  geo_fill_only_when_missing?: boolean;
  is_default?: boolean;
}): Promise<void> {
  const pixelId = normalizePixelId(input.pixel_id);
  const { error } = await supabase
    .from("conversions_pixel_configs")
    .upsert(
      {
        user_id: input.user_id,
        pixel_id: pixelId,
        meta_access_token: input.meta_access_token,
        meta_currency: input.meta_currency ?? "ARS",
        meta_api_version: input.meta_api_version ?? "v25.0",
        send_contact_capi: !!input.send_contact_capi,
        geo_use_ipapi: !!input.geo_use_ipapi,
        geo_fill_only_when_missing: !!input.geo_fill_only_when_missing,
        is_default: !!input.is_default,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,pixel_id" },
    );
  if (error) throw error;
}

export async function deletePixelConfig(
  userId: string,
  pixelId: string,
): Promise<void> {
  const normalizedPixel = normalizePixelId(pixelId);
  const { error } = await supabase
    .from("conversions_pixel_configs")
    .delete()
    .eq("user_id", userId)
    .eq("pixel_id", normalizedPixel);
  if (error) throw error;
}

export async function updateAllVisibleColumns(
  columns: string[] | null,
): Promise<void> {
  const { error } = await supabase
    .from("conversions_config")
    // PostgREST requiere un WHERE para UPDATE bajo RLS.
    // Usamos una condicion amplia sobre user_id para aplicar el cambio a todos los registros reales.
    .update({ visible_columns: columns ?? [] })
    .not("user_id", "is", null);

  if (error) throw error;
}

// Conversions list

const CONVERSIONS_SELECT = `
  id, internal_id, landing_id, user_id, landing_name,
  phone, email, cuit_cuil, inferred_sex, sex_source, fn, ln, ct, st, zip, country,
  fbp, fbc, from_meta_ads, geo_source, meta_pixel_id, pixel_id,
  source_platform,
  contact_event_id, contact_event_time, sendContactPixel, contact_payload_raw,
  lead_event_id, lead_event_time, lead_payload_raw,
  purchase_event_id, purchase_event_time, purchase_payload_raw, purchase_coelsa_id, purchase_transaction_id,
  test_event_code,
  purchase_type,
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

/** Fetch conversions sin excluir hidden_conversions. Se usa para reportes historicos/operativos. */
export async function fetchConversionsUnfiltered(
  userId: string,
  range?: FetchDateRange,
): Promise<ConversionRow[]> {
  const pageSize = 1000;
  const rows: ConversionRow[] = [];
  let offset = 0;

  while (true) {
    let query = supabase
      .from("conversions")
      .select(CONVERSIONS_SELECT)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    const startIso = toIsoIfValid(range?.start);
    const endIso = toIsoIfValid(range?.end);
    if (startIso) query = query.gte("created_at", startIso);
    if (endIso) query = query.lte("created_at", endIso);

    const { data, error } = await query.range(offset, offset + pageSize - 1);
    if (error) throw error;

    const chunk = (data ?? []) as unknown as ConversionRow[];
    rows.push(...chunk);

    if (chunk.length < pageSize) break;
    offset += pageSize;
  }

  return rows;
}

/** Fetch admin sin excluir hidden_conversions. */
export async function fetchConversionsForAdminUnfiltered(
  range?: FetchDateRange,
): Promise<ConversionRow[]> {
  const pageSize = 1000;
  const rows: ConversionRow[] = [];
  let offset = 0;

  while (true) {
    let query = supabase
      .from("conversions")
      .select(CONVERSIONS_SELECT)
      .order("created_at", { ascending: false });
    const startIso = toIsoIfValid(range?.start);
    const endIso = toIsoIfValid(range?.end);
    if (startIso) query = query.gte("created_at", startIso);
    if (endIso) query = query.lte("created_at", endIso);

    const { data, error } = await query.range(offset, offset + pageSize - 1);
    if (error) throw error;

    const chunk = (data ?? []) as unknown as ConversionRow[];
    rows.push(...chunk);

    if (chunk.length < pageSize) break;
    offset += pageSize;
  }

  return rows;
}

/** Fetch conversions excluyendo los ocultos por hiddenBy. */
export async function fetchConversionsFiltered(
  userId: string,
  hiddenBy: string,
  limit?: number,
  range?: FetchDateRange,
): Promise<ConversionRow[]> {
  const pageSize = 1000;
  const rows: ConversionRow[] = [];
  let offset = 0;

  while (true) {
    let query = supabase
      .from("conversions")
      .select(CONVERSIONS_SELECT)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    const startIso = toIsoIfValid(range?.start);
    const endIso = toIsoIfValid(range?.end);
    if (startIso) query = query.gte("created_at", startIso);
    if (endIso) query = query.lte("created_at", endIso);

    const chunkSize = typeof limit === "number"
      ? Math.min(pageSize, Math.max(limit - offset, 0))
      : pageSize;

    if (chunkSize <= 0) break;

    const { data, error } = await query.range(offset, offset + chunkSize - 1);
    if (error) throw error;

    const chunk = (data ?? []) as unknown as ConversionRow[];
    rows.push(...chunk);

    if (chunk.length < chunkSize) break;
    offset += chunkSize;
  }

  const hiddenIds = await fetchHiddenConversionIds(hiddenBy);
  return rows.filter(
    (r) => !hiddenIds.has(r.id),
  );
}

/** Fetch conversions for admin excluyendo los ocultos por hiddenBy. */
export async function fetchConversionsForAdminFiltered(
  hiddenBy: string,
  limit?: number,
  range?: FetchDateRange,
): Promise<ConversionRow[]> {
  const pageSize = 1000;
  const rows: ConversionRow[] = [];
  let offset = 0;

  while (true) {
    let query = supabase
      .from("conversions")
      .select(CONVERSIONS_SELECT)
      .order("created_at", { ascending: false });
    const startIso = toIsoIfValid(range?.start);
    const endIso = toIsoIfValid(range?.end);
    if (startIso) query = query.gte("created_at", startIso);
    if (endIso) query = query.lte("created_at", endIso);

    const chunkSize = typeof limit === "number"
      ? Math.min(pageSize, Math.max(limit - offset, 0))
      : pageSize;

    if (chunkSize <= 0) break;

    const { data, error } = await query.range(offset, offset + chunkSize - 1);
    if (error) throw error;

    const chunk = (data ?? []) as unknown as ConversionRow[];
    rows.push(...chunk);

    if (chunk.length < chunkSize) break;
    offset += chunkSize;
  }

  const hiddenIds = await fetchHiddenConversionIds(hiddenBy);
  return rows.filter(
    (r) => !hiddenIds.has(r.id),
  );
}

// Funnel contacts (aggregated by phone)

function derivePurchaseType(row: ConversionRow): "first" | "repeat" | null {
  if (!row.purchase_event_id) return null;
  if (row.purchase_type === "first" || row.purchase_type === "repeat") return row.purchase_type;
  return (row.observaciones ?? "").includes("REPEAT") ? "repeat" : "first";
}

export function buildFunnelContactsFromConversions(rows: ConversionRow[]): FunnelContact[] {
  const grouped = new Map<string, ConversionRow[]>();
  for (const row of rows) {
    // Excluir eventos de prueba para no ensuciar el funnel.
    if (String(row.test_event_code ?? "").trim()) continue;
    const key = `${row.user_id}::${row.phone}`;
    const bucket = grouped.get(key) ?? [];
    bucket.push(row);
    grouped.set(key, bucket);
  }

  const funnel: FunnelContact[] = [];
  for (const group of grouped.values()) {
    const sorted = [...group].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const latest = sorted[sorted.length - 1];
    const currentStatus = (latest.estado ?? "") as "lead" | "purchase" | string;
    const currentPurchaseType = derivePurchaseType(latest);
    if (currentStatus !== "lead" && currentStatus !== "purchase") continue;

    const purchaseRows = sorted.filter((r) => (r.purchase_event_id ?? "") !== "");
    const repeatRows = purchaseRows.filter((r) => derivePurchaseType(r) === "repeat");
    const leadRows = sorted.filter((r) => (r.lead_event_id ?? "") !== "");
    const contactRows = sorted.filter((r) => (r.contact_event_id ?? "") !== "");
    const assignedPhone =
      [...sorted].reverse().find((r) => String(r.telefono_asignado ?? "").trim())?.telefono_asignado ??
      null;

    funnel.push({
      user_id: latest.user_id,
      phone: latest.phone,
      email: latest.email || null,
      fn: latest.fn || null,
      ln: latest.ln || null,
      ct: latest.ct || null,
      st: latest.st || null,
      country: latest.country || null,
      region: latest.geo_region || latest.st || null,
      utm_campaign: latest.utm_campaign || null,
      device_type: latest.device_type || null,
      landing_name: latest.landing_name || null,
      telefono_asignado: assignedPhone,
      total_valor: purchaseRows.reduce((sum, r) => sum + (Number(r.valor) || 0), 0),
      purchase_count: purchaseRows.length,
      repeat_count: repeatRows.length,
      lead_count: leadRows.length,
      contact_count: contactRows.length,
      reached_contact: contactRows.length > 0,
      reached_lead: leadRows.length > 0,
      reached_purchase: purchaseRows.length > 0,
      reached_repeat: repeatRows.length > 0,
      last_activity: latest.created_at,
      first_contact: sorted[0]?.created_at ?? latest.created_at,
      current_status: currentStatus,
      current_purchase_type: currentPurchaseType,
    });
  }

  return funnel.sort((a, b) => new Date(b.last_activity).getTime() - new Date(a.last_activity).getTime());
}

export async function fetchFunnelContacts(
  userId: string,
): Promise<FunnelContact[]> {
  const rows = await fetchConversionsFiltered(userId, userId);
  return buildFunnelContactsFromConversions(rows);
}

export async function fetchFunnelContactsForAdmin(): Promise<FunnelContact[]> {
  const rows = await fetchConversionsForAdminFiltered("admin");
  return buildFunnelContactsFromConversions(rows);
}

/** Fetch funnel contacts excluyendo los ocultos por hiddenBy. */
export async function fetchFunnelContactsFiltered(
  userId: string,
  hiddenBy: string,
  range?: FetchDateRange,
): Promise<FunnelContact[]> {
  const rows = await fetchConversionsFiltered(userId, hiddenBy, undefined, range);
  return buildFunnelContactsFromConversions(rows);
}

/** Fetch funnel contacts for admin excluyendo los ocultos por hiddenBy. */
export async function fetchFunnelContactsForAdminFiltered(
  hiddenBy: string,
  range?: FetchDateRange,
): Promise<FunnelContact[]> {
  const rows = await fetchConversionsForAdminFiltered(hiddenBy, undefined, range);
  return buildFunnelContactsFromConversions(rows);
}

// Logs

const LOGS_SELECT =
  "id, user_id, conversion_id, function_name, level, message, detail, payload_received, result, payload_meta, response_meta, created_at";
const INBOX_SELECT =
  "id, user_id, conversion_id, landing_name, action, action_event_id, coelsa_id, transaction_id, promo_code, phone, payload_raw, status, http_status, response_body, processed_at, created_at";

function arrangeLogsForUi(rows: ConversionLogRow[]): ConversionLogRow[] {
  type LogGroup = {
    sortTs: number;
    rows: ConversionLogRow[];
  };

  const withId = new Map<string, ConversionLogRow[]>();
  const withoutId: ConversionLogRow[] = [];

  for (const row of rows) {
    const key = row.conversion_id ?? "";
    if (key) {
      const bucket = withId.get(key) ?? [];
      bucket.push(row);
      withId.set(key, bucket);
    } else {
      withoutId.push(row);
    }
  }

  const groups: LogGroup[] = [];

  for (const bucket of withId.values()) {
    const sortedBucket = [...bucket].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    groups.push({
      sortTs: new Date(sortedBucket[0]?.created_at ?? 0).getTime(),
      rows: sortedBucket,
    });
  }

  for (const row of withoutId) {
    groups.push({
      sortTs: new Date(row.created_at).getTime(),
      rows: [row],
    });
  }

  groups.sort((a, b) => b.sortTs - a.sortTs);
  return groups.flatMap((g) => g.rows);
}

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
  return arrangeLogsForUi((data ?? []) as unknown as ConversionLogRow[]);
}

export async function fetchConversionLogsFiltered(
  userId: string,
  hiddenBy: string,
  limit = 200,
  offset = 0,
): Promise<ConversionLogRow[]> {
  const rows = await fetchConversionLogs(userId, limit, offset);
  const hiddenIds = await fetchHiddenConversionLogIds(hiddenBy);
  return rows.filter((r) => !hiddenIds.has(r.id));
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
  return arrangeLogsForUi((data ?? []) as unknown as ConversionLogRow[]);
}

export async function fetchConversionLogsForAdminFiltered(
  hiddenBy: string,
  limit = 200,
  offset = 0,
): Promise<ConversionLogRow[]> {
  const rows = await fetchConversionLogsForAdmin(limit, offset);
  const hiddenIds = await fetchHiddenConversionLogIds(hiddenBy);
  return rows.filter((r) => !hiddenIds.has(r.id));
}

export async function fetchConversionInbox(
  userId: string,
  hiddenBy: string,
  limit = 300,
  offset = 0,
): Promise<ConversionInboxRow[]> {
  const { data, error } = await supabase
    .from("conversion_inbox")
    .select(INBOX_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  const hiddenIds = await fetchHiddenConversionInboxIds(hiddenBy);
  return ((data ?? []) as unknown as ConversionInboxRow[]).filter((row) => !hiddenIds.has(row.id));
}

export async function fetchConversionsConfigForUser(
  userId: string,
): Promise<ConversionsConfig> {
  return fetchConversionsConfig(userId);
}

export async function fetchHomeOverviewStats(userId: string): Promise<HomeOverviewStats> {
  const { data, error } = await supabase.rpc("get_home_overview_stats", {
    p_user_id: userId,
    p_hidden_by: userId,
  });
  if (error) throw error;

  const row = (data ?? {}) as Record<string, unknown>;
  return {
    landingsCount: Number(row.landings_count ?? 0),
    porcentajeCarga: Number(row.porcentaje_carga ?? 0),
    cargaPromedio: Number(row.carga_promedio ?? 0),
    totalCargado: Number(row.total_cargado ?? 0),
    premium: Number(row.jugadores_premium ?? 0),
    retencionActiva30d: Number(row.retencion_activa_30d ?? 0),
  };
}

type GerenciaAvailabilitySnapshotRaw = {
  gerencia_id: number | string | null;
  active_phone_count: number | string | null;
  total_phone_count: number | string | null;
  assigned_landing_count?: number | string | null;
  checked_at: string | null;
  gerencias?:
    | {
        id?: number | string | null;
        nombre?: string | null;
        gerencia_id?: number | string | null;
      }
    | Array<{
        id?: number | string | null;
        nombre?: string | null;
        gerencia_id?: number | string | null;
      }>
    | null;
};

async function fetchGerenciaAvailabilitySummariesInternal(
  range: FetchDateRange,
  userId?: string,
): Promise<GerenciaAvailabilitySummary[]> {
  const startIso = toIsoIfValid(range.start);
  const endIso = toIsoIfValid(range.end);

  let query = supabase
    .from("gerencia_phone_availability_snapshots")
    .select("gerencia_id, active_phone_count, total_phone_count, assigned_landing_count, checked_at, gerencias!inner(id,nombre,gerencia_id)")
    .order("checked_at", { ascending: true });
  if (userId) query = query.eq("user_id", userId);
  if (startIso) query = query.gte("checked_at", startIso);
  if (endIso) query = query.lte("checked_at", endIso);

  const { data, error } = await query;
  if (error) throw error;

  const byLabel = new Map<string, { sampleCount: number; activeSampleCount: number }>();
  for (const row of (data ?? []) as unknown as GerenciaAvailabilitySnapshotRaw[]) {
    if (Number(row.assigned_landing_count ?? 0) <= 0) continue;
    const joined = Array.isArray(row.gerencias) ? row.gerencias[0] : row.gerencias;
    const internalId = Number(joined?.id ?? row.gerencia_id);
    const externalId = Number(joined?.gerencia_id);
    const labelId = Number.isFinite(externalId) ? externalId : internalId;
    const name = String(joined?.nombre ?? "").trim() || `Gerencia ${labelId}`;
    const label = `${name} (ID ${labelId})`;
    const current = byLabel.get(label) ?? { sampleCount: 0, activeSampleCount: 0 };
    current.sampleCount += 1;
    if (Number(row.active_phone_count ?? 0) > 0) current.activeSampleCount += 1;
    byLabel.set(label, current);
  }

  return Array.from(byLabel.entries()).map(([label, value]) => ({
    label,
    sampleCount: value.sampleCount,
    activeSampleCount: value.activeSampleCount,
    availabilityPct: value.sampleCount > 0 ? (value.activeSampleCount / value.sampleCount) * 100 : null,
  }));
}

export async function fetchGerenciaAvailabilitySummaries(
  userId: string,
  range: FetchDateRange,
): Promise<GerenciaAvailabilitySummary[]> {
  return fetchGerenciaAvailabilitySummariesInternal(range, userId);
}

export async function fetchGerenciaAvailabilitySummariesForAdmin(
  range: FetchDateRange,
): Promise<GerenciaAvailabilitySummary[]> {
  return fetchGerenciaAvailabilitySummariesInternal(range);
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

// Hidden conversions / contacts (persistente en BD)

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

export async function fetchHiddenConversionLogIds(
  hiddenBy: string,
): Promise<Set<number>> {
  const { data, error } = await supabase
    .from("hidden_conversion_logs")
    .select("log_id")
    .eq("hidden_by", hiddenBy);
  if (error) throw error;
  return new Set((data ?? []).map((r) => Number(r.log_id)));
}

export async function fetchHiddenConversionInboxIds(
  hiddenBy: string,
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from("hidden_conversion_inbox")
    .select("inbox_id")
    .eq("hidden_by", hiddenBy);
  if (error) throw error;
  return new Set((data ?? []).map((r) => String(r.inbox_id ?? "").trim()).filter(Boolean));
}

export async function hideConversionLogs(
  logIds: number[],
  hiddenBy: string,
): Promise<void> {
  if (logIds.length === 0) return;
  const rows = logIds.map((id) => ({
    log_id: id,
    hidden_by: hiddenBy,
  }));
  const { error } = await supabase
    .from("hidden_conversion_logs")
    .upsert(rows, {
      onConflict: "log_id,hidden_by",
      ignoreDuplicates: true,
    });
  if (error) throw error;
}

export async function hideConversionInboxRows(
  inboxIds: string[],
  hiddenBy: string,
): Promise<void> {
  if (inboxIds.length === 0) return;
  const rows = inboxIds.map((id) => ({
    inbox_id: id,
    hidden_by: hiddenBy,
  }));
  const { error } = await supabase
    .from("hidden_conversion_inbox")
    .upsert(rows, {
      onConflict: "inbox_id,hidden_by",
      ignoreDuplicates: true,
    });
  if (error) throw error;
}
