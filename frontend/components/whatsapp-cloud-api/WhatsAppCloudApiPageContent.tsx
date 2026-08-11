"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { invokeFunction } from "@/lib/supabaseFunctions";
import { PageHeader, SurfaceCard } from "@/components/ui/PanelPrimitives";
import { CURRENCY_ALL } from "@/lib/currency";
import { SingleCurrencyRequired, useCurrencyScope } from "@/components/currency/CurrencyScope";
import type { Gerencia } from "@/lib/gerencias/types";
import type { PhoneKind } from "@/lib/landing/types";
import {
  fetchGerencias,
  fetchGerenciasForAdmin,
  type LandingGerenciaAssignment,
} from "@/lib/gerencias/gerenciasDb";
import {
  fetchWhatsappCloudApiAssignments,
  fetchWhatsappCloudApiConfig,
  fetchWhatsappCloudApiRecentEvents,
  setWhatsappCloudApiAssignments,
  upsertWhatsappCloudApiConfig,
  type WhatsappCloudApiAssignment,
  type WhatsappCloudApiConfig,
} from "@/lib/whatsappCloudApiDb";

const DEFAULT_REDIRECT_TEMPLATE =
  "Hola, gracias por comunicarte con {{name}}.\n\nPara continuar escribile a tu asesor: {{wa_link}}\n\nTu codigo es: {{promo_code}}";
const DEFAULT_FALLBACK_TEMPLATE =
  "Hola, gracias por comunicarte. En este momento no hay un asesor disponible. Por favor intenta nuevamente en unos minutos.";

const PHONE_KIND_OPTIONS: Array<{ value: PhoneKind; label: string }> = [
  { value: "carga", label: "Carga" },
  { value: "assistant", label: "Asistente" },
  { value: "ads", label: "Ads" },
  { value: "mkt", label: "Mkt" },
];

const inputClass =
  "h-10 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-2)] px-3 text-sm text-[var(--color-text-strong)] outline-none placeholder:text-[var(--color-text-disabled)]";
const textareaClass =
  "w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-2)] px-3 py-2.5 text-sm leading-5 text-[var(--color-text-strong)] outline-none placeholder:text-[var(--color-text-disabled)]";
const compactInputClass =
  "h-8 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-2)] px-2 text-xs text-[var(--color-text-strong)] outline-none disabled:opacity-50";
const compactSelectClass =
  "h-8 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-2)] px-2 text-xs text-[var(--color-text-strong)] outline-none disabled:opacity-50";

type ClientOption = {
  id: string;
  nombre: string | null;
  email: string | null;
};

type RecentEvent = Awaited<ReturnType<typeof fetchWhatsappCloudApiRecentEvents>>[number];

function cleanSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function cleanTag(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, "");
}

function toAssignments(rows: WhatsappCloudApiAssignment[]): LandingGerenciaAssignment[] {
  return rows.map((row) => ({
    gerencia_id: row.gerencia_id,
    weight: row.weight,
    phoneMode: row.phoneMode,
    phoneKind: row.phoneKind,
    intervalStartHour: row.intervalStartHour,
    intervalEndHour: row.intervalEndHour,
  }));
}

