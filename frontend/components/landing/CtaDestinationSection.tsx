"use client";

import Image from "next/image";
import { useEffect, type SetStateAction } from "react";
import type { AtrioClient } from "@/lib/atrio/atrioDb";
import type { LandingThemeConfig } from "@/lib/landing/types";
import type { MultiSkinCode, TargetProvider } from "@/lib/landing/types";
import CustomSelect from "@/components/ui/CustomSelect";

type Props = {
  config: LandingThemeConfig;
  setConfig: (updater: SetStateAction<LandingThemeConfig>) => void;
  atrioClients?: AtrioClient[];
};

export function isAtrioUrlValidForSave(config: LandingThemeConfig) {
  return config.template !== "template7" || config.ctaDestination === "atrio";
}

function AtrioLogo() {
  return (
    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1f1f24] ring-1 ring-amber-400/20">
      <svg
        className="h-7 w-7 text-amber-400"
        viewBox="0 0 40 40"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="20" cy="20" r="15" stroke="currentColor" strokeWidth="3" />
        <path
          d="M12 13.5A11 11 0 0 1 23.5 9"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="5 6"
        />
        <path
          d="M28 26.5A11 11 0 0 1 16.5 31"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="5 6"
        />
        <path
          d="M12 18.5c0-3.2 2.7-5.8 6.1-5.8h4.4c3.4 0 6.1 2.6 6.1 5.8s-2.7 5.8-6.1 5.8h-4.1l-5.2 3.5 1.2-4.4A5.6 5.6 0 0 1 12 18.5Z"
          fill="currentColor"
        />
      </svg>
    </span>
  );
}

export function CtaDestinationSection({
  config,
  setConfig,
  atrioClients = [],
}: Props) {
  useEffect(() => {
    if (config.template === "template7" && config.ctaDestination !== "atrio") {
      setConfig((prev) => ({ ...prev, ctaDestination: "atrio" }));
    }
  }, [config.template, config.ctaDestination, setConfig]);
  const destination = config.template === "template7" || (config.template !== "template6" && config.ctaDestination === "atrio") ? "atrio" : "whatsapp";
  const targets = [
    {
      value: "whatsapp" as const,
      title: "WhatsApp",
      icon: (
        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-500/10">
          <Image
            src="/whatsapp-icon.png"
            alt=""
            width={26}
            height={26}
            className="h-6 w-6"
          />
        </span>
      ),
    },
    {
      value: "atrio" as const,
      title: "Atrio",
      icon: <AtrioLogo />,
    },
  ].filter((target) => config.template === "template7" ? target.value === "atrio" : config.template !== "template6" || target.value === "whatsapp");

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      <p className="text-sm font-semibold text-zinc-200">{config.template === "template7" ? "Asignación de asesor" : "Destino del CTA"}</p>
      {config.template === "template7" ? <p className="mt-1 text-xs text-zinc-400">Atrio asigna el asesor; el proveedor de cuenta se elige abajo.</p> : null}
      <div className={`mt-4 grid gap-2 ${config.template === "template6" || config.template === "template7" ? "grid-cols-1" : "sm:grid-cols-2"}`}>
        {targets.map((target) => {
          const active = destination === target.value;

          return (
            <button
              key={target.value}
              type="button"
              onClick={() =>
                setConfig((prev) => ({
                  ...prev,
                  ctaDestination: target.value,
                }))
              }
              aria-pressed={active}
              className={`flex min-h-[72px] items-center gap-3 rounded-xl border px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 ${
                active
                  ? "border-emerald-500/70 bg-emerald-500/10"
                  : "border-zinc-800 bg-zinc-950/30 hover:bg-zinc-900/70"
              }`}
            >
              {target.icon}
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-zinc-100">
                    {target.title}
                  </span>
                  <span
                    className={`ml-auto h-2.5 w-2.5 shrink-0 rounded-full ${
                      active ? "bg-emerald-400" : "bg-zinc-700"
                    }`}
                    aria-hidden="true"
                  />
                </span>
              </span>
            </button>
          );
        })}
      </div>
      {destination === "atrio" && config.template !== "template7" ? (
        <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
          <p className="text-xs font-medium text-zinc-300">
            La asignación de asesor Atrio se configura en la card Redirección.
          </p>
          <p className="mt-1 text-[11px] text-zinc-500">
            Hay {atrioClients.length} cliente(s) Atrio disponibles para este workspace. Selecciona los slugs y el modo de reparto en la card Redireccion.
          </p>
        </div>
      ) : null}
      {config.template === "template7" ? (
        <div className="mt-4">
          <label htmlFor="template7-target-provider" className="block text-sm font-semibold text-zinc-200">
            Proveedor de destino
          </label>
          <CustomSelect
            portal
            id="template7-target-provider"
            value={config.targetProvider === "multi_skin" ? "multi_skin" : "rey_de_ases"}
            onChange={(value) => setConfig((prev) => ({
              ...prev,
              targetProvider: value as TargetProvider,
            }))}
            options={[{ value: "rey_de_ases", label: "Rey de Ases" }, { value: "multi_skin", label: "Multi Skin" }]}
            className="mt-2"
            buttonClassName="h-10 bg-zinc-950 px-3 text-sm"
          />
          {config.targetProvider === "multi_skin" ? (
            <>
              <label htmlFor="template7-multi-skin-code" className="mt-4 block text-sm font-semibold text-zinc-200">
                Sitio Multi Skin
              </label>
              <CustomSelect
                portal
                id="template7-multi-skin-code"
                value={config.multiSkinCode || "ganamos_plus"}
                onChange={(value) => setConfig((prev) => ({
                  ...prev,
                  multiSkinCode: value as MultiSkinCode,
                }))}
                options={[{ value: "ganamos_plus", label: "Ganamos+" }]}
                className="mt-2"
                buttonClassName="h-10 bg-zinc-950 px-3 text-sm"
              />
              <p className="mt-2 text-xs text-zinc-500">
                La cuenta funciona en toda la red Multi Skin; esta opción define qué sitio verá el jugador.
              </p>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
