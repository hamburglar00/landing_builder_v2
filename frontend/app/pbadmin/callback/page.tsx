"use client";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { PbadminConnectionScreen } from "@/components/brand/PbadminConnectionScreen";
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
        e instanceof TypeError
          ? "Se interrumpió la conexión. Volvé a intentar."
          : e instanceof Error
            ? e.message
            : "No se pudo completar el acceso.",
      ),
    );
  }, []);
  return <PbadminConnectionScreen error={error} />;
}
