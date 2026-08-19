import { supabase } from "@/lib/supabaseClient";
import type { ReportingCurrency } from "@/lib/currency";
import {
  buildConversionLogQueryFilter,
  type ConversionLogDirectionFilter,
  type ConversionLogEventFilter,
} from "@/lib/conversionLogFilters";

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
  send_lead_capi: boolean;
  send_complete_registration_capi: boolean;
  meta_ads_only_capi: boolean;
  send_purchase_capi: boolean;
  include_purchase_type_capi: boolean;
  send_first_purchase_capi: boolean;
  send_repeat_purchase_capi: boolean;
  send_geo_capi: boolean;
  geo_use_ipapi: boolean;
  geo_fill_only_when_missing: boolean;
  funnel_premium_threshold: number;
  funnel_premium_thresholds?: Record<string, number> | null;
  visible_columns?: string[] | null;
  show_logs?: boolean;
  show_inbox?: boolean;
  show_ai_assistant?: boolean;
  show_promotions?: boolean;
  tracking_ranking_config?: TrackingRankingConfig | null;
  tracking_ranking_configs?: Record<string, TrackingRankingConfig> | null;
}

export interface PixelConfig {
  id: string;
  user_id: string;
  pixel_id: string;
  meta_access_token: string;
  comment: string;
  meta_currency: string;
  meta_api_version: string;
  send_contact_capi: boolean;
  send_lead_capi: boolean;
  send_complete_registration_capi: boolean;
  meta_ads_only_capi: boolean;
  send_purchase_capi: boolean;
  include_purchase_type_capi: boolean;
  send_first_purchase_capi: boolean;
  send_repeat_purchase_capi: boolean;
  send_geo_capi: boolean;
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
  gerenciaId: number | null;
  gerenciaExternalId: number | null;
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
  form_fn?: string | null;
  form_ln?: string | null;
  form_email?: string | null;
  form_phone?: string | null;
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
  dataset_id: string;
  source_platform?: string;
  ctwa_clid?: string;
  atrio_id?: string | null;
  atrio_client_id?: string | null;
  atrio_slug?: string | null;
  atrio_players_id?: string | null;
  pixel_id: string;
  pixel_attribution_source?: string;
  pixel_attribution_conversion_id?: string | null;
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
  purchase_capi_route?: "" | "website" | "business_messaging";
  purchase_capi_route_reason?: string;
  client_ip: string;
  agent_user: string;
  device_type: string;
  event_source_url: string;
  estado: string;
  valor: number;
  currency: string;
  workspace_resolution_source?: string | null;
  contact_status_capi: string;
  lead_status_capi: string;
  registration_status_capi?: string;
  purchase_status_capi: string;
  observaciones: string;
  external_id: string;
  utm_campaign: string;
  telefono_asignado: string;
  assigned_gerencia_id?: number | null;
  assigned_gerencia_external_id?: number | null;
  assigned_gerencia_name?: string | null;
  assigned_gerencia_label?: string | null;
  lead_bot_phone?: string | null;
  lead_player_username?: string | null;
  lead_agency_id?: string | null;
  lead_gerencia_id?: number | null;
  lead_gerencia_external_id?: number | null;
  lead_gerencia_name?: string | null;
  lead_gerencia_label?: string | null;
  lead_incoming_promo_code?: string | null;
  lead_atrio_id?: string | null;
  lead_atrio_players_id?: string | null;
  lead_attribution_status?: string | null;
  lead_attribution_conversion_id?: string | null;
  registration_event_id?: string | null;
  registration_event_time?: number | null;
  registration_payload_raw?: string | null;
  registration_player_username?: string | null;
  registration_bot_phone?: string | null;
  registration_agency_id?: string | null;
  registration_gerencia_id?: number | null;
  registration_gerencia_external_id?: number | null;
  registration_gerencia_name?: string | null;
  registration_gerencia_label?: string | null;
  registration_incoming_promo_code?: string | null;
  registration_atrio_id?: string | null;
  registration_atrio_players_id?: string | null;
  registration_attribution_status?: string | null;
  registration_attribution_conversion_id?: string | null;
  purchase_bot_phone?: string | null;
  purchase_player_username?: string | null;
  purchase_agency_id?: string | null;
  purchase_gerencia_id?: number | null;
  purchase_gerencia_external_id?: number | null;
  purchase_gerencia_name?: string | null;
  purchase_gerencia_label?: string | null;
  purchase_incoming_promo_code?: string | null;
  purchase_atrio_id?: string | null;
  purchase_atrio_players_id?: string | null;
  purchase_attribution_status?: string | null;
  purchase_attribution_conversion_id?: string | null;
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
  conversion_internal_id?: number | null;
  workspace_currency?: ReportingCurrency | string | null;
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
  conversion_internal_id?: number | null;
  workspace_currency?: ReportingCurrency | string | null;
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
  assigned_gerencia_label?: string | null;
  player_username?: string | null;
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

export function getConversionGerenciaLabels(
  row: Pick<
    ConversionRow,
    | "telefono_asignado"
    | "assigned_gerencia_label"
    | "contact_event_id"
    | "lead_event_id"
    | "purchase_event_id"
    | "lead_gerencia_label"
    | "purchase_gerencia_label"
  >,
  gerenciaByPhone: Record<string, string[]>,
  stage?: "contact" | "lead" | "purchase",
): string[] {
  const assignedLabels = (): string[] => {
    const historicalLabel = String(row.assigned_gerencia_label ?? "").trim();
    if (historicalLabel) return [historicalLabel];
    const assignedPhone = String(row.telefono_asignado ?? "").replace(/\D/g, "");
    return assignedPhone ? (gerenciaByPhone[assignedPhone] ?? []) : [];
  };
  const leadLabels = (): string[] => {
    const label = String(row.lead_gerencia_label ?? "").trim();
    return label ? [label] : assignedLabels();
  };
  const purchaseLabels = (): string[] => {
    const label = String(row.purchase_gerencia_label ?? "").trim();
    return label ? [label] : leadLabels();
  };

  if (stage === "contact") return assignedLabels();
  if (stage === "lead") return leadLabels();
  if (stage === "purchase") return purchaseLabels();

  const labels = new Set<string>();
  if (String(row.contact_event_id ?? "").trim()) {
    for (const label of assignedLabels()) labels.add(label);
  }
  if (String(row.lead_event_id ?? "").trim()) {
    for (const label of leadLabels()) labels.add(label);
  }
  if (String(row.purchase_event_id ?? "").trim()) {
    for (const label of purchaseLabels()) labels.add(label);
  }
  if (labels.size > 0) return Array.from(labels);
  return assignedLabels();
}

export function getConversionTableGerenciaLabels(
  row: Pick<
    ConversionRow,
    | "telefono_asignado"
    | "assigned_gerencia_label"
    | "lead_event_id"
    | "registration_event_id"
    | "purchase_event_id"
    | "lead_gerencia_label"
    | "registration_gerencia_label"
    | "purchase_gerencia_label"
  >,
  gerenciaByPhone: Record<string, string[]>,
): string[] {
  const assignedLabels = (): string[] => {
    const historicalLabel = String(row.assigned_gerencia_label ?? "").trim();
    if (historicalLabel) return [historicalLabel];
    const assignedPhone = String(row.telefono_asignado ?? "").replace(/\D/g, "");
    return assignedPhone ? (gerenciaByPhone[assignedPhone] ?? []) : [];
  };
  const leadLabels = (): string[] => {
    const label = String(row.lead_gerencia_label ?? "").trim();
    return label ? [label] : assignedLabels();
  };
  const registrationLabels = (): string[] => {
    const label = String(row.registration_gerencia_label ?? "").trim();
    return label ? [label] : leadLabels();
  };
  const purchaseLabels = (): string[] => {
    const label = String(row.purchase_gerencia_label ?? "").trim();
    return label ? [label] : registrationLabels();
  };

  if (String(row.purchase_event_id ?? "").trim()) return purchaseLabels();
  if (String(row.registration_event_id ?? "").trim()) return registrationLabels();
  if (String(row.lead_event_id ?? "").trim()) return leadLabels();
  return assignedLabels();
}

export function scopeConversionStagesToGerencia(
  row: ConversionRow,
  gerenciaByPhone: Record<string, string[]>,
  matches: (labels: string[]) => boolean,
): ConversionRow | null {
  const hasContact = String(row.contact_event_id ?? "").trim() !== "" &&
    matches(getConversionGerenciaLabels(row, gerenciaByPhone, "contact"));
  const hasLead = String(row.lead_event_id ?? "").trim() !== "" &&
    matches(getConversionGerenciaLabels(row, gerenciaByPhone, "lead"));
  const hasPurchase = String(row.purchase_event_id ?? "").trim() !== "" &&
    matches(getConversionGerenciaLabels(row, gerenciaByPhone, "purchase"));
  if (!hasContact && !hasLead && !hasPurchase) return null;

  return {
    ...row,
    contact_event_id: hasContact ? row.contact_event_id : "",
    contact_event_time: hasContact ? row.contact_event_time : null,
    lead_event_id: hasLead ? row.lead_event_id : "",
    lead_event_time: hasLead ? row.lead_event_time : null,
    purchase_event_id: hasPurchase ? row.purchase_event_id : "",
    purchase_event_time: hasPurchase ? row.purchase_event_time : null,
    purchase_type: hasPurchase ? row.purchase_type : null,
    valor: hasPurchase ? row.valor : 0,
    estado: hasPurchase ? "purchase" : (hasLead ? "lead" : "contact"),
  };
}

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

function latestIso(
  ...values: Array<Date | string | null | undefined>
): string | null {
  const valid = values
    .map(toIsoIfValid)
    .filter((value): value is string => Boolean(value));
  if (valid.length === 0) return null;
  return valid.reduce((latest, value) =>
    Date.parse(value) > Date.parse(latest) ? value : latest
  );
}

export async function fetchConversionViewVisibleFrom(
  hiddenBy: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("conversion_view_preferences")
    .select("visible_from")
    .eq("hidden_by", hiddenBy)
    .maybeSingle();
  if (error) throw error;
  return toIsoIfValid(data?.visible_from);
}

export async function setConversionViewVisibleFrom(
  hiddenBy: string,
  visibleFrom: Date | string,
): Promise<void> {
  const normalized = toIsoIfValid(visibleFrom);
  if (!normalized) throw new Error("Fecha de corte inválida.");
  const { error } = await supabase
    .from("conversion_view_preferences")
    .upsert(
      {
        hidden_by: hiddenBy,
        visible_from: normalized,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "hidden_by" },
    );
  if (error) throw error;
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
  send_lead_capi: true,
  send_complete_registration_capi: false,
  meta_ads_only_capi: false,
  send_purchase_capi: true,
  include_purchase_type_capi: true,
  send_first_purchase_capi: true,
  send_repeat_purchase_capi: true,
  send_geo_capi: true,
  geo_use_ipapi: false,
  geo_fill_only_when_missing: false,
  funnel_premium_threshold: 50000,
  funnel_premium_thresholds: { ARS: 50000 },
  visible_columns: [],
  show_logs: true,
  show_inbox: false,
  show_ai_assistant: false,
  show_promotions: false,
  tracking_ranking_config: null,
  tracking_ranking_configs: {},
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
  const stored = data as Partial<ConversionsConfig>;
  const storedThresholds =
    stored.funnel_premium_thresholds &&
    typeof stored.funnel_premium_thresholds === "object" &&
    !Array.isArray(stored.funnel_premium_thresholds)
      ? stored.funnel_premium_thresholds
      : {};
  const storedRankingConfigs =
    stored.tracking_ranking_configs &&
    typeof stored.tracking_ranking_configs === "object" &&
    !Array.isArray(stored.tracking_ranking_configs)
      ? stored.tracking_ranking_configs
      : {};
  const legacyPurchaseEnabled = stored.send_purchase_capi !== false;
  return {
    ...DEFAULT_CONFIG,
    ...stored,
    user_id: userId,
    funnel_premium_thresholds: {
      ARS: Number(storedThresholds.ARS ?? stored.funnel_premium_threshold ?? 50000),
      ...storedThresholds,
    },
    tracking_ranking_configs: {
      ...(stored.tracking_ranking_config ? { ARS: stored.tracking_ranking_config } : {}),
      ...storedRankingConfigs,
    },
    send_purchase_capi:
      stored.send_purchase_capi ??
      (stored.send_first_purchase_capi !== false || stored.send_repeat_purchase_capi !== false),
    send_complete_registration_capi: stored.send_complete_registration_capi === true,
    meta_ads_only_capi: stored.meta_ads_only_capi === true,
    include_purchase_type_capi: stored.include_purchase_type_capi !== false,
    send_first_purchase_capi:
      stored.send_first_purchase_capi ?? legacyPurchaseEnabled,
    send_repeat_purchase_capi:
      stored.send_repeat_purchase_capi ?? legacyPurchaseEnabled,
    send_geo_capi: stored.send_geo_capi !== false,
  };
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
        send_lead_capi: config.send_lead_capi !== false,
        send_complete_registration_capi: config.send_complete_registration_capi === true,
        meta_ads_only_capi: config.meta_ads_only_capi === true,
        send_purchase_capi: config.send_purchase_capi !== false,
        include_purchase_type_capi: config.include_purchase_type_capi !== false,
        send_first_purchase_capi: config.send_first_purchase_capi !== false,
        send_repeat_purchase_capi: config.send_repeat_purchase_capi !== false,
        send_geo_capi: config.send_geo_capi !== false,
        geo_use_ipapi: config.geo_use_ipapi,
        geo_fill_only_when_missing: config.geo_fill_only_when_missing,
        funnel_premium_threshold: config.funnel_premium_threshold,
        funnel_premium_thresholds: config.funnel_premium_thresholds ?? {
          ARS: config.funnel_premium_threshold,
        },
        visible_columns: config.visible_columns ?? [],
        show_logs: config.show_logs ?? true,
        show_inbox: config.show_inbox ?? false,
        show_ai_assistant: config.show_ai_assistant ?? false,
        show_promotions: config.show_promotions ?? false,
        tracking_ranking_config: config.tracking_ranking_config ?? null,
        tracking_ranking_configs: config.tracking_ranking_configs ?? (
          config.tracking_ranking_config
            ? { ARS: config.tracking_ranking_config }
            : {}
        ),
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
  return (data ?? []).map((pixel) => {
    const legacyPurchaseEnabled = pixel.send_purchase_capi !== false;
    return {
      ...pixel,
      send_lead_capi: pixel.send_lead_capi !== false,
      send_complete_registration_capi: pixel.send_complete_registration_capi === true,
      meta_ads_only_capi: pixel.meta_ads_only_capi === true,
      send_purchase_capi:
        pixel.send_purchase_capi ??
        (pixel.send_first_purchase_capi !== false || pixel.send_repeat_purchase_capi !== false),
      include_purchase_type_capi: pixel.include_purchase_type_capi !== false,
      send_first_purchase_capi:
        pixel.send_first_purchase_capi ?? legacyPurchaseEnabled,
      send_repeat_purchase_capi:
        pixel.send_repeat_purchase_capi ?? legacyPurchaseEnabled,
      send_geo_capi: pixel.send_geo_capi !== false,
    };
  }) as PixelConfig[];
}

export async function upsertPixelConfig(input: {
  user_id: string;
  pixel_id: string;
  meta_access_token: string;
  comment?: string;
  meta_currency?: string;
  meta_api_version?: string;
  send_contact_capi?: boolean;
  send_lead_capi?: boolean;
  send_complete_registration_capi?: boolean;
  meta_ads_only_capi?: boolean;
  send_purchase_capi?: boolean;
  include_purchase_type_capi?: boolean;
  send_first_purchase_capi?: boolean;
  send_repeat_purchase_capi?: boolean;
  send_geo_capi?: boolean;
  geo_use_ipapi?: boolean;
  geo_fill_only_when_missing?: boolean;
  is_default?: boolean;
}): Promise<void> {
  const pixelId = normalizePixelId(input.pixel_id);
  const legacyPurchaseEnabled = input.send_purchase_capi !== false;
  const firstPurchaseEnabled =
    input.send_first_purchase_capi ?? legacyPurchaseEnabled;
  const repeatPurchaseEnabled =
    input.send_repeat_purchase_capi ?? legacyPurchaseEnabled;
  const purchaseEnabled =
    input.send_purchase_capi ?? (firstPurchaseEnabled || repeatPurchaseEnabled);
  const body: Record<string, unknown> = {
    user_id: input.user_id,
    pixel_id: pixelId,
    meta_access_token: input.meta_access_token,
    meta_currency: input.meta_currency ?? "ARS",
    meta_api_version: input.meta_api_version ?? "v25.0",
    send_contact_capi: !!input.send_contact_capi,
    send_lead_capi: input.send_lead_capi !== false,
    send_complete_registration_capi: input.send_complete_registration_capi === true,
    send_purchase_capi: purchaseEnabled,
    include_purchase_type_capi: input.include_purchase_type_capi !== false,
    send_first_purchase_capi: firstPurchaseEnabled,
    send_repeat_purchase_capi: repeatPurchaseEnabled,
    geo_use_ipapi: !!input.geo_use_ipapi,
    geo_fill_only_when_missing: !!input.geo_fill_only_when_missing,
    is_default: !!input.is_default,
    updated_at: new Date().toISOString(),
  };
  if (input.comment !== undefined) {
    body.comment = input.comment.trim();
  }
  if (input.meta_ads_only_capi !== undefined) {
    body.meta_ads_only_capi = input.meta_ads_only_capi;
  }
  if (input.send_geo_capi !== undefined) {
    body.send_geo_capi = input.send_geo_capi;
  }
  const { error } = await supabase
    .from("conversions_pixel_configs")
    .upsert(body, { onConflict: "user_id,pixel_id" });
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
  phone, email, form_fn, form_ln, form_email, form_phone, cuit_cuil, inferred_sex, sex_source, fn, ln, ct, st, zip, country,
  fbp, fbc, from_meta_ads, geo_source, meta_pixel_id, pixel_id, dataset_id,
  pixel_attribution_source, pixel_attribution_conversion_id,
  source_platform, ctwa_clid, atrio_id, atrio_client_id, atrio_slug, atrio_players_id,
  contact_event_id, contact_event_time, sendContactPixel, contact_payload_raw,
  lead_event_id, lead_event_time, lead_payload_raw,
  purchase_event_id, purchase_event_time, purchase_payload_raw, purchase_coelsa_id, purchase_transaction_id,
  test_event_code,
  purchase_type, purchase_capi_route, purchase_capi_route_reason,
  client_ip, agent_user, device_type, event_source_url,
  estado, valor, currency, workspace_resolution_source,
  contact_status_capi, lead_status_capi, registration_status_capi, purchase_status_capi,
  observaciones,
  external_id, utm_campaign, telefono_asignado,
  assigned_gerencia_id, assigned_gerencia_external_id, assigned_gerencia_name, assigned_gerencia_label,
  lead_bot_phone, lead_player_username, lead_agency_id, lead_gerencia_id, lead_gerencia_external_id, lead_gerencia_name, lead_gerencia_label,
  lead_incoming_promo_code, lead_atrio_id, lead_atrio_players_id, lead_attribution_status, lead_attribution_conversion_id,
  registration_event_id, registration_event_time, registration_payload_raw, registration_player_username,
  registration_bot_phone, registration_agency_id, registration_gerencia_id, registration_gerencia_external_id,
  registration_gerencia_name, registration_gerencia_label, registration_incoming_promo_code, registration_atrio_id, registration_atrio_players_id,
  registration_attribution_status, registration_attribution_conversion_id,
  purchase_bot_phone, purchase_player_username, purchase_agency_id, purchase_gerencia_id, purchase_gerencia_external_id, purchase_gerencia_name, purchase_gerencia_label,
  purchase_incoming_promo_code, purchase_atrio_id, purchase_atrio_players_id, purchase_attribution_status, purchase_attribution_conversion_id,
  promo_code,
  geo_city, geo_region, geo_country,
  created_at
`.replace(/\s+/g, " ").trim();

type ConversionQueryScope = {
  userId?: string;
};

async function fetchConversionPageInternal({
  userId,
  limit,
  offset,
}: ConversionQueryScope & {
  limit: number;
  offset: number;
}): Promise<ConversionRow[]> {
  let query = supabase
    .from("conversions")
    .select(CONVERSIONS_SELECT);
  if (userId !== undefined) query = query.eq("user_id", userId);

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return (data ?? []) as unknown as ConversionRow[];
}

async function fetchConversionRowsInternal({
  userId,
  limit,
  range,
  visibleFrom,
}: ConversionQueryScope & {
  limit?: number;
  range?: FetchDateRange;
  visibleFrom?: Date | string | null;
}): Promise<ConversionRow[]> {
  const pageSize = 1000;
  const rows: ConversionRow[] = [];
  const startIso = latestIso(range?.start, visibleFrom);
  const endIso = toIsoIfValid(range?.end);
  let offset = 0;

  while (true) {
    let query = supabase
      .from("conversions")
      .select(CONVERSIONS_SELECT);
    if (userId !== undefined) query = query.eq("user_id", userId);
    query = query.order("created_at", { ascending: false });
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

  return rows;
}

async function excludeHiddenConversions(
  rows: ConversionRow[],
  hiddenBy: string,
): Promise<ConversionRow[]> {
  const hiddenIds = await fetchHiddenConversionIds(
    hiddenBy,
    rows.map((row) => row.id),
  );
  return rows.filter((row) => !hiddenIds.has(row.id));
}

export async function fetchConversions(
  userId: string,
  limit = 200,
  offset = 0,
): Promise<ConversionRow[]> {
  return fetchConversionPageInternal({ userId, limit, offset });
}

export async function fetchConversionsForAdmin(
  limit = 500,
  offset = 0,
): Promise<ConversionRow[]> {
  return fetchConversionPageInternal({ limit, offset });
}

/** Fetch conversions sin excluir hidden_conversions. Se usa para reportes historicos/operativos. */
export async function fetchConversionsUnfiltered(
  userId: string,
  range?: FetchDateRange,
): Promise<ConversionRow[]> {
  return fetchConversionRowsInternal({ userId, range });
}

/** Fetch admin sin excluir hidden_conversions. */
export async function fetchConversionsForAdminUnfiltered(
  range?: FetchDateRange,
): Promise<ConversionRow[]> {
  return fetchConversionRowsInternal({ range });
}

/** Fetch conversions excluyendo los ocultos por hiddenBy. */
export async function fetchConversionsFiltered(
  userId: string,
  hiddenBy: string,
  limit?: number,
  range?: FetchDateRange,
): Promise<ConversionRow[]> {
  const visibleFrom = await fetchConversionViewVisibleFrom(hiddenBy);
  const rows = await fetchConversionRowsInternal({
    userId,
    limit,
    range,
    visibleFrom,
  });
  return excludeHiddenConversions(rows, hiddenBy);
}

/** Fetch conversions for admin excluyendo los ocultos por hiddenBy. */
export async function fetchConversionsForAdminFiltered(
  hiddenBy: string,
  limit?: number,
  range?: FetchDateRange,
): Promise<ConversionRow[]> {
  const visibleFrom = await fetchConversionViewVisibleFrom(hiddenBy);
  const rows = await fetchConversionRowsInternal({
    limit,
    range,
    visibleFrom,
  });
  return excludeHiddenConversions(rows, hiddenBy);
}

// Funnel contacts (aggregated by phone + agency/bot, with player username as display/fallback)

function derivePurchaseType(row: ConversionRow): "first" | "repeat" | null {
  if (!row.purchase_event_id) return null;
  if (row.purchase_type === "first" || row.purchase_type === "repeat") return row.purchase_type;
  return (row.observaciones ?? "").includes("REPEAT") ? "repeat" : "first";
}

export function buildFunnelContactsFromConversions(rows: ConversionRow[]): FunnelContact[] {
  const cleanText = (value: unknown): string => String(value ?? "").trim();
  const cleanDigits = (value: unknown): string => cleanText(value).replace(/\D/g, "");
  const stageContextKey = (row: ConversionRow): string => {
    const purchaseKey = cleanText(row.purchase_agency_id) ||
      cleanText(row.purchase_gerencia_external_id) ||
      cleanText(row.purchase_gerencia_id) ||
      cleanText(row.purchase_bot_phone) ||
      cleanText(row.purchase_gerencia_label);
    const registrationKey = cleanText(row.registration_agency_id) ||
      cleanText(row.registration_gerencia_external_id) ||
      cleanText(row.registration_gerencia_id) ||
      cleanText(row.registration_bot_phone) ||
      cleanText(row.registration_gerencia_label);
    const leadKey = cleanText(row.lead_agency_id) ||
      cleanText(row.lead_gerencia_external_id) ||
      cleanText(row.lead_gerencia_id) ||
      cleanText(row.lead_bot_phone) ||
      cleanText(row.lead_gerencia_label);
    const assignedKey = cleanText(row.assigned_gerencia_external_id) ||
      cleanText(row.assigned_gerencia_id) ||
      cleanText(row.telefono_asignado) ||
      cleanText(row.assigned_gerencia_label);
    return purchaseKey || registrationKey || leadKey || assignedKey || "__sin_gerencia__";
  };
  const stagePlayerFallbackKey = (row: ConversionRow): string => {
    const username = String(
      row.purchase_player_username ||
      row.registration_player_username ||
      row.lead_player_username ||
      "",
    ).trim();
    return username || row.external_id || row.id || row.created_at;
  };
  const stageScopedPlayerKey = (row: ConversionRow): string => {
    const phone = cleanDigits(row.phone);
    const context = stageContextKey(row);
    if (phone && context) return `phone:${phone}::context:${context.toLowerCase()}`;
    if (phone) return `phone:${phone}`;
    return `fallback:${stagePlayerFallbackKey(row).toLowerCase()}`;
  };
  const displayPlayerUsername = (groupRows: ConversionRow[]): string | null => {
    const latestUsername = [...groupRows].reverse()
      .map((row) => String(
        row.purchase_player_username ||
        row.registration_player_username ||
        row.lead_player_username ||
        "",
      ).trim())
      .find(Boolean);
    return latestUsername || null;
  };

  const grouped = new Map<string, ConversionRow[]>();
  for (const row of rows) {
    // Excluir eventos de prueba para no ensuciar el funnel.
    if (String(row.test_event_code ?? "").trim()) continue;
    const key = `${row.user_id}::${stageScopedPlayerKey(row)}`;
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
    const stagePhone = currentStatus === "purchase"
      ? String(latest.purchase_bot_phone ?? "").trim()
      : String(latest.registration_bot_phone ?? "").trim() ||
        (currentStatus === "lead"
          ? String(latest.lead_bot_phone ?? "").trim()
          : "");
    const assignedPhone = stagePhone ||
      ([...sorted].reverse().find((r) => String(r.telefono_asignado ?? "").trim())?.telefono_asignado ?? null);
    const stageGerenciaLabel = currentStatus === "purchase"
      ? String(latest.purchase_gerencia_label ?? "").trim()
      : String(latest.registration_gerencia_label ?? "").trim() ||
        (currentStatus === "lead"
          ? String(latest.lead_gerencia_label ?? "").trim()
          : "");
    const assignedGerenciaLabel = stageGerenciaLabel ||
      ([...sorted].reverse().find((r) => String(r.assigned_gerencia_label ?? "").trim())?.assigned_gerencia_label ?? null);

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
      assigned_gerencia_label: assignedGerenciaLabel,
      player_username: displayPlayerUsername(sorted),
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
  "id, user_id, conversion_id, conversions(internal_id), workspace_currency, function_name, level, message, detail, payload_received, result, payload_meta, response_meta, created_at";
const INBOX_SELECT =
  "id, user_id, conversion_id, conversions(internal_id), workspace_currency, landing_name, action, action_event_id, coelsa_id, transaction_id, promo_code, phone, payload_raw, status, http_status, response_body, processed_at, created_at";

function normalizeLogRows(rows: unknown[]): ConversionLogRow[] {
  return rows.map((row) => {
    const record = row as ConversionLogRow & {
      conversions?: { internal_id?: number | string | null } | Array<{ internal_id?: number | string | null }> | null;
    };
    const joined = Array.isArray(record.conversions) ? record.conversions[0] : record.conversions;
    const rawInternalId = joined?.internal_id;
    const internalId = rawInternalId == null ? null : Number(rawInternalId);
    const { conversions: _conversions, ...clean } = record;
    return {
      ...clean,
      conversion_internal_id: Number.isFinite(internalId) ? internalId : null,
    };
  });
}

function normalizeInboxRows(rows: unknown[]): ConversionInboxRow[] {
  return rows.map((row) => {
    const record = row as ConversionInboxRow & {
      conversions?: { internal_id?: number | string | null } | Array<{ internal_id?: number | string | null }> | null;
    };
    const joined = Array.isArray(record.conversions) ? record.conversions[0] : record.conversions;
    const rawInternalId = joined?.internal_id;
    const internalId = rawInternalId == null ? null : Number(rawInternalId);
    const { conversions: _conversions, ...clean } = record;
    return {
      ...clean,
      conversion_internal_id: Number.isFinite(internalId) ? internalId : null,
    };
  });
}

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

async function fetchConversionLogsInternal({
  userId,
  limit,
  offset,
  range,
  direction,
  eventType,
  workspaceCurrency,
}: ConversionQueryScope & {
  limit: number;
  offset: number;
  range?: FetchDateRange | null;
  direction?: ConversionLogDirectionFilter;
  eventType?: ConversionLogEventFilter;
  workspaceCurrency?: ReportingCurrency | null;
}): Promise<ConversionLogRow[]> {
  let query = supabase
    .from("conversion_logs")
    .select(LOGS_SELECT);
  if (userId !== undefined) query = query.eq("user_id", userId);
  if (workspaceCurrency) query = query.eq("workspace_currency", workspaceCurrency);

  const start = toIsoIfValid(range?.start);
  const end = toIsoIfValid(range?.end);
  if (start) query = query.gte("created_at", start);
  if (end) query = query.lt("created_at", end);

  const logFilter = buildConversionLogQueryFilter(direction, eventType);
  if (logFilter.requireReceivedPayload) {
    query = query.neq("payload_received", "");
  }
  if (logFilter.requireMetaPayload) {
    query = query.neq("payload_meta", "");
  }
  if (logFilter.orExpression) {
    query = query.or(logFilter.orExpression);
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;
  return arrangeLogsForUi(normalizeLogRows(data ?? []));
}

async function fetchVisibleConversionLogs({
  userId,
  hiddenBy,
  limit,
  offset,
  range,
  direction,
  eventType,
  workspaceCurrency,
}: ConversionQueryScope & {
  hiddenBy: string;
  limit: number;
  offset: number;
  range?: FetchDateRange | null;
  direction?: ConversionLogDirectionFilter;
  eventType?: ConversionLogEventFilter;
  workspaceCurrency?: ReportingCurrency | null;
}): Promise<ConversionLogRow[]> {
  const visibleFrom = await fetchConversionViewVisibleFrom(hiddenBy);
  const effectiveRange: FetchDateRange = {
    ...range,
    start: latestIso(range?.start, visibleFrom),
  };
  const rows = await fetchConversionLogsInternal({
    userId,
    limit,
    offset,
    range: effectiveRange,
    direction,
    eventType,
    workspaceCurrency,
  });
  const hiddenIds = await fetchHiddenConversionLogIds(
    hiddenBy,
    rows.map((row) => row.id),
  );
  return rows.filter((row) => !hiddenIds.has(row.id));
}

export async function fetchConversionLogs(
  userId: string,
  limit = 200,
  offset = 0,
  range?: FetchDateRange | null,
  workspaceCurrency?: ReportingCurrency | null,
): Promise<ConversionLogRow[]> {
  return fetchConversionLogsInternal({ userId, limit, offset, range, workspaceCurrency });
}

export async function fetchConversionLogsFiltered(
  userId: string,
  hiddenBy: string,
  limit = 200,
  offset = 0,
  range?: FetchDateRange | null,
  filters: {
    direction?: ConversionLogDirectionFilter;
    eventType?: ConversionLogEventFilter;
    workspaceCurrency?: ReportingCurrency | null;
  } = {},
): Promise<ConversionLogRow[]> {
  return fetchVisibleConversionLogs({
    userId,
    hiddenBy,
    limit,
    offset,
    range,
    direction: filters.direction,
    eventType: filters.eventType,
    workspaceCurrency: filters.workspaceCurrency,
  });
}

export async function fetchConversionLogsForAdmin(
  limit = 200,
  offset = 0,
  range?: FetchDateRange | null,
  workspaceCurrency?: ReportingCurrency | null,
): Promise<ConversionLogRow[]> {
  return fetchConversionLogsInternal({ limit, offset, range, workspaceCurrency });
}

export async function fetchConversionLogsForAdminFiltered(
  hiddenBy: string,
  limit = 200,
  offset = 0,
  filters: {
    direction?: ConversionLogDirectionFilter;
    eventType?: ConversionLogEventFilter;
    workspaceCurrency?: ReportingCurrency | null;
  } = {},
): Promise<ConversionLogRow[]> {
  return fetchVisibleConversionLogs({
    hiddenBy,
    limit,
    offset,
    direction: filters.direction,
    eventType: filters.eventType,
    workspaceCurrency: filters.workspaceCurrency,
  });
}

export async function fetchConversionInbox(
  userId: string,
  hiddenBy: string,
  limit = 300,
  offset = 0,
  workspaceCurrency?: ReportingCurrency | null,
): Promise<ConversionInboxRow[]> {
  const visibleFrom = await fetchConversionViewVisibleFrom(hiddenBy);
  let query = supabase
    .from("conversion_inbox")
    .select(INBOX_SELECT)
    .eq("user_id", userId);
  if (workspaceCurrency) query = query.eq("workspace_currency", workspaceCurrency);
  if (visibleFrom) query = query.gte("created_at", visibleFrom);
  const { data, error } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  const rows = normalizeInboxRows(data ?? []);
  const hiddenIds = await fetchHiddenConversionInboxIds(
    hiddenBy,
    rows.map((row) => row.id),
  );
  return rows.filter((row) => !hiddenIds.has(row.id));
}

export async function fetchConversionInboxFiltered(
  userId: string,
  hiddenBy: string,
  options: {
    limit?: number;
    offset?: number;
    range?: FetchDateRange | null;
    action?: "all" | "CONTACT" | "LEAD" | "COMPLETEREGISTRATION" | "PURCHASE";
    search?: string;
    workspaceCurrency?: ReportingCurrency | null;
  } = {},
): Promise<ConversionInboxRow[]> {
  const limit = options.limit ?? 400;
  const offset = options.offset ?? 0;
  const visibleFrom = await fetchConversionViewVisibleFrom(hiddenBy);
  let query = supabase
    .from("conversion_inbox")
    .select(INBOX_SELECT)
    .eq("user_id", userId);
  if (options.workspaceCurrency) {
    query = query.eq("workspace_currency", options.workspaceCurrency);
  }

  const start = latestIso(options.range?.start, visibleFrom);
  const end = toIsoIfValid(options.range?.end);
  if (start) query = query.gte("created_at", start);
  if (end) query = query.lt("created_at", end);

  const action = options.action && options.action !== "all" ? options.action : "";
  if (action) query = query.eq("action", action);

  const search = String(options.search ?? "").trim();
  if (search) {
    const term = search.replace(/[%_]/g, "\\$&");
    const like = `%${term}%`;
    query = query.or([
      `action.ilike.${like}`,
      `status.ilike.${like}`,
      `promo_code.ilike.${like}`,
      `coelsa_id.ilike.${like}`,
      `transaction_id.ilike.${like}`,
      `phone.ilike.${like}`,
      `action_event_id.ilike.${like}`,
      `response_body.ilike.${like}`,
      `landing_name.ilike.${like}`,
      `payload_raw.ilike.${like}`,
    ].join(","));
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  const rows = normalizeInboxRows(data ?? []);
  const hiddenIds = await fetchHiddenConversionInboxIds(
    hiddenBy,
    rows.map((row) => row.id),
  );
  return rows.filter((row) => !hiddenIds.has(row.id));
}

export async function fetchConversionsConfigForUser(
  userId: string,
): Promise<ConversionsConfig> {
  return fetchConversionsConfig(userId);
}

export function getPremiumThreshold(
  config: Pick<ConversionsConfig, "funnel_premium_threshold" | "funnel_premium_thresholds"> | null | undefined,
  currency: ReportingCurrency,
): number {
  const scoped = Number(config?.funnel_premium_thresholds?.[currency]);
  if (Number.isFinite(scoped) && scoped >= 0) return scoped;
  const legacy = Number(config?.funnel_premium_threshold);
  return Number.isFinite(legacy) && legacy >= 0 ? legacy : 50000;
}

export function setPremiumThreshold(
  config: ConversionsConfig,
  currency: ReportingCurrency,
  value: number,
): ConversionsConfig {
  const normalized = Number.isFinite(value) && value >= 0 ? value : 0;
  return {
    ...config,
    funnel_premium_threshold: currency === "ARS"
      ? normalized
      : config.funnel_premium_threshold,
    funnel_premium_thresholds: {
      ...(config.funnel_premium_thresholds ?? {
        ARS: config.funnel_premium_threshold,
      }),
      [currency]: normalized,
    },
  };
}

export function getTrackingRankingConfig(
  config: Pick<ConversionsConfig, "tracking_ranking_config" | "tracking_ranking_configs"> | null | undefined,
  currency: ReportingCurrency,
): TrackingRankingConfig | null {
  return config?.tracking_ranking_configs?.[currency] ??
    (currency === "ARS" ? config?.tracking_ranking_config ?? null : null);
}

export function setTrackingRankingConfig(
  config: ConversionsConfig,
  currency: ReportingCurrency,
  value: TrackingRankingConfig,
): ConversionsConfig {
  return {
    ...config,
    tracking_ranking_config: currency === "ARS"
      ? value
      : config.tracking_ranking_config,
    tracking_ranking_configs: {
      ...(config.tracking_ranking_configs ?? (
        config.tracking_ranking_config
          ? { ARS: config.tracking_ranking_config }
          : {}
      )),
      [currency]: value,
    },
  };
}

export async function fetchHomeOverviewStats(
  userId: string,
  currency: ReportingCurrency = "ARS",
): Promise<HomeOverviewStats> {
  const { data, error } = await supabase.rpc("get_home_overview_stats_by_currency", {
    p_user_id: userId,
    p_hidden_by: userId,
    p_currency: currency,
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

type GerenciaAvailabilitySummaryRaw = {
  gerencia_id: number | string | null;
  gerencia_external_id: number | string | null;
  label: string | null;
  sample_count: number | string | null;
  active_sample_count: number | string | null;
  availability_pct: number | string | null;
};

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

async function fetchGerenciaAvailabilitySummariesInternal(
  range: FetchDateRange,
  userId?: string,
  workspaceCurrency?: ReportingCurrency | string | null,
): Promise<GerenciaAvailabilitySummary[]> {
  const startIso = toIsoIfValid(range.start);
  const endIso = toIsoIfValid(range.end);
  const workspace = String(workspaceCurrency ?? "").trim().toUpperCase();

  const { data: summaryData, error: summaryError } = await supabase.rpc(
    "get_gerencia_availability_summaries",
    {
      p_user_id: userId ?? null,
      p_start: startIso ?? null,
      p_end: endIso ?? null,
      p_workspace_currency: workspace || null,
    },
  );
  if (!summaryError) {
    return ((summaryData ?? []) as unknown as GerenciaAvailabilitySummaryRaw[])
      .map((row) => ({
        gerenciaId: nullableNumber(row.gerencia_id),
        gerenciaExternalId: nullableNumber(row.gerencia_external_id),
        label: String(row.label ?? "").trim(),
        sampleCount: Number(row.sample_count ?? 0),
        activeSampleCount: Number(row.active_sample_count ?? 0),
        availabilityPct: row.availability_pct === null ? null : Number(row.availability_pct),
      }))
      .filter((row) => row.label);
  }

  throw summaryError;
}

export async function fetchGerenciaAvailabilitySummaries(
  userId: string,
  range: FetchDateRange,
  workspaceCurrency?: ReportingCurrency | string | null,
): Promise<GerenciaAvailabilitySummary[]> {
  return fetchGerenciaAvailabilitySummariesInternal(range, userId, workspaceCurrency);
}

export async function fetchGerenciaAvailabilitySummariesForAdmin(
  range: FetchDateRange,
  workspaceCurrency?: ReportingCurrency | string | null,
): Promise<GerenciaAvailabilitySummary[]> {
  return fetchGerenciaAvailabilitySummariesInternal(range, undefined, workspaceCurrency);
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

function chunkValues<T>(values: T[], size = 100): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

export async function fetchHiddenConversionIds(
  hiddenBy: string,
  conversionIds?: string[],
): Promise<Set<string>> {
  const candidates = conversionIds
    ? Array.from(new Set(conversionIds.filter(Boolean)))
    : null;
  if (candidates?.length === 0) return new Set();
  const batches = candidates ? chunkValues(candidates) : [null];
  const responses = await Promise.all(
    batches.map((batch) => {
      let query = supabase
        .from("hidden_conversions")
        .select("conversion_id")
        .eq("hidden_by", hiddenBy);
      if (batch) query = query.in("conversion_id", batch);
      return query;
    }),
  );
  const hidden = new Set<string>();
  for (const { data, error } of responses) {
    if (error) throw error;
    for (const row of data ?? []) hidden.add(row.conversion_id);
  }
  return hidden;
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
  logIds?: number[],
): Promise<Set<number>> {
  const candidates = logIds
    ? Array.from(new Set(logIds.filter(Number.isFinite)))
    : null;
  if (candidates?.length === 0) return new Set();
  const batches = candidates ? chunkValues(candidates) : [null];
  const responses = await Promise.all(
    batches.map((batch) => {
      let query = supabase
        .from("hidden_conversion_logs")
        .select("log_id")
        .eq("hidden_by", hiddenBy);
      if (batch) query = query.in("log_id", batch);
      return query;
    }),
  );
  const hidden = new Set<number>();
  for (const { data, error } of responses) {
    if (error) throw error;
    for (const row of data ?? []) hidden.add(Number(row.log_id));
  }
  return hidden;
}

export async function fetchHiddenConversionInboxIds(
  hiddenBy: string,
  inboxIds?: string[],
): Promise<Set<string>> {
  const candidates = inboxIds
    ? Array.from(new Set(inboxIds.filter(Boolean)))
    : null;
  if (candidates?.length === 0) return new Set();
  const batches = candidates ? chunkValues(candidates) : [null];
  const responses = await Promise.all(
    batches.map((batch) => {
      let query = supabase
        .from("hidden_conversion_inbox")
        .select("inbox_id")
        .eq("hidden_by", hiddenBy);
      if (batch) query = query.in("inbox_id", batch);
      return query;
    }),
  );
  const hidden = new Set<string>();
  for (const { data, error } of responses) {
    if (error) throw error;
    for (const row of data ?? []) {
      const id = String(row.inbox_id ?? "").trim();
      if (id) hidden.add(id);
    }
  }
  return hidden;
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
