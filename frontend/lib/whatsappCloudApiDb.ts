import { supabase } from "@/lib/supabaseClient";
import type { PhoneKind } from "@/lib/landing/types";

export interface WhatsappCloudApiConfig {
  id: string;
  user_id: string;
  name: string;
  active: boolean;
  workspace_currency: "ARS" | "PYG";
  phone_number_id: string;
  whatsapp_business_account_id: string;
  display_phone_number: string;
  meta_access_token: string;
  meta_app_secret: string;
  has_meta_access_token: boolean;
  has_meta_app_secret: boolean;
  meta_api_version: string;
  webhook_verify_token: string;
  meta_messaging_dataset_id: string;
  enrich_business_messaging_user_data: boolean;
  landing_tag: string;
  gerencia_selection_mode: "weighted_random" | "fair";
  gerencia_fair_criterion: "usage_count" | "messages_received";
  send_contact_capi: boolean;
  redirect_message_template: string;
  fallback_message_template: string;
  redirect_use_cta_button: boolean;
  redirect_cta_button_title: string;
  phone_number_status: string;
  quality_rating: string;
  messaging_limit_tier: string;
  health_checked_at: string | null;
  health_last_error: string;
  created_at: string;
  updated_at: string;
}

export interface WhatsappCloudApiAssignment {
  gerencia_id: number;
  weight: number;
  phoneMode: "random" | "fair";
  phoneKind: PhoneKind;
  intervalStartHour: number | null;
  intervalEndHour: number | null;
}

export type WhatsappCloudApiLogKind =
  "request" | "webhook" | "assignment" | "outbound" | "meta_capi";

export interface WhatsappCloudApiLogEntry {
  id: string;
  kind: WhatsappCloudApiLogKind;
  direction: "meta_to_us" | "us_to_meta" | "us_to_whatsapp" | "internal";
  meta_event_name: string;
  label: string;
  status: string;
  created_at: string;
  config_id: string | null;
  config_name: string;
  phone: string;
  phone_number_id: string;
  meta_message_id: string;
  promo_code: string;
  gerencia: string;
  attempts: number | null;
  error: string;
  payload: Record<string, unknown> | null;
}

export interface WhatsappCloudApiInboxMessage {
  created_at: string;
  direction: "inbound" | "outbound";
  body: string;
  status: string;
  meta_message_id: string;
  message_type: string;
  button_title: string;
  button_url: string;
  error: string;
}

export interface WhatsappCloudApiInboxThread {
  contact_id: string;
  config_id: string;
  config_name: string;
  user_id: string;
  wa_id: string;
  phone: string;
  profile_name: string;
  first_message_at: string | null;
  last_message_at: string | null;
  last_message_text: string;
  last_message_direction: string;
  last_message_status: string;
  assigned_phone: string;
  assigned_gerencia_id: number | null;
  assigned_gerencia_label: string;
  promo_code: string;
  ctwa_clid: string;
  source_url: string;
  source_type: string;
  headline: string;
  conversion_id: string | null;
  lead_count: number;
  purchase_count: number;
  repeat_purchase_count: number;
  total_loaded: number;
  last_purchase_at: string | null;
  tag: "nuevo" | "contacto" | "lead" | "cargo" | "recompra" | "premium";
  redirect_clicked: boolean;
  redirect_click_count: number;
  redirect_last_clicked_at: string | null;
  unread_count: number;
  unread_last_message_at: string | null;
  messages: WhatsappCloudApiInboxMessage[];
}

export interface WhatsappCloudApiContactsPageRow {
  contact_id: string;
  config_id: string;
  config_name: string;
  wa_id: string;
  phone: string;
  profile_name: string;
  last_message_at: string | null;
  tag: WhatsappCloudApiInboxThread["tag"];
  total_contacts: number;
}

export async function fetchWhatsappCloudApiConfig(
  userId: string,
  workspaceCurrency: "ARS" | "PYG",
): Promise<WhatsappCloudApiConfig | null> {
  const { data, error } = await supabase.rpc("get_whatsapp_cloud_api_config", {
    p_user_id: userId,
    p_workspace_currency: workspaceCurrency,
  });
  if (error) throw error;
  const rows = Array.isArray(data) ? data : [];
  return (rows[0] ?? null) as WhatsappCloudApiConfig | null;
}

