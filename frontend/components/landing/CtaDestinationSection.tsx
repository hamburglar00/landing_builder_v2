"use client";
import { useEffect, useRef, type SetStateAction } from "react";
import Image from "next/image";
import type { AtrioClient } from "@/lib/atrio/atrioDb";
import type { LandingThemeConfig, TargetProvider, LandingCtaDestination, TemplateOption } from "@/lib/landing/types";
import { templateChannel } from "@/lib/landing/channels";
import { switchLandingTemplate } from "@/lib/landing/templateVariants";
import CustomSelect from "@/components/ui/CustomSelect";
import { MULTI_SKIN_CATALOG, MULTI_SKIN_CODES, type MultiSkinCode } from "@/lib/multi-skin-catalog";
export function isAtrioUrlValidForSave(config: LandingThemeConfig) {
  return config.ctaDestination === (["template7", "template8", "template9"].includes(config.template) ? "atrio" : "whatsapp");
}
export function CtaDestinationSection({ config, setConfig, allowAtrio = true }: {
  config: LandingThemeConfig; setConfig: (updater: SetStateAction<LandingThemeConfig>) => void; atrioClients?: AtrioClient[];
  allowAtrio?: boolean;
}) {
  const channel = templateChannel(config.template);
  const lastTemplate = useRef<Record<LandingCtaDestination, TemplateOption>>({ whatsapp: "template1", atrio: "template7" });
  function selectChannel(next: LandingCtaDestination) {
    if(next === channel || (next === "atrio" && !allowAtrio))return;
    lastTemplate.current[channel] = config.template;
    const nextTemplate=lastTemplate.current[next];
    setConfig(current => switchLandingTemplate(current, nextTemplate));
  }
  useEffect(() => {
    const channel = ["template7", "template8", "template9"].includes(config.template) ? "atrio" : "whatsapp";
    if (config.ctaDestination !== channel) setConfig(prev => ({ ...prev, ctaDestination: channel }));
  }, [config.template, config.ctaDestination, setConfig]);
  const usesAtrio = ["template7", "template8", "template9"].includes(config.template);
  const showPlatform = config.template === "template7" || config.template === "template9";
  return <section className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50" aria-label="Canal de la landing">
    <h2 className="border-b border-zinc-800 px-4 py-3 text-sm font-semibold text-zinc-200">Canal</h2>
    <div className="space-y-4 p-4">
    <div role="group" aria-label="Canal de atención" className="grid grid-cols-2 gap-3">
    {(["whatsapp", "atrio"] as const).map(option => <button key={option} type="button" aria-pressed={channel === option}
      disabled={option === "atrio" && !allowAtrio} onClick={() => selectChannel(option)}
      title={option === "atrio" && !allowAtrio ? "Atrio debe estar habilitado en los permisos del cliente." : undefined}
      className={`flex min-w-0 flex-col items-start gap-2 rounded-xl border p-3 text-left transition sm:flex-row sm:items-center sm:gap-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-40 ${channel === option ? "border-[var(--color-primary)] bg-[var(--color-primary-soft-bg)]" : "border-zinc-700 bg-zinc-950/30 hover:border-zinc-500"}`}>
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${option === "atrio" ? "bg-[#1A1A1F]" : "bg-emerald-400/10"}`}>
        <Image
          src={option === "atrio" ? "/brand/atrio/icon.svg" : "/whatsapp-icon.png"}
          alt=""
          width={32}
          height={32}
          className={option === "atrio" ? "h-8 w-8" : "h-6 w-6"}
          unoptimized
        />
      </span>
      <span className="break-words text-sm font-semibold text-zinc-100">{option === "atrio" ? "Atrio" : "WhatsApp"}</span>
    </button>)}
    </div>
    <p className="text-xs leading-relaxed text-zinc-400">{usesAtrio ? "El cliente crea su usuario y continúa con su asesor en el chat de Atrio." : "El cliente continúa la conversación por WhatsApp."}</p>
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
    </div>
  </section>;
}
