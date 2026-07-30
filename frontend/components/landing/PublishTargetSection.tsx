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
  profile: string;
  recommendation: string;
  comparison: Array<{
    label: string;
    value: string;
  }>;
  pros: string[];
  cons: string[];
}> = [
  {
    value: "classic",
    title: "Clásico",
    profile: "Continuidad y compatibilidad",
    recommendation:
      "Elegilo si esta URL ya está publicada en anuncios y no querés modificar una campaña activa.",
    comparison: [
      {
        label: "Carga inicial",
        value: "Buena, aunque más pesada: necesita iniciar React/Next.",
      },
      {
        label: "Teléfono",
        value: "Lo precarga al iniciar la app y reintenta si la red demora.",
      },
      {
        label: "Actualizaciones",
        value: "Funciona como un servicio independiente del Constructor.",
      },
    ],
    pros: [
      "Motor histórico, estable y muy probado en campañas reales.",
      "Conserva la URL actual: no hace falta editar anuncios existentes.",
      "Su despliegue separado aísla los cambios del motor principal.",
    ],
    cons: [
      "Descarga e inicializa una aplicación React antes de quedar plenamente interactivo.",
      "La búsqueda anticipada del teléfono comienza después de esa inicialización.",
      "Las mejoras del motor deben actualizarse también en este proyecto.",
    ],
  },
  {
    value: "constructor",
    title: "Constructor",
    profile: "Rendimiento recomendado",
    recommendation:
      "Es la opción recomendada para campañas nuevas o cuando la prioridad es abrir y responder lo más rápido posible.",
    comparison: [
      {
        label: "Carga inicial",
        value: "Más rápida: entrega HTML listo y no necesita iniciar React.",
      },
      {
        label: "Teléfono",
        value: "Puede venir cacheado en la página y se actualiza en paralelo.",
      },
      {
        label: "Actualizaciones",
        value: "Recibe directamente las mejoras del Constructor.",
      },
    ],
    pros: [
      "Menos JavaScript y CTA disponible antes, especialmente en móviles lentos.",
      "Inicia la obtención del teléfono antes que el motor Clásico.",
      "Publicación, tracking y mejoras quedan centralizados en un solo motor.",
    ],
    cons: [
      "Usa una URL diferente con el formato /l/nombre.",
      "Al migrar una campaña activa hay que reemplazar su enlace en Meta Ads.",
      "Los cambios recién publicados pueden atravesar unos segundos de caché, aunque el sistema los precalienta.",
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
                  className="absolute right-2 top-10 z-30 max-h-[min(34rem,calc(100vh-2rem))] w-[min(23rem,calc(100vw-3rem))] overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-950 p-3.5 text-left shadow-2xl shadow-black/50"
                >
                  <p className="text-xs font-semibold text-zinc-100">
                    Motor {target.title}
                  </p>
                  <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.1em] text-sky-300">
                    {target.profile}
                  </p>
                  <p className="mt-3 rounded-lg border border-sky-500/20 bg-sky-500/5 px-2.5 py-2 text-[11px] leading-4 text-zinc-200">
                    {target.recommendation}
                  </p>
                  <div className="mt-3 grid gap-3">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-sky-300">
                        Comparativa técnica
                      </p>
                      <dl className="mt-1.5 divide-y divide-zinc-800 rounded-lg border border-zinc-800 bg-zinc-900/50 px-2.5">
                        {target.comparison.map((item) => (
                          <div
                            key={item.label}
                            className="grid grid-cols-[5.5rem_1fr] gap-2 py-2 text-[10px] leading-4"
                          >
                            <dt className="font-semibold text-zinc-300">
                              {item.label}
                            </dt>
                            <dd className="text-zinc-400">{item.value}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
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
                  <p className="mt-3 border-t border-zinc-800 pt-2.5 text-[10px] leading-4 text-zinc-500">
                    Ambos conservan la misma lógica de asignación de teléfonos,
                    Pixel/CAPI y conversiones. Cambia la arquitectura de entrega,
                    no la lógica del negocio.
                  </p>
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