export async function upsertWhatsappCloudApiConfig(input: {
  id?: string | null;
  user_id: string;
  name: string;
  active: boolean;
  workspace_currency: "ARS" | "PYG";
  phone_number_id: string;
  whatsapp_business_account_id: string;
  display_phone_number: string;
  meta_access_token: string | null;
  meta_app_secret: string | null;
  meta_api_version: string;
  webhook_verify_token: string;
  meta_messaging_dataset_id: string;
  enrich_business_messaging_user_data: boolean;
  landing_tag: string;
  gerencia_selection_mode: "weighted_random" | "fair";
  gerencia_fair_criterion: "usage_count" | "messages_received";
  send_contact_capi: boolean;
  redirect_message_template: string;
  fallback_message_template: string;
  redirect_use_cta_button: boolean;
  redirect_cta_button_title: string;
}): Promise<{ id: string }> {
  const { data, error } = await supabase.rpc(
    "upsert_whatsapp_cloud_api_config_secure",
    {
      p_id: input.id ?? null,
      p_user_id: input.user_id,
      p_name: input.name,
      p_active: input.active,
      p_workspace_currency: input.workspace_currency,
      p_phone_number_id: input.phone_number_id,
      p_whatsapp_business_account_id: input.whatsapp_business_account_id,
      p_display_phone_number: input.display_phone_number,
      p_meta_access_token: input.meta_access_token,
      p_meta_app_secret: input.meta_app_secret,
      p_meta_api_version: input.meta_api_version,
      p_webhook_verify_token: input.webhook_verify_token,
      p_meta_messaging_dataset_id: input.meta_messaging_dataset_id,
      p_enrich_business_messaging_user_data:
        input.enrich_business_messaging_user_data,
      p_landing_tag: input.landing_tag,
      p_gerencia_selection_mode: input.gerencia_selection_mode,
      p_gerencia_fair_criterion: input.gerencia_fair_criterion,
      p_redirect_message_template: input.redirect_message_template,
      p_fallback_message_template: input.fallback_message_template,
      p_redirect_use_cta_button: input.redirect_use_cta_button,
      p_redirect_cta_button_title: input.redirect_cta_button_title,
    },
  );
  if (error) throw error;
  if (!data) throw new Error("No se pudo guardar WhatsApp Cloud API.");
  return { id: String(data) };
}

export async function ensureWhatsappCloudApiDataset(input: {
  config_id?: string | null;
  user_id: string;
  whatsapp_business_account_id: string;
  meta_access_token: string | null;
  meta_api_version: string;
  force_create?: boolean;
}): Promise<{ dataset_id: string; source: "stored" | "meta_existing" | "meta_ensure" | "" }> {
  const { data, error } = await supabase.functions.invoke(
    "whatsapp-cloud-ensure-dataset",
    {
      body: {
        config_id: input.config_id ?? null,
        user_id: input.user_id,
        whatsapp_business_account_id: input.whatsapp_business_account_id,
        meta_access_token: input.meta_access_token,
        meta_api_version: input.meta_api_version,
        force_create: input.force_create ?? false,
      },
    },
  );
  if (error) throw error;
  const datasetId = String(
    (data as { dataset_id?: unknown } | null)?.dataset_id ?? "",
  ).replace(/\D/g, "");
  if (!datasetId) throw new Error("Meta no devolvio Dataset ID.");
  const source = String((data as { source?: unknown } | null)?.source ?? "");
  return {
    dataset_id: datasetId,
    source: ["stored", "meta_existing", "meta_ensure"].includes(source)
      ? (source as "stored" | "meta_existing" | "meta_ensure")
      : "",
  };
}

export async function syncWhatsappCloudApiHealth(
  configId: string,
): Promise<void> {
  const { error } = await supabase.functions.invoke(
    "whatsapp-cloud-sync-health",
    {
      body: { config_id: configId },
    },
  );
  if (error) throw error;
}

