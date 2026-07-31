"use client";

import { useId } from "react";
import type { LandingMarketCountry, LandingThemeConfig } from "@/lib/landing/types";

export function LandingMarketCountryField({
  config,
  setConfig,
}: {
  config: LandingThemeConfig;
  setConfig: React.Dispatch<React.SetStateAction<LandingThemeConfig>>;
}) {
  const id = useId();

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-zinc-400">
        País donde circulará la landing
      </label>
      <select
        id={id}
        value={config.marketCountry}
        onChange={(event) => {
          const marketCountry = event.target.value as LandingMarketCountry;
          setConfig((current) => ({ ...current, marketCountry }));
        }}
        className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
      >
        <option value="AR">Argentina (+54)</option>
        <option value="PY">Paraguay (+595)</option>
      </select>
    </div>
  );
}
