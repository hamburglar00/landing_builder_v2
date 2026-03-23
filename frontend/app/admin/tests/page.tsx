"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getSettings } from "@/lib/settingsDb";

type LogLevel = "info" | "warn" | "error";
type LogEntry = { id: number; time: string; level: LogLevel; message: string; data?: unknown };
type CapiResult = { status: number; ok: boolean; body: unknown };

export default function AdminTestsPage() {
  const [landingName, setLandingName] = useState("");
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [loadingPhone, setLoadingPhone] = useState(false);
  const [loadingSync, setLoadingSync] = useState(false);
  const [loadingRevalidate, setLoadingRevalidate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logIdRef = useRef(0);
  const consoleEndRef = useRef<HTMLDivElement>(null);

  // Meta CAPI test state
  const [capiEvent, setCapiEvent] = useState<"Contact" | "Lead" | "Purchase">("Contact");
  const [capiTestCode, setCapiTestCode] = useState("");
  const [capiLoading, setCapiLoading] = useState(false);
  const [capiResult, setCapiResult] = useState<CapiResult | null>(null);

  // Test contact (conversions endpoint)
  const [clientName, setClientName] = useState("");
  const [loadingContact, setLoadingContact] = useState(false);

  const addLog = useCallback((level: LogLevel, message: string, data?: unknown) => {
    const id = ++logIdRef.current;
    const time = new Date().toLocaleTimeString("es-AR", { hour12: false });
    setLogs((prev) => [...prev, { id, time, level, message, data }]);
    if (level === "error") console.error(`[Tests] ${message}`, data ?? "");
    else if (level === "warn") console.warn(`[Tests] ${message}`, data ?? "");
    else console.log(`[Tests] ${message}`, data ?? "");
  }, []);

  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const handleTestConfig = async () => {
    if (!landingName.trim()) return;
    setLoadingConfig(true);
    setError(null);
    const name = landingName.trim();
    addLog("info", `builder-config: inicio (name=${name})`);
    try {
      const base =
        process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ?? "";
      const apiKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
      if (!base) {
        addLog("error", "Falta NEXT_PUBLIC_SUPABASE_URL en el frontend.");
        setError("Falta NEXT_PUBLIC_SUPABASE_URL en el frontend.");
        return;
      }
      const url = `${base}/functions/v1/builder-config?name=${encodeURIComponent(name)}`;
      addLog("info", `GET /functions/v1/builder-config`);
      const res = await fetch(url, {
        headers: apiKey
          ? {
              apikey: apiKey,
              Authorization: `Bearer ${apiKey}`,
            }
          : undefined,
      });
      const text = await res.text();
      if (res.ok) {
        try {
          const json = JSON.parse(text) as { tracking?: { postUrl?: string } };
          const postUrl = json?.tracking?.postUrl ?? "(no definido)";
          const isConversions = String(postUrl).includes("/conversions?name=");
          addLog("info", `tracking.postUrl: ${postUrl} ${isConversions ? "✓ (conversiones)" : "⚠ NO es endpoint de conversiones"}`);
        } catch {
          // ignore parse error
        }
        addLog("info", `builder-config OK (${res.status})`, text);
      } else {
        addLog("error", `builder-config ${res.status} ${res.statusText}`, text);
        setError(`Error builder-config: ${res.status} ${res.statusText}`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error desconocido al probar builder-config";
      addLog("error", msg, e);
      setError(msg);
    } finally {
      setLoadingConfig(false);
    }
  };

  const handleTestPhone = async () => {
    if (!landingName.trim()) return;
    setLoadingPhone(true);
    setError(null);
    const name = landingName.trim();
    addLog("info", `landing-phone: inicio (name=${name})`);
    try {
      const base =
        process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ?? "";
      const apiKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
      if (!base) {
        addLog("error", "Falta NEXT_PUBLIC_SUPABASE_URL en el frontend.");
        setError("Falta NEXT_PUBLIC_SUPABASE_URL en el frontend.");
        return;
      }
      addLog("info", `GET /functions/v1/landing-phone`);
      const res = await fetch(
        `${base}/functions/v1/landing-phone?name=${encodeURIComponent(name)}`,
        {
          headers: apiKey
            ? {
                apikey: apiKey,
                Authorization: `Bearer ${apiKey}`,
              }
            : undefined,
        },
      );
      const text = await res.text();
      if (res.ok) {
        addLog("info", `landing-phone OK (${res.status})`, text);
      } else {
        addLog("error", `landing-phone ${res.status} ${res.statusText}`, text);
        setError(`Error landing-phone: ${res.status} ${res.statusText}`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error desconocido al probar landing-phone";
      addLog("error", msg, e);
      setError(msg);
    } finally {
      setLoadingPhone(false);
    }
  };

  const handleTestSync = async () => {
    setLoadingSync(true);
    setError(null);
    addLog("info", "sync-phones: inicio");
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) {
        addLog("error", "No hay sesión de usuario para sync-phones.", userError);
        setError("No hay sesión de usuario para sync-phones.");
        return;
      }
      const base =
        process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ?? "";
      const apiKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
      if (!base) {
        addLog("error", "Falta NEXT_PUBLIC_SUPABASE_URL en el frontend.");
        setError("Falta NEXT_PUBLIC_SUPABASE_URL en el frontend.");
        return;
      }
      addLog("info", `POST /functions/v1/sync-phones`, { user_id: user.id });
      const res = await fetch(`${base}/functions/v1/sync-phones`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { apikey: apiKey } : {}),
        },
        body: JSON.stringify({ user_id: user.id }),
      });
      const text = await res.text();
      if (res.ok) {
        addLog("info", `sync-phones OK (${res.status})`, text);
      } else {
        addLog("error", `sync-phones ${res.status} ${res.statusText}`, text);
        setError(`Error sync-phones: ${res.status} ${res.statusText}`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error desconocido al probar sync-phones";
      addLog("error", msg, e);
      setError(msg);
    } finally {
      setLoadingSync(false);
    }
  };

  const handleTestCapi = async () => {
    setError(null);
    setCapiResult(null);
    setCapiLoading(true);
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ?? "";
    if (!base) {
      const msg = "Falta NEXT_PUBLIC_SUPABASE_URL en el frontend.";
      addLog("error", msg);
      setError(msg);
      setCapiLoading(false);
      return;
    }
    const url = `${base}/functions/v1/conversions-test`;
    const payload = {
      event: capiEvent,
      test_event_code: capiTestCode.trim(),
    };
    addLog("info", "CAPI test: enviando payload a conversions-test", { url, payload });
    try {
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
      // Forzar refresh para evitar JWT vencido/invalidado en sesión vieja.
      await supabase.auth.refreshSession();
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token ?? "";
      if (!accessToken) {
        const msg = "No hay sesión válida. Cerrá sesión y volvé a ingresar.";
        addLog("error", msg);
        setError(msg);
        return;
      }
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(anonKey ? { apikey: anonKey } : {}),
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => null);
      addLog("info", `CAPI test: respuesta ${res.status}`, json ?? "");
      setCapiResult({
        status: res.status,
        ok: res.ok,
        body: json,
      });
    } catch (e) {
      const msg = "Error al probar Meta CAPI (conversions-test).";
      addLog("error", msg, e);
      setError(msg);
    } finally {
      setCapiLoading(false);
    }
  };

  const handleTestRevalidate = async () => {
    if (!landingName.trim()) return;
    setLoadingRevalidate(true);
    setError(null);
    const name = landingName.trim();
    addLog("info", `revalidate: inicio (name=${name})`);
    try {
      let settings: Awaited<ReturnType<typeof getSettings>>;
      try {
        settings = await getSettings();
      } catch (e) {
        const msg =
          "No se pudo cargar la configuración (Supabase). Revisá conexión y que el proyecto no esté pausado.";
        addLog("error", msg, e);
        setError(msg);
        return;
      }
      const rawBase = settings.url_base ?? "";
      const secret = settings.revalidate_secret ?? "";
      if (!rawBase) {
        const msg = "Falta URL base en Configuración.";
        addLog("error", msg);
        setError(msg);
        return;
      }
      if (!secret) {
        const msg = "Falta secreto de revalidación en Configuración.";
        addLog("error", msg);
        setError(msg);
        return;
      }
      const base = rawBase.replace(/\/$/, "");
      const url = `${base}/api/revalidate`;
      addLog("info", `POST ${url}`, { name });
      let res: Response;
      try {
        res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name,
            secret,
          }),
        });
      } catch (e) {
        const msg =
          "No se pudo conectar con la landing (Failed to fetch). Verificá que esté corriendo en la URL base y que permita peticiones desde este origen (CORS).";
        addLog("error", msg, e);
        setError(msg);
        return;
      }
      const text = await res.text();
      if (res.ok) {
        addLog("info", `revalidate OK (${res.status})`, text);
      } else {
        addLog("error", `revalidate ${res.status} ${res.statusText}`, text);
        setError(`Error revalidate: ${res.status} ${res.statusText}`);
      }
    } finally {
      setLoadingRevalidate(false);
    }
  };

  const handleTestContact = async () => {
    const name = clientName.trim();
    if (!name) return;
    setLoadingContact(true);
    setError(null);
    addLog("info", `conversions (contact): POST ?name=${name}`);
    try {
      const base =
        process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ?? "";
      if (!base) {
        addLog("error", "Falta NEXT_PUBLIC_SUPABASE_URL.");
        setError("Falta NEXT_PUBLIC_SUPABASE_URL.");
        return;
      }
      const url = `${base}/functions/v1/conversions?name=${encodeURIComponent(name)}`;
      const payload = {
        phone: "5491112345678",
        landing_name: landingName.trim() || "kobe",
      };
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const text = await res.text();
      if (res.ok) {
        addLog("info", `conversions OK (${res.status}) - Revisá CONVERSIONES > Tabla`, text);
      } else {
        addLog("error", `conversions ${res.status} ${res.statusText}`, text);
        setError(`Error conversions: ${res.status} ${text}`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error al enviar contacto de prueba";
      addLog("error", msg, e);
      setError(msg);
    } finally {
      setLoadingContact(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-100">Tests</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Proba rápidamente los endpoints públicos de configuraciones y
          teléfonos de tus landings.
        </p>
        <p className="mt-1 text-[11px] text-zinc-500">
          Revalidate: la URL base en Configuración debe ser la de la landing
          (ej. http://localhost:3000). Si el constructor corre en otro puerto,
          la landing debe permitir CORS desde ese origen.
        </p>
      </div>

      <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 sm:p-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <label
              htmlFor="tests-landing-name"
              className="mb-1 block text-xs font-medium text-zinc-400"
            >
              Nombre de la landing
            </label>
            <input
              id="tests-landing-name"
              type="text"
              value={landingName}
              onChange={(e) => setLandingName(e.target.value)}
              placeholder="Ej: kobe"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleTestConfig}
              disabled={loadingConfig || !landingName.trim()}
              className="rounded-lg bg-zinc-100 px-3 py-2 text-xs font-medium text-zinc-900 transition hover:bg-zinc-200 disabled:opacity-60"
            >
              {loadingConfig ? "Probando..." : "Probar builder-config"}
            </button>
            <button
              type="button"
              onClick={handleTestPhone}
              disabled={loadingPhone || !landingName.trim()}
              className="rounded-lg bg-zinc-800 px-3 py-2 text-xs font-medium text-zinc-100 transition hover:bg-zinc-700 disabled:opacity-60"
            >
              {loadingPhone ? "Probando..." : "Probar landing-phone"}
            </button>
            <button
              type="button"
              onClick={handleTestSync}
              disabled={loadingSync}
              className="rounded-lg bg-emerald-900 px-3 py-2 text-xs font-medium text-emerald-50 transition hover:bg-emerald-800 disabled:opacity-60"
            >
              {loadingSync ? "Sincronizando..." : "Probar sync-phones"}
            </button>
            <button
              type="button"
              onClick={handleTestRevalidate}
              disabled={loadingRevalidate || !landingName.trim()}
              className="rounded-lg bg-indigo-900 px-3 py-2 text-xs font-medium text-indigo-50 transition hover:bg-indigo-800 disabled:opacity-60"
            >
              {loadingRevalidate
                ? "Revalidando..."
                : "Probar /api/revalidate"}
            </button>
          </div>
        </div>

        {/* Test contact (conversions) */}
        <div className="mt-6 space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
          <h2 className="text-sm font-semibold text-zinc-200">Conversiones — Simular contacto</h2>
          <p className="text-[11px] text-zinc-500">
            Envía un POST de contacto al endpoint de conversiones. Usa el <strong>nombre del cliente</strong> (profiles.nombre, ej. koben), no el nombre de la landing.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1 min-w-[180px]">
              <label className="text-xs font-medium text-zinc-400">Nombre cliente (profiles.nombre)</label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Ej: koben"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-100"
              />
            </div>
            <button
              type="button"
              onClick={handleTestContact}
              disabled={loadingContact || !clientName.trim()}
              className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-amber-50 transition hover:bg-amber-500 disabled:opacity-60"
            >
              {loadingContact ? "Enviando..." : "Simular contacto"}
            </button>
          </div>
        </div>

        {/* Meta CAPI test card */}
        <div className="mt-6 space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
          <h2 className="text-sm font-semibold text-zinc-200">Meta CAPI — Test events</h2>
          <p className="text-[11px] text-zinc-500">
            Envía un evento de prueba a Meta CAPI usando la misma lógica que producción, pero forzando{" "}
            <code className="px-1 py-0.5 rounded bg-zinc-900 text-[10px]">test_event_code</code>.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-zinc-400">Evento</label>
              <select
                value={capiEvent}
                onChange={(e) => setCapiEvent(e.target.value as typeof capiEvent)}
                className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-100"
              >
                <option value="Contact">Contact</option>
                <option value="Lead">Lead</option>
                <option value="Purchase">Purchase</option>
              </select>
            </div>
            <div className="flex flex-col gap-1 min-w-[220px] flex-1">
              <label className="text-xs font-medium text-zinc-400">
                test_event_code (Meta Test Events)
              </label>
              <input
                type="text"
                value={capiTestCode}
                onChange={(e) => setCapiTestCode(e.target.value)}
                placeholder="Ej: TEST1234"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-100"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleTestCapi}
                disabled={capiLoading || !capiTestCode.trim()}
                className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-medium text-emerald-950 transition hover:bg-emerald-400 disabled:opacity-60"
              >
                {capiLoading ? "Enviando..." : "Send test event"}
              </button>
            </div>
          </div>

          {capiResult && (
            <div className="mt-3 space-y-1 rounded-md bg-zinc-950/90 p-3 text-[11px] text-zinc-300">
              <p>
                <span className="font-medium">HTTP status:</span>{" "}
                <span className={capiResult.ok ? "text-emerald-400" : "text-red-400"}>
                  {capiResult.status} {capiResult.ok ? "(OK)" : "(error)"}
                </span>
              </p>
              {capiResult.body != null ? (
                <pre className="mt-1 max-h-64 overflow-auto rounded bg-zinc-950 p-2 text-[10px] text-zinc-300">
                  {JSON.stringify(capiResult.body, null, 2)}
                </pre>
              ) : null}
            </div>
          )}
        </div>

        {error && (
          <p
            className="rounded-lg bg-red-950/50 px-3 py-2 text-xs text-red-300"
            role="alert"
          >
            {error}
          </p>
        )}

        <div className="space-y-2 border-t border-zinc-800 pt-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-zinc-300">Consola</h2>
            <button
              type="button"
              onClick={() => setLogs([])}
              disabled={logs.length === 0}
              className="rounded bg-zinc-800 px-2 py-1 text-[10px] font-medium text-zinc-400 transition hover:bg-zinc-700 hover:text-zinc-200 disabled:opacity-50"
            >
              Limpiar
            </button>
          </div>
          <div className="max-h-[420px] overflow-auto rounded-lg bg-zinc-950 font-mono text-[11px]">
            {logs.length === 0 ? (
              <p className="p-3 text-zinc-500">Sin logs. Ejecutá una prueba para ver la salida aquí.</p>
            ) : (
              <ul className="min-h-full list-none p-2">
                {logs.map((entry) => (
                  <li
                    key={entry.id}
                    className="border-b border-zinc-900/80 py-1.5 leading-relaxed last:border-0"
                  >
                    <div className="flex flex-wrap gap-x-2">
                      <span className="shrink-0 text-zinc-500">{entry.time}</span>
                      <span
                        className={
                          entry.level === "error"
                            ? "text-red-400"
                            : entry.level === "warn"
                              ? "text-amber-400"
                              : "text-zinc-300"
                        }
                      >
                        [{entry.level}]
                      </span>
                      <span className="text-zinc-200">{entry.message}</span>
                    </div>
                    {entry.data !== undefined && entry.data !== "" && (
                      <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-words pl-6 text-zinc-500">
                        {typeof entry.data === "string"
                          ? entry.data
                          : JSON.stringify(entry.data, null, 2)}
                      </pre>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <div ref={consoleEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
}
