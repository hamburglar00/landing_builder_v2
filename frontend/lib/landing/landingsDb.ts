import { supabase } from "@/lib/supabaseClient";
import type { Landing, LandingThemeConfig } from "./types";
import { DEFAULT_CONFIG } from "./mocks";
import type { LandingConfigPayload } from "./buildLandingConfig";

function normalizePixelId(value: string): string {
  return String(value ?? "").replace(/\D/g, "");
}

/** Fila tal como viene de la tabla public.landings */
export interface LandingRow {
  id: string;
  user_id: string;
  landing_type: "internal" | "external";
  external_domain: string;
  name: string;
  pixel_id: string;
  gerencia_selection_mode: "weighted_random" | "fair";
  gerencia_fair_criterion: "usage_count" | "messages_received";
  phone_mode: "random" | "fair";
  phone_kind: "carga" | "ads" | "mkt";
  phone_interval_start_hour: number | null;
  phone_interval_end_hour: number | null;
  post_url: string;
  landing_tag: string;
  comment: string;
  config: LandingThemeConfig;
  created_at?: string;
  updated_at?: string;
  landing_config?: LandingConfigPayload;
}

function rowToLanding(row: LandingRow): Landing {
  const merged: LandingThemeConfig = {
    ...DEFAULT_CONFIG,
    ...(row.config as LandingThemeConfig),
  };
  return {
    id: row.id,
    userId: row.user_id,
    landingType: row.landing_type ?? "internal",
    externalDomain: row.external_domain ?? "",
    name: row.name,
    pixelId: row.pixel_id ?? "",
    gerenciaSelectionMode: row.gerencia_selection_mode ?? "weighted_random",
    gerenciaFairCriterion: row.gerencia_fair_criterion ?? "usage_count",
    phoneMode: row.phone_mode ?? "random",
    phoneKind: row.phone_kind ?? "carga",
    phoneIntervalStartHour: row.phone_interval_start_hour ?? null,
    phoneIntervalEndHour: row.phone_interval_end_hour ?? null,
    postUrl: row.post_url ?? "",
    landingTag: row.landing_tag ?? "",
    comment: row.comment,
    config: merged,
  };
}

/**
 * Lista todas las landings del usuario (solo las propias por RLS).
 */
export async function fetchLandings(userId: string): Promise<Landing[]> {
  return fetchLandingsByUserId(userId);
}

const LANDINGS_SELECT =
  "id, user_id, landing_type, external_domain, name, pixel_id, gerencia_selection_mode, gerencia_fair_criterion, phone_mode, phone_kind, phone_interval_start_hour, phone_interval_end_hour, post_url, landing_tag, comment, config, created_at, updated_at";

/**
 * Lista landings de un usuario por su id. Los admins pueden listar landings de cualquier usuario (RLS).
 */
export async function fetchLandingsByUserId(userId: string): Promise<Landing[]> {
  const { data, error } = await supabase
    .from("landings")
    .select(LANDINGS_SELECT)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map((r) => rowToLanding(r as LandingRow));
}

/**
 * Para admin: lista todas las landings, propias primero y después las de los clientes.
 * Requiere RLS "Admins can read all landings".
 */
export async function fetchLandingsForAdmin(adminUserId: string): Promise<{
  mine: Landing[];
  clients: Landing[];
}> {
  const { data, error } = await supabase
    .from("landings")
    .select(LANDINGS_SELECT)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  const rows = (data ?? []) as LandingRow[];
  const mine: Landing[] = [];
  const clients: Landing[] = [];
  for (const r of rows) {
    const landing = rowToLanding(r);
    if (r.user_id === adminUserId) mine.push(landing);
    else clients.push(landing);
  }
  return { mine, clients };
}

/**
 * Obtiene una landing por id. RLS asegura que solo el dueño (o un admin) pueda leerla.
 */
export async function fetchLandingById(
  landingId: string,
): Promise<Landing | null> {
  const { data, error } = await supabase
    .from("landings")
    .select(LANDINGS_SELECT)
    .eq("id", landingId)
    .maybeSingle();

  if (error) throw error;
  return data ? rowToLanding(data as LandingRow) : null;
}

/**
 * Crea una nueva landing para el usuario. Devuelve el id asignado.
 */
