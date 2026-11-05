"use client";

import type { ReactNode } from "react";
import type { LandingThemeConfig } from "@/lib/landing/types";
import { LandingPreview } from "./LandingPreview";

/** Shared by the client and administrator editors. */
export function LandingEditorPreview({ config, children }: { config: LandingThemeConfig; children: ReactNode }) {
  const help = "La vista previa es aproximada. Para una vista certera, abrí el enlace de la landing.";

  return <>
    <div className="mb-8 mt-8 w-full max-w-[380px] xl:hidden">
      <p className="mb-3 text-xs font-medium text-zinc-500">Vista previa</p>
      <LandingPreview config={config} />
      <p className="mt-3 text-[11px] leading-4 text-[var(--color-text-disabled)]">{help}</p>
      {children}
    </div>

    <aside aria-label="Vista previa y gerencias asignadas" className="sticky top-20 mb-8 hidden max-h-[calc(100dvh-8rem)] w-[360px] min-w-0 self-start overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[rgba(11,15,21,0.72)] shadow-[var(--shadow-card)] xl:flex xl:flex-col">
      <div className="flex shrink-0 items-center justify-between px-3 py-3">
        <p className="text-xs font-semibold text-[var(--color-text)]">Vista previa</p>
        <span className="ui-badge">En vivo</span>
      </div>
      <div tabIndex={0} aria-label="Contenido de la vista previa" className="min-h-0 overflow-y-auto overscroll-contain px-3 pb-5 [scrollbar-gutter:stable]">
        <div className="overflow-hidden rounded-xl border border-[var(--color-border-subtle)]">
          {config.template === "template9" ? <LandingPreview config={config} /> : (
            <div className="flex w-full items-center justify-center p-2">
              <div className="relative h-[397px] w-[224px] shrink-0">
                <div className="absolute left-1/2 top-0 w-[360px] -translate-x-1/2 origin-top scale-[0.62]">
                  <LandingPreview config={config} />
                </div>
              </div>
            </div>
          )}
        </div>
        <p className="mt-3 text-[11px] leading-4 text-[var(--color-text-disabled)]">{help}</p>
        {children}
      </div>
    </aside>
  </>;
}
