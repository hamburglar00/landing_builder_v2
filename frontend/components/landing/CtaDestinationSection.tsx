"use client";

import Image from "next/image";
import type { SetStateAction } from "react";
import type { AtrioClient } from "@/lib/atrio/atrioDb";
import type { LandingThemeConfig } from "@/lib/landing/types";

type Props = {
  config: LandingThemeConfig;
  setConfig: (updater: SetStateAction<LandingThemeConfig>) => void;
  atrioClients?: AtrioClient[];
};

export function isAtrioUrlValidForSave(config: LandingThemeConfig) {
  return config.ctaDestination !== "atrio" || Boolean(config.ctaDestination);
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
  const destination = config.ctaDestination === "atrio" ? "atrio" : "whatsapp";
  const targets = [
    {
      value: "whatsapp" as const,
      title: "WhatsApp",
      detail: "Usa el telefono ganador y abre wa.me.",
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
      detail: "Conserva el Contact y redirige al webchat con promo_code.",
      icon: <AtrioLogo />,
    },
  ];

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      <p className="text-sm font-semibold text-zinc-200">Destino del CTA</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
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
              className={`flex min-h-[92px] items-center gap-3 rounded-xl border px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 ${
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
                <span className="mt-1.5 block text-[11px] leading-4 text-zinc-500">
                  {target.detail}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      {destination === "atrio" ? (
        <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
          <p className="text-xs font-medium text-zinc-300">
            Atrio usa la card Redireccion
          </p>
          <p className="mt-1 text-[11px] text-zinc-500">
            Hay {atrioClients.length} cliente(s) Atrio disponibles para este workspace. Selecciona los slugs y el modo de reparto en la card Redireccion.
          </p>
        </div>
      ) : null}
    </div>
  );
}
