"use client";

import { useState } from "react";
import type { LandingThemeConfig } from "@/lib/landing/types";
import { ColorSelect } from "./ColorSelect";
import { ImageUploader } from "./ImageUploader";

interface LandingEditorFormProps {
  config: LandingThemeConfig;
  setConfig: React.Dispatch<React.SetStateAction<LandingThemeConfig>>;
  onSave: () => void;
  onReset: () => void;
  /** Sube la imagen a Supabase y devuelve la URL pública. Si se pasa, las imágenes se guardan en Storage. */
  uploadImage?: (file: File) => Promise<string>;
}

function updateConfig(
  setConfig: React.Dispatch<React.SetStateAction<LandingThemeConfig>>,
  patch: Partial<LandingThemeConfig>,
) {
  setConfig((prev) => ({ ...prev, ...patch }));
}

function CollapsibleSection({
  id,
  title,
  defaultOpen,
  children,
}: {
  id: string;
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-zinc-200 hover:bg-zinc-800/50"
        aria-expanded={open}
      >
        {title}
        <span className="text-zinc-500 transition-transform" aria-hidden>
          {open ? "▼" : "▶"}
        </span>
      </button>
      {open && <div className="space-y-4 border-t border-zinc-800 p-4">{children}</div>}
    </section>
  );
}

/**
 * Formulario del dashboard del constructor de landing por secciones.
 * Cada sección es colapsable. Incluye acciones: Guardar, Resetear, Exportar JSON.
 */
export function LandingEditorForm({
  config,
  setConfig,
  onSave,
  onReset,
  uploadImage,
}: LandingEditorFormProps) {
  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(config, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "landing-config.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
    >
      <CollapsibleSection id="fondo" title="Fondo" defaultOpen>
        <div className="space-y-4">
          <div>
            <span className="block text-xs font-medium text-zinc-400 mb-2">
              Modo
            </span>
            <div className="flex gap-4">
              {(["single", "rotating"] as const).map((mode) => (
                <label key={mode} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="backgroundMode"
                    value={mode}
                    checked={config.backgroundMode === mode}
                    onChange={() =>
                      updateConfig(setConfig, { backgroundMode: mode })
                    }
                    className="rounded border-zinc-600"
                  />
                  <span className="text-sm text-zinc-300">
                    {mode === "single" ? "Una imagen" : "Rotando"}
                  </span>
                </label>
              ))}
            </div>
          </div>
          <ImageUploader
            label="Imágenes de fondo"
            multiple
            value={config.backgroundImages}
            onChange={(urls) =>
              updateConfig(setConfig, { backgroundImages: urls })
            }
            onUpload={uploadImage}
          />
          {config.backgroundMode === "rotating" && (
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Rotar cada (horas)
              </label>
              <input
                type="number"
                min={1}
                max={168}
                value={config.rotateEveryHours}
                onChange={(e) =>
                  updateConfig(setConfig, {
                    rotateEveryHours: Math.max(
                      1,
                      Math.min(168, Number(e.target.value) || 1),
                    ),
                  })
                }
                className="w-24 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
              />
            </div>
          )}
        </div>
      </CollapsibleSection>

      <CollapsibleSection id="logo" title="Logo">
        <ImageUploader
          label="Logo"
          multiple={false}
          value={config.logoUrl ? [config.logoUrl] : []}
          onChange={(urls) =>
            updateConfig(setConfig, { logoUrl: urls[0] ?? "" })
          }
          onUpload={uploadImage}
        />
      </CollapsibleSection>

      <CollapsibleSection id="titulo" title="Título">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Línea 1
            </label>
            <input
              type="text"
              value={config.titleLine1}
              onChange={(e) =>
                updateConfig(setConfig, { titleLine1: e.target.value })
              }
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Línea 2
            </label>
            <input
              type="text"
              value={config.titleLine2}
              onChange={(e) =>
                updateConfig(setConfig, { titleLine2: e.target.value })
              }
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
            />
          </div>
          <ColorSelect
            label="Color del título"
            value={config.titleColor}
            onChange={(titleColor) =>
              updateConfig(setConfig, { titleColor })
            }
          />
        </div>
      </CollapsibleSection>

      <CollapsibleSection id="informacion" title="Información">
        <div className="space-y-3">
          {(["subtitleLine1", "subtitleLine2", "subtitleLine3"] as const).map(
            (key, i) => (
              <div key={key}>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Línea {i + 1}
                </label>
                <input
                  type="text"
                  value={config[key]}
                  onChange={(e) =>
                    updateConfig(setConfig, { [key]: e.target.value })
                  }
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                />
              </div>
            ),
          )}
          <ColorSelect
            label="Color del texto"
            value={config.subtitleColor}
            onChange={(subtitleColor) =>
              updateConfig(setConfig, { subtitleColor })
            }
          />
        </div>
      </CollapsibleSection>

      <CollapsibleSection id="texto-final" title="Texto final">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Texto del badge
            </label>
            <input
              type="text"
              value={config.footerBadgeText}
              onChange={(e) =>
                updateConfig(setConfig, { footerBadgeText: e.target.value })
              }
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
            />
          </div>
          <ColorSelect
            label="Color del badge"
            value={config.footerBadgeColor}
            onChange={(footerBadgeColor) =>
              updateConfig(setConfig, { footerBadgeColor })
            }
          />
        </div>
      </CollapsibleSection>

      <CollapsibleSection id="cta" title="CTA">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Texto del botón
            </label>
            <input
              type="text"
              value={config.ctaText}
              onChange={(e) =>
                updateConfig(setConfig, { ctaText: e.target.value })
              }
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
            />
          </div>
          <ColorSelect
            label="Color del texto del CTA"
            value={config.ctaTextColor}
            onChange={(ctaTextColor) =>
              updateConfig(setConfig, { ctaTextColor })
            }
          />
          <ColorSelect
            label="Color de fondo del CTA"
            value={config.ctaBackgroundColor}
            onChange={(ctaBackgroundColor) =>
              updateConfig(setConfig, { ctaBackgroundColor })
            }
          />
          <ColorSelect
            label="Color del brillo del CTA"
            value={config.ctaGlowColor}
            onChange={(ctaGlowColor) =>
              updateConfig(setConfig, { ctaGlowColor })
            }
          />
        </div>
      </CollapsibleSection>

      {/* Acciones */}
      <div className="flex flex-wrap gap-3 border-t border-zinc-800 pt-6">
        <button
          type="submit"
          className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-200"
        >
          Guardar
        </button>
        <button
          type="button"
          onClick={onReset}
          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800"
        >
          Resetear
        </button>
        <button
          type="button"
          onClick={handleExportJson}
          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800"
        >
          Exportar JSON
        </button>
      </div>
    </form>
  );
}
