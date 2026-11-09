import { supabase } from "@/lib/supabaseClient";
export async function requestBotsWorkspace<T = unknown>(input: object): Promise<T> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw Error("Volvé a iniciar sesión.");
  const response = await fetch("/api/bots/workspace", {
    method: "POST", headers: { Authorization: `Bearer ${data.session.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify(input), signal: AbortSignal.timeout(60000),
  });
  const result = await response.json();
  if (!response.ok) throw Error(result.error || "No se pudo completar la acción.");
  return result;
}
