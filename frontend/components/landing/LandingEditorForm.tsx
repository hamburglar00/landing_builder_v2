"use client";

import { useId, useState } from "react";
import type {
  LandingTemplate4ChatConfig,
  LandingThemeConfig,
  CtaPositionOption,
  TemplateOption,
} from "@/lib/landing/types";
import { ColorSelect } from "./ColorSelect";
import { ImageUploader } from "./ImageUploader";
import { buildLandingConfig } from "@/lib/landing/buildLandingConfig";
import ModalPortal from "@/components/ui/ModalPortal";

interface LandingEditorFormProps {
  config: LandingThemeConfig;
  setConfig: React.Dispatch<React.SetStateAction<LandingThemeConfig>>;
  onSave: () => void;
  onReset: () => void;
  showTemplateSection?: boolean;
  /** Sube la imagen a Supabase y devuelve la URL pública. Si se pasa, las imágenes se guardan en Storage. */
  uploadImage?: (file: File) => Promise<string>;
  /** Identificación básica de la landing (usada en el JSON exportado). */
  landingId?: string;
  landingName?: string;
  /** Comentario interno de la landing (identificación). */
  comment?: string;
  /** Tracking de la landing. */
  pixelId?: string;
  postUrl?: string;
  landingTag?: string;
  /** Obtiene un número según la config de redirección y devuelve el teléfono para armar wa.me. */
  getPhoneForPreview?: () => Promise<string | null>;
}

function updateConfig(
  setConfig: React.Dispatch<React.SetStateAction<LandingThemeConfig>>,
  patch: Partial<LandingThemeConfig>,
) {
  setConfig((prev) => ({ ...prev, ...patch }));
}

function ToggleSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={[
        "flex h-6 w-11 items-center rounded-full border px-0.5 transition",
        checked
          ? "border-emerald-400/60 bg-emerald-500/25"
          : "border-zinc-700 bg-zinc-800",
      ].join(" ")}
    >
      <span
        className={[
          "h-5 w-5 rounded-full transition-transform",
          checked ? "translate-x-5 bg-emerald-300" : "translate-x-0 bg-zinc-400",
        ].join(" ")}
      />
    </button>
  );
}