function assignmentRows(rows: LandingGerenciaAssignment[]): WhatsappCloudApiAssignment[] {
  return rows.map((row) => ({
    gerencia_id: row.gerencia_id,
    weight: row.weight,
    phoneMode: row.phoneMode,
    phoneKind: row.phoneKind,
    intervalStartHour: row.intervalStartHour,
    intervalEndHour: row.intervalEndHour,
  }));
}

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-[var(--color-border-subtle)] bg-[rgba(255,255,255,0.025)] px-3 py-2 text-left transition hover:border-[var(--color-border-strong)] hover:bg-[rgba(255,255,255,0.045)]"
    >
      <span className="min-w-0">
        <span className="block text-xs font-medium text-[var(--color-text)]">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-[11px] leading-4 text-[var(--color-text-muted)]">
            {description}
          </span>
        ) : null}
      </span>
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full border transition ${
          checked
            ? "border-[rgba(52,211,153,0.55)] bg-[rgba(52,211,153,0.25)]"
            : "border-[var(--color-border)] bg-[var(--color-bg-2)]"
        }`}
      >
        <span
          className={`absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-[var(--color-text-strong)] shadow-sm transition ${
            checked ? "left-5" : "left-0.5"
          }`}
        />
      </span>
    </button>
  );
}

function SectionTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--color-border-subtle)] pb-3">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-primary)]">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="mt-1 text-sm font-semibold text-[var(--color-text-strong)]">{title}</h2>
        {description ? (
          <p className="mt-1 max-w-3xl text-xs leading-5 text-[var(--color-text-muted)]">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function StatusBadge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
  children: React.ReactNode;
}) {
  const toneClass =
    tone === "success"
      ? "border-[rgba(52,211,153,0.28)] bg-[rgba(52,211,153,0.08)] text-[var(--color-success)]"
      : tone === "warning"
        ? "border-[rgba(251,191,36,0.28)] bg-[rgba(251,191,36,0.08)] text-[var(--color-warning)]"
        : tone === "danger"
          ? "border-[rgba(251,113,133,0.28)] bg-[rgba(251,113,133,0.08)] text-[var(--color-danger)]"
          : tone === "info"
            ? "border-[rgba(56,189,248,0.28)] bg-[rgba(56,189,248,0.08)] text-[var(--color-info)]"
            : "";
  return <span className={`ui-badge ${toneClass}`}>{children}</span>;
}

function SegmentButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-8 rounded-lg px-3 text-xs font-semibold transition ${
        active
          ? "bg-[var(--color-text-strong)] text-[var(--color-bg-0)]"
          : "text-[var(--color-text-muted)] hover:bg-[rgba(255,255,255,0.05)] hover:text-[var(--color-text)]"
      }`}
    >
      {children}
    </button>
  );
}

function MetricTile({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "success" | "warning" | "info";
}) {
  const dotClass =
    tone === "success"
      ? "bg-[var(--color-success)]"
      : tone === "warning"
        ? "bg-[var(--color-warning)]"
        : tone === "info"
          ? "bg-[var(--color-info)]"
          : "bg-[var(--color-text-disabled)]";
  return (
    <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[rgba(255,255,255,0.025)] p-3">
      <div className="flex items-center gap-2">
        <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-muted)]">
          {label}
        </p>
      </div>
      <p className="mt-2 truncate text-sm font-semibold text-[var(--color-text-strong)]">{value}</p>
    </div>
  );
}

