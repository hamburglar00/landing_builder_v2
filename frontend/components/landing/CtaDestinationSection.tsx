"use client";

import type { LandingThemeConfig } from "@/lib/landing/types";

type Props = {
  config: LandingThemeConfig;
  setConfig: (updater: React.SetStateAction<LandingThemeConfig>) => void;
};

function isValidAtrioUrl(value: string) {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function isAtrioUrlValidForSave(config: LandingThemeConfig) {
  return config.ctaDestination !== "atrio" || isValidAtrioUrl(config.atrioRedirectUrl);
}

export function CtaDestinationSection({ config, setConfig }: Props) {
  const destination = config.ctaDestination === "atrio" ? "atrio" : "whatsapp";

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/30 p-3">
      <p className="text-xs font-medium text-zinc-300">Destino del CTA</p>
      <div className="mt-2 inline-flex rounded-lg border border-zinc-800 bg-zinc-950 p-1 text-xs">
        <button
          type="button"
          onClick={() =>
            setConfig((prev) => ({
              ...prev,
              ctaDestination: "whatsapp",
            }))
          }
          className={`rounded-md px-3 py-1.5 transition ${
            destination === "whatsapp"
              ? "bg-zinc-100 text-zinc-950"
              : "text-zinc-300 hover:bg-zinc-800"
          }`}
        >
          WhatsApp
        </button>
        <button
          type="button"
          onClick={() =>
            setConfig((prev) => ({
              ...prev,
              ctaDestination: "atrio",
            }))
          }
          className={`rounded-md px-3 py-1.5 transition ${
            destination === "atrio"
              ? "bg-zinc-100 text-zinc-950"
              : "text-zinc-300 hover:bg-zinc-800"
          }`}
        >
          Atrio
        </button>
      </div>
      <p className="mt-2 text-[11px] text-zinc-500">
        WhatsApp usa el telefono ganador. Atrio conserva el Contact y redirige al webchat con promo_code.
      </p>
      {destination === "atrio" ? (
        <div className="mt-3">
          <label className="mb-1 block text-xs font-medium text-zinc-400">
            URL de Atrio <span className="text-red-400">*</span>
          </label>
          <input
            type="url"
            value={config.atrioRedirectUrl}
            onChange={(event) =>
              setConfig((prev) => ({
                ...prev,
                atrioRedirectUrl: event.target.value,
              }))
            }
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
            placeholder="https://www.atrio.website/gera"
          />
          <p className="mt-1 text-[11px] text-zinc-500">
            Al abrirse, se agrega automaticamente el parametro promo_code.
          </p>
        </div>
      ) : null}
    </div>
  );
}
