"use client";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
export default function Callback() {
  const started = useRef(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const params = new URLSearchParams(location.search);
    history.replaceState(null, "", "/pbadmin/callback");
    void (async () => {
      const response = await fetch("/api/pbadmin/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: params.get("code"),
          state: params.get("state"),
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "No se pudo abrir el constructor.");
      const result = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });
      if (result.error)
        throw new Error("No se pudo guardar la sesión. Volvé a ingresar.");
      sessionStorage.setItem("pbadmin_access", result.data.user!.id);
      location.replace(
        data.syncPending ? "/dashboard?sync=pending" : "/dashboard",
      );
    })().catch((e) =>
      setError(
        e instanceof Error ? e.message : "No se pudo completar el acceso.",
      ),
    );
  }, []);
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-white">
      <div className="max-w-md space-y-4 rounded-xl border border-slate-700 bg-slate-900 p-8">
        <h1 className="text-xl font-semibold">Tu constructor</h1>
        <p role={error ? "alert" : "status"}>
          {error || "Preparando tu cuenta y tus bots…"}
        </p>
        {error && (
          <a
            className="inline-block rounded-lg bg-violet-600 px-4 py-2"
            href="/api/pbadmin/start"
          >
            Volver a ingresar con PBAdmin
          </a>
        )}
      </div>
    </main>
  );
}
