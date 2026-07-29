"use client";

import { useCallback, useState } from "react";
import {
  ChevronIcon,
  CopyIcon,
} from "@/components/conversiones/ConversionPageUi";
import { formatIntegerWithThousands } from "@/components/conversiones/conversionPageShared";

type ConversionConfigurationPanelProps = {
  endpointBase: string;
  clientName: string;
  endpointMissingMessage: string;
  isAllCurrencies: boolean;
  reportingCurrency: string;
  premiumThreshold: number;
  onPremiumThresholdChange: (value: number) => void;
  showLogs?: boolean;
  onToggleShowLogs?: () => void;
  saving: boolean;
  onSave: () => void;
};

export default function ConversionConfigurationPanel({
  endpointBase,
  clientName,
  endpointMissingMessage,
  isAllCurrencies,
  reportingCurrency,
  premiumThreshold,
  onPremiumThresholdChange,
  showLogs,
  onToggleShowLogs,
  saving,
  onSave,
}: ConversionConfigurationPanelProps) {
  const [endpointOpen, setEndpointOpen] = useState(false);
  const [funnelConfigOpen, setFunnelConfigOpen] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const endpointUrl = clientName
    ? `${endpointBase}/functions/v1/conversions?name=${encodeURIComponent(clientName)}`
    : "";

  const copyToClipboard = useCallback(async () => {
    if (!endpointUrl) return;
    await navigator.clipboard.writeText(endpointUrl);
    setCopiedUrl(endpointUrl);
    window.setTimeout(() => setCopiedUrl(null), 2000);
  }, [endpointUrl]);

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50">
        <button
          type="button"
          onClick={() => setEndpointOpen((value) => !value)}
          className="flex w-full cursor-pointer items-center gap-2 p-4"
          aria-expanded={endpointOpen}
        >
          <ChevronIcon open={endpointOpen} />
          <h3 className="text-sm font-semibold text-zinc-200">Endpoint de conversiones</h3>
        </button>
        {endpointOpen && (
          <div className="space-y-3 border-t border-zinc-800 p-4">
            <p className="text-xs text-zinc-400">
              Tus landings y sistemas externos deben enviar POST a esta URL.
            </p>
            {endpointUrl ? (
              <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2">
                <code className="flex-1 break-all text-[11px] text-emerald-400">
                  {endpointUrl}
                </code>
                <button
                  type="button"
                  onClick={() => void copyToClipboard()}
                  className="shrink-0 cursor-pointer rounded p-1 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300"
                  title="Copiar URL"
                  aria-label="Copiar URL del endpoint"
                >
                  {copiedUrl === endpointUrl ? (
                    <span className="text-[10px] text-emerald-400">OK</span>
                  ) : (
                    <CopyIcon />
                  )}
                </button>
              </div>
            ) : (
              <p className="text-[11px] text-amber-400">{endpointMissingMessage}</p>
            )}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50">
        <button
          type="button"
          onClick={() => setFunnelConfigOpen((value) => !value)}
          className="flex w-full cursor-pointer items-center gap-2 p-4"
          aria-expanded={funnelConfigOpen}
        >
          <ChevronIcon open={funnelConfigOpen} />
          <h3 className="text-sm font-semibold text-zinc-200">Personalización del funnel</h3>
        </button>
        {funnelConfigOpen && (
          <div className="space-y-4 border-t border-zinc-800 p-4">
            <div>
              <label
                htmlFor="conversion-premium-threshold"
                className="mb-1 block text-xs font-medium text-zinc-400"
              >
                Monto mínimo para Jugador Premium{" "}
                {isAllCurrencies ? "" : `(${reportingCurrency})`}
              </label>
              <input
                id="conversion-premium-threshold"
                type="text"
                inputMode="numeric"
                value={isAllCurrencies ? "" : formatIntegerWithThousands(premiumThreshold)}
                disabled={isAllCurrencies}
                onChange={(event) => {
                  const raw = event.target.value.replace(/[^\d]/g, "");
                  onPremiumThresholdChange(raw ? Number.parseInt(raw, 10) : 0);
                }}
                className="w-full max-w-xs rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                placeholder="50.000"
              />
              <p className="mt-1 text-[11px] text-zinc-500">
                {isAllCurrencies
                  ? "Seleccioná ARS o PYG arriba para configurar su umbral de manera independiente."
                  : `Solo se compara contra cargas expresadas en ${reportingCurrency}.`}
              </p>
            </div>
          </div>
        )}
      </section>

      {typeof showLogs === "boolean" && onToggleShowLogs && (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <h3 className="text-sm font-semibold text-zinc-200">Visibilidad en cliente</h3>
          <div className="mt-3 space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950/50 px-3 py-2">
              <span className="text-xs text-zinc-300">Mostrar pestaña Logs</span>
              <button
                type="button"
                aria-label="Mostrar pestaña Logs"
                aria-pressed={showLogs}
                onClick={onToggleShowLogs}
                className={`relative inline-flex h-6 w-11 items-center rounded-full border transition ${
                  showLogs
                    ? "border-emerald-500/60 bg-emerald-500/30"
                    : "border-zinc-700 bg-zinc-800"
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                    showLogs ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
          </div>
        </section>
      )}

      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="cursor-pointer rounded-lg bg-zinc-100 px-5 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-200 active:scale-95 disabled:opacity-60"
        >
          {saving ? "Guardando..." : "Guardar configuración"}
        </button>
      </div>
    </div>
  );
}
