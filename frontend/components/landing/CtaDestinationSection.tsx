"use client";
import { useEffect, type SetStateAction } from "react";
import Image from "next/image";
import type { AtrioClient } from "@/lib/atrio/atrioDb";
import type { LandingThemeConfig, TargetProvider } from "@/lib/landing/types";
import CustomSelect from "@/components/ui/CustomSelect";
import { MULTI_SKIN_CATALOG, MULTI_SKIN_CODES, type MultiSkinCode } from "@/lib/multi-skin-catalog";
export function isAtrioUrlValidForSave(config: LandingThemeConfig) {
  return config.ctaDestination === (["template7", "template8", "template9"].includes(config.template) ? "atrio" : "whatsapp");
}
export function CtaDestinationSection({ config, setConfig }: {
  config: LandingThemeConfig; setConfig: (updater: SetStateAction<LandingThemeConfig>) => void; atrioClients?: AtrioClient[];
}) {
  useEffect(() => {
    const channel = ["template7", "template8", "template9"].includes(config.template) ? "atrio" : "whatsapp";
    if (config.ctaDestination !== channel) setConfig(prev => ({ ...prev, ctaDestination: channel }));
  }, [config.template, config.ctaDestination, setConfig]);
  const usesAtrio = ["template7", "template8", "template9"].includes(config.template);
  const showPlatform = config.template === "template7" || config.template === "template9";
  return <div className="space-y-4">
    <div className={`flex items-start gap-3 rounded-xl border p-4 ${usesAtrio ? "border-violet-400/25 bg-violet-400/[0.06]" : "border-emerald-400/25 bg-emerald-400/[0.06]"}`}>
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${usesAtrio ? "bg-[#1A1A1F]" : "bg-emerald-400/10"}`}>
        <Image
          src={usesAtrio ? "/brand/atrio/icon.svg" : "/whatsapp-icon.png"}
          alt={usesAtrio ? "Atrio" : "WhatsApp"}
          width={32}
          height={32}
          className={usesAtrio ? "h-8 w-8" : "h-6 w-6"}
          unoptimized
        />
      </span>
      <div>
        <p className="text-xs text-zinc-400">Canal de atención</p>
        <p className={`mt-0.5 text-sm font-semibold ${usesAtrio ? "text-violet-200" : "text-emerald-200"}`}>{usesAtrio ? "Atrio" : "WhatsApp"}</p>
        <p className="mt-1 text-xs leading-relaxed text-zinc-400">{usesAtrio ? "El cliente crea su usuario y continúa con su asesor en el chat de Atrio." : "El cliente continúa la conversación por WhatsApp."}</p>
      </div>
    </div>
    {showPlatform && <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-2)] p-4">
    <label htmlFor="template7-target-provider" className="block text-sm font-semibold">Plataforma</label>
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
    </div>}
  </div>;
}
