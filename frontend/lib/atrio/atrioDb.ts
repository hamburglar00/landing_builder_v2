import { supabase } from "@/lib/supabaseClient";
import { normalizeCurrency, type ReportingCurrency } from "@/lib/currency";

export const ATRIO_BASE_URL = "https://www.atrio.website";

export type AtrioClient = {
  id: string;
  user_id: string;
  workspace_currency: ReportingCurrency;
  slug: string;
  atrio_id: string;
  usage_count: number;
  created_at?: string | null;
  updated_at?: string | null;
};

export type LandingAtrioAssignment = {
  atrioClientId: string;
  weight: number;
};

type DbErrorLike = {
  code?: string;
  message?: string;
  details?: string;
};

const SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]{0,80}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function normalizeAtrioSlug(value: string): string {
  return String(value ?? "")
    .trim()
    .replace(/^https?:\/\/(?:www\.)?atrio\.website\/?/i, "")
    .replace(/^\/+|\/+$/g, "")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_-]/g, "");
}

export function buildAtrioUrl(slug: string): string {
  const normalizedSlug = normalizeAtrioSlug(slug);
  return normalizedSlug ? `${ATRIO_BASE_URL}/${normalizedSlug}` : `${ATRIO_BASE_URL}/`;
}

export function isValidAtrioSlug(value: string): boolean {
  return SLUG_PATTERN.test(normalizeAtrioSlug(value));
}

export function isValidAtrioId(value: string): boolean {
  return UUID_PATTERN.test(String(value ?? "").trim());
}

export function sortAtrioClients(list: AtrioClient[]): AtrioClient[] {
  return [...list].sort((a, b) => {
    const bySlug = a.slug.localeCompare(b.slug, "es", {
      numeric: true,
      sensitivity: "base",
    });
    if (bySlug !== 0) return bySlug;
    return a.atrio_id.localeCompare(b.atrio_id, "es", { sensitivity: "base" });
  });
}

export function formatAtrioError(error: unknown, fallback: string): string {
  if (!error || typeof error !== "object") return fallback;
  const e = error as DbErrorLike;
  const message = String(e.message ?? "");
  const details = String(e.details ?? "");

  if (e.code === "23505") {
    if (message.includes("atrio_clients_atrio_id_key")) {
      return "No se puede guardar: ese ID de Atrio ya existe.";
    }
    if (message.includes("atrio_clients_user_workspace_slug_key")) {
      return "No se puede guardar: ese slug ya existe en este workspace.";
    }
    return "No se puede guardar: ya existe un registro con esos datos.";
  }

  if (e.code === "23514") {
    return "No se puede guardar: revisa el formato del slug o del ID de Atrio.";
  }

  if (e.code === "42501") return "No tienes permisos para realizar esta accion.";
  if (details) return `${fallback}: ${details}`;
  if (message) return `${fallback}: ${message}`;
  return fallback;
}

function mapAtrioClient(row: Record<string, unknown>): AtrioClient {
  return {
    id: String(row.id ?? ""),
    user_id: String(row.user_id ?? ""),
    workspace_currency: normalizeCurrency(row.workspace_currency),
    slug: String(row.slug ?? ""),
    atrio_id: String(row.atrio_id ?? ""),
    usage_count: Number(row.usage_count ?? 0) || 0,
    created_at: typeof row.created_at === "string" ? row.created_at : null,
    updated_at: typeof row.updated_at === "string" ? row.updated_at : null,
  };
}

export async function fetchAtrioClients(
  userId: string,
  workspaceCurrency: ReportingCurrency,
): Promise<AtrioClient[]> {
  const { data, error } = await supabase
    .from("atrio_clients")
    .select("id, user_id, workspace_currency, slug, atrio_id, usage_count, created_at, updated_at")
    .eq("user_id", userId)
    .eq("workspace_currency", workspaceCurrency)
    .order("slug", { ascending: true });

  if (error) throw error;
  return sortAtrioClients(((data ?? []) as Record<string, unknown>[]).map(mapAtrioClient));
}

export async function fetchAtrioClientsForAdmin(
  adminUserId: string,
  workspaceCurrency: ReportingCurrency,
): Promise<AtrioClient[]> {
  const { data, error } = await supabase
    .from("atrio_clients")
    .select("id, user_id, workspace_currency, slug, atrio_id, usage_count, created_at, updated_at")
    .eq("workspace_currency", workspaceCurrency)
    .order("slug", { ascending: true });

  if (error) throw error;
  const list = ((data ?? []) as Record<string, unknown>[]).map(mapAtrioClient);
  const mine = list.filter((client) => client.user_id === adminUserId);
  const others = list.filter((client) => client.user_id !== adminUserId);
  return [...sortAtrioClients(mine), ...sortAtrioClients(others)];
}

export async function createAtrioClient(
  userId: string,
  payload: {
    workspaceCurrency: ReportingCurrency;
    slug: string;
    atrioId: string;
  },
): Promise<AtrioClient> {
  const { data, error } = await supabase
    .from("atrio_clients")
    .insert({
      user_id: userId,
      workspace_currency: payload.workspaceCurrency,
      slug: normalizeAtrioSlug(payload.slug),
      atrio_id: payload.atrioId.trim(),
    })
    .select("id, user_id, workspace_currency, slug, atrio_id, usage_count, created_at, updated_at")
    .single();

  if (error) throw error;
  return mapAtrioClient(data as Record<string, unknown>);
}

export async function updateAtrioClient(
  id: string,
  payload: {
    slug: string;
    atrioId: string;
  },
): Promise<AtrioClient> {
  const { data, error } = await supabase
    .from("atrio_clients")
    .update({
      slug: normalizeAtrioSlug(payload.slug),
      atrio_id: payload.atrioId.trim(),
    })
    .eq("id", id)
    .select("id, user_id, workspace_currency, slug, atrio_id, usage_count, created_at, updated_at")
    .single();

  if (error) throw error;
  return mapAtrioClient(data as Record<string, unknown>);
}

export async function deleteAtrioClient(id: string): Promise<void> {
  const { error } = await supabase.from("atrio_clients").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchLandingAtrioAssignments(
  landingId: string,
): Promise<LandingAtrioAssignment[]> {
  const { data, error } = await supabase
    .from("landings_atrio_clients")
    .select("atrio_client_id, weight")
    .eq("landing_id", landingId);

  if (error) throw error;
  return (data ?? []).map((row) => ({
    atrioClientId: String(row.atrio_client_id ?? ""),
    weight: Number(row.weight ?? 0) || 0,
  })).filter((row) => row.atrioClientId);
}

export async function setLandingAtrioAssignments(
  landingId: string,
  assignments: LandingAtrioAssignment[],
): Promise<void> {
  const { error: deleteError } = await supabase
    .from("landings_atrio_clients")
    .delete()
    .eq("landing_id", landingId);
  if (deleteError) throw deleteError;

  const rows = assignments
    .filter((assignment) => assignment.atrioClientId)
    .map((assignment) => ({
      landing_id: landingId,
      atrio_client_id: assignment.atrioClientId,
      weight: Math.max(0, Number(assignment.weight) || 0),
    }));

  if (rows.length === 0) return;
  const { error } = await supabase.from("landings_atrio_clients").insert(rows);
  if (error) throw error;
}
