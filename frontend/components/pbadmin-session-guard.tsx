"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
export function PbadminSessionGuard() {
  const [error, setError] = useState("");
  useEffect(() => {
    let running = false;
    const check = async () => {
      if (running) return;
      running = true;
      try {
        const session = (await supabase.auth.getSession()).data.session;
        if (
          !session ||
          (!session.user.app_metadata.pbadmin_managed &&
            sessionStorage.getItem("pbadmin_access") !== session.user.id)
        )
          return;
        const response = await fetch("/api/pbadmin/session", {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: "no-store",
        });
        if (response.status === 401 || response.status === 403) {
          await supabase.auth.signOut();
          sessionStorage.removeItem("pbadmin_access");
          location.replace("/login");
          return;
        }
        setError(
          response.ok
            ? ""
            : "No se pudo verificar el acceso con PBAdmin. Reintentando…",
        );
      } catch {
        setError("No se pudo verificar el acceso con PBAdmin. Reintentando…");
      } finally {
        running = false;
      }
    };
    void check();
    const timer = setInterval(() => void check(), 60_000);
    window.addEventListener("focus", check);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", check);
    };
  }, []);
  return error ? (
    <div
      role="alert"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/95 p-8 text-white"
    >
      <p>{error}</p>
    </div>
  ) : null;
}
