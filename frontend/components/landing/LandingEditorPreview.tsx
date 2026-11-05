"use client";

import type { ReactNode } from "react";
import type { LandingThemeConfig } from "@/lib/landing/types";
import { LandingPreview } from "./LandingPreview";
import { EditorPreviewFrame } from "./EditorPreviewFrame";

/** Shared by the client and administrator editors. */
export function LandingEditorPreview({ config, children }: { config: LandingThemeConfig; children: ReactNode }) {
  const help = "La vista previa es aproximada. Para una vista certera, abrí el enlace de la landing.";

  return <>
    <div className="mb-8 mt-8 w-full max-w-[380px] xl:hidden">
      <p className="mb-3 text-xs font-medium text-zinc-500">Vista previa</p>
      {config.template === "template9" ? <LandingPreview config={config} /> : <EditorPreviewFrame><LandingPreview config={config} /></EditorPreviewFrame>}
      <p className="mt-3 text-[11px] leading-4 text-[var(--color-text-disabled)]">{help}</p>
      {children}
    </div>

    <aside aria-label="Vista previa y gerencias asignadas" className="sticky top-20 mb-8 hidden w-[360px] min-w-0 self-start pb-4 xl:block">
      <section aria-label="Vista previa" className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[rgba(11,15,21,0.72)] shadow-[var(--shadow-card)]">
      <div className="flex shrink-0 items-center justify-between px-3 py-3">
        <p className="text-xs font-semibold text-[var(--color-text)]">Vista previa</p>
        <span className="ui-badge">En vivo</span>
      </div>
      <div aria-label="Contenido de la vista previa" className="px-3 pb-5">
        <div className="overflow-hidden rounded-xl border border-[var(--color-border-subtle)]">
          {config.template === "template9" ? <LandingPreview config={config} /> : (
            <EditorPreviewFrame><LandingPreview config={config} /></EditorPreviewFrame>
          )}
        </div>
        <p className="mt-3 text-[11px] leading-4 text-[var(--color-text-disabled)]">{help}</p>
      </div>
      </section>
      {children}
    </aside>
  </>;
}