export default function WhatsAppCloudApiPageContent({
  mode,
}: {
  mode: "admin" | "dashboard";
}) {
  const router = useRouter();
  const { currencyScope, isAllCurrencies } = useCurrencyScope();
  const workspaceCurrency = currencyScope === CURRENCY_ALL ? "ARS" : currencyScope;
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [targetUserId, setTargetUserId] = useState<string | null>(null);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<WhatsappCloudApiConfig | null>(null);
  const [gerencias, setGerencias] = useState<Gerencia[]>([]);
  const [assignments, setAssignments] = useState<LandingGerenciaAssignment[]>([]);
  const [recentEvents, setRecentEvents] = useState<RecentEvent[]>([]);
  const [pixelOptions, setPixelOptions] = useState<Array<{ pixel_id: string; comment: string }>>([]);

  const [name, setName] = useState("whatsapp-cloud-api");
  const [active, setActive] = useState(false);
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [wabaId, setWabaId] = useState("");
  const [displayPhone, setDisplayPhone] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [apiVersion, setApiVersion] = useState("v25.0");
  const [verifyToken, setVerifyToken] = useState("");
  const [pixelId, setPixelId] = useState("");
  const [landingTag, setLandingTag] = useState("");
  const [selectionMode, setSelectionMode] = useState<"weighted_random" | "fair">("weighted_random");
  const [fairCriterion, setFairCriterion] = useState<"usage_count" | "messages_received">("usage_count");
  const [sendContactCapi, setSendContactCapi] = useState(false);
  const [redirectTemplate, setRedirectTemplate] = useState(DEFAULT_REDIRECT_TEMPLATE);
  const [fallbackTemplate, setFallbackTemplate] = useState(DEFAULT_FALLBACK_TEMPLATE);

  const webhookUrl = useMemo(() => {
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ?? "";
    return base ? `${base}/functions/v1/whatsapp-cloud-webhook` : "";
  }, []);

  const selectedClientName = useMemo(() => {
    const selected = clients.find((client) => client.id === targetUserId);
    return selected?.nombre || selected?.email || "";
  }, [clients, targetUserId]);

  const loadTarget = useCallback(async (uid: string, ownerId: string) => {
    setError(null);
    const gerenciasPromise = mode === "admin"
      ? fetchGerenciasForAdmin(ownerId, workspaceCurrency).then((rows) =>
        rows.filter((row) => row.user_id === uid)
      )
      : fetchGerencias(uid, workspaceCurrency);
    const [cfg, gers] = await Promise.all([
      fetchWhatsappCloudApiConfig(uid),
      gerenciasPromise,
    ]);
    const { data: pixels } = await supabase
      .from("conversions_pixel_configs")
      .select("pixel_id,comment")
      .eq("user_id", uid)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true });
    const options = (pixels ?? [])
      .map((p) => ({
        pixel_id: String(p.pixel_id ?? "").trim(),
        comment: String(p.comment ?? "").trim(),
      }))
      .filter((p) => p.pixel_id);
    setConfig(cfg);
    setGerencias(gers);
    setPixelOptions(options);
    const fallbackName = cleanSlug(selectedClientName || "whatsapp-cloud-api") || "whatsapp-cloud-api";
    setName(cfg?.name ?? fallbackName);
    setActive(cfg?.active ?? false);
    setPhoneNumberId(cfg?.phone_number_id ?? "");
    setWabaId(cfg?.whatsapp_business_account_id ?? "");
    setDisplayPhone(cfg?.display_phone_number ?? "");
    setAccessToken(cfg?.meta_access_token ?? "");
    setApiVersion(cfg?.meta_api_version ?? "v25.0");
    setVerifyToken(cfg?.webhook_verify_token ?? crypto.randomUUID().replace(/-/g, ""));
    setPixelId(cfg?.pixel_id ?? "");
    setLandingTag(cfg?.landing_tag ?? "");
    setSelectionMode(cfg?.gerencia_selection_mode ?? "weighted_random");
    setFairCriterion(cfg?.gerencia_fair_criterion ?? "usage_count");
    setSendContactCapi(cfg?.send_contact_capi ?? false);
    setRedirectTemplate(cfg?.redirect_message_template ?? DEFAULT_REDIRECT_TEMPLATE);
    setFallbackTemplate(cfg?.fallback_message_template ?? DEFAULT_FALLBACK_TEMPLATE);
    if (cfg?.id) {
      const [asg, events] = await Promise.all([
        fetchWhatsappCloudApiAssignments(cfg.id),
        fetchWhatsappCloudApiRecentEvents(cfg.id),
      ]);
      setAssignments(toAssignments(asg));
      setRecentEvents(events);
    } else {
      setAssignments([]);
      setRecentEvents([]);
    }
  }, [mode, selectedClientName, workspaceCurrency]);

  useEffect(() => {
    const init = async () => {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) {
        router.replace("/login");
        return;
      }
      setCurrentUserId(auth.user.id);

      let initialTarget = auth.user.id;
      if (mode === "admin") {
        const { data, error: listError } = await invokeFunction<{
          users?: ClientOption[];
        }>(supabase, "list-clients", { method: "GET" });
        if (listError) throw new Error(listError.message);
        const userList = Array.isArray(data?.users) ? data!.users : [];
        setClients(userList);
        initialTarget = userList[0]?.id ?? auth.user.id;
      }
      setTargetUserId(initialTarget);
      await loadTarget(initialTarget, auth.user.id);
      setReady(true);
    };

    void init().catch((err) => {
      setError(err instanceof Error ? err.message : "Error al cargar WhatsApp Cloud API");
      setReady(true);
    });
  }, [loadTarget, mode, router]);

  const reloadSelected = async (uid = targetUserId) => {
    if (!uid || !currentUserId) return;
    await loadTarget(uid, currentUserId);
  };

  const copyText = async (value: string, label: string) => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setMessage(`${label} copiado.`);
  };

  const handleSave = async () => {
    if (!targetUserId) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const cleanName = cleanSlug(name);
      if (!cleanName) throw new Error("El nombre debe tener letras o numeros.");
      if (!/^\d+$/.test(phoneNumberId.trim())) throw new Error("Phone Number ID debe ser numerico.");
      if (!/^\d+$/.test(wabaId.trim())) throw new Error("WABA ID debe ser numerico.");
      if (!accessToken.trim()) throw new Error("Meta access token requerido.");
      if (!verifyToken.trim()) throw new Error("Verify token requerido.");
      if (!cleanTag(landingTag)) throw new Error("Tag de promo_code requerido.");
      if (!/^\d+$/.test(pixelId.trim())) throw new Error("Pixel ID requerido.");

      const saved = await upsertWhatsappCloudApiConfig({
        id: config?.id,
        user_id: targetUserId,
        name: cleanName,
        active,
        workspace_currency: workspaceCurrency,
        phone_number_id: phoneNumberId.trim(),
        whatsapp_business_account_id: wabaId.trim(),
        display_phone_number: displayPhone.trim(),
        meta_access_token: accessToken.trim(),
        meta_api_version: apiVersion.trim() || "v25.0",
        webhook_verify_token: verifyToken.trim(),
        pixel_id: pixelId.trim(),
        landing_tag: cleanTag(landingTag),
        gerencia_selection_mode: selectionMode,
        gerencia_fair_criterion: fairCriterion,
        send_contact_capi: sendContactCapi,
        redirect_message_template: redirectTemplate,
        fallback_message_template: fallbackTemplate,
      });
      await setWhatsappCloudApiAssignments(
        saved.id,
        targetUserId,
        assignmentRows(assignments),
      );
      setMessage("Configuracion guardada.");
      await reloadSelected(targetUserId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar.");
    } finally {
      setSaving(false);
    }
  };

  const toggleAssignment = (g: Gerencia) => {
    setAssignments((prev) => {
      const exists = prev.some((row) => row.gerencia_id === g.id);
      if (exists) return prev.filter((row) => row.gerencia_id !== g.id);
      return [
        ...prev,
        {
          gerencia_id: g.id,
          weight: 1,
          phoneMode: "random",
          phoneKind: "carga",
          intervalStartHour: null,
          intervalEndHour: null,
        },
      ];
    });
  };

  if (!ready) {
    return <p className="text-sm text-[var(--color-text-muted)]">Cargando WhatsApp Cloud API...</p>;
  }

  if (isAllCurrencies) {
    return <SingleCurrencyRequired title="Elegi ARS o PYG para configurar WhatsApp Cloud API" />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Landing conversacional"
        title="WhatsApp Cloud API"
        description="Recibi mensajes Click-to-WhatsApp, captura referral/ctwa_clid y deriva al asesor asignado."
        actions={
          <>
            <StatusBadge tone={active ? "success" : "warning"}>
              {active ? "Activo" : "Inactivo"}
            </StatusBadge>
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSave()}
              className="ui-button ui-button-primary"
            >
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </>
        }
      />

      {mode === "admin" && clients.length > 0 ? (
        <SurfaceCard className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <Field label="Cliente">
              <select
                value={targetUserId ?? ""}
                onChange={(event) => {
                  const next = event.target.value;
                  setTargetUserId(next);
                  void reloadSelected(next);
                }}
                className={`${inputClass} sm:min-w-80`}
              >
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.nombre || client.email || client.id}
                  </option>
                ))}
              </select>
            </Field>
            <StatusBadge tone="info">{workspaceCurrency}</StatusBadge>
          </div>
        </SurfaceCard>
      ) : null}

      {error ? (
        <p className="ui-alert border-[rgba(251,113,133,0.25)] bg-[rgba(251,113,133,0.07)] text-sm text-[var(--color-danger)]">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="ui-alert border-emerald-500/30 bg-emerald-500/10 text-sm text-emerald-200">
          {message}
        </p>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          <SurfaceCard className="overflow-hidden">
            <div className="space-y-4 p-4 sm:p-5">
              <SectionTitle
                eyebrow="Conexion Meta"
                title="Identificacion"
                description="Numero oficial, WABA y credenciales de la app conectada."
                action={<Toggle checked={active} onChange={setActive} label={active ? "Integracion activa" : "Integracion inactiva"} />}
              />

              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Nombre interno">
                  <input value={name} onChange={(e) => setName(cleanSlug(e.target.value))} className={inputClass} />
                </Field>
                <Field label="Telefono visible">
                  <input value={displayPhone} onChange={(e) => setDisplayPhone(e.target.value)} className={inputClass} placeholder="549..." />
                </Field>
                <Field label="Phone Number ID">
                  <input value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value.replace(/\D/g, ""))} className={inputClass} inputMode="numeric" />
                </Field>
                <Field label="WhatsApp Business Account ID">
                  <input value={wabaId} onChange={(e) => setWabaId(e.target.value.replace(/\D/g, ""))} className={inputClass} inputMode="numeric" />
                </Field>
                <Field label="Verify token">
                  <div className="flex gap-2">
                    <input value={verifyToken} onChange={(e) => setVerifyToken(e.target.value.trim())} className={`${inputClass} font-mono text-xs`} />
                    <button type="button" onClick={() => void copyText(verifyToken, "Verify token")} className="ui-button ui-button-secondary shrink-0">
                      Copiar
                    </button>
                  </div>
                </Field>
                <Field label="Meta access token">
                  <input value={accessToken} onChange={(e) => setAccessToken(e.target.value)} className={`${inputClass} font-mono text-xs`} type="password" autoComplete="off" />
                </Field>
                <Field label="Version WhatsApp Cloud API">
                  <input value={apiVersion} onChange={(e) => setApiVersion(e.target.value)} className={inputClass} />
                  <p className="mt-1 text-[11px] leading-4 text-[var(--color-text-muted)]">
                    Solo aplica al envio de mensajes de WhatsApp Cloud API; CAPI se configura desde Integraciones.
                  </p>
                </Field>
              </div>
            </div>
          </SurfaceCard>

          <SurfaceCard className="overflow-hidden">
            <div className="space-y-4 p-4 sm:p-5">
              <SectionTitle
                eyebrow="Tracking"
                title="Pixel y atribucion"
                description="Origen, promo_code y comportamiento del primer Contact interno."
              />
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Pixel ID">
                  <select
                    value={pixelId}
                    onChange={(e) => setPixelId(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Seleccionar pixel</option>
                    {[...(pixelOptions.some((p) => p.pixel_id === pixelId) || !pixelId ? pixelOptions : [{ pixel_id: pixelId, comment: "" }, ...pixelOptions])].map((pixel) => (
                      <option key={pixel.pixel_id} value={pixel.pixel_id}>
                        {pixel.comment ? `${pixel.pixel_id} (${pixel.comment})` : pixel.pixel_id}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
                    Se configura desde{" "}
                    <a
                      href={mode === "admin" ? "/admin/integraciones" : "/dashboard/integraciones"}
                      className="text-[var(--color-text)] underline hover:text-[var(--color-text-strong)]"
                    >
                      Integraciones
                    </a>
                    .
                  </p>
                </Field>
                <Field label="Tag">
                  <input value={landingTag} onChange={(e) => setLandingTag(cleanTag(e.target.value))} className={inputClass} />
                </Field>
                <div className="md:col-span-2">
                  <Field label="Webhook URL">
                    <div className="flex gap-2">
                      <input value={webhookUrl} readOnly className={`${inputClass} font-mono text-xs`} />
                      <button type="button" onClick={() => void copyText(webhookUrl, "Webhook URL")} className="ui-button ui-button-secondary shrink-0">
                        Copiar
                      </button>
                    </div>
                    <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">
                      URL para configurar el webhook del numero en Meta.
                    </p>
                  </Field>
                </div>
              </div>
              <Toggle
                checked={sendContactCapi}
                onChange={setSendContactCapi}
                label="Enviar Contact CAPI a Meta"
                description="Por defecto queda apagado; el Contact interno se crea igual."
              />
            </div>
          </SurfaceCard>

          <SurfaceCard className="overflow-hidden">
            <div className="space-y-4 p-4 sm:p-5">
              <SectionTitle
                eyebrow="Respuesta"
                title="Mensaje automatico"
                description="Texto que recibe el usuario cuando escriba al numero Cloud API."
              />
              <Field label="Mensaje de derivacion">
                <textarea
                  value={redirectTemplate}
                  onChange={(e) => setRedirectTemplate(e.target.value)}
                  rows={6}
                  className={`${textareaClass} min-h-36`}
                />
              </Field>
              <Field label="Mensaje fallback sin telefonos">
                <textarea
                  value={fallbackTemplate}
                  onChange={(e) => setFallbackTemplate(e.target.value)}
                  rows={3}
                  className={textareaClass}
                />
              </Field>
              <div className="flex flex-wrap gap-2">
                {["{{name}}", "{{phone}}", "{{promo_code}}", "{{wa_link}}"].map((token) => (
                  <span key={token} className="ui-badge font-mono">{token}</span>
                ))}
              </div>
            </div>
          </SurfaceCard>

          <SurfaceCard className="overflow-hidden">
            <div className="space-y-4 p-4 sm:p-5">
              <SectionTitle
                eyebrow="Redireccion"
                title="Asignacion de gerencias"
                description="Misma matriz operativa que las landings, aplicada al numero Cloud API."
                action={
                  <div className="flex rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-2)] p-1">
                    <SegmentButton active={selectionMode === "weighted_random"} onClick={() => setSelectionMode("weighted_random")}>
                      Peso
                    </SegmentButton>
                    <SegmentButton active={selectionMode === "fair"} onClick={() => setSelectionMode("fair")}>
                      Equitativa
                    </SegmentButton>
                  </div>
                }
              />

              {selectionMode === "fair" ? (
                <div className="flex w-fit rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-2)] p-1">
                  <SegmentButton active={fairCriterion === "usage_count"} onClick={() => setFairCriterion("usage_count")}>
                    Contador
                  </SegmentButton>
                  <SegmentButton active={fairCriterion === "messages_received"} onClick={() => setFairCriterion("messages_received")}>
                    Mensajes
                  </SegmentButton>
                </div>
              ) : null}

              <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
                <table className="min-w-[820px] w-full text-left text-xs">
                  <thead className="bg-[rgba(255,255,255,0.035)] text-[var(--color-text-muted)]">
                    <tr>
                      <th className="px-3 py-2.5 font-medium">Asignar</th>
                      <th className="px-3 py-2.5 font-medium">Gerencia</th>
                      {selectionMode === "weighted_random" ? <th className="px-3 py-2.5 font-medium">Peso</th> : null}
                      <th className="px-3 py-2.5 font-medium">Modo telefono</th>
                      <th className="px-3 py-2.5 font-medium">Tipo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border-subtle)]">
                    {gerencias.map((g) => {
                      const assignment = assignments.find((row) => row.gerencia_id === g.id);
                      const checked = Boolean(assignment);
                      return (
                        <tr key={g.id} className={checked ? "bg-[rgba(163,230,53,0.035)]" : "bg-transparent"}>
                          <td className="px-3 py-2.5">
                            <input type="checkbox" checked={checked} onChange={() => toggleAssignment(g)} className="h-4 w-4 accent-[var(--color-primary)]" />
                          </td>
                          <td className="px-3 py-2.5 text-[var(--color-text)]">
                            <div className="font-medium text-[var(--color-text-strong)]">{g.nombre}</div>
                            <div className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">ID {g.gerencia_id ?? g.id}</div>
                          </td>
                          {selectionMode === "weighted_random" ? (
                            <td className="px-3 py-2.5">
                              <input
                                type="number"
                                min={0}
                                disabled={!checked}
                                value={assignment?.weight ?? 0}
                                onChange={(e) => {
                                  const next = Math.max(0, Number(e.target.value) || 0);
                                  setAssignments((prev) => prev.map((row) => row.gerencia_id === g.id ? { ...row, weight: next } : row));
                                }}
                                className={`${compactInputClass} w-20`}
                              />
                            </td>
                          ) : null}
                          <td className="px-3 py-2.5">
                            <select
                              disabled={!checked}
                              value={assignment?.phoneMode ?? "random"}
                              onChange={(e) => setAssignments((prev) => prev.map((row) => row.gerencia_id === g.id ? { ...row, phoneMode: e.target.value as "random" | "fair" } : row))}
                              className={compactSelectClass}
                            >
                              <option value="random">Aleatorio</option>
                              <option value="fair">Equitativo</option>
                            </select>
                          </td>
                          <td className="px-3 py-2.5">
                            <select
                              disabled={!checked}
                              value={assignment?.phoneKind ?? "carga"}
                              onChange={(e) => setAssignments((prev) => prev.map((row) => row.gerencia_id === g.id ? { ...row, phoneKind: e.target.value as PhoneKind } : row))}
                              className={compactSelectClass}
                            >
                              {PHONE_KIND_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                    {gerencias.length === 0 ? (
                      <tr>
                        <td colSpan={selectionMode === "weighted_random" ? 5 : 4} className="px-3 py-8 text-center text-[var(--color-text-muted)]">
                          No hay gerencias para este workspace.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </SurfaceCard>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <SurfaceCard className="space-y-3 p-4">
            <SectionTitle title="Estado" />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <MetricTile label="Configuracion" value={config ? "Guardada" : "Sin guardar"} tone={config ? "success" : "warning"} />
              <MetricTile label="Webhook" value={webhookUrl ? "URL lista" : "Sin URL"} tone={webhookUrl ? "info" : "warning"} />
              <MetricTile label="Gerencias" value={`${assignments.length} asignadas`} tone={assignments.length > 0 ? "success" : "warning"} />
              <MetricTile label="Contact CAPI" value={sendContactCapi ? "Activo" : "Apagado"} tone={sendContactCapi ? "success" : "neutral"} />
            </div>
          </SurfaceCard>

          <SurfaceCard className="space-y-3 p-4">
            <SectionTitle title="Ultimos eventos" />
            {recentEvents.length > 0 ? (
              <div className="space-y-2">
                {recentEvents.map((event) => (
                  <div key={event.id} className="rounded-xl border border-[var(--color-border-subtle)] bg-[rgba(255,255,255,0.025)] p-3">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-medium capitalize text-[var(--color-text-strong)]">{event.event_type}</span>
                      <StatusBadge tone={event.status === "failed" ? "danger" : event.status === "processed" ? "success" : "neutral"}>
                        {event.status}
                      </StatusBadge>
                    </div>
                    <p className="mt-2 truncate font-mono text-[10px] text-[var(--color-text-muted)]">
                      {event.meta_message_id || event.id}
                    </p>
                    {event.last_error ? (
                      <p className="mt-2 line-clamp-3 text-[11px] leading-4 text-[var(--color-danger)]">{event.last_error}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-[var(--color-border-strong)] px-3 py-5 text-center text-xs text-[var(--color-text-muted)]">
                Todavia no hay webhooks recibidos.
              </p>
            )}
          </SurfaceCard>
        </aside>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-[var(--color-text-muted)]">{label}</span>
      {children}
    </label>
  );
}
