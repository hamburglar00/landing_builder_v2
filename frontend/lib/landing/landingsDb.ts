import { supabase } from "@/lib/supabaseClient";
import type { Landing, LandingThemeConfig } from "./types";

/** Fila tal como viene de la tabla public.landings */
export interface LandingRow {
  id: string;
  user_id: string;
  name: string;
  pixel_id: string;
  comment: string;
  config: LandingThemeConfig;
  created_at?: string;
  updated_at?: string;
}

function rowToLanding(row: LandingRow): Landing {
  return {
    id: row.id,
    name: row.name,
    pixelId: row.pixel_id ?? "",
    comment: row.comment,
    config: row.config,
  };
}

/**
 * Lista todas las landings del usuario (solo las propias por RLS).
 */
export async function fetchLandings(userId: string): Promise<Landing[]> {
  return fetchLandingsByUserId(userId);
}

/**
 * Lista landings de un usuario por su id. Los admins pueden listar landings de cualquier usuario (RLS).
 */
export async function fetchLandingsByUserId(userId: string): Promise<Landing[]> {
  const { data, error } = await supabase
    .from("landings")
    .select("id, user_id, name, comment, config, created_at, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(rowToLanding);
}

/**
 * Obtiene una landing por id. RLS asegura que solo el dueño (o un admin) pueda leerla.
 */
export async function fetchLandingById(
  landingId: string,
): Promise<Landing | null> {
  const { data, error } = await supabase
    .from("landings")
    .select("id, user_id, name, pixel_id, comment, config, created_at, updated_at")
    .eq("id", landingId)
    .maybeSingle();

  if (error) throw error;
  return data ? rowToLanding(data) : null;
}

/**
 * Crea una nueva landing para el usuario. Devuelve el id asignado.
 * El nombre debe ser único en la tabla; si no se pasa, se usa uno generado.
 */
export async function createLanding(
  userId: string,
  payload: {
    name?: string;
    pixelId?: string;
    comment: string;
    config: LandingThemeConfig;
  },
): Promise<{ id: string }> {
  const name =
    payload.name ?? `Nueva-landing-${crypto.randomUUID().slice(0, 8)}`;
  const { data, error } = await supabase
    .from("landings")
    .insert({
      user_id: userId,
      name,
      pixel_id: payload.pixelId ?? "",
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
    name?: string;
    pixelId?: string;
    comment?: string;
    config?: LandingThemeConfig;
  },
): Promise<void> {
  const body: Record<string, unknown> = {};
  if (payload.name !== undefined) body.name = payload.name;
  if (payload.pixelId !== undefined) body.pixel_id = payload.pixelId;
  if (payload.comment !== undefined) body.comment = payload.comment;
  if (payload.config !== undefined)
    body.config = payload.config as unknown as Record<string, unknown>;

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