export async function fetchWhatsappCloudApiAssignments(
  configId: string,
): Promise<WhatsappCloudApiAssignment[]> {
  const { data, error } = await supabase
    .from("whatsapp_cloud_api_gerencias")
    .select(
      "gerencia_id, weight, phone_mode, phone_kind, interval_start_hour, interval_end_hour",
    )
    .eq("config_id", configId);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    gerencia_id: Number(row.gerencia_id),
    weight: Number(row.weight) || 0,
    phoneMode: (row.phone_mode as "random" | "fair") ?? "random",
    phoneKind: (row.phone_kind as PhoneKind) ?? "carga",
    intervalStartHour: row.interval_start_hour ?? null,
    intervalEndHour: row.interval_end_hour ?? null,
  }));
}

export async function setWhatsappCloudApiAssignments(
  configId: string,
  userId: string,
  assignments: WhatsappCloudApiAssignment[],
): Promise<void> {
  const { error: deleteError } = await supabase
    .from("whatsapp_cloud_api_gerencias")
    .delete()
    .eq("config_id", configId);
  if (deleteError) throw deleteError;

  if (assignments.length === 0) return;
  const rows = assignments.map((assignment) => ({
    config_id: configId,
    user_id: userId,
    gerencia_id: assignment.gerencia_id,
    weight: assignment.weight,
    phone_mode: assignment.phoneMode,
    phone_kind: assignment.phoneKind,
    interval_start_hour: assignment.intervalStartHour,
    interval_end_hour: assignment.intervalEndHour,
  }));
  const { error } = await supabase
    .from("whatsapp_cloud_api_gerencias")
    .insert(rows);
  if (error) throw error;
}

export async function fetchWhatsappCloudApiRecentEvents(
  configId: string,
): Promise<
  Array<{
    id: string;
    event_type: string;
    status: string;
    meta_message_id: string;
    received_at: string;
    last_error: string;
  }>
> {
  const { data, error } = await supabase
    .from("whatsapp_cloud_api_webhook_events")
    .select("id,event_type,status,meta_message_id,received_at,last_error")
    .eq("config_id", configId)
    .order("received_at", { ascending: false })
    .limit(8);
  if (error) throw error;
  return (data ?? []) as Array<{
    id: string;
    event_type: string;
    status: string;
    meta_message_id: string;
    received_at: string;
    last_error: string;
  }>;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value))
      return String(value);
  }
  return "";
}

export function formatWhatsappCloudApiError(
  error: unknown,
  fallback: string,
): string {
  const record = asRecord(error);
  const code = firstString(record?.code, record?.status);
  const message = firstString(
    record?.message,
    record?.error_description,
    record?.error,
    error instanceof Error ? error.message : "",
  );
  const details = firstString(record?.details);
  const hint = firstString(record?.hint);
  const parts = [
    fallback,
    code ? `[${code}]` : "",
    message,
    details ? `Detalle: ${details}` : "",
    hint ? `Hint: ${hint}` : "",
  ].filter(Boolean);
  return parts.join(" ");
}

export function logWhatsappCloudApiError(
  context: string,
  error: unknown,
  meta: Record<string, unknown> = {},
): void {
  console.error(`[whatsapp-cloud-api] ${context}`, {
    ...meta,
    error,
    formatted: formatWhatsappCloudApiError(error, "Error WhatsApp Cloud API."),
  });
}

async function rpcSessionState(): Promise<{
  hasSession: boolean;
  hasAccessToken: boolean;
  userId: string;
}> {
  const { data, error } = await supabase.auth.getSession();
  return {
    hasSession: Boolean(data.session),
    hasAccessToken: Boolean(data.session?.access_token),
    userId: data.session?.user?.id ?? firstString(asRecord(error)?.message),
  };
}

function readPayloadPhone(payload: Record<string, unknown> | null): string {
  const entry = Array.isArray(payload?.entry)
    ? asRecord(payload.entry[0])
    : null;
  const changes = Array.isArray(entry?.changes)
    ? asRecord(entry.changes[0])
    : null;
  const value = asRecord(changes?.value);
  const contacts = Array.isArray(value?.contacts)
    ? asRecord(value.contacts[0])
    : null;
  const messages = Array.isArray(value?.messages)
    ? asRecord(value.messages[0])
    : null;
  return firstString(messages?.from, contacts?.wa_id);
}

function parseJsonRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    return asRecord(JSON.parse(value));
  } catch {
    return null;
  }
}

