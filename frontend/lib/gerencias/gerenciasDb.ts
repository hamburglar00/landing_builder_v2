import { supabase } from "@/lib/supabaseClient";
import type { Gerencia } from "./types";

/**
 * Lista las gerencias del usuario.
 */
export async function fetchGerencias(userId: string): Promise<Gerencia[]> {
  const { data, error } = await supabase
    .from("gerencias")
    .select("id, nombre, gerencia_id")
    .eq("user_id", userId)
    .order("id", { ascending: true });

  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    nombre: r.nombre,
    gerencia_id: (r as { gerencia_id?: number | null }).gerencia_id ?? null,
  })) as Gerencia[];
}

/**
 * Crea una gerencia. El id entero lo asigna la base.
 * Solo envía gerencia_id si viene definido, para no fallar si la columna aún no existe.
 */
export async function createGerencia(
  userId: string,
  payload: { nombre: string; gerencia_id?: number | null },
): Promise<Gerencia> {
  const insert: { user_id: string; nombre: string; gerencia_id?: number } = {
    user_id: userId,
    nombre: payload.nombre.trim(),
  };
  if (payload.gerencia_id != null) insert.gerencia_id = payload.gerencia_id;

  const { data, error } = await supabase
    .from("gerencias")
    .insert(insert)
    .select("id, nombre")
    .single();

  if (error) throw error;
  return {
    id: data.id,
    nombre: data.nombre,
    gerencia_id: payload.gerencia_id ?? null,
  } as Gerencia;
}

/**
 * Actualiza una gerencia.
 */
export async function updateGerencia(
  id: number,
  payload: { nombre: string; gerencia_id?: number | null },
): Promise<void> {
  const body: { nombre: string; gerencia_id?: number | null } = {
    nombre: payload.nombre.trim(),
  };
  if (payload.gerencia_id !== undefined) body.gerencia_id = payload.gerencia_id;
  const { error } = await supabase.from("gerencias").update(body).eq("id", id);

  if (error) throw error;
}

/**
 * Elimina una gerencia.
 */
export async function deleteGerencia(id: number): Promise<void> {
  const { error } = await supabase.from("gerencias").delete().eq("id", id);

  if (error) throw error;
}

/**
 * Devuelve los ids de gerencias asignadas a una landing.
 */
export async function fetchGerenciaIdsByLandingId(
  landingId: string,
): Promise<number[]> {
  const { data, error } = await supabase
    .from("landings_gerencias")
    .select("gerencia_id")
    .eq("landing_id", landingId);

  if (error) throw error;
  return (data ?? []).map((r) => r.gerencia_id);
}

/**
 * Asigna las gerencias a una landing. Reemplaza las asignaciones actuales.
 */
export async function setLandingGerencias(
  landingId: string,
  gerenciaIds: number[],
): Promise<void> {
  const { error: deleteError } = await supabase
    .from("landings_gerencias")
    .delete()
    .eq("landing_id", landingId);

  if (deleteError) throw deleteError;

  if (gerenciaIds.length === 0) return;

  const rows = gerenciaIds.map((gerencia_id) => ({
    landing_id: landingId,
    gerencia_id,
  }));

  const { error: insertError } = await supabase
    .from("landings_gerencias")
    .insert(rows);

  if (insertError) throw insertError;
}
