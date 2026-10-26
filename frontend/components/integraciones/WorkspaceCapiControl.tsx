"use client";

import { useState } from "react";
import type { ReportingCurrency } from "@/lib/currency";
import { setWorkspaceCapiEnabled } from "@/lib/conversionsDb";

export function WorkspaceCapiControl({ userId, currency, enabled, onSaved }: {
  userId: string;
  currency: ReportingCurrency;
  enabled: boolean;
  onSaved: (currency: ReportingCurrency, enabled: boolean) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    if (saving) return;
    const next = !enabled;
    setSaving(true);
    setError(null);
    try {
      await setWorkspaceCapiEnabled(userId, currency, next);
      onSaved(currency, next);
    } catch {
      setError("No pudimos guardar el cambio. Intentá nuevamente.");
    } finally {
      setSaving(false);
    }
  }

  return <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-panel)] p-4" data-workspace-capi={currency}>
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-zinc-100">Enviar eventos por CAPI <span className="ml-1.5 text-xs font-medium text-zinc-400">{currency}</span></p>
        <p className="mt-1 text-xs leading-5 text-zinc-400">Aplica únicamente al workspace {currency}. Las conversiones se siguen registrando.</p>
      </div>
      <button type="button" role="switch" aria-label="Enviar eventos por CAPI" aria-checked={enabled} aria-busy={saving} disabled={saving} onClick={() => void toggle()}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition disabled:cursor-wait disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-lime-400 ${enabled ? "border-emerald-500/60 bg-emerald-500/30" : "border-zinc-700 bg-zinc-800"}`}>
        <span className={`inline-block h-5 w-5 rounded-full bg-white transition-transform ${enabled ? "translate-x-5" : "translate-x-0.5"}`}/>
      </button>
    </div>
    {saving ? <p role="status" className="mt-2 text-xs text-zinc-400">Guardando…</p> : error ? <p role="alert" className="mt-2 text-xs text-red-400">{error}</p> : <p role="status" className={`mt-2 text-xs ${enabled ? "text-emerald-300" : "text-amber-300"}`}>{enabled ? `CAPI activo en ${currency}` : `CAPI desactivado en ${currency}`}</p>}
  </div>;
}
