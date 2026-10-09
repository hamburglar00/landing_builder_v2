"use client";

import { useEffect, useId } from "react";
import type {
  LandingMarketCountry,
  LandingThemeConfig,
  LandingWorkspaceCurrency,
} from "@/lib/landing/types";
import CustomSelect from "@/components/ui/CustomSelect";

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
      <CustomSelect
        id={id}
        value={fixedCountry}
        disabled
        onChange={() => undefined}
        options={[{ value: fixedCountry, label: countryLabel(fixedCountry) }]}
        buttonClassName="h-10 px-3 text-sm disabled:opacity-80"
      />
      <p className="mt-1 text-[11px] text-zinc-500">
        Se define automáticamente por el workspace activo.
      </p>
    </div>
  );
}