function readMetaEventName(payload: Record<string, unknown> | null): string {
  const data = Array.isArray(payload?.data) ? asRecord(payload.data[0]) : null;
  return firstString(data?.event_name);
}

function readMetaResponseId(payload: Record<string, unknown> | null): string {
  return firstString(payload?.fbtrace_id);
}

export async function fetchWhatsappCloudApiLogs(input: {
  userId: string;
  isAdmin: boolean;
  workspaceCurrency: "ARS" | "PYG";
  limit?: number;
}): Promise<WhatsappCloudApiLogEntry[]> {
  const limit = input.limit ?? 40;
  const configsQuery = supabase
    .from("whatsapp_cloud_api_configs")
    .select("id,name,display_phone_number")
    .eq("workspace_currency", input.workspaceCurrency);
  if (!input.isAdmin) configsQuery.eq("user_id", input.userId);
  const { data: configRows, error: configError } = await configsQuery;
  if (configError) throw configError;

  const configNames = new Map<string, string>();
  const configIds = (configRows ?? []).map((row) => {
    const id = String(row.id);
    const displayPhone = firstString(row.display_phone_number);
    configNames.set(
      id,
      displayPhone ? `${row.name} (${displayPhone})` : String(row.name ?? ""),
    );
    return id;
  });
  if (configIds.length === 0) return [];

  const webhookQuery = supabase
    .from("whatsapp_cloud_api_webhook_events")
    .select(
      "id,config_id,user_id,event_type,status,phone_number_id,meta_message_id,meta_status_id,payload,attempts,received_at,processed_at,last_error",
    )
    .in("config_id", configIds)
    .order("received_at", { ascending: false })
    .limit(limit);
  if (!input.isAdmin) webhookQuery.eq("user_id", input.userId);

  const assignmentQuery = supabase
    .from("whatsapp_cloud_api_assignments")
    .select(
      "id,config_id,user_id,assigned_phone,assigned_gerencia_id,assigned_gerencia_label,promo_code,redirect_message_id,status,last_error,created_at,redirect_sent_at",
    )
    .in("config_id", configIds)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (!input.isAdmin) assignmentQuery.eq("user_id", input.userId);

  const outboundQuery = supabase
    .from("whatsapp_cloud_api_outbound_messages")
    .select(
      "id,config_id,user_id,assignment_id,meta_message_id,recipient_wa_id,message_type,status,payload,response,last_error,created_at,sent_at",
    )
    .in("config_id", configIds)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (!input.isAdmin) outboundQuery.eq("user_id", input.userId);

  const requestLogQuery = supabase
    .from("whatsapp_cloud_api_webhook_request_logs")
    .select(
      "id,config_id,user_id,request_status,reason,http_status,phone_number_id,whatsapp_business_account_id,payload,error,created_at",
    )
    .eq("workspace_currency", input.workspaceCurrency)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (!input.isAdmin) requestLogQuery.eq("user_id", input.userId);

  const [
    webhookResult,
    assignmentResult,
    outboundResult,
    requestLogResult,
  ] =
    await Promise.all([
      webhookQuery,
      assignmentQuery,
      outboundQuery,
      requestLogQuery,
    ]);
  if (webhookResult.error) throw webhookResult.error;
  if (assignmentResult.error) throw assignmentResult.error;
  if (outboundResult.error) throw outboundResult.error;
  if (requestLogResult.error) throw requestLogResult.error;

  const logs: WhatsappCloudApiLogEntry[] = [];

  for (const row of requestLogResult.data ?? []) {
    const payload = asRecord(row.payload);
    const httpStatus = firstString(row.http_status);
    const reason = firstString(row.reason) || "request";
    logs.push({
      id: String(row.id),
      kind: "request",
      direction: "meta_to_us",
      meta_event_name: "",
      label: httpStatus
        ? `Request ${reason} HTTP ${httpStatus}`
        : `Request ${reason}`,
      status: String(row.request_status ?? ""),
      created_at: String(row.created_at ?? ""),
      config_id: row.config_id ?? null,
      config_name: row.config_id ? (configNames.get(row.config_id) ?? "") : "",
      phone: readPayloadPhone(payload),
      phone_number_id: firstString(row.phone_number_id),
      meta_message_id: firstString(row.whatsapp_business_account_id),
      promo_code: "",
      gerencia: "",
      attempts: null,
      error: String(row.error ?? ""),
      payload,
    });
  }

  for (const row of webhookResult.data ?? []) {
    const payload = asRecord(row.payload);
    logs.push({
      id: String(row.id),
      kind: "webhook",
      direction: "meta_to_us",
      meta_event_name: "",
      label: row.event_type ? `Webhook ${row.event_type}` : "Webhook",
      status: String(row.status ?? ""),
      created_at: String(row.received_at ?? ""),
      config_id: row.config_id ?? null,
      config_name: row.config_id ? (configNames.get(row.config_id) ?? "") : "",
      phone: readPayloadPhone(payload),
      phone_number_id: firstString(row.phone_number_id),
      meta_message_id: firstString(row.meta_message_id, row.meta_status_id),
      promo_code: "",
      gerencia: "",
      attempts: Number(row.attempts ?? 0),
      error: String(row.last_error ?? ""),
      payload,
    });
  }

  for (const row of assignmentResult.data ?? []) {
    logs.push({
      id: String(row.id),
      kind: "assignment",
      direction: "internal",
      meta_event_name: "",
      label: "Derivacion",
      status: String(row.status ?? ""),
      created_at: String(row.created_at ?? ""),
      config_id: row.config_id ?? null,
      config_name: row.config_id ? (configNames.get(row.config_id) ?? "") : "",
      phone: firstString(row.assigned_phone),
      phone_number_id: "",
      meta_message_id: firstString(row.redirect_message_id),
      promo_code: firstString(row.promo_code),
      gerencia: firstString(
        row.assigned_gerencia_label,
        row.assigned_gerencia_id,
      ),
      attempts: null,
      error: String(row.last_error ?? ""),
      payload: null,
    });
  }

  for (const row of outboundResult.data ?? []) {
    logs.push({
      id: String(row.id),
      kind: "outbound",
      direction: "us_to_whatsapp",
      meta_event_name: "",
      label: `Mensaje saliente ${firstString(row.message_type) || "text"}`,
      status: String(row.status ?? ""),
      created_at: String(row.created_at ?? ""),
      config_id: row.config_id ?? null,
      config_name: row.config_id ? (configNames.get(row.config_id) ?? "") : "",
      phone: firstString(row.recipient_wa_id),
      phone_number_id: "",
      meta_message_id: firstString(row.meta_message_id),
      promo_code: "",
      gerencia: "",
      attempts: null,
      error: String(row.last_error ?? ""),
      payload: asRecord(row.response) ?? asRecord(row.payload),
    });
  }

  await appendMetaCapiLogs(logs, input, limit);

  return logs
    .filter((log) => log.created_at)
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
    .slice(0, limit);
}

