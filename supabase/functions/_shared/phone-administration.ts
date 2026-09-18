import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

type PhoneTarget = { user_id?: unknown; gerencia_id?: unknown } | null;
type Authorization =
  | { ok: true; userId: string; gerenciaId: number | null }
  | { ok: false; status: number; error: string };

// A public API key identifies an application, never the phone owner or an admin.
export async function authorizePhoneAdministration(
  request: Request,
  body: PhoneTarget,
  backend: SupabaseClient,
): Promise<Authorization> {
  const token = request.headers.get("Authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) return { ok: false, status: 401, error: "Se requiere una sesion valida." };
  const { data, error } = await backend.auth.getUser(token);
  if (error || !data.user) return { ok: false, status: 401, error: "Se requiere una sesion valida." };
  const user = data.user;
  if (new URL(request.url).searchParams.has("user_id")) {
    return { ok: false, status: 400, error: "Destino de administracion invalido." };
  }
  const { data: profile, error: roleError } = await backend.from("profiles")
    .select("role").eq("id", user.id).maybeSingle();
  if (roleError || !profile) return { ok: false, status: 403, error: "Acceso no autorizado." };
  const isAdmin = profile.role === "admin";
  const target = body?.user_id;
  if (target != null && (typeof target !== "string" || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(target))) {
    return { ok: false, status: 400, error: "Destino de administracion invalido." };
  }
  if (target != null && target !== user.id && !isAdmin) {
    return { ok: false, status: 403, error: "Acceso no autorizado." };
  }
  let userId = typeof target === "string" ? target : user.id;
  const gerenciaId = body?.gerencia_id ?? null;
  if (gerenciaId !== null) {
    if (typeof gerenciaId !== "number" || !Number.isSafeInteger(gerenciaId) || gerenciaId <= 0) {
      return { ok: false, status: 400, error: "Gerencia invalida." };
    }
    const { data: gerencia, error: gerenciaError } = await backend.from("gerencias")
      .select("user_id").eq("id", gerenciaId).maybeSingle();
    if (gerenciaError) return { ok: false, status: 500, error: "No se pudo verificar el acceso." };
    if (!gerencia || (!isAdmin && gerencia.user_id !== user.id)
      || (target != null && gerencia.user_id !== target)) {
      return { ok: false, status: 403, error: "Acceso no autorizado." };
    }
    userId = gerencia.user_id;
  }
  return { ok: true, userId, gerenciaId };
}