export async function createLanding(
  userId: string,
  payload: {
    landingType?: "internal" | "external";
    externalDomain?: string;
    name?: string;
    pixelId?: string;
    gerenciaSelectionMode?: "weighted_random" | "fair";
    gerenciaFairCriterion?: "usage_count" | "messages_received";
    phoneMode?: "random" | "fair";
    phoneKind?: "carga" | "ads" | "mkt";
    phoneIntervalStartHour?: number | null;
    phoneIntervalEndHour?: number | null;
    postUrl?: string;
    landingTag?: string;
    comment: string;
    config: LandingThemeConfig;
  },
): Promise<{ id: string }> {
  const name =
    payload.name ?? `Nueva-landing-${crypto.randomUUID().slice(0, 8)}`;
  const base =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ?? "";
  let pixelId = normalizePixelId(payload.pixelId ?? "");
  let postUrl = payload.postUrl ?? "";
  const [{ data: profile }, { data: config }] = await Promise.all([
    supabase.from("profiles").select("nombre").eq("id", userId).maybeSingle(),
    supabase.from("conversions_config").select("pixel_id").eq("user_id", userId).maybeSingle(),
  ]);
  if (!pixelId) {
    pixelId = normalizePixelId(String(config?.pixel_id ?? ""));
  }
  if (base && profile?.nombre) {
    postUrl = `${base}/functions/v1/conversions?name=${encodeURIComponent(
      profile.nombre,
    )}`;
  }
  const { data, error } = await supabase
    .from("landings")
    .insert({
      user_id: userId,
      landing_type: payload.landingType ?? "internal",
      external_domain: payload.externalDomain ?? "",
      name,
      pixel_id: pixelId,
      gerencia_selection_mode: payload.gerenciaSelectionMode ?? "weighted_random",
      gerencia_fair_criterion: payload.gerenciaFairCriterion ?? "usage_count",
      phone_mode: payload.phoneMode ?? "random",
      phone_kind: payload.phoneKind ?? "carga",
      phone_interval_start_hour: payload.phoneIntervalStartHour ?? null,
      phone_interval_end_hour: payload.phoneIntervalEndHour ?? null,
      post_url: postUrl,
      landing_tag: payload.landingTag ?? "",
      comment: payload.comment,
      config: payload.config as unknown as Record<string, unknown>,
    })
    .select("id")
    .single();

  if (error) throw error;
  if (!data?.id) throw new Error("No se devolvió id de la landing.");
  return { id: data.id };
}

/**
 * Actualiza una landing. RLS asegura que solo el dueño pueda actualizarla.
 */
export async function updateLanding(
  landingId: string,
  payload: {
    landingType?: "internal" | "external";
    externalDomain?: string;
    name?: string;
    pixelId?: string;
    gerenciaSelectionMode?: "weighted_random" | "fair";
    gerenciaFairCriterion?: "usage_count" | "messages_received";
    phoneMode?: "random" | "fair";
    phoneKind?: "carga" | "ads" | "mkt";
    phoneIntervalStartHour?: number | null;
    phoneIntervalEndHour?: number | null;
    postUrl?: string;
    landingTag?: string;
    comment?: string;
    config?: LandingThemeConfig;
    landingConfig?: LandingConfigPayload;
  },
): Promise<void> {
  const body: Record<string, unknown> = {};
  if (payload.landingType !== undefined) body.landing_type = payload.landingType;
  if (payload.externalDomain !== undefined) body.external_domain = payload.externalDomain;
  if (payload.name !== undefined) body.name = payload.name;
  if (payload.pixelId !== undefined) body.pixel_id = normalizePixelId(payload.pixelId);
  if (payload.gerenciaSelectionMode !== undefined)
    body.gerencia_selection_mode = payload.gerenciaSelectionMode;
  if (payload.gerenciaFairCriterion !== undefined)
    body.gerencia_fair_criterion = payload.gerenciaFairCriterion;
  if (payload.phoneMode !== undefined) body.phone_mode = payload.phoneMode;
  if (payload.phoneKind !== undefined) body.phone_kind = payload.phoneKind;
  if (payload.phoneIntervalStartHour !== undefined)
    body.phone_interval_start_hour = payload.phoneIntervalStartHour;
  if (payload.phoneIntervalEndHour !== undefined)
    body.phone_interval_end_hour = payload.phoneIntervalEndHour;
  if (payload.postUrl !== undefined) body.post_url = payload.postUrl;
  if (payload.landingTag !== undefined) body.landing_tag = payload.landingTag;
  if (payload.comment !== undefined) body.comment = payload.comment;
  if (payload.config !== undefined)
    body.config = payload.config as unknown as Record<string, unknown>;
  if (payload.landingConfig !== undefined)
    body.landing_config = payload.landingConfig as unknown as Record<
      string,
      unknown
    >;

  if (Object.keys(body).length === 0) return;

  const { error } = await supabase
    .from("landings")
    .update(body)
    .eq("id", landingId);

  if (error) throw error;
}

/**
 * Elimina una landing. RLS asegura que solo el dueño pueda eliminarla.
 */
export async function deleteLanding(landingId: string): Promise<void> {
  const { error } = await supabase.from("landings").delete().eq("id", landingId);

  if (error) throw error;
}

/** Código de error Postgres por violación de restricción única. */
export const UNIQUE_VIOLATION_CODE = "23505";