export function CollapsibleSection({
  title,
  defaultOpen,
  children,
}: {
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
        className="flex w-full cursor-pointer items-center justify-between px-4 py-3 text-left text-sm font-semibold text-zinc-200 hover:bg-zinc-800/50"
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

const TEMPLATE_OPTIONS: { label: string; value: TemplateOption }[] = [
  { label: "Plantilla 1", value: "template1" },
  { label: "Plantilla 2", value: "template2" },
  { label: "Plantilla 3 (redirect)", value: "template3" },
  { label: "Plantilla 4 (chat)", value: "template4" },
  { label: "Plantilla 5 (live)", value: "template5" },
];

const LEAD_CAPTURE_DEFAULT_TITLE =
  "Desbloqueá atención personalizada";
const LEAD_CAPTURE_DEFAULT_DESCRIPTION =
  "Completá tus datos o seguí directo a WhatsApp.";

const TEMPLATE4_CHAT_DEFAULTS: LandingTemplate4ChatConfig = {
  profileImageUrl: "",
  bubble1Text: "Hola, soy {{name}}, enviame un mensaje y comenzamos ya mismo.",
  bubble2Intro: "Te acompaño en todo el proceso",
  bubble2Item1: "💸 Cargas y retiros las 24hs",
  bubble2Item2: "👤 Atencion personalizada",
  bubble2Item3: "🛡️ Respaldo y mas de 5 anos de experiencia",
  bubble3Text: "Arrancamos? Toca abajo y comenzamos",
};

export function LandingTemplateSection({
  config,
  setConfig,
}: {
  config: LandingThemeConfig;
  setConfig: React.Dispatch<React.SetStateAction<LandingThemeConfig>>;
}) {
  return (
    <CollapsibleSection title="Plantilla" defaultOpen>
      <div className="space-y-3">
        <p className="text-xs text-zinc-400">
          Elegí la plantilla de layout que define qué secciones se configuran.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          {TEMPLATE_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className="flex flex-1 cursor-pointer items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-800"
            >
              <input
                type="radio"
                name="landing-template"
                value={opt.value}
                checked={config.template === opt.value}
                onChange={() =>
                  updateConfig(setConfig, {
                    template: opt.value,
                    ...(opt.value === "template4" &&
                    (!config.ctaText.trim() || config.ctaText === "Acceder")
                      ? { ctaText: "ABRIR WHATSAPP" }
                      : {}),
                    ...(opt.value === "template4" && config.ctaTextColor === "black"
                      ? { ctaTextColor: "white" as const }
                      : {}),
                    ...(opt.value === "template4" && config.ctaBackgroundColor === "gold"
                      ? { ctaBackgroundColor: "whatsapp_green" as const }
                      : {}),
                  })
                }
                className="h-3.5 w-3.5 rounded-full border-zinc-500"
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
      </div>
    </CollapsibleSection>
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
  showTemplateSection = true,
  uploadImage,
  landingId,
  landingName,
  comment,
  pixelId,
  postUrl,
  landingTag,
  getPhoneForPreview,
}: LandingEditorFormProps) {
  const formId = useId();
  const fieldId = (name: string) => `${formId}-${name}`;
  const [probarLoading, setProbarLoading] = useState(false);
  const [probarError, setProbarError] = useState<string | null>(null);
  const [showJsonModal, setShowJsonModal] = useState(false);
  const [copying, setCopying] = useState(false);
  const [copyOk, setCopyOk] = useState(false);

  const fontSizeOptions = [
    { label: "Muy chico (12px)", value: 12 },
    { label: "Chico (14px)", value: 14 },
    { label: "Normal (16px)", value: 16 },
    { label: "Grande (18px)", value: 18 },
    { label: "Muy grande (22px)", value: 22 },
    { label: "Título (26px)", value: 26 },
    { label: "Título XL (30px)", value: 30 },
  ];

  const ctaPositionOptions: { label: string; value: CtaPositionOption }[] = [
    { label: "Arriba (debajo del logo)", value: "top" },
    {
      label: "Entre título e info (por defecto)",
      value: "between_title_and_info",
    },
    {
      label: "Entre info y texto final",
      value: "between_info_and_badge",
    },
    { label: "Abajo de todo", value: "bottom" },
  ];

  const isTemplate3 = config.template === "template3";
  const isTemplate4 = config.template === "template4";
  const isFixedVisualTemplate =
    config.template === "template4" || config.template === "template5";
  const hidesVisualControls = isTemplate3 || isFixedVisualTemplate;
  const template4Chat = {
    ...TEMPLATE4_CHAT_DEFAULTS,
    ...(config.template4Chat ?? {}),
  };
  const template4CtaText =
    config.ctaText.trim() && config.ctaText !== "Acceder"
      ? config.ctaText
      : "ABRIR WHATSAPP";
  const template4CtaTextColor =
    config.ctaTextColor === "black" ? "white" : config.ctaTextColor;
  const template4CtaBackgroundColor =
    config.ctaBackgroundColor === "gold" ? "whatsapp_green" : config.ctaBackgroundColor;
  const leadCapture = config.leadCapture ?? {
    enabled: false,
    title: LEAD_CAPTURE_DEFAULT_TITLE,
    description: LEAD_CAPTURE_DEFAULT_DESCRIPTION,
    fields: {
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
    },
  };

  const updateLeadCapture = (
    patch: Omit<Partial<LandingThemeConfig["leadCapture"]>, "fields"> & {
      fields?: Partial<LandingThemeConfig["leadCapture"]["fields"]>;
    },
  ) => {
    updateConfig(setConfig, {
      leadCapture: {
        ...leadCapture,
        ...patch,
        fields: {
          ...leadCapture.fields,
          ...(patch.fields ?? {}),
        },
      },
    });
  };

  const updateTemplate4Chat = (
    patch: Partial<LandingTemplate4ChatConfig>,
  ) => {
    updateConfig(setConfig, {
      template4Chat: {
        ...template4Chat,
        ...patch,
      },
    });
  };

  const handleProbarAhora = async () => {
    if (!getPhoneForPreview) return;
    setProbarLoading(true);
    setProbarError(null);
    try {
      const phone = await getPhoneForPreview();
      if (!phone) {
        setProbarError("No se pudo obtener un número. Revisá gerencias asignadas y sincronización.");
        return;
      }
      const digits = phone.replace(/\D/g, "");
      if (!digits.length) {
        setProbarError("Número inválido.");
        return;
      }
      window.open(`https://wa.me/${digits}`, "_blank", "noopener,noreferrer");
    } catch {
      setProbarError("Error al obtener el número.");
    } finally {
      setProbarLoading(false);
    }
  };

  const handleExportJson = () => {
    setShowJsonModal(true);
    setCopyOk(false);
  };

  const buildExportPayload = () => {
    return buildLandingConfig({
      id: landingId ?? "",
      name: landingName ?? "",
      comment: comment ?? "",
      pixelId: pixelId ?? "",
      postUrl: postUrl ?? "",
      landingTag: landingTag ?? "",
      config,
      phoneMode: undefined,
      updatedAt: undefined,
    });
  };

  const handleCopyJson = async () => {
    try {
      setCopying(true);
      setCopyOk(false);
      const text = JSON.stringify(buildExportPayload(), null, 2);
      await navigator.clipboard.writeText(text);
      setCopyOk(true);
    } catch {
      setCopyOk(false);
    } finally {
      setCopying(false);
    }
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
    >
      {showTemplateSection && (
        <LandingTemplateSection config={config} setConfig={setConfig} />
      )}

      {!hidesVisualControls && (
        <CollapsibleSection title="CTA">
        <div className="space-y-3">
          <div>
            <label
              htmlFor={fieldId("cta-text")}
              className="block text-xs font-medium text-zinc-400 mb-1"
            >
              Texto del botón
            </label>
            <input
              id={fieldId("cta-text")}
              type="text"
              value={config.ctaText}
              onChange={(e) =>
                updateConfig(setConfig, { ctaText: e.target.value })
              }
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor={fieldId("cta-font-size")}
                className="block text-xs font-medium text-zinc-400 mb-1"
              >
                Tamaño de letra del CTA
              </label>
              <select
                id={fieldId("cta-font-size")}
                value={config.ctaFontSize}
                onChange={(e) =>
                  updateConfig(setConfig, {
                    ctaFontSize: Number(e.target.value) || config.ctaFontSize,
                  })
                }
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100"
              >
                {fontSizeOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-2 pt-1">
              <input
                id={fieldId("cta-bold")}
                type="checkbox"
                checked={config.ctaBold}
                onChange={(e) =>
                  updateConfig(setConfig, { ctaBold: e.target.checked })
                }
                className="h-4 w-4 rounded border-zinc-600 bg-zinc-900"
              />
              <label
                htmlFor={fieldId("cta-bold")}
                className="text-xs font-medium text-zinc-300"
              >
                CTA en negrita
              </label>
            </div>
          </div>
          {config.template !== "template2" && (
            <div>
              <label
                htmlFor={fieldId("cta-position")}
                className="block text-xs font-medium text-zinc-400 mb-1"
              >
                Posici?n del CTA
              </label>
              <select
                id={fieldId("cta-position")}
                value={config.ctaPosition}
                onChange={(e) =>
                  updateConfig(setConfig, {
                    ctaPosition: e.target.value as CtaPositionOption,
                  })
                }
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100"
              >
                {ctaPositionOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}
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
          {config.template !== "template2" && (
            <ColorSelect
              label="Color del brillo del CTA"
              value={config.ctaGlowColor}
              onChange={(ctaGlowColor) =>
                updateConfig(setConfig, { ctaGlowColor })
              }
            />
          )}
          {getPhoneForPreview && (
            <div className="mt-3 space-y-2 rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex-1">
                  <p className="text-[11px] text-zinc-400">
                    Proba ahora la redirección del CTA usando la configuración
                    actual de esta landing
                    {landingName ? ` (${landingName})` : ""}.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleProbarAhora}
                  disabled={probarLoading}
                  className="inline-flex cursor-pointer items-center justify-center rounded-md bg-emerald-400 px-3 py-1.5 text-xs font-semibold text-zinc-950 shadow-sm transition hover:bg-emerald-300 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {probarLoading ? "Probando..." : "Probar ahora"}
                </button>
              </div>
              {probarError && (
                <p className="text-[11px] text-red-300">{probarError}</p>
              )}
            </div>
          )}
        </div>
        </CollapsibleSection>
      )}

      {!hidesVisualControls && (
        <CollapsibleSection title="Multimedia">
        <div className="space-y-6">
          <div className="space-y-4">
            <div>
              <span className="block text-xs font-medium text-zinc-400 mb-2">
                Fondo
              </span>
              <span className="block text-[11px] text-zinc-500 mb-2">
                Elegí cómo se ve el fondo de tu landing (una imagen fija o
                rotando entre varias).
              </span>
              <div className="space-y-3">
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
                  maxFiles={config.backgroundMode === "rotating" ? 3 : undefined}
                />
                {config.backgroundMode === "rotating" && config.backgroundImages.length > 3 && (
                  <p className="text-[11px] text-amber-400">
                    Esta landing tiene más de 3 imágenes por configuración previa. No se eliminarán automáticamente, pero no podrás agregar nuevas hasta dejar 3 o menos.
                  </p>
                )}
                {config.backgroundMode === "rotating" && (
                  <div>
                    <label
                      htmlFor={fieldId("rotate-hours")}
                      className="block text-xs font-medium text-zinc-400 mb-1"
                    >
                      Rotar cada (horas)
                    </label>
                    <input
                      id={fieldId("rotate-hours")}
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
                      className="w-24 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="border-t border-zinc-800 pt-4">
            <ImageUploader
              label="Logo"
              multiple={false}
              value={config.logoUrl ? [config.logoUrl] : []}
              onChange={(urls) =>
                updateConfig(setConfig, { logoUrl: urls[0] ?? "" })
              }
              onUpload={uploadImage}
            />
          </div>
        </div>
        </CollapsibleSection>
      )}

      {isTemplate4 && (
        <CollapsibleSection title="Chat" defaultOpen>
          <div className="space-y-5">
            <ImageUploader
              label="Foto de perfil"
              multiple={false}
              value={template4Chat.profileImageUrl ? [template4Chat.profileImageUrl] : []}
              onChange={(urls) =>
                updateTemplate4Chat({ profileImageUrl: urls[0] ?? "" })
              }
              onUpload={uploadImage}
            />
            <p className="text-[11px] text-zinc-500">
              Formato .avif. Se usa en la intro y en el avatar del chat.
            </p>

            <div className="space-y-3 border-t border-zinc-800 pt-4">
              <label
                htmlFor={fieldId("template4-cta-text")}
                className="block text-xs font-medium text-zinc-400"
              >
                Texto del CTA
              </label>
              <input
                id={fieldId("template4-cta-text")}
                type="text"
                value={template4CtaText}
                onChange={(e) =>
                  updateConfig(setConfig, { ctaText: e.target.value })
                }
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <ColorSelect
                  label="Color texto e icono"
                  value={template4CtaTextColor}
                  onChange={(ctaTextColor) =>
                    updateConfig(setConfig, { ctaTextColor })
                  }
                />
                <ColorSelect
                  label="Color de fondo"
                  value={template4CtaBackgroundColor}
                  onChange={(ctaBackgroundColor) =>
                    updateConfig(setConfig, { ctaBackgroundColor })
                  }
                />
              </div>
            </div>

            <div className="space-y-3 border-t border-zinc-800 pt-4">
              <label
                htmlFor={fieldId("template4-bubble-1")}
                className="block text-xs font-medium text-zinc-400"
              >
                Burbuja 1
              </label>
              <textarea
                id={fieldId("template4-bubble-1")}
                value={template4Chat.bubble1Text}
                onChange={(e) =>
                  updateTemplate4Chat({ bubble1Text: e.target.value })
                }
                rows={2}
                className="w-full resize-none rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
              />
              <p className="text-[11px] text-zinc-500">
                Podés usar {"{{name}}"} para insertar el nombre configurado.
              </p>
            </div>

            <div className="space-y-3 border-t border-zinc-800 pt-4">
              <label
                htmlFor={fieldId("template4-bubble-2-intro")}
                className="block text-xs font-medium text-zinc-400"
              >
                Burbuja 2
              </label>
              <input
                id={fieldId("template4-bubble-2-intro")}
                type="text"
                value={template4Chat.bubble2Intro}
                onChange={(e) =>
                  updateTemplate4Chat({ bubble2Intro: e.target.value })
                }
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
              />
              {(
                [
                  ["bubble2Item1", "Ítem 1"],
                  ["bubble2Item2", "Ítem 2"],
                  ["bubble2Item3", "Ítem 3"],
                ] as const
              ).map(([key, label]) => (
                <input
                  key={key}
                  type="text"
                  aria-label={label}
                  value={template4Chat[key]}
                  onChange={(e) =>
                    updateTemplate4Chat({ [key]: e.target.value })
                  }
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                />
              ))}
            </div>

            <div className="space-y-3 border-t border-zinc-800 pt-4">
              <label
                htmlFor={fieldId("template4-bubble-3")}
                className="block text-xs font-medium text-zinc-400"
              >
                Burbuja 3
              </label>
              <textarea
                id={fieldId("template4-bubble-3")}
                value={template4Chat.bubble3Text}
                onChange={(e) =>
                  updateTemplate4Chat({ bubble3Text: e.target.value })
                }
                rows={2}
                className="w-full resize-none rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
              />
            </div>
          </div>
        </CollapsibleSection>
      )}

      {!hidesVisualControls && (
        <CollapsibleSection title="Textos">
        <div className="space-y-6">
          <div className="space-y-3">
            <span className="block text-xs font-medium text-zinc-400 mb-1">
              Título
            </span>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2 space-y-3">
                <div>
                  <label
                    htmlFor={fieldId("title-line-1")}
                    className="block text-xs font-medium text-zinc-400 mb-1"
                  >
                    Línea 1
                  </label>
                  <input
                    id={fieldId("title-line-1")}
                    type="text"
                    value={config.titleLine1}
                    onChange={(e) =>
                      updateConfig(setConfig, { titleLine1: e.target.value })
                    }
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                  />
                </div>
                <div>
                  <label
                    htmlFor={fieldId("title-line-2")}
                    className="block text-xs font-medium text-zinc-400 mb-1"
                  >
                    Línea 2
                  </label>
                  <input
                    id={fieldId("title-line-2")}
                    type="text"
                    value={config.titleLine2}
                    onChange={(e) =>
                      updateConfig(setConfig, { titleLine2: e.target.value })
                    }
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                  />
                </div>
                <div>
                  <label
                    htmlFor={fieldId("title-line-3")}
                    className="block text-xs font-medium text-zinc-400 mb-1"
                  >
                    Línea 3
                  </label>
                  <input
                    id={fieldId("title-line-3")}
                    type="text"
                    value={config.titleLine3}
                    onChange={(e) =>
                      updateConfig(setConfig, { titleLine3: e.target.value })
                    }
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                  />
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <label
                    htmlFor={fieldId("title-font-size")}
                    className="block text-xs font-medium text-zinc-400 mb-1"
                  >
                    Tamaño
                  </label>
                  <select
                    id={fieldId("title-font-size")}
                    value={config.titleFontSize}
                    onChange={(e) =>
                      updateConfig(setConfig, {
                        titleFontSize:
                          Number(e.target.value) || config.titleFontSize,
                      })
                    }
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100"
                  >
                    {fontSizeOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id={fieldId("title-bold")}
                    type="checkbox"
                    checked={config.titleBold}
                    onChange={(e) =>
                      updateConfig(setConfig, {
                        titleBold: e.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded border-zinc-600 bg-zinc-900"
                  />
                  <label
                    htmlFor={fieldId("title-bold")}
                    className="text-xs font-medium text-zinc-300"
                  >
                    Negrita
                  </label>
                </div>
              </div>
            </div>
            <div>
              <ColorSelect
                label="Color del título"
                value={config.titleColor}
                onChange={(titleColor) =>
                  updateConfig(setConfig, { titleColor })
                }
              />
            </div>
          </div>

          <div className="space-y-3 border-t border-zinc-800 pt-4">
            <span className="block text-xs font-medium text-zinc-400 mb-1">
              Información
            </span>
            <div className="space-y-3">
              {(
                ["subtitleLine1", "subtitleLine2", "subtitleLine3"] as const
              ).map((key, i) => (
                <div key={key}>
                  <label
                    htmlFor={fieldId(key)}
                    className="block text-xs font-medium text-zinc-400 mb-1"
                  >
                    Línea {i + 1}
                  </label>
                  <input
                    id={fieldId(key)}
                    type="text"
                    value={config[key]}
                    onChange={(e) =>
                      updateConfig(setConfig, { [key]: e.target.value })
                    }
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                  />
                </div>
              ))}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor={fieldId("subtitle-font-size")}
                    className="block text-xs font-medium text-zinc-400 mb-1"
                  >
                    Tamaño
                  </label>
                  <select
                    id={fieldId("subtitle-font-size")}
                    value={config.subtitleFontSize}
                    onChange={(e) =>
                      updateConfig(setConfig, {
                        subtitleFontSize:
                          Number(e.target.value) || config.subtitleFontSize,
                      })
                    }
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100"
                  >
                    {fontSizeOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end gap-2 pt-1">
                  <input
                    id={fieldId("subtitle-bold")}
                    type="checkbox"
                    checked={config.subtitleBold}
                    onChange={(e) =>
                      updateConfig(setConfig, {
                        subtitleBold: e.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded border-zinc-600 bg-zinc-900"
                  />
                  <label
                    htmlFor={fieldId("subtitle-bold")}
                    className="text-xs font-medium text-zinc-300"
                  >
                    Negrita
                  </label>
                </div>
              </div>
              <ColorSelect
                label="Color del texto"
                value={config.subtitleColor}
                onChange={(subtitleColor) =>
                  updateConfig(setConfig, { subtitleColor })
                }
              />
            </div>
          </div>

          <div className="space-y-3 border-t border-zinc-800 pt-4">
            <span className="block text-xs font-medium text-zinc-400 mb-1">
              Texto final (3 líneas)
            </span>
            <div className="space-y-3">
              {(
                [
                  "footerBadgeLine1",
                  "footerBadgeLine2",
                  "footerBadgeLine3",
                ] as const
              ).map((key, i) => (
                <div key={key}>
                  <label
                    htmlFor={fieldId(key)}
                    className="block text-xs font-medium text-zinc-400 mb-1"
                  >
                    Línea {i + 1}
                  </label>
                  <input
                    id={fieldId(key)}
                    type="text"
                    value={config[key]}
                    onChange={(e) =>
                      updateConfig(setConfig, { [key]: e.target.value })
                    }
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                  />
                </div>
              ))}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor={fieldId("badge-font-size")}
                    className="block text-xs font-medium text-zinc-400 mb-1"
                  >
                    Tamaño
                  </label>
                  <select
                    id={fieldId("badge-font-size")}
                    value={config.badgeFontSize}
                    onChange={(e) =>
                      updateConfig(setConfig, {
                        badgeFontSize:
                          Number(e.target.value) || config.badgeFontSize,
                      })
                    }
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100"
                  >
                    {fontSizeOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end gap-2 pt-1">
                  <input
                    id={fieldId("badge-bold")}
                    type="checkbox"
                    checked={config.badgeBold}
                    onChange={(e) =>
                      updateConfig(setConfig, {
                        badgeBold: e.target.checked,
                      })
                    }
                    className="h-4 w-4 rounded border-zinc-600 bg-zinc-900"
                  />
                  <label
                    htmlFor={fieldId("badge-bold")}
                    className="text-xs font-medium text-zinc-300"
                  >
                    Negrita
                  </label>
                </div>
              </div>
              <ColorSelect
                label="Color del badge"
                value={config.footerBadgeColor}
                onChange={(footerBadgeColor) =>
                  updateConfig(setConfig, { footerBadgeColor })
                }
              />
            </div>
          </div>
        </div>
        </CollapsibleSection>
      )}

      {!hidesVisualControls && (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">
                Prueba social
              </h3>
              <p className="mt-1 text-xs text-zinc-500">
                Activa o desactiva el bloque de prueba social en la landing.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-zinc-400">
                {config.socialProofEnabled ? "Activada" : "Desactivada"}
              </span>
              <ToggleSwitch
                checked={config.socialProofEnabled}
                label="Activar prueba social"
                onChange={(socialProofEnabled) =>
                  updateConfig(setConfig, { socialProofEnabled })
                }
              />
            </div>
          </div>
        </section>
      )}

      {!hidesVisualControls && (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">
                Captura opcional antes de WhatsApp
              </h3>
              <p className="mt-1 text-xs text-zinc-500">
                Muestra un formulario al tocar el CTA. El visitante puede omitirlo y continuar igual.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-zinc-400">
                {leadCapture.enabled ? "Activada" : "Desactivada"}
              </span>
              <ToggleSwitch
                checked={leadCapture.enabled}
                label="Activar captura opcional antes de WhatsApp"
                onChange={(enabled) => updateLeadCapture({ enabled })}
              />
            </div>
          </div>

          {leadCapture.enabled && (
            <div className="mt-4 space-y-4 border-t border-zinc-800 pt-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ["firstName", "Nombre"],
                  ["lastName", "Apellido"],
                  ["phone", "Teléfono"],
                  ["email", "Email"],
                ].map(([field, label]) => {
                  const key = field as keyof typeof leadCapture.fields;
                  return (
                    <div
                      key={field}
                      className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2"
                    >
                      <span className="text-xs font-medium text-zinc-300">
                        Pedir {label.toLowerCase()}
                      </span>
                      <ToggleSwitch
                        checked={leadCapture.fields[key] === true}
                        label={`Mostrar campo ${label}`}
                        onChange={(checked) =>
                          updateLeadCapture({
                            fields: { [key]: checked } as Partial<typeof leadCapture.fields>,
                          })
                        }
                      />
                    </div>
                  );
                })}
              </div>

              <div>
                <label
                  htmlFor={fieldId("lead-capture-title")}
                  className="mb-1 block text-xs font-medium text-zinc-400"
                >
                  Título del modal
                </label>
                <input
                  id={fieldId("lead-capture-title")}
                  type="text"
                  value={leadCapture.title}
                  onChange={(e) => updateLeadCapture({ title: e.target.value })}
                  placeholder={LEAD_CAPTURE_DEFAULT_TITLE}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600"
                />
              </div>

              <div>
                <label
                  htmlFor={fieldId("lead-capture-description")}
                  className="mb-1 block text-xs font-medium text-zinc-400"
                >
                  Descripción del modal
                </label>
                <textarea
                  id={fieldId("lead-capture-description")}
                  value={leadCapture.description}
                  onChange={(e) => updateLeadCapture({ description: e.target.value })}
                  rows={3}
                  placeholder={LEAD_CAPTURE_DEFAULT_DESCRIPTION}
                  className="w-full resize-y rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600"
                />
              </div>
            </div>
          )}
        </section>
      )}

      {!isFixedVisualTemplate && (
      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">
              Interacciones
            </h3>
            <p className="mt-1 text-xs text-zinc-500">
              Agrega texto al mensaje prellenado cuando la landing redirige a WhatsApp.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-zinc-400">
              {config.interactionsEnabled ? "Activadas" : "Desactivadas"}
            </span>
            <ToggleSwitch
              checked={config.interactionsEnabled}
              label="Activar interacciones"
              onChange={(interactionsEnabled) =>
                updateConfig(setConfig, { interactionsEnabled })
              }
            />
          </div>
        </div>

        {config.interactionsEnabled && (
          <div className="mt-4">
            <label
              htmlFor={fieldId("whatsapp-prefill")}
              className="mb-1 block text-xs font-medium text-zinc-400"
            >
              Texto para WhatsApp
            </label>
            <textarea
              id={fieldId("whatsapp-prefill")}
              value={config.whatsappPrefillText}
              onChange={(e) =>
                updateConfig(setConfig, { whatsappPrefillText: e.target.value })
              }
              rows={3}
              placeholder="Oportunidad desbloqueada: siguenos en nuestra fan page y reclama tu bono..."
              className="w-full resize-y rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600"
            />
          </div>
        )}
      </section>
      )}

      {/* Acciones */}
      <div className="flex flex-wrap gap-3 border-t border-zinc-800 pt-6">
        <button
          type="button"
          onClick={onReset}
          className="cursor-pointer rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800 active:scale-95"
        >
          Resetear
        </button>
        <button
          type="button"
          onClick={handleExportJson}
          className="cursor-pointer rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800 active:scale-95"
        >
          Exportar JSON
        </button>
      </div>
      {showJsonModal && (
        <ModalPortal>
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-3">
          <div className="max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
              <h2 className="text-sm font-semibold text-zinc-100">
                JSON de configuración de la landing
              </h2>
              <button
                type="button"
                onClick={() => setShowJsonModal(false)}
                className="cursor-pointer rounded-md px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              >
                Cerrar
              </button>
            </div>
            <div className="flex flex-col gap-3 px-4 py-3">
              <p className="text-[11px] text-zinc-500">
                Este JSON incluye la identificación de la landing,{" "}
                <span className="font-medium">tracking</span> (pixel, URL Post,
                landing tag),{" "}
                <span className="font-medium">background</span>,{" "}
                <span className="font-medium">content</span> (logo, títulos,
                textos), <span className="font-medium">typography</span>,{" "}
                <span className="font-medium">colors</span> (en formato hex) y{" "}
                <span className="font-medium">layout</span> (posición del CTA y
                plantilla), <span className="font-medium">interactions</span>{" "}
                (mensaje prellenado de WhatsApp).
                No incluye la configuración de redirección (gerencias, pesos,
                modo, intervalos).
              </p>
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={handleCopyJson}
                  disabled={copying}
                  className="cursor-pointer rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-900 transition hover:bg-zinc-200 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {copying ? "Copiando..." : "Copiar JSON"}
                </button>
                {copyOk && (
                  <span className="text-[11px] text-emerald-400">
                    Copiado al portapapeles.
                  </span>
                )}
              </div>
              <div className="max-h-[55vh] overflow-auto rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
                <pre className="text-[11px] text-zinc-100">
                  {JSON.stringify(buildExportPayload(), null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
        </ModalPortal>
      )}
    </form>
  );
}

