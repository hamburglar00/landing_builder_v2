"use client";

import { useState } from "react";
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
}> = [
  {
    value: "classic",
    title: "Clasico",
  },
  {
    value: "constructor",
    title: "Constructor",
  },
];

export function PublishTargetSection({
  landingName,
  publishTarget,
  classicBaseUrl,
  onChange,
}: PublishTargetSectionProps) {
  const [currentUrlCopied, setCurrentUrlCopied] = useState(false);
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

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      <h3 className="mb-1 text-sm font-semibold text-zinc-200">
        Motor de publicacion
      </h3>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {TARGETS.map((target) => {
          const active = publishTarget === target.value;
          const targetUrl =
            target.value === "constructor" ? constructorUrl : classicUrl;

          return (
            <button
              key={target.value}
              type="button"
              onClick={() => onChange(target.value)}
              className={`rounded-xl border px-3 py-3 text-left transition ${
                active
                  ? "border-emerald-500/70 bg-emerald-500/10"
                  : "border-zinc-800 bg-zinc-950/30 hover:border-zinc-700 hover:bg-zinc-900"
              }`}
            >
              <span className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-zinc-100">
                  {target.title}
                </span>
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    active ? "bg-emerald-400" : "bg-zinc-700"
                  }`}
                />
              </span>
              <span className="mt-2 block truncate font-mono text-[10px] text-zinc-400">
                {targetUrl}
              </span>
            </button>
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
