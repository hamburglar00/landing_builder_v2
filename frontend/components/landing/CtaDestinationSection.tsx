"use client";
import { useEffect, type SetStateAction } from "react";
import type { AtrioClient } from "@/lib/atrio/atrioDb";
import type { LandingThemeConfig, TargetProvider } from "@/lib/landing/types";
import CustomSelect from "@/components/ui/CustomSelect";
import { MULTI_SKIN_CATALOG, MULTI_SKIN_CODES, type MultiSkinCode } from "@/lib/multi-skin-catalog";
export function isAtrioUrlValidForSave(config: LandingThemeConfig) {
  return config.ctaDestination === (["template7", "template8"].includes(config.template) ? "atrio" : "whatsapp");
}
export function CtaDestinationSection({ config, setConfig }: {
  config: LandingThemeConfig; setConfig: (updater: SetStateAction<LandingThemeConfig>) => void; atrioClients?: AtrioClient[];
}) {
  useEffect(() => {
    const channel = ["template7", "template8"].includes(config.template) ? "atrio" : "whatsapp";
    if (config.ctaDestination !== channel) setConfig(prev => ({ ...prev, ctaDestination: channel }));
  }, [config.template, config.ctaDestination, setConfig]);
  if (config.template !== "template7") return null;
  return <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-2)] p-4">
    <label htmlFor="template7-target-provider" className="block text-sm font-semibold">Casino</label>
          <CustomSelect
            portal
            id="template7-target-provider"
            value={config.targetProvider}
            onChange={(value) => setConfig((prev) => ({
              ...prev,
              targetProvider: value as TargetProvider,
            }))}
            options={[
              { value: "rey_de_ases", label: "Rey de Ases" },
              { value: "multi_skin", label: "Multi Skin" },
              { value: "ases_del_norte", label: "Ases del Norte" },
              { value: "ganamos_net", label: "Ganamos NET" },
            ]}
            className="mt-2"
            buttonClassName="h-10 bg-zinc-950 px-3 text-sm"
          />

    {config.targetProvider === "multi_skin" && <div className="mt-3">
      <label className="text-sm text-zinc-300">Página de Multi Skin</label>
      <CustomSelect value={config.multiSkinCode} onChange={value => setConfig(prev => ({ ...prev, multiSkinCode: value as MultiSkinCode }))}
        options={MULTI_SKIN_CODES.map(code => ({ value: code, label: MULTI_SKIN_CATALOG[code].name }))}
        className="mt-2" buttonClassName="h-10 bg-zinc-950 px-3 text-sm" />
    </div>}
  </div>;
}