async function appendMetaCapiLogs(
  logs: WhatsappCloudApiLogEntry[],
  input: {
    userId: string;
    isAdmin: boolean;
    workspaceCurrency: "ARS" | "PYG";
  },
  limit: number,
): Promise<void> {
  try {
    const capiLogQuery = supabase
      .from("conversion_logs")
      .select(
        "id,user_id,conversion_id,function_name,level,message,detail,created_at,payload_meta,response_meta,result,workspace_currency",
      )
      .eq("workspace_currency", input.workspaceCurrency)
      .not("payload_meta", "eq", "")
      .not("conversion_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (!input.isAdmin) capiLogQuery.eq("user_id", input.userId);

    const { data: capiRows, error: capiError } = await capiLogQuery;
    if (capiError) throw capiError;

    const conversionIds = Array.from(
      new Set(
        (capiRows ?? [])
          .map((row) => firstString(row.conversion_id))
          .filter(Boolean),
      ),
    );
    if (!conversionIds.length) return;

    const conversionQuery = supabase
      .from("conversions")
      .select(
        "id,source_platform,phone,promo_code,telefono_asignado,assigned_gerencia_label,lead_gerencia_label,purchase_gerencia_label",
      )
      .eq("source_platform", "whatsapp_cloud_api")
      .in("id", conversionIds);
    if (!input.isAdmin) conversionQuery.eq("user_id", input.userId);

    const { data: conversionRows, error: conversionError } =
      await conversionQuery;
    if (conversionError) throw conversionError;

    const conversionsById = new Map(
      (conversionRows ?? []).map((row) => [String(row.id), row]),
    );

    for (const row of capiRows ?? []) {
      const conversion = asRecord(
        conversionsById.get(firstString(row.conversion_id)),
      );
      if (!conversion) continue;
      const metaPayload = parseJsonRecord(row.payload_meta);
      const metaResponse = parseJsonRecord(row.response_meta);
      const eventName = readMetaEventName(metaPayload);
      const responseStatus = firstString(row.level).toUpperCase() === "ERROR"
        ? "error"
        : firstString(metaResponse?.events_received) === "1"
        ? "enviado"
        : firstString(row.level).toLowerCase() || "info";
      logs.push({
        id: `capi-${String(row.id)}`,
        kind: "meta_capi",
        direction: "us_to_meta",
        meta_event_name: eventName,
        label: eventName ? `Meta CAPI ${eventName}` : "Meta CAPI",
        status: responseStatus,
        created_at: String(row.created_at ?? ""),
        config_id: null,
        config_name: "",
        phone: firstString(conversion.phone),
        phone_number_id: firstString(
          asRecord(
            Array.isArray(metaPayload?.data)
              ? asRecord(metaPayload.data[0])?.user_data
              : null,
          )?.whatsapp_business_account_id,
        ),
        meta_message_id: readMetaResponseId(metaResponse),
        promo_code: firstString(conversion.promo_code),
        gerencia: firstString(
          conversion.purchase_gerencia_label,
          conversion.lead_gerencia_label,
          conversion.assigned_gerencia_label,
        ),
        attempts: null,
        error: firstString(row.level).toUpperCase() === "ERROR"
          ? firstString(row.result, row.detail, row.message)
          : "",
        payload: {
          request: metaPayload ?? row.payload_meta,
          response: metaResponse ?? row.response_meta,
        },
      });
    }
  } catch (error) {
    console.warn("[whatsapp-cloud-api-logs] meta capi logs skipped", error);
  }
}

function normalizeInboxMessage(
  value: unknown,
): WhatsappCloudApiInboxMessage | null {
  const row = asRecord(value);
  if (!row) return null;
  const direction =
    firstString(row.direction) === "outbound" ? "outbound" : "inbound";
  return {
    created_at: firstString(row.created_at),
    direction,
    body: firstString(row.body),
    status: firstString(row.status),
    meta_message_id: firstString(row.meta_message_id),
    message_type: firstString(row.message_type),
    button_title: firstString(row.button_title),
    button_url: firstString(row.button_url),
    error: firstString(row.error),
  };
}

export async function fetchWhatsappCloudApiInboxThreads(
  limit = 20,
  workspaceCurrency?: "ARS" | "PYG" | null,
  offset = 0,
): Promise<WhatsappCloudApiInboxThread[]> {
  const sessionState = await rpcSessionState();
  if (!sessionState.hasAccessToken) {
    const error = new Error("Sesion de Supabase no disponible para consultar Inbox.");
    logWhatsappCloudApiError("fetch inbox threads missing session", error, {
      limit,
      offset,
      workspaceCurrency: workspaceCurrency ?? null,
      sessionState,
    });
    throw error;
  }

  const { data, error } = await supabase.rpc(
    "get_whatsapp_cloud_api_inbox_threads_page",
    {
      p_limit: limit,
      p_offset: offset,
      p_workspace_currency: workspaceCurrency ?? null,
    },
  );
  if (error) {
    logWhatsappCloudApiError("fetch inbox threads rpc failed", error, {
      rpc: "get_whatsapp_cloud_api_inbox_threads_page",
      limit,
      offset,
      workspaceCurrency: workspaceCurrency ?? null,
      sessionState,
    });
    throw new Error(
      formatWhatsappCloudApiError(error, "No se pudo cargar el Inbox."),
    );
  }
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const messages = Array.isArray(row.messages)
      ? row.messages
          .map(normalizeInboxMessage)
          .filter((msg): msg is WhatsappCloudApiInboxMessage => Boolean(msg))
      : [];
    const rawTag = firstString(row.tag);
    const tag = rawTag as WhatsappCloudApiInboxThread["tag"];
    return {
      contact_id: firstString(row.contact_id),
      config_id: firstString(row.config_id),
      config_name: firstString(row.config_name),
      user_id: firstString(row.user_id),
      wa_id: firstString(row.wa_id),
      phone: firstString(row.phone),
      profile_name: firstString(row.profile_name),
      first_message_at: firstString(row.first_message_at) || null,
      last_message_at: firstString(row.last_message_at) || null,
      last_message_text: firstString(row.last_message_text),
      last_message_direction: firstString(row.last_message_direction),
      last_message_status: firstString(row.last_message_status),
      assigned_phone: firstString(row.assigned_phone),
      assigned_gerencia_id:
        row.assigned_gerencia_id === null ||
        row.assigned_gerencia_id === undefined
          ? null
          : Number(row.assigned_gerencia_id),
      assigned_gerencia_label: firstString(row.assigned_gerencia_label),
      promo_code: firstString(row.promo_code),
      ctwa_clid: firstString(row.ctwa_clid),
      source_url: firstString(row.source_url),
      source_type: firstString(row.source_type),
      headline: firstString(row.headline),
      conversion_id: firstString(row.conversion_id) || null,
      lead_count: Number(row.lead_count ?? 0),
      purchase_count: Number(row.purchase_count ?? 0),
      repeat_purchase_count: Number(row.repeat_purchase_count ?? 0),
      total_loaded: Number(row.total_loaded ?? 0),
      last_purchase_at: firstString(row.last_purchase_at) || null,
      tag: [
        "nuevo",
        "contacto",
        "lead",
        "cargo",
        "recompra",
        "premium",
      ].includes(tag)
        ? tag
        : "nuevo",
      redirect_clicked: Boolean(row.redirect_clicked),
      redirect_click_count: Number(row.redirect_click_count ?? 0),
      redirect_last_clicked_at:
        firstString(row.redirect_last_clicked_at) || null,
      unread_count: Number(row.unread_count ?? 0),
      unread_last_message_at: firstString(row.unread_last_message_at) || null,
      messages,
    };
  });
}

