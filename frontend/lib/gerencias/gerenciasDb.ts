import { supabase } from "@/lib/supabaseClient";
import type { Gerencia } from "./types";

type DbErrorLike = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

export function formatGerenciaError(error: unknown, fallback: string): string {
  if (!error || typeof error !== "object") return fallback;
  const e = error as DbErrorLike;
  const msg = String(e.message ?? "");
  const details = String(e.details ?? "");

  // Postgres unique_violation
  if (e.code === "23505") {
    if (msg.includes("gerencias_pkey") || msg.includes("gerencias_gerencia_id_unique")) {
      return "No se puede crear: ese Gerencia ID ya existe en el sistema.";
    }
    return "No se puede crear: ya existe un registro con esos datos.";
  }

  // RLS / permisos
  if (e.code === "42501") {
    return "No tienes permisos para realizar esta accion.";
  }

  // FKs/check constraints
  if (e.code === "23503" || e.code === "23514") {
    return "No se pudo guardar por una restriccion de datos. Revisa el Gerencia ID.";
  }

  if (details) return `${fallback}: ${details}`;
  if (msg) return `${fallback}: ${msg}`;
  return fallback;
}

/**
 * Lista las gerencias del usuario.
 */
export async function fetchGerencias(userId: string): Promise<Gerencia[]> {
  const { data, error } = await supabase
    .from("gerencias")
    .select("id, nombre, gerencia_id, source_type, fair_criterion")
    .eq("user_id", userId)
    .order("id", { ascending: true });

  if (error) throw error;
  return (data ?? []) as Gerencia[];
}

/**
 * Para admin: lista todas las gerencias, propias primero y después las de los clientes.
 */
export async function fetchGerenciasForAdmin(adminUserId: string): Promise<Gerencia[]> {
  const { data, error } = await supabase
    .from("gerencias")
    .select("id, nombre, gerencia_id, source_type, fair_criterion, user_id")
    .order("id", { ascending: true });

  if (error) throw error;
  const list = (data ?? []) as Gerencia[];
  const mine: Gerencia[] = [];
  const others: Gerencia[] = [];
  for (const g of list) {
    if (g.user_id === adminUserId) mine.push(g);
    else others.push(g);
  }
  return [...mine, ...others];
}

/**
 * Crea una gerencia. gerencia_id es obligatorio (id para API externa de teléfonos).
 */
export async function createGerencia(
  userId: string,
  payload: { nombre: string; source_type: "pbadmin" | "manual"; gerencia_id?: number | null },
): Promise<Gerencia> {
  const isPbAdmin = payload.source_type === "pbadmin";
  let generatedId: number | null = null;

  if (!isPbAdmin) {
    const { data: lastRow, error: lastError } = await supabase
      .from("gerencias")
      .select("id")
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastError) throw lastError;
    generatedId = Number(lastRow?.id ?? 0) + 1;
  }

  const { data, error } = await supabase
    .from("gerencias")
    .insert({
      user_id: userId,
      nombre: payload.nombre.trim(),
      source_type: payload.source_type,
      ...(isPbAdmin
        ? {
            id: payload.gerencia_id,
            gerencia_id: payload.gerencia_id,
          }
        : {
            id: generatedId,
            gerencia_id: null,
          }),
    })
    .select("id, nombre, gerencia_id, source_type")
    .single();

  if (error) throw error;
  return data as Gerencia;
}

/**
 * Actualiza una gerencia.
 */
export async function updateGerencia(
  id: number,
  payload: { nombre: string; source_type: "pbadmin" | "manual"; gerencia_id?: number | null },
): Promise<void> {
  const isPbAdmin = payload.source_type === "pbadmin";
  const { error } = await supabase
    .from("gerencias")
    .update({
      nombre: payload.nombre.trim(),
      source_type: payload.source_type,
      ...(isPbAdmin
        ? {
            id: payload.gerencia_id,
            gerencia_id: payload.gerencia_id,
          }
        : {
            gerencia_id: null,
          }),
    })
    .eq("id", id);

  if (error) throw error;
}

/**
 * Elimina una gerencia.
 */
export async function deleteGerencia(id: number): Promise<void> {
  const { error } = await supabase.from("gerencias").delete().eq("id", id);

  if (error) throw error;
}

/** Asignación de una gerencia a una landing, con peso y configuración telefónica. */
export interface LandingGerenciaAssignment {
  gerencia_id: number;
  weight: number;
  phoneMode: "random" | "fair";
  phoneKind: "carga" | "ads" | "mkt";
  intervalStartHour: number | null;
  intervalEndHour: number | null;
}

/**
 * Devuelve las gerencias asignadas a una landing con su weight.
 */
export async function fetchLandingGerencias(
  landingId: string,
): Promise<LandingGerenciaAssignment[]> {
  const { data, error } = await supabase
    .from("landings_gerencias")
    .select(
      "gerencia_id, weight, phone_mode, phone_kind, interval_start_hour, interval_end_hour",
    )
    .eq("landing_id", landingId);

  if (error) throw error;
  return (data ?? []).map((r) => ({
    gerencia_id: r.gerencia_id,
    weight: Number(r.weight) || 0,
    phoneMode: (r.phone_mode as "random" | "fair") ?? "random",
    phoneKind: (r.phone_kind as "carga" | "ads" | "mkt") ?? "carga",
    intervalStartHour: r.interval_start_hour ?? null,
    intervalEndHour: r.interval_end_hour ?? null,
  }));
}

/**
 * Devuelve solo los ids de gerencias asignadas (compatibilidad).
 */
export async function fetchGerenciaIdsByLandingId(
  landingId: string,
): Promise<number[]> {
  const assignments = await fetchLandingGerencias(landingId);
  return assignments.map((a) => a.gerencia_id);
}

/**
 * Asigna las gerencias a una landing con su weight. Reemplaza las asignaciones actuales.
 */
export async function setLandingGerencias(
  landingId: string,
  assignments: LandingGerenciaAssignment[],
): Promise<void> {
  const { error: deleteError } = await supabase
    .from("landings_gerencias")
    .delete()
    .eq("landing_id", landingId);

  if (deleteError) throw deleteError;

  if (assignments.length === 0) return;

  const rows = assignments.map(
    ({
      gerencia_id,
      weight,
      phoneMode,
      phoneKind,
      intervalStartHour,
      intervalEndHour,
    }) => ({
      landing_id: landingId,
      gerencia_id,
      weight,
      phone_mode: phoneMode,
      phone_kind: phoneKind,
      interval_start_hour: intervalStartHour,
      interval_end_hour: intervalEndHour,
    }),
  );

  const { error: insertError } = await supabase
    .from("landings_gerencias")
    .insert(rows);

  if (insertError) throw insertError;
}
