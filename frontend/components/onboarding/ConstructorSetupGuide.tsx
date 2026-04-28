"use client";

import { useCallback, useMemo, useState } from "react";

type GuideStep = {
  title: string;
  eyebrow: string;
  body: string;
  note?: string;
  actionLabel?: string;
  actionHref?: string;
};

type ConstructorSetupGuideProps = {
  open: boolean;
  endpointUrl: string;
  dontShowAgain: boolean;
  onDontShowAgainChange: (checked: boolean) => void;
  onClose: () => void;
};

const steps: GuideStep[] = [
  {
    eyebrow: "Paso 1 de 5",
    title: "Endpoint de conversiones",
    body:
      "Esta URL recibe los eventos que llegan al constructor. Si una landing o herramienta externa necesita informar conversiones, debe enviar los datos a este endpoint.",
    note:
      "También lo podés encontrar en Integraciones > Endpoint de Conversiones del constructor.",
    actionLabel: "Abrir endpoint",
    actionHref: "/dashboard/integraciones?section=endpoint",
  },
  {
    eyebrow: "Paso 2 de 5",
    title: "Gerencias",
    body:
      "Las gerencias sirven para obtener los números de teléfonos asociados a esas gerencias. Podés sincronizarlas desde PBadmin o cargarlas manualmente.",
    note:
      "Sin gerencias, después no vas a poder asociar teléfonos correctamente.",
    actionLabel: "Abrir gerencias",
    actionHref: "/dashboard/gerencias",
  },
  {
    eyebrow: "Paso 3 de 5",
    title: "Teléfonos",
    body:
      "En Teléfonos vas a ver los números sincronizados para cada gerencia. Estos son los teléfonos que después puede usar una landing para redireccionar contactos.",
    note:
      "Verificá que cada gerencia tenga los números correctos antes de poner en circulación la landing.",
    actionLabel: "Abrir teléfonos",
    actionHref: "/dashboard/telefonos",
  },
  {
    eyebrow: "Paso 4 de 5",
    title: "Meta CAPI",
    body:
      "Para enviar eventos de conversión a Meta necesitás cargar un Pixel ID y un Access Token. Esto permite que el constructor informe eventos como Contact a Meta.",
    note:
      "Sin pixel y token, la landing puede funcionar, pero no enviará conversiones a Meta.",
    actionLabel: "Abrir Meta CAPI",
    actionHref: "/dashboard/integraciones?section=meta",
  },
  {
    eyebrow: "Paso 5 de 5",
    title: "Landings",
    body:
      "Cuando ya tengas teléfonos y pixel configurados, entrá al editor de cada landing para definir a qué teléfonos redirecciona y qué pixel usará para enviar eventos.",
    note:
      "Esta configuración es por landing, así podés usar distintos teléfonos o pixeles según la campaña.",
    actionLabel: "Abrir landings",
    actionHref: "/dashboard/landings",
  },
];

export default function ConstructorSetupGuide({
  open,
  endpointUrl,
  dontShowAgain,
  onDontShowAgainChange,
  onClose,
}: ConstructorSetupGuideProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);

  const step = steps[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === steps.length - 1;
  const progressLabel = useMemo(() => `${stepIndex + 1}/${steps.length}`, [stepIndex]);

  const handleCopyEndpoint = useCallback(async () => {
    if (!endpointUrl) return;
    try {
      await navigator.clipboard.writeText(endpointUrl);
      setCopyMsg("Endpoint copiado.");
    } catch {
      setCopyMsg("No se pudo copiar. Selecciona y copia el endpoint manualmente.");
    }
  }, [endpointUrl]);

  const goNext = () => {
    setCopyMsg(null);
    setStepIndex((current) => Math.min(current + 1, steps.length - 1));
  };

  const goBack = () => {
    setCopyMsg(null);
    setStepIndex((current) => Math.max(current - 1, 0));
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 px-4 py-6">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-950 shadow-2xl shadow-black/40">
        <div className="border-b border-zinc-800 bg-zinc-900/70 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-300">
                Guía inicial
              </p>
              <h2 className="mt-1 text-lg font-semibold text-zinc-100">
                Configuración mínima del constructor
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300 transition hover:bg-zinc-800"
            >
              Cerrar
            </button>
          </div>
        </div>

        <div className="p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <span className="rounded-full border border-cyan-700/60 bg-cyan-950/40 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-cyan-200">
              {step.eyebrow}
            </span>
            <span className="text-xs text-zinc-500">{progressLabel}</span>
          </div>

          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
            <h3 className="text-base font-semibold text-zinc-100">{step.title}</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-300">{step.body}</p>

            {stepIndex === 0 && (
              <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950 p-3">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                  URL Post del cliente
                </p>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  {endpointUrl ? (
                    <code className="min-w-0 flex-1 break-all rounded-lg bg-black/30 px-3 py-2 text-xs text-emerald-300">
                      {endpointUrl}
                    </code>
                  ) : (
                    <span className="min-w-0 flex-1 rounded-lg bg-black/30 px-3 py-2 text-xs text-amber-300">
                      No se pudo resolver la URL porque el cliente no tiene name configurado.
                    </span>
                  )}
                  <button
                    type="button"
                    disabled={!endpointUrl}
                    onClick={() => void handleCopyEndpoint()}
                    className="shrink-0 rounded-lg border border-emerald-700/70 bg-emerald-950/30 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-300 transition hover:bg-emerald-950/50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Copiar
                  </button>
                </div>
                {copyMsg && (
                  <p className={`mt-2 text-xs ${copyMsg.includes("copiado") ? "text-emerald-400" : "text-amber-300"}`}>
                    {copyMsg}
                  </p>
                )}
              </div>
            )}

            {step.note && (
              <p className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-xs leading-5 text-zinc-400">
                {step.note}
              </p>
            )}

            {step.actionHref && step.actionLabel && (
              <a
                href={step.actionHref}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex rounded-lg border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-800"
              >
                {step.actionLabel} en nueva pestaña
              </a>
            )}
          </section>

          <div className="mt-4 flex flex-col gap-3 border-t border-zinc-800 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <label className="inline-flex items-center gap-2 text-xs text-zinc-400">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => onDontShowAgainChange(e.target.checked)}
                className="rounded border-zinc-700 bg-zinc-900"
              />
              No volver a mostrar
            </label>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={isFirst}
                onClick={goBack}
                className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Atrás
              </button>
              {isLast ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg bg-cyan-300 px-3 py-2 text-xs font-bold uppercase tracking-wide text-zinc-950 transition hover:bg-cyan-200"
                >
                  Finalizar
                </button>
              ) : (
                <button
                  type="button"
                  onClick={goNext}
                  className="rounded-lg bg-cyan-300 px-3 py-2 text-xs font-bold uppercase tracking-wide text-zinc-950 transition hover:bg-cyan-200"
                >
                  Siguiente
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
