"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import type { Landing, LandingThemeConfig } from "@/lib/landing/types";
import { DEFAULT_CONFIG } from "@/lib/landing/mocks";
import {
  fetchLandingById,
  updateLanding,
  deleteLanding,
  UNIQUE_VIOLATION_CODE,
} from "@/lib/landing/landingsDb";
import { uploadLandingImage } from "@/lib/landing/upload";
import type { Gerencia } from "@/lib/gerencias/types";
import type { LandingGerenciaAssignment } from "@/lib/gerencias/gerenciasDb";
import {
  fetchGerencias,
  fetchLandingGerencias,
  setLandingGerencias,
} from "@/lib/gerencias/gerenciasDb";
import { LandingPreview } from "@/components/landing/LandingPreview";
import {
  CollapsibleSection,
  LandingEditorForm,
  LandingTemplateSection,
} from "@/components/landing/LandingEditorForm";
import { buildLandingConfig } from "@/lib/landing/buildLandingConfig";
import { getSettings } from "@/lib/settingsDb";

const EXTERNAL_INTEGRATION_STEPS: Array<{ title: string; desc: string }> = [
  { title: "1. Endpoint de conversiones", desc: "Enviar Contact al endpoint /functions/v1/conversions?name=CLIENTE." },
  { title: "2. Obtener telefono", desc: "Pedir telefono a landing-phone y guardarlo como telefono_asignado para el CTA." },
  { title: "3. Identificadores", desc: "Generar event_id por click, promo_code unico y external_id persistente." },
  { title: "4. Payload completo", desc: "Enviar Contact con fbp/fbc, utm, external_id, promo_code y event_source_url." },
  { title: "5. Redirect WhatsApp", desc: "Redirigir a wa.me usando telefono_asignado sin bloquear la UX." },
  { title: "6. Deduplicacion", desc: "Aplicar lock anti-rafaga en CTA para evitar eventos duplicados." },
  { title: "7. Pixel + CAPI", desc: "Si usan Pixel Contact, enviar el mismo event_id para deduplicar en Meta." },
];

function buildExternalIntegrationGuide(): string {
  return [
    "INSTRUCCIONES PARA INTEGRAR UNA LANDING EXTERNA CON EL CONSTRUCTOR",
    "",
    "Esta guia explica como integrar una landing externa (frontend propio) con las utilidades del Constructor.",
    "",
    "1) ENDPOINT DE CONVERSIONES",
    "- Toda landing externa debe enviar Contact a:",
    "  <URL de conversiones del Constructor>/functions/v1/conversions?name=<nombre_cliente>",
    "- <nombre_cliente> debe ser exactamente el nombre del cliente en el Constructor.",
    "",
    "2) OBTENER TELEFONO PARA WHATSAPP",
    "- Antes del click en CTA, consultar la funcion landing-phone del cliente para obtener el telefono dinamico.",
    "- Guardar ese valor como telefono_asignado.",
    "- Ese telefono se usa para:",
    "  a) construir el link final de WhatsApp (wa.me/telefono_asignado)",
    "  b) enviarlo dentro del payload Contact.",
    "",
    "3) IDENTIFICADORES QUE DEBE GENERAR LA LANDING",
    "- event_id: UUID unico por click de CTA (un evento Contact = un event_id).",
    "- promo_code: identificador unico por click/contacto (obligatorio).",
    "- external_id: identificador persistente por navegador/usuario (guardar en localStorage).",
    "- event_time: epoch en segundos.",
    "",
    "4) PIXEL + CAPI (DEDUPLICACION)",
    "- Si la landing envia Contact por Pixel (browser), debe usar el MISMO event_id en el payload al Constructor.",
    "- Esto permite que Meta deduplique Pixel + CAPI correctamente.",
    "",
    "5) PAYLOAD RECOMENDADO (COMPLETO)",
    "- Enviar el payload mas completo posible para mejorar matching y trazabilidad.",
    "",
    "{",
    "  \"event_name\": \"Contact\",",
    "  \"event_id\": \"<uuid>\",",
    "  \"event_time\": 1774750000,",
    "  \"external_id\": \"<external_id_persistente>\",",
    "  \"event_source_url\": \"https://tu-dominio.com/ruta\",",
    "  \"email\": \"<email_si_existe>\",",
    "  \"phone\": \"<telefono_si_existe>\",",
    "  \"fn\": \"<nombre_si_existe>\",",
    "  \"ln\": \"<apellido_si_existe>\",",
    "  \"ct\": \"<ciudad_si_existe>\",",
    "  \"st\": \"<provincia_si_existe>\",",
    "  \"zip\": \"<zip_si_existe>\",",
    "  \"country\": \"<pais_si_existe>\",",
    "  \"utm_campaign\": \"<utm_campaign>\",",
    "  \"fbp\": \"<_fbp_cookie>\",",
    "  \"fbc\": \"<_fbc_cookie_o_desde_fbclid>\",",
    "  \"promo_code\": \"<landingTag-random>\",",
    "  \"telefono_asignado\": \"<phone_obtenido_de_landing-phone>\",",
    "  \"landing_name\": \"<nombre_landing>\",",
    "  \"device_type\": \"mobile|tablet|desktop\",",
    "  \"clientIP\": \"<ip_real_si_disponible>\",",
    "  \"agentuser\": \"<user_agent>\",",
    "  \"test_event_code\": \"<opcional>\"",
    "}",
    "",
    "6) REDIRECCION AL CHAT",
    "- Una vez disparado el envio, redirigir al chat de WhatsApp usando telefono_asignado.",
    "- Recomendado: no bloquear UX por respuestas de red lentas.",
    "",
    "7) ANTI-RAFAGA (NO INFLAR METRICAS)",
    "- Implementar lock en CTA al primer click para evitar multiples envios.",
    "- Mostrar feedback visual: 'Abriendo...' y boton deshabilitado.",
    "- Opcional: dedupe temporal local (ej. 5 minutos por external_id + slug).",
    "",
    "CHECKLIST FINAL",
    "- [ ] El endpoint usa /conversions?name=<cliente> correcto.",
    "- [ ] Se obtiene y usa telefono_asignado.",
    "- [ ] promo_code se genera por click y viaja en payload.",
    "- [ ] event_id de Pixel y CAPI coincide (si usan Pixel).",
    "- [ ] fbp/fbc se envian cuando existen.",
    "- [ ] El CTA no permite rafagas de clicks.",
    "",
    "Si estos puntos se cumplen, la landing externa queda integrada con la misma logica del Constructor.",
  ].join("\n");
}

