"use client";

import { useEffect } from "react";
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

export function LandingMarketCountryField({
  config,
  setConfig,
  workspaceCurrency = "ARS",
}: {
  config: LandingThemeConfig;
  setConfig: React.Dispatch<React.SetStateAction<LandingThemeConfig>>;
  workspaceCurrency?: LandingWorkspaceCurrency;
}) {
  const fixedCountry = countryForWorkspace(workspaceCurrency);

  useEffect(() => {
    if (config.marketCountry === fixedCountry) return;
    setConfig((current) => ({ ...current, marketCountry: fixedCountry }));
  }, [config.marketCountry, fixedCountry, setConfig]);

  // Keep the workspace-derived value in the saved config without an editor field.
  return null;
}
