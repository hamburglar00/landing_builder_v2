"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useGatewayOriginCatalog } from "@/lib/landing/useGatewayOriginCatalog";
import { gatewayPublicationOrigin, supportsGatewayPublication, supportsGatewayLandingName, type GatewayPublicationConfig } from "@/lib/landing/gatewayPublication";
import type { PublishTarget } from "@/lib/landing/types";
import {
  buildLandingPublicUrl,
  getClassicLandingBaseUrl,
  getConstructorLandingBaseUrl,
} from "@/lib/landing/publicUrls";

type PublishTargetSectionProps = {
  landingName: string;
  config?: Partial<GatewayPublicationConfig>;
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
  { value: "gateway", title: "Gateway", profile: "Landing y acceso en el mismo sitio",
    recommendation: "Disponible para Templates 7 y 9 con destino Atrio. La landing se publica en el dominio del casino.",
    comparison: [{ label: "Carga inicial", value: "Formulario HTML listo, con los mismos recursos y tracking del Constructor." }, { label: "Ingreso", value: "Continúa al gateway dentro del mismo dominio." }, { label: "Publicación", value: "Los cambios se reflejan en un máximo de 15 segundos." }],
    pros: ["Conserva el editor, el diseño, Pixel/CAPI y las conversiones.", "Evita cambiar de dominio al continuar hacia el gateway."],
    cons: ["Requiere un gateway compatible y configurado.", "Su rendimiento se compara con los otros motores; compartir dominio no elimina las esperas del proveedor."],
  },
  {
    value: "classic",
    title: "Clásico",
    profile: "Continuidad y compatibilidad",
    recommendation:
      "Elegilo si esta URL ya está publicada en anuncios y no querés modificar una campaña activa.",
    comparison: [
      {
        label: "Carga inicial",
        value: "Templates 7, 8 y 9 entregan el formulario HTML listo; las otras plantillas usan React/Next.",
      },
      {
        label: "Ingreso",
        value: "Las plantillas con Atrio preparan el destino y continúan al dominio del gateway.",
      },
      {
        label: "Actualizaciones",
        value: "Proyecto independiente: sus mejoras se despliegan por separado.",
      },
    ],
    pros: [
      "Templates 7, 8 y 9 comparten el formulario y el runtime liviano con el Constructor.",
      "Conserva la URL actual: no hace falta editar anuncios existentes.",
      "Su despliegue separado aísla los cambios del motor principal.",
    ],
    cons: [
      "Las plantillas anteriores requieren iniciar React antes de habilitar sus funciones.",
      "El recorrido hacia Atrio continúa en otro dominio.",
    ],
  },
  {
    value: "constructor",
    title: "Constructor",
    profile: "Publicación desde el Constructor",
    recommendation:
      "Publica la landing dentro del Constructor. Para elegir por velocidad, compará el recorrido completo del proveedor que usás.",
    comparison: [
      {
        label: "Carga inicial",
        value: "Entrega HTML listo. Templates 7, 8 y 9 comparten el formulario liviano con el Clásico.",
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
      "El formulario se entrega listo, sin depender de la hidratación de React.",
      "Prepara el destino mientras el cliente completa sus datos.",
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
  config,
  publishTarget,
  classicBaseUrl,
  onChange,
}: PublishTargetSectionProps) {
  const gatewayCatalog = useGatewayOriginCatalog(supportsGatewayPublication(config));
  const reservedGatewayName = landingName.toLowerCase() === "nexobet";
  const gatewayOrigin = supportsGatewayLandingName(landingName) ? gatewayPublicationOrigin(config, gatewayCatalog) : null;
  const gatewayUrl = buildLandingPublicUrl(landingName, "gateway", null, gatewayOrigin);
  const [currentUrlCopied, setCurrentUrlCopied] = useState(false);
  const [openInfo, setOpenInfo] = useState<PublishTarget | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const openTarget =
    TARGETS.find((target) => target.value === openInfo) ?? null;
  const currentUrl = buildLandingPublicUrl(
    landingName,
    publishTarget,
    classicBaseUrl,
    gatewayOrigin,
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

    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() => {
      dialogRef.current?.focus();
    });

    const handleDialogKeys = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenInfo(null);
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleDialogKeys);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousBodyOverflow;
      document.removeEventListener("keydown", handleDialogKeys);
    };
  }, [openInfo]);

  return (
    <section
      className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4"
    >
      <h3 className="mb-1 text-sm font-semibold text-zinc-200">
        Motor de publicación
      </h3>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {[...TARGETS].sort((a, b) => ["classic", "constructor", "gateway"].indexOf(a.value) - ["classic", "constructor", "gateway"].indexOf(b.value)).map((target) => {
          const active = publishTarget === target.value;
          const unavailable = target.value === "gateway" && !gatewayOrigin;
          const targetUrl =
            target.value === "gateway" ? gatewayUrl || (reservedGatewayName ? "El nombre nexobet está reservado" : "Requiere Template 7/9 y gateway") : target.value === "constructor" ? constructorUrl : classicUrl;
          const infoOpen = openInfo === target.value;
          const infoId = `publish-target-${target.value}-info`;

          return (
            <div
              key={target.value}
              className={`relative min-w-0 rounded-xl border transition ${
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
                disabled={unavailable}
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

      {openTarget && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[140] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm sm:p-6"
              onPointerDown={(event) => {
                if (event.currentTarget === event.target) setOpenInfo(null);
              }}
            >
              <div
                ref={dialogRef}
                id={`publish-target-${openTarget.value}-info`}
                role="dialog"
                aria-modal="true"
                aria-labelledby={`publish-target-${openTarget.value}-title`}
                tabIndex={-1}
                className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-950 text-left shadow-2xl shadow-black/70 outline-none sm:max-h-[calc(100dvh-3rem)]"
              >
                <div className="flex shrink-0 items-start gap-3 border-b border-zinc-800 px-4 py-3.5">
                  <div className="min-w-0 flex-1">
                    <p
                      id={`publish-target-${openTarget.value}-title`}
                      className="text-sm font-semibold text-zinc-100"
                    >
                      Motor {openTarget.title}
                    </p>
                    <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.1em] text-sky-300">
                      {openTarget.profile}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpenInfo(null)}
                    aria-label="Cerrar información"
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900 text-lg leading-none text-zinc-400 transition hover:border-zinc-600 hover:text-zinc-100"
                  >
                    ×
                  </button>
                </div>

                <div className="min-h-0 overflow-y-auto overscroll-contain px-4 py-4">
                  <p className="rounded-lg border border-sky-500/20 bg-sky-500/5 px-3 py-2.5 text-[11px] leading-4 text-zinc-200">
                    {openTarget.recommendation}
                  </p>
                  <div className="mt-4 grid gap-4">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-sky-300">
                        Comparativa técnica
                      </p>
                      <dl className="mt-2 divide-y divide-zinc-800 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3">
                        {openTarget.comparison.map((item) => (
                          <div
                            key={item.label}
                            className="grid grid-cols-[5.75rem_1fr] gap-3 py-2.5 text-[11px] leading-4"
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
                      <ul className="mt-2 space-y-2 text-[11px] leading-4 text-zinc-300">
                        {openTarget.pros.map((item) => (
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
                      <ul className="mt-2 space-y-2 text-[11px] leading-4 text-zinc-300">
                        {openTarget.cons.map((item) => (
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
                  <p className="mt-4 border-t border-zinc-800 pt-3 text-[10px] leading-4 text-zinc-500">
                    Ambos conservan la misma lógica de asignación de teléfonos,
                    Pixel/CAPI y conversiones. Cambia la arquitectura de entrega,
                    no la lógica del negocio.
                  </p>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </section>
  );
}