export async function fetchWhatsappCloudApiContactsPage(
  limit = 20,
  workspaceCurrency?: "ARS" | "PYG" | null,
  offset = 0,
): Promise<WhatsappCloudApiContactsPageRow[]> {
  const sessionState = await rpcSessionState();
  if (!sessionState.hasAccessToken) {
    const error = new Error("Sesion de Supabase no disponible para consultar contactos.");
    logWhatsappCloudApiError("fetch contacts missing session", error, {
      limit,
      offset,
      workspaceCurrency: workspaceCurrency ?? null,
      sessionState,
    });
    throw error;
  }

  const { data, error } = await supabase.rpc(
    "get_whatsapp_cloud_api_contacts_page",
    {
      p_limit: limit,
      p_offset: offset,
      p_workspace_currency: workspaceCurrency ?? null,
    },
  );
  if (error) {
    logWhatsappCloudApiError("fetch contacts rpc failed", error, {
      rpc: "get_whatsapp_cloud_api_contacts_page",
      limit,
      offset,
      workspaceCurrency: workspaceCurrency ?? null,
      sessionState,
    });
    throw new Error(
      formatWhatsappCloudApiError(error, "No se pudieron cargar contactos."),
    );
  }
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const rawTag = firstString(row.tag);
    const tag = rawTag as WhatsappCloudApiInboxThread["tag"];
    return {
      contact_id: firstString(row.contact_id),
      config_id: firstString(row.config_id),
      config_name: firstString(row.config_name),
      wa_id: firstString(row.wa_id),
      phone: firstString(row.phone),
      profile_name: firstString(row.profile_name),
      last_message_at: firstString(row.last_message_at) || null,
      tag: [
        "nuevo",
        "contacto",
        "lead",
        "cargo",
        "recompra",
        "premium",
      ].includes(tag)
        ? tag
        : "nuevo",
      total_contacts: Number(row.total_contacts ?? 0),
    };
  });
}

export async function markWhatsappCloudApiThreadRead(
  contactId: string,
): Promise<void> {
  if (!contactId) return;
  const { error } = await supabase.rpc("mark_whatsapp_cloud_api_thread_read", {
    p_contact_id: contactId,
  });
  if (error) throw error;
}
