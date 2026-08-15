"use client";

import { useEffect, useId } from "react";
import type {
  LandingMarketCountry,
  LandingThemeConfig,
  LandingWorkspaceCurrency,
} from "@/lib/landing/types";

function countryForWorkspace(
  workspaceCurrency: LandingWorkspaceCurrency,
): LandingMarketCountry {
  return workspaceCurrency === "PYG" ? "PY" : "AR";
}

function countryLabel(country: LandingMarketCountry): string {
  return country === "PY" ? "Paraguay (+595)" : "Argentina (+54)";
}

export function LandingMarketCountryField({
  config,
  setConfig,
  workspaceCurrency = "ARS",
}: {
  config: LandingThemeConfig;
  setConfig: React.Dispatch<React.SetStateAction<LandingThemeConfig>>;
  workspaceCurrency?: LandingWorkspaceCurrency;
}) {
  const id = useId();
  const fixedCountry = countryForWorkspace(workspaceCurrency);

  useEffect(() => {
    if (config.marketCountry === fixedCountry) return;
    setConfig((current) => ({ ...current, marketCountry: fixedCountry }));
  }, [config.marketCountry, fixedCountry, setConfig]);

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-zinc-400">
        País donde circulará la landing
      </label>
      <select
        id={id}
        value={fixedCountry}
        disabled
        className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 disabled:cursor-not-allowed disabled:opacity-80"
      >
        <option value={fixedCountry}>{countryLabel(fixedCountry)}</option>
      </select>
      <p className="mt-1 text-[11px] text-zinc-500">
        Se define automáticamente por el workspace activo.
      </p>
    </div>
  );
}
