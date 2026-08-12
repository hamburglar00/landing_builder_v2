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
  meta_api_version: string;
  webhook_verify_token: string;
  pixel_id: string;
  landing_tag: string;
  gerencia_selection_mode: "weighted_random" | "fair";
  gerencia_fair_criterion: "usage_count" | "messages_received";
  send_contact_capi: boolean;
  redirect_message_template: string;
  fallback_message_template: string;
  redirect_use_cta_button: boolean;
  redirect_cta_button_title: string;
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

export type WhatsappCloudApiLogKind = "webhook" | "assignment" | "outbound";

export interface WhatsappCloudApiLogEntry {
  id: string;
  kind: WhatsappCloudApiLogKind;
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
  tag: "nuevo" | "lead" | "cargo" | "recompra" | "premium";
  messages: WhatsappCloudApiInboxMessage[];
}

export async function fetchWhatsappCloudApiConfig(
  userId: string,
): Promise<WhatsappCloudApiConfig | null> {
  const { data, error } = await supabase
    .from("whatsapp_cloud_api_configs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as WhatsappCloudApiConfig | null;
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
  meta_access_token: string;
  meta_app_secret: string;
  meta_api_version: string;
  webhook_verify_token: string;
  pixel_id: string;
  landing_tag: string;
  gerencia_selection_mode: "weighted_random" | "fair";
  gerencia_fair_criterion: "usage_count" | "messages_received";
  send_contact_capi: boolean;
  redirect_message_template: string;
  fallback_message_template: string;
  redirect_use_cta_button: boolean;
  redirect_cta_button_title: string;
}): Promise<{ id: string }> {
  const body = {
    ...(input.id ? { id: input.id } : {}),
    user_id: input.user_id,
    name: input.name,
    active: input.active,
    workspace_currency: input.workspace_currency,
    phone_number_id: input.phone_number_id,
    whatsapp_business_account_id: input.whatsapp_business_account_id,
    display_phone_number: input.display_phone_number,
    meta_access_token: input.meta_access_token,
    meta_app_secret: input.meta_app_secret,
    meta_api_version: input.meta_api_version,
    webhook_verify_token: input.webhook_verify_token,
    pixel_id: input.pixel_id,
    landing_tag: input.landing_tag,
    gerencia_selection_mode: input.gerencia_selection_mode,
    gerencia_fair_criterion: input.gerencia_fair_criterion,
    send_contact_capi: input.send_contact_capi,
    redirect_message_template: input.redirect_message_template,
    fallback_message_template: input.fallback_message_template,
    redirect_use_cta_button: input.redirect_use_cta_button,
    redirect_cta_button_title: input.redirect_cta_button_title,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("whatsapp_cloud_api_configs")
    .upsert(body, { onConflict: "id" })
    .select("id")
    .single();
  if (error) throw error;
  if (!data?.id) throw new Error("No se pudo guardar WhatsApp Cloud API.");
  return { id: String(data.id) };
}

export async function fetchWhatsappCloudApiAssignments(
  configId: string,
): Promise<WhatsappCloudApiAssignment[]> {
  const { data, error } = await supabase
    .from("whatsapp_cloud_api_gerencias")
    .select("gerencia_id, weight, phone_mode, phone_kind, interval_start_hour, interval_end_hour")
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

export async function fetchWhatsappCloudApiRecentEvents(configId: string): Promise<
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
    ? value as Record<string, unknown>
    : null;
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function readPayloadPhone(payload: Record<string, unknown> | null): string {
  const entry = Array.isArray(payload?.entry) ? asRecord(payload.entry[0]) : null;
  const changes = Array.isArray(entry?.changes) ? asRecord(entry.changes[0]) : null;
  const value = asRecord(changes?.value);
  const contacts = Array.isArray(value?.contacts) ? asRecord(value.contacts[0]) : null;
  const messages = Array.isArray(value?.messages) ? asRecord(value.messages[0]) : null;
  return firstString(messages?.from, contacts?.wa_id);
}

export async function fetchWhatsappCloudApiLogs(input: {
  userId: string;
  isAdmin: boolean;
  limit?: number;
}): Promise<WhatsappCloudApiLogEntry[]> {
  const limit = input.limit ?? 40;

  const webhookQuery = supabase
    .from("whatsapp_cloud_api_webhook_events")
    .select("id,config_id,user_id,event_type,status,phone_number_id,meta_message_id,meta_status_id,payload,attempts,received_at,processed_at,last_error")
    .order("received_at", { ascending: false })
    .limit(limit);
  if (!input.isAdmin) webhookQuery.eq("user_id", input.userId);

  const assignmentQuery = supabase
    .from("whatsapp_cloud_api_assignments")
    .select("id,config_id,user_id,assigned_phone,assigned_gerencia_id,assigned_gerencia_label,promo_code,redirect_message_id,status,last_error,created_at,redirect_sent_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (!input.isAdmin) assignmentQuery.eq("user_id", input.userId);

  const outboundQuery = supabase
    .from("whatsapp_cloud_api_outbound_messages")
    .select("id,config_id,user_id,assignment_id,meta_message_id,recipient_wa_id,message_type,status,payload,response,last_error,created_at,sent_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (!input.isAdmin) outboundQuery.eq("user_id", input.userId);

  const [webhookResult, assignmentResult, outboundResult] = await Promise.all([
    webhookQuery,
    assignmentQuery,
    outboundQuery,
  ]);
  if (webhookResult.error) throw webhookResult.error;
  if (assignmentResult.error) throw assignmentResult.error;
  if (outboundResult.error) throw outboundResult.error;

  const rawConfigIds = [
    ...(webhookResult.data ?? []).map((row) => row.config_id),
    ...(assignmentResult.data ?? []).map((row) => row.config_id),
    ...(outboundResult.data ?? []).map((row) => row.config_id),
  ];
  const configIds = Array.from(new Set(rawConfigIds.filter((id): id is string => typeof id === "string" && Boolean(id))));
  const configNames = new Map<string, string>();
  if (configIds.length > 0) {
    const { data, error } = await supabase
      .from("whatsapp_cloud_api_configs")
      .select("id,name,display_phone_number")
      .in("id", configIds);
    if (error) throw error;
    for (const row of data ?? []) {
      const displayPhone = firstString(row.display_phone_number);
      configNames.set(String(row.id), displayPhone ? `${row.name} (${displayPhone})` : String(row.name ?? ""));
    }
  }

  const logs: WhatsappCloudApiLogEntry[] = [];

  for (const row of webhookResult.data ?? []) {
    const payload = asRecord(row.payload);
    logs.push({
      id: String(row.id),
      kind: "webhook",
      label: row.event_type ? `Webhook ${row.event_type}` : "Webhook",
      status: String(row.status ?? ""),
      created_at: String(row.received_at ?? ""),
      config_id: row.config_id ?? null,
      config_name: row.config_id ? configNames.get(row.config_id) ?? "" : "",
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
      label: "Derivacion",
      status: String(row.status ?? ""),
      created_at: String(row.created_at ?? ""),
      config_id: row.config_id ?? null,
      config_name: row.config_id ? configNames.get(row.config_id) ?? "" : "",
      phone: firstString(row.assigned_phone),
      phone_number_id: "",
      meta_message_id: firstString(row.redirect_message_id),
      promo_code: firstString(row.promo_code),
      gerencia: firstString(row.assigned_gerencia_label, row.assigned_gerencia_id),
      attempts: null,
      error: String(row.last_error ?? ""),
      payload: null,
    });
  }

  for (const row of outboundResult.data ?? []) {
    logs.push({
      id: String(row.id),
      kind: "outbound",
      label: `Mensaje saliente ${firstString(row.message_type) || "text"}`,
      status: String(row.status ?? ""),
      created_at: String(row.created_at ?? ""),
      config_id: row.config_id ?? null,
      config_name: row.config_id ? configNames.get(row.config_id) ?? "" : "",
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

  return logs
    .filter((log) => log.created_at)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit);
}

function normalizeInboxMessage(value: unknown): WhatsappCloudApiInboxMessage | null {
  const row = asRecord(value);
  if (!row) return null;
  const direction = firstString(row.direction) === "outbound" ? "outbound" : "inbound";
  return {
    created_at: firstString(row.created_at),
    direction,
    body: firstString(row.body),
    status: firstString(row.status),
    meta_message_id: firstString(row.meta_message_id),
    error: firstString(row.error),
  };
}

export async function fetchWhatsappCloudApiInboxThreads(limit = 50): Promise<WhatsappCloudApiInboxThread[]> {
  const { data, error } = await supabase.rpc("get_whatsapp_cloud_api_inbox_threads", {
    p_limit: limit,
  });
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const messages = Array.isArray(row.messages)
      ? row.messages.map(normalizeInboxMessage).filter((msg): msg is WhatsappCloudApiInboxMessage => Boolean(msg))
      : [];
    const tag = firstString(row.tag) as WhatsappCloudApiInboxThread["tag"];
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
      assigned_gerencia_id: row.assigned_gerencia_id === null || row.assigned_gerencia_id === undefined
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
      tag: ["nuevo", "lead", "cargo", "recompra", "premium"].includes(tag) ? tag : "nuevo",
      messages,
    };
  });
}
