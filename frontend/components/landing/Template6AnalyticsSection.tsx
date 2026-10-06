"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAppConfirm } from "@/components/ui/AppConfirmDialog";
import type { LandingThemeConfig } from "@/lib/landing/types";
import { normalizeTemplate6Cover, TEMPLATE6_CARD_COUNT } from "@/lib/landing/template6";

function buenosAiresDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

type Props = {
  landingId: string;
  config: LandingThemeConfig;
  savedTemplate6: boolean;
};

export function Template6AnalyticsSection({ landingId, config, savedTemplate6 }: Props) {
  const confirmAction = useAppConfirm();
  const [from, setFrom] = useState(() => buenosAiresDate(new Date(Date.now() - 6 * 86_400_000)));
  const [to, setTo] = useState(() => buenosAiresDate(new Date()));
  const [counts, setCounts] = useState<number[]>([0, 0, 0, 0, 0, 0]);
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(0);
  const cover = normalizeTemplate6Cover(config.template6Cover);
  const cardCount = TEMPLATE6_CARD_COUNT[cover.grid];
  const total = counts.slice(0, cardCount).reduce((sum, count) => sum + count, 0);
  const percent = useMemo(() => new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }), []);
  const invalidRange = !from || !to || from > to;

  const refresh = useCallback(async () => {
    if (!savedTemplate6 || !from || !to || from > to) return;
    const currentRequest = ++requestId.current;
    setLoading(true);
    setError("");
    const { data, error: queryError } = await supabase.rpc("get_template6_card_analytics", {
      p_landing_id: landingId,
      p_from: from,
      p_to: to,
    });
    if (currentRequest !== requestId.current) return;
    if (queryError) {
      setError("No se pudieron cargar las analíticas.");
    } else {
      const next = [0, 0, 0, 0, 0, 0];
      for (const row of (data ?? []) as Array<{ card_index: number; clicks: number | string }>) {
        const index = Number(row.card_index) - 1;
        if (index >= 0 && index < next.length) next[index] = Number(row.clicks) || 0;
      }
      setCounts(next);
    }
    setLoading(false);
  }, [landingId, savedTemplate6, from, to]);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => { if (active) void refresh(); });
    return () => { active = false; requestId.current += 1; };
  }, [refresh]);

  const reset = async () => {
    if (resetting || !savedTemplate6) return;
    const confirmed = await confirmAction({
      title: "Reiniciar analíticas de tarjetas",
      description: "Los porcentajes volverán a cero desde ahora. Las conversiones y los registros anteriores no se borran.",
      confirmLabel: "Reiniciar analíticas",
      danger: true,
    });
    if (!confirmed) return;
    setResetting(true);
    setError("");
    const { error: resetError } = await supabase.rpc("reset_template6_card_analytics", {
      p_landing_id: landingId,
    });
    if (resetError) setError("No se pudieron reiniciar las analíticas.");
    else await refresh();
    setResetting(false);
  };

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100">Analíticas de tarjetas</h3>
          <p className="text-xs text-zinc-400">Toques en los CTA · horario de Buenos Aires</p>
        </div>
        <button type="button" onClick={() => void reset()} disabled={!savedTemplate6 || resetting}
          className="rounded-lg border border-red-500/40 px-3 py-2 text-xs font-medium text-red-300 transition hover:bg-red-500/10 disabled:opacity-50">
          {resetting ? "Reiniciando..." : "Reiniciar analíticas"}
        </button>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2 sm:max-w-sm">
        <label className="text-xs text-zinc-400">Desde
          <input type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2 text-sm text-zinc-100" />
        </label>
        <label className="text-xs text-zinc-400">Hasta
          <input type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2 text-sm text-zinc-100" />
        </label>
      </div>

      {!savedTemplate6 ? <p className="text-xs text-zinc-400">Guardá la plantilla 6 para comenzar a medir.</p> : null}
      {invalidRange ? <p className="text-xs text-amber-300">Elegí un rango de fechas válido.</p> : null}
      {error ? <p role="alert" className="text-xs text-red-300">{error}</p> : null}
      {savedTemplate6 && !invalidRange ? (
        <div aria-busy={loading} className="space-y-2">
          <p className="text-xs text-zinc-300">Total: <strong className="text-zinc-100">{total.toLocaleString("es-AR")}</strong>{loading ? " · Actualizando..." : ""}</p>
          {cover.cards.slice(0, cardCount).map((card, index) => {
            const share = total ? counts[index] / total * 100 : 0;
            return <div key={index} className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="min-w-0 truncate text-zinc-200">Tarjeta {index + 1}{card.text.trim() ? ` · ${card.text.trim()}` : ""}</span>
                <strong className="shrink-0 text-zinc-100">{percent.format(share)}% · {counts[index].toLocaleString("es-AR")}</strong>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800"><div className="h-full rounded-full bg-emerald-400" style={{ width: `${share}%` }} /></div>
            </div>;
          })}
        </div>
      ) : null}
    </section>
  );
}
