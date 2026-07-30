"use client";

import { useEffect, useRef, useState } from "react";
import type { PublishTarget } from "@/lib/landing/types";
import {
  buildLandingPublicUrl,
  getClassicLandingBaseUrl,
  getConstructorLandingBaseUrl,
} from "@/lib/landing/publicUrls";

type PublishTargetSectionProps = {
  landingName: string;
  publishTarget: PublishTarget;
  classicBaseUrl?: string | null;
  onChange: (publishTarget: PublishTarget) => void;
};

const TARGETS: Array<{
  value: PublishTarget;
  title: string;
  pros: string[];
  cons: string[];
}> = [
  {
    value: "classic",
    title: "Clásico",
    pros: [
      "Estable y probado en campañas.",
      "Conserva tus enlaces actuales sin cambios.",
    ],
    cons: [
      "Las mejoras se actualizan por separado.",
      "Los cambios pueden tardar un poco más en verse.",
    ],
  },
  {
    value: "constructor",
    title: "Constructor",
    pros: [
      "Carga más liviana y rápida.",
      "Recibe primero las mejoras del editor.",
    ],
    cons: [
      "Utiliza una dirección web diferente.",
      "Migrar una campaña activa requiere actualizar su enlace.",
    ],
  },
];

export function PublishTargetSection({
  landingName,
  publishTarget,
  classicBaseUrl,
  onChange,
}: PublishTargetSectionProps) {
  const [currentUrlCopied, setCurrentUrlCopied] = useState(false);
  const [openInfo, setOpenInfo] = useState<PublishTarget | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const currentUrl = buildLandingPublicUrl(
    landingName,
    publishTarget,
    classicBaseUrl,
  );
  const classicUrl = `${getClassicLandingBaseUrl(classicBaseUrl)}/${encodeURIComponent(
    landingName,
  )}`;
  const constructorUrl = `${getConstructorLandingBaseUrl()}/l/${encodeURIComponent(
    landingName,
  )}`;
  const handleCopyCurrentUrl = async () => {
    if (!currentUrl) return;
    await navigator.clipboard.writeText(currentUrl);
    setCurrentUrlCopied(true);
    window.setTimeout(() => setCurrentUrlCopied(false), 1200);
  };

  useEffect(() => {
    if (!openInfo) return;

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (
        sectionRef.current &&
        event.target instanceof Node &&
        !sectionRef.current.contains(event.target)
      ) {
        setOpenInfo(null);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenInfo(null);
    };

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [openInfo]);

  return (
    <section
      ref={sectionRef}
      className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4"
    >
      <h3 className="mb-1 text-sm font-semibold text-zinc-200">
        Motor de publicación
      </h3>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {TARGETS.map((target) => {
          const active = publishTarget === target.value;
          const targetUrl =
            target.value === "constructor" ? constructorUrl : classicUrl;
          const infoOpen = openInfo === target.value;
          const infoId = `publish-target-${target.value}-info`;

          return (
            <div
              key={target.value}
              className={`relative rounded-xl border transition ${
                active
                  ? "border-emerald-500/70 bg-emerald-500/10"
                  : "border-zinc-800 bg-zinc-950/30"
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  setOpenInfo(null);
                  onChange(target.value);
                }}
                aria-pressed={active}
                aria-label={`Usar motor ${target.title}`}
                className={`absolute inset-0 rounded-xl transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 ${
                  active ? "" : "hover:bg-zinc-900/70"
                }`}
              />

              <div className="pointer-events-none relative px-3 py-3">
                <span className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-zinc-100">
                    {target.title}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setOpenInfo((current) =>
                        current === target.value ? null : target.value,
                      )
                    }
                    aria-label={`Ver ventajas y contras del motor ${target.title}`}
                    aria-expanded={infoOpen}
                    aria-controls={infoId}
                    title="Ver ventajas y contras"
                    className={`pointer-events-auto relative z-10 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold transition ${
                      infoOpen
                        ? "border-sky-400/60 bg-sky-400/15 text-sky-300"
                        : "border-zinc-600 bg-zinc-900/90 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                    }`}
                  >
                    i
                  </button>
                  <span
                    className={`ml-auto h-2.5 w-2.5 shrink-0 rounded-full ${
                      active ? "bg-emerald-400" : "bg-zinc-700"
                    }`}
                    aria-hidden="true"
                  />
                </span>
                <span className="mt-2 block truncate font-mono text-[10px] text-zinc-400">
                  {targetUrl}
                </span>
              </div>

              {infoOpen ? (
                <div
                  id={infoId}
                  role="tooltip"
                  className="absolute right-2 top-10 z-30 w-[min(18rem,calc(100vw-3rem))] rounded-xl border border-zinc-700 bg-zinc-950 p-3.5 text-left shadow-2xl shadow-black/50"
                >
                  <p className="text-xs font-semibold text-zinc-100">
                    Motor {target.title}
                  </p>
                  <div className="mt-3 grid gap-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-400">
                        Ventajas
                      </p>
                      <ul className="mt-1.5 space-y-1.5 text-[11px] leading-4 text-zinc-300">
                        {target.pros.map((item) => (
                          <li key={item} className="flex gap-2">
                            <span
                              className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400"
                              aria-hidden="true"
                            />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-300">
                        A tener en cuenta
                      </p>
                      <ul className="mt-1.5 space-y-1.5 text-[11px] leading-4 text-zinc-300">
                        {target.cons.map((item) => (
                          <li key={item} className="flex gap-2">
                            <span
                              className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300"
                              aria-hidden="true"
                            />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2">
        <p className="min-w-0 flex-1 truncate font-mono text-[10px] text-zinc-400">
          URL actual: {currentUrl}
        </p>
        <button
          type="button"
          onClick={handleCopyCurrentUrl}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-zinc-700 bg-zinc-900 text-zinc-300 transition hover:bg-zinc-800 hover:text-zinc-100"
          title="Copiar URL actual"
          aria-label="Copiar URL actual"
        >
          {currentUrlCopied ? (
            <span className="text-[10px] text-emerald-400">OK</span>
          ) : (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
            </svg>
          )}
        </button>
      </div>
    </section>
  );
}