export default function DashboardLandingEditarPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string | undefined;
  const [landing, setLanding] = useState<Landing | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [gerencias, setGerencias] = useState<Gerencia[]>([]);
  const [assignments, setAssignments] = useState<LandingGerenciaAssignment[]>([]);
  const [initialName, setInitialName] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(true);
  const [urlBase, setUrlBase] = useState<string | null>(null);
  const [revalidateSecret, setRevalidateSecret] = useState<string | null>(null);
  const [clientName, setClientName] = useState<string | null>(null);
  const [pixelOptions, setPixelOptions] = useState<string[]>([]);
  const [postUrlCopied, setPostUrlCopied] = useState(false);

  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error || !user || !id) {
        router.replace("/dashboard");
        return;
      }

      setUserId(user.id);
      try {
        const [found, userGerencias, assigned, settings, profile] = await Promise.all([
          fetchLandingById(id),
          fetchGerencias(user.id),
          fetchLandingGerencias(id),
          getSettings(),
          supabase.from("profiles").select("nombre").eq("id", user.id).maybeSingle(),
        ]);
        if (!found) {
          router.replace("/dashboard");
          return;
        }
        setLanding(found);
        if (!initialName) {
          setInitialName(found.name);
        }
        setGerencias(userGerencias);
        setAssignments(assigned);
        setShowPreview(settings.show_client_landing_preview ?? true);
        setUrlBase(settings.url_base ?? null);
        setRevalidateSecret(settings.revalidate_secret || null);
        setClientName(profile.data?.nombre ?? null);
        const { data: pixels } = await supabase
          .from("conversions_pixel_configs")
          .select("pixel_id")
          .eq("user_id", user.id)
          .order("is_default", { ascending: false })
          .order("created_at", { ascending: true });
        const options = (pixels ?? [])
          .map((p) => String(p.pixel_id ?? "").trim())
          .filter(Boolean);
        setPixelOptions(options);
      } catch {
        router.replace("/dashboard");
        return;
      } finally {
        setReady(true);
      }
    };

    void init();
  }, [router, id, initialName]);

  const setConfig = (updater: React.SetStateAction<LandingThemeConfig>) => {
    setLanding((prev) => {
      if (!prev) return prev;
      const nextConfig =
        typeof updater === "function" ? updater(prev.config) : updater;
      return { ...prev, config: nextConfig };
    });
  };

  const handleSave = async () => {
    if (!landing) return;
    if (saving) return;
    setSaveError(null);
    if (/\s/.test(landing.name)) {
      setSaveError("El nombre no debe contener espacios.");
      return;
    }
    if (!landing.landingTag.trim()) {
      setSaveError("Landing Tag es obligatorio.");
      return;
    }
    if (!/^[a-zA-Z0-9]+$/.test(landing.landingTag)) {
      setSaveError("Landing Tag solo puede contener letras y números, sin espacios.");
      return;
    }
    if (landing.landingType === "external") {
      const domain = landing.externalDomain.trim().toLowerCase();
      if (!domain) {
        setSaveError("El dominio de la landing externa es obligatorio.");
        return;
      }
      const cleaned = domain.replace(/^https?:\/\//, "").replace(/\/+$/, "");
      if (!/^[a-z0-9.-]+$/.test(cleaned)) {
        setSaveError("Dominio externo inválido. Usá solo dominio (ej: mi-landing.com).");
        return;
      }
    }
    let pixelIdToSave = landing.pixelId.trim();
    if (!pixelIdToSave) {
      if (userId) {
        const { data: cfg } = await supabase
          .from("conversions_config")
          .select("pixel_id")
          .eq("user_id", userId)
          .maybeSingle();
        pixelIdToSave = String(cfg?.pixel_id ?? "").trim();
      }
    }
    if (!pixelIdToSave) {
      const entered = window.prompt(
        "El Pixel ID es obligatorio para guardar la landing. Ingresalo para continuar:",
        "",
      );
      pixelIdToSave = (entered ?? "").replace(/\D/g, "");
      if (!pixelIdToSave) {
        setSaveError("No se puede guardar sin Pixel ID.");
        return;
      }
      setLanding((prev) => (prev ? { ...prev, pixelId: pixelIdToSave } : prev));
    }
    if (!/^\d+$/.test(pixelIdToSave)) {
      setSaveError("Pixel ID inválido. Debe contener solo números.");
      return;
    }
    if (
      initialName &&
      initialName.startsWith("Nueva-landing-") &&
      landing.name.trim()
    ) {
      const ok = window.confirm(
        `Vas a nombrar tu landing como "${landing.name}". Este nombre se usará en la URL pública y no se podrá cambiar luego.\n\n¿Confirmar nombre?`,
      );
      if (!ok) return;
    }
    setSaving(true);
    try {
      const effectivePhoneMode = assignments.some((a) => a.phoneMode === "fair")
        ? "fair"
        : "random";

      const supabaseBase = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ?? "";
      const conversionsUrl =
        clientName && supabaseBase
          ? `${supabaseBase}/functions/v1/conversions?name=${encodeURIComponent(clientName)}`
          : landing.postUrl;

      const landingConfig = buildLandingConfig({
        id: landing.id,
        name: landing.name,
        comment: landing.comment,
        pixelId: pixelIdToSave,
        postUrl: conversionsUrl,
        landingTag: landing.landingTag,
        config: landing.config,
        phoneMode: effectivePhoneMode,
        updatedAt: undefined,
      });

      await updateLanding(landing.id, {
        landingType: landing.landingType,
        externalDomain: landing.externalDomain
          .trim()
          .toLowerCase()
          .replace(/^https?:\/\//, "")
          .replace(/\/+$/, ""),
        name: landing.name,
        pixelId: pixelIdToSave,
        gerenciaSelectionMode: landing.gerenciaSelectionMode,
        gerenciaFairCriterion: landing.gerenciaFairCriterion,
        phoneMode: effectivePhoneMode,
        phoneKind: landing.phoneKind,
        phoneIntervalStartHour: landing.phoneIntervalStartHour,
        phoneIntervalEndHour: landing.phoneIntervalEndHour,
        postUrl: conversionsUrl,
        landingTag: landing.landingTag,
        comment: landing.comment,
        config: landing.config,
        landingConfig,
      });
      await setLandingGerencias(landing.id, assignments);
      // Revalidar landing pública en Vercel (ISR) y calentar caché.
      if (urlBase && revalidateSecret) {
        const base = urlBase.replace(/\/$/, "");
        try {
          await fetch(`${base}/api/revalidate`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              name: landing.name,
              secret: revalidateSecret,
            }),
          });
          // Calentar la Edge Function builder-config para que la primera visita a la landing no pague cold start.
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
          const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
          if (supabaseUrl && anonKey) {
            fetch(
              `${supabaseUrl}/functions/v1/builder-config?name=${encodeURIComponent(landing.name)}`,
              { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } },
            ).catch(() => {});
          }
        } catch {
          // No bloqueamos el guardado si falla la revalidación.
        }
      }
      router.push("/dashboard/landings");
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      if (err?.code === UNIQUE_VIOLATION_CODE) {
        const msg = err.message ?? "";
        if (msg.includes("landing_tag")) {
          setSaveError("Ese Landing Tag ya está en uso. Elegí otro.");
        } else {
          setSaveError("Ese nombre ya existe. Elegí otro.");
        }
      } else {
        setSaveError(e instanceof Error ? e.message : "Error al guardar");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!landing) return;
    if (!window.confirm(`¿Eliminar la landing "${landing.name}"? Esta acción no se puede deshacer.`)) return;
    setDeleting(true);
    setSaveError(null);
    try {
      await deleteLanding(landing.id);
      router.push("/dashboard");
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Error al eliminar");
    } finally {
      setDeleting(false);
    }
  };

  const handleReset = () => {
    if (!landing) return;
    setLanding((prev) =>
      prev ? { ...prev, config: { ...DEFAULT_CONFIG } } : prev,
    );
  };

  const handleDownloadExternalGuide = () => {
    const content = buildExternalIntegrationGuide();
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "instrucciones-landing-externa.txt";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!ready || !landing) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-zinc-400">Cargando...</p>
      </div>
    );
  }
  const isLandingTagLocked = Boolean(
    initialName && !initialName.startsWith("Nueva-landing-"),
  );
  const postUrlValue = clientName
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ?? ""}/functions/v1/conversions?name=${encodeURIComponent(
        clientName,
      )}`
    : landing.postUrl;

  return (
    <div className="lg:flex lg:gap-6 lg:items-start lg:pr-[440px]">
      {/* Columna izquierda: scroll normal */}
      <div className="min-w-0 flex-1 space-y-8 pb-8 lg:pr-4">
        {saveError && (
          <p className="rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-300" role="alert">
            {saveError}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-zinc-800 hover:text-zinc-50"
          >
            <span className="text-sm" aria-hidden>
              ←
            </span>
            <span>Volver al listado</span>
          </Link>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={deleting}
              className="cursor-pointer rounded-lg border border-red-900/60 bg-red-950/30 px-3 py-1.5 text-sm font-medium text-red-300 transition hover:bg-red-950/50 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {deleting ? "Eliminando..." : "Eliminar landing"}
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="cursor-pointer rounded-lg border border-emerald-700/70 bg-emerald-950/30 px-3 py-1.5 text-sm font-medium text-emerald-300 transition hover:bg-emerald-950/50 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {saving ? "GUARDANDO..." : "GUARDAR"}
            </button>
          </div>
        </div>
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">
            Editar landing
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Nombre y comentario identifican esta landing en tu listado.
          </p>
        </div>

        {landing.landingType === "external" && (
          <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <h3 className="text-sm font-semibold text-zinc-100">
              Instrucciones para integrar una landing externa
            </h3>
            <div className="mt-3 space-y-2">
              {EXTERNAL_INTEGRATION_STEPS.map((step) => (
                <div key={step.title} className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2">
                  <p className="text-xs font-medium text-zinc-200">{step.title}</p>
                  <p className="mt-1 text-[11px] text-zinc-400">{step.desc}</p>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={handleDownloadExternalGuide}
              className="mt-4 inline-flex items-center rounded-lg border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-200 transition hover:bg-zinc-800"
            >
              Descargar indicaciones
            </button>
          </section>
        )}

        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <h3 className="mb-4 text-sm font-semibold text-zinc-200">
            Identificación
          </h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Nombre (solo minúsculas y números)
              </label>
              <input
                type="text"
                value={landing.name}
                onChange={(e) =>
                  setLanding((prev) => {
                    if (!prev) return prev;
                    const raw = e.target.value.toLowerCase();
                    const cleaned = raw.replace(/[^a-z0-9]/g, "");
                    return { ...prev, name: cleaned };
                  })
                }
                disabled={
                  initialName !== null &&
                  !initialName.startsWith("Nueva-landing-")
                }
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                placeholder="ej: milanding123"
              />
              <p className="mt-1 text-[11px] text-zinc-500">
                Este nombre se usará como /name en la URL pública. Una vez que
                guardes por primera vez, no se podrá cambiar.
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Comentario
              </label>
              <input
                type="text"
                value={landing.comment}
                onChange={(e) =>
                  setLanding((prev) =>
                    prev ? { ...prev, comment: e.target.value } : prev,
                  )
                }
                placeholder="Opcional"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
              />
            </div>
          </div>
        </section>

        {landing.landingType !== "external" && (
          <LandingTemplateSection config={landing.config} setConfig={setConfig} />
        )}

        {landing.landingType === "external" && (
          <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <h3 className="mb-4 text-sm font-semibold text-zinc-200">
              Dominio externo
            </h3>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Dominio permitido <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={landing.externalDomain}
                onChange={(e) =>
                  setLanding((prev) =>
                    prev ? { ...prev, externalDomain: e.target.value } : prev,
                  )
                }
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                placeholder="ej: landing.tercero.com"
              />
              <p className="mt-1 text-[11px] text-zinc-500">
                Ingresá solo el dominio (sin https:// ni rutas). Se usa para validar el origen de la landing externa.
              </p>
            </div>
          </section>
        )}

        <CollapsibleSection title="Tracking" defaultOpen>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Pixel ID <span className="text-red-400">*</span>
              </label>
              <select
                value={landing.pixelId}
                onChange={(e) =>
                  setLanding((prev) =>
                    prev ? { ...prev, pixelId: e.target.value } : prev,
                  )
                }
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
              >
                <option value="">Seleccionar pixel</option>
                {[...(pixelOptions.includes(landing.pixelId) || !landing.pixelId ? pixelOptions : [landing.pixelId, ...pixelOptions])].map((pid) => (
                  <option key={pid} value={pid}>
                    {pid}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-zinc-500">
                Se configura desde{" "}
                <a href="/dashboard/integraciones" className="text-zinc-300 underline hover:text-zinc-100">
                  Integraciones
                </a>
                .
              </p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/30 px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-zinc-300">Enviar Contact via Pixel</p>
                  <p className="mt-0.5 text-[11px] text-zinc-500">
                    Controla si la landing publica envia el evento Contact por Pixel del navegador.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={landing.config.sendContactPixel}
                  onClick={() =>
                    setLanding((prev) =>
                      prev
                        ? {
                            ...prev,
                            config: {
                              ...prev.config,
                              sendContactPixel: !prev.config.sendContactPixel,
                            },
                          }
                        : prev,
                    )
                  }
                  className={`relative inline-flex h-6 w-11 items-center rounded-full border transition ${
                    landing.config.sendContactPixel
                      ? "border-emerald-500/60 bg-emerald-500/30"
                      : "border-zinc-700 bg-zinc-800"
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                      landing.config.sendContactPixel ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                URL Post <span className="text-red-400">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={postUrlValue}
                  disabled
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 disabled:opacity-60 disabled:cursor-not-allowed"
                  placeholder="Se completa automáticamente desde Integraciones"
                />
                <button
                  type="button"
                  onClick={async () => {
                    if (!postUrlValue) return;
                    await navigator.clipboard.writeText(postUrlValue);
                    setPostUrlCopied(true);
                    window.setTimeout(() => setPostUrlCopied(false), 1200);
                  }}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-300 transition hover:bg-zinc-800 hover:text-zinc-100"
                  title="Copiar URL Post"
                  aria-label="Copiar URL Post"
                >
                  {postUrlCopied ? (
                    <span className="text-[10px] text-emerald-400">OK</span>
                  ) : (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                    </svg>
                  )}
                </button>
              </div>
              <p className="mt-1 text-[11px] text-zinc-500">
                URL a la cual enviara los eventos de conversion el Whatsapp que hayas integrado escaneando el QR.
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Landing Tag <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={landing.landingTag}
                disabled={isLandingTagLocked}
                title={
                  isLandingTagLocked
                    ? "Landing Tag inmutable luego del primer guardado."
                    : undefined
                }
                onChange={(e) =>
                  setLanding((prev) => {
                    if (!prev) return prev;
                    const cleaned = e.target.value.replace(/[^a-zA-Z0-9]/g, "");
                    return { ...prev, landingTag: cleaned };
                  })
                }
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 disabled:cursor-not-allowed disabled:opacity-70"
                placeholder="ej: miLanding123"
                required
              />
              <p className="mt-1 text-[11px] text-zinc-500">
                Identificador único de la landing. Solo letras y números, sin espacios.
              </p>
            </div>
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Redirección" defaultOpen>
          <div className="mb-3 rounded-lg border border-zinc-700 bg-zinc-900/70 p-3">
            <p className="mb-2 text-xs font-medium text-zinc-300">Selección de gerencias</p>
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex rounded-lg border border-zinc-700 bg-zinc-900 text-[11px]">
                <button
                  type="button"
                  onClick={() =>
                    setLanding((prev) =>
                      prev ? { ...prev, gerenciaSelectionMode: "weighted_random" } : prev,
                    )
                  }
                  className={`cursor-pointer px-2 py-1 rounded-l-lg border-r border-zinc-700 ${
                    landing.gerenciaSelectionMode === "weighted_random"
                      ? "bg-zinc-100 text-zinc-900"
                      : "text-zinc-300 hover:bg-zinc-800"
                  }`}
                  title="Aleatorio por peso de gerencia"
                >
                  Aleatoria (peso)
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setLanding((prev) =>
                      prev ? { ...prev, gerenciaSelectionMode: "fair" } : prev,
                    )
                  }
                  className={`cursor-pointer px-2 py-1 rounded-r-lg ${
                    landing.gerenciaSelectionMode === "fair"
                      ? "bg-zinc-100 text-zinc-900"
                      : "text-zinc-300 hover:bg-zinc-800"
                  }`}
                  title="Equitativo entre gerencias (ignora peso)"
                >
                  Equitativa
                </button>
              </div>
              {landing.gerenciaSelectionMode === "fair" && (
                <div className="inline-flex rounded-lg border border-zinc-700 bg-zinc-900 text-[11px]">
                  <button
                    type="button"
                    onClick={() =>
                      setLanding((prev) =>
                        prev ? { ...prev, gerenciaFairCriterion: "usage_count" } : prev,
                      )
                    }
                    className={`cursor-pointer px-2 py-1 rounded-l-lg border-r border-zinc-700 ${
                      landing.gerenciaFairCriterion === "usage_count"
                        ? "bg-zinc-100 text-zinc-900"
                        : "text-zinc-300 hover:bg-zinc-800"
                    }`}
                    title="Equitativo por sumatoria de contador"
                  >
                    Por contador
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setLanding((prev) =>
                        prev ? { ...prev, gerenciaFairCriterion: "messages_received" } : prev,
                      )
                    }
                    className={`cursor-pointer px-2 py-1 rounded-r-lg ${
                      landing.gerenciaFairCriterion === "messages_received"
                        ? "bg-zinc-100 text-zinc-900"
                        : "text-zinc-300 hover:bg-zinc-800"
                    }`}
                    title="Equitativo por sumatoria de mensajes recibidos"
                  >
                    Mensajes recibidos
                  </button>
                </div>
              )}
            </div>
          </div>
          <p className="mb-3 text-xs text-zinc-400">
            Configura a donde re dirigirá el CTA de tu landing page.
          </p>
          <p className="mb-3 text-xs text-zinc-500">
            Marque <strong>Asignar</strong> para incluir la gerencia; en selección <strong>Aleatoria (peso)</strong> puede editar el <strong>Peso</strong> para definir probabilidad. Elija modo (carga/ads/mkt), tipo de elección de teléfono (aleatorio/equitativo) y opcionalmente un intervalo de tiempo. Crea gerencias en el menú Gerencias si no tienes.
          </p>
          {gerencias.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No tienes gerencias.{" "}
              <Link
                href="/dashboard/gerencias"
                className="text-zinc-300 underline hover:text-zinc-100"
              >
                Crear gerencias
              </Link>
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-zinc-700">
              <table className="w-full text-left text-sm">
                <thead className="bg-zinc-800/80">
                  <tr>
                    <th className="px-3 py-2 font-medium text-zinc-300">
                      Gerencia
                    </th>
                    <th className="px-3 py-2 font-medium text-zinc-300">
                      Nombre
                    </th>
                    <th className="px-3 py-2 font-medium text-zinc-300 w-20 text-center">
                      Asignar
                    </th>
                    {landing.gerenciaSelectionMode === "weighted_random" && (
                      <th className="px-3 py-2 font-medium text-zinc-300 w-10">
                        Peso
                      </th>
                    )}
                    <th className="px-3 py-2 font-medium text-zinc-300 w-32">
                      Modo
                    </th>
                    <th className="px-3 py-2 font-medium text-zinc-300 min-w-[140px]">
                      Tipo
                    </th>
                    <th className="px-3 py-2 font-medium text-zinc-300 w-56">
                      Intervalo
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {gerencias.map((g) => {
                    const assignment = assignments.find(
                      (a) => a.gerencia_id === g.id,
                    );
                    const isAssigned = !!assignment;
                    const weight = assignment?.weight ?? 0;
                    const phoneMode = assignment?.phoneMode ?? "random";
                    const phoneKind = assignment?.phoneKind ?? "carga";
                    const intervalStartHour =
                      assignment?.intervalStartHour ?? null;
                    const intervalEndHour = assignment?.intervalEndHour ?? null;
                    return (
                      <tr key={g.id} className="bg-zinc-950/40">
                        <td className="px-3 py-2 text-zinc-300">
                          {g.gerencia_id ?? "MANUAL"}
                        </td>
                        <td className="px-3 py-2 text-zinc-200">{g.nombre}</td>
                        <td className="px-3 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={isAssigned}
                            onChange={() => {
                              if (isAssigned) {
                                setAssignments((prev) =>
                                  prev.filter((a) => a.gerencia_id !== g.id),
                                );
                              } else {
                                setAssignments((prev) => [
                                  ...prev,
                                  {
                                    gerencia_id: g.id,
                                    weight: 1,
                                    phoneMode: "random",
                                    phoneKind: "carga",
                                    intervalStartHour: null,
                                    intervalEndHour: null,
                                  },
                                ]);
                              }
                            }}
                            className="rounded border-zinc-600"
                          />
                        </td>
                        {landing.gerenciaSelectionMode === "weighted_random" && (
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min={0}
                              value={weight}
                              onChange={(e) => {
                                if (!isAssigned) return;
                                const v = parseInt(e.target.value, 10);
                                const next = Number.isNaN(v) ? 0 : Math.max(0, v);
                                setAssignments((prev) =>
                                  prev.map((a) =>
                                    a.gerencia_id === g.id
                                      ? { ...a, weight: next }
                                      : a,
                                  ),
                                );
                              }}
                              disabled={!isAssigned}
                              title={
                                isAssigned
                                  ? "Peso de esta gerencia en esta landing"
                                  : "Marque Asignar para poder editar el peso"
                              }
                              className="w-10 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                            />
                          </td>
                        )}
                        <td className="px-3 py-2">
                          <div className="inline-flex rounded-lg border border-zinc-700 bg-zinc-900 text-[11px]">
                            <button
                              type="button"
                              onClick={() => {
                                if (!isAssigned) return;
                                setAssignments((prev) =>
                                  prev.map((a) =>
                                    a.gerencia_id === g.id
                                      ? { ...a, phoneMode: "random" }
                                      : a,
                                  ),
                                );
                              }}
                              className={`cursor-pointer px-2 py-1 rounded-l-lg border-r border-zinc-700 ${
                                phoneMode === "random"
                                  ? "bg-zinc-100 text-zinc-900"
                                  : "text-zinc-300 hover:bg-zinc-800"
                              }`}
                            >
                              Aleatorio
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (!isAssigned) return;
                                setAssignments((prev) =>
                                  prev.map((a) =>
                                    a.gerencia_id === g.id
                                      ? { ...a, phoneMode: "fair" }
                                      : a,
                                  ),
                                );
                              }}
                              className={`cursor-pointer px-2 py-1 rounded-r-lg ${
                                phoneMode === "fair"
                                  ? "bg-zinc-100 text-zinc-900"
                                  : "text-zinc-300 hover:bg-zinc-800"
                              }`}
                            >
                              Equitativo
                            </button>
                          </div>
                        </td>
                        <td className="px-3 py-2 min-w-[140px]">
                          <div className="inline-flex flex-shrink-0 rounded-lg border border-zinc-700 bg-zinc-900 text-[11px]">
                            <button
                              type="button"
                              onClick={() => {
                                if (!isAssigned) return;
                                setAssignments((prev) =>
                                  prev.map((a) =>
                                    a.gerencia_id === g.id
                                      ? { ...a, phoneKind: "carga" }
                                      : a,
                                  ),
                                );
                              }}
                              className={`cursor-pointer shrink-0 px-2 py-1 rounded-l-lg border-r border-zinc-700 ${
                                phoneKind === "carga"
                                  ? "bg-zinc-100 text-zinc-900"
                                  : "text-zinc-300 hover:bg-zinc-800"
                              }`}
                            >
                              Carga
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (!isAssigned) return;
                                setAssignments((prev) =>
                                  prev.map((a) =>
                                    a.gerencia_id === g.id
                                      ? { ...a, phoneKind: "ads" }
                                      : a,
                                  ),
                                );
                              }}
                              className={`cursor-pointer shrink-0 px-2 py-1 border-r border-zinc-700 ${
                                phoneKind === "ads"
                                  ? "bg-zinc-100 text-zinc-900"
                                  : "text-zinc-300 hover:bg-zinc-800"
                              }`}
                            >
                              Ads
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (!isAssigned) return;
                                setAssignments((prev) =>
                                  prev.map((a) =>
                                    a.gerencia_id === g.id
                                      ? { ...a, phoneKind: "mkt" }
                                      : a,
                                  ),
                                );
                              }}
                              className={`cursor-pointer shrink-0 px-2 py-1 rounded-r-lg ${
                                phoneKind === "mkt"
                                  ? "bg-zinc-100 text-zinc-900"
                                  : "text-zinc-300 hover:bg-zinc-800"
                              }`}
                            >
                              Mkt
                            </button>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-300">
                            <label className="flex items-center gap-1">
                              <input
                                type="checkbox"
                                checked={
                                  intervalStartHour !== null &&
                                  intervalEndHour !== null
                                }
                                onChange={(e) => {
                                  if (!isAssigned) return;
                                  setAssignments((prev) =>
                                    prev.map((a) => {
                                      if (a.gerencia_id !== g.id) return a;
                                      if (!e.target.checked) {
                                        return {
                                          ...a,
                                          intervalStartHour: null,
                                          intervalEndHour: null,
                                        };
                                      }
                                      return {
                                        ...a,
                                        intervalStartHour:
                                          a.intervalStartHour ?? 9,
                                        intervalEndHour:
                                          a.intervalEndHour ?? 21,
                                      };
                                    }),
                                  );
                                }}
                                className="rounded border-zinc-600"
                              />
                              <span>Aplicar</span>
                            </label>
                            {intervalStartHour !== null &&
                              intervalEndHour !== null && (
                                <div className="flex flex-wrap items-center gap-1">
                                  <span>Dentro de</span>
                                  <select
                                    value={intervalStartHour}
                                    onChange={(e) => {
                                      const v = parseInt(e.target.value, 10);
                                      const n = Number.isNaN(v)
                                        ? 0
                                        : Math.max(0, Math.min(23, v));
                                      setAssignments((prev) =>
                                        prev.map((a) =>
                                          a.gerencia_id === g.id
                                            ? {
                                                ...a,
                                                intervalStartHour: n,
                                              }
                                            : a,
                                        ),
                                      );
                                    }}
                                    className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-100"
                                  >
                                    {Array.from({ length: 24 }).map((_, h) => (
                                      <option key={h} value={h}>
                                        {h.toString().padStart(2, "0")}:00
                                      </option>
                                    ))}
                                  </select>
                                  <span>a</span>
                                  <select
                                    value={intervalEndHour}
                                    onChange={(e) => {
                                      const v = parseInt(e.target.value, 10);
                                      const n = Number.isNaN(v)
                                        ? 0
                                        : Math.max(0, Math.min(23, v));
                                      setAssignments((prev) =>
                                        prev.map((a) =>
                                          a.gerencia_id === g.id
                                            ? {
                                                ...a,
                                                intervalEndHour: n,
                                              }
                                            : a,
                                        ),
                                      );
                                    }}
                                    className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-100"
                                  >
                                    {Array.from({ length: 24 }).map((_, h) => (
                                      <option key={h} value={h}>
                                        {h.toString().padStart(2, "0")}:00
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CollapsibleSection>

        {landing.landingType !== "external" && (
          <LandingEditorForm
            showTemplateSection={false}
            config={landing.config}
            setConfig={setConfig}
            onSave={handleSave}
            onReset={handleReset}
            uploadImage={
              userId
                ? (file) => uploadLandingImage(supabase, userId, file)
                : undefined
            }
            landingId={landing.id}
            landingName={landing.name}
            comment={landing.comment}
            pixelId={landing.pixelId}
            postUrl={landing.postUrl}
            landingTag={landing.landingTag}
            getPhoneForPreview={async () => {
              try {
                const base =
                  process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ?? "";
                const apiKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
                if (!base) return null;
                const url = `${base}/functions/v1/landing-phone?name=${encodeURIComponent(
                  landing.name,
                )}`;
                const res = await fetch(url, {
                  headers: apiKey
                    ? {
                        apikey: apiKey,
                        Authorization: `Bearer ${apiKey}`,
                      }
                    : undefined,
                });
                if (!res.ok) return null;
                const j = await res.json();
                const phone = j?.phone;
                return typeof phone === "string" ? phone : null;
              } catch {
                return null;
              }
            }}
          />
        )}
      </div>

      {/* Preview fijo en escritorio (derecha de la pantalla) y normal en mobile */}
      {showPreview && landing.landingType !== "external" && (
        <>
          {/* Mobile / tablet: preview al final, con scroll normal */}
          <div className="mt-8 w-full max-w-[380px] lg:hidden">
            <p className="mb-3 text-xs font-medium text-zinc-500">
              Vista previa
            </p>
            <LandingPreview config={landing.config} />
            <p className="mt-2 w-full text-[11px] text-zinc-500">
              La vista previa es aproximada. Para una vista certera, abrí el enlace de la landing.
            </p>
          </div>

          {/* Desktop: preview fijo que acompaña el scroll y siempre queda visible */}
          <div className="pointer-events-none fixed right-6 top-16 z-20 hidden w-[360px] max-w-[40vw] lg:block">
            <p className="mb-3 text-xs font-medium text-zinc-500">
              Vista previa
            </p>
            <div className="pointer-events-auto w-full">
              <div className="scale-[0.7] origin-top">
                <LandingPreview config={landing.config} />
              </div>
          </div>
            <p className="mt-2 w-full text-[11px] text-zinc-500">
              La vista previa es aproximada. Para una vista certera, abrí el enlace de la landing.
            </p>
          </div>
        </>
      )}

    </div>
  );
}






