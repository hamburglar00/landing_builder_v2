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
