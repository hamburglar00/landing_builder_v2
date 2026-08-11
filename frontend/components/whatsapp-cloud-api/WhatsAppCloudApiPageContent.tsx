"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { invokeFunction } from "@/lib/supabaseFunctions";
import { PageHeader, SurfaceCard } from "@/components/ui/PanelPrimitives";
import { CURRENCY_ALL } from "@/lib/currency";
import { SingleCurrencyRequired, useCurrencyScope } from "@/components/currency/CurrencyScope";
import type { Gerencia, GerenciaWorkGroup } from "@/lib/gerencias/types";
import type { PhoneKind } from "@/lib/landing/types";
import {
  fetchGerencias,
  fetchGerenciaWorkGroups,
  fetchGerenciasForAdmin,
  type LandingGerenciaAssignment,
} from "@/lib/gerencias/gerenciasDb";
import { CollapsibleSection } from "@/components/landing/LandingEditorForm";
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

const INSTRUCTION_CHECKLIST = [
  "Crear o seleccionar la app de Meta y conectar el numero oficial a WhatsApp Cloud API.",
  "Copiar Phone Number ID, WhatsApp Business Account ID y generar un access token valido para enviar mensajes.",
  "Pegar en Meta la Webhook URL y el Verify token de esta pantalla.",
  "Suscribir el webhook a eventos de mensajes y verificar que Meta acepte el challenge.",
  "Seleccionar el Pixel, definir el Tag, cargar el mensaje de respuesta y asignar gerencias.",
  "Activar la integracion, guardar y probar escribiendo al numero conectado.",
];

const INSTRUCTION_FLOW = [
  "Meta envia el mensaje entrante al webhook del constructor.",
  "El constructor guarda el payload completo y captura referral/ctwa_clid cuando Meta lo envia.",
  "Se selecciona un telefono con la misma matriz de gerencias que usan las landings.",
  "Se crea un Contact interno en conversiones, sin enviar Contact CAPI a Meta.",
  "El usuario recibe por WhatsApp el mensaje configurado con telefono, link y promo_code.",
  "LEAD y PURCHASE siguen entrando por el endpoint actual y matchean con el recorrido.",
];

const PHONE_KIND_OPTIONS: Array<{ value: PhoneKind; label: string }> = [
  { value: "carga", label: "Carga" },
  { value: "assistant", label: "Asistente" },
  { value: "ads", label: "Ads" },
  { value: "mkt", label: "Mkt" },
];

const GRAPH_API_VERSION_OPTIONS = ["v26.0", "v25.0", "v24.0", "v23.0", "v22.0", "v21.0"];

const inputClass =
  "h-10 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-2)] px-3 text-sm text-[var(--color-text-strong)] outline-none placeholder:text-[var(--color-text-disabled)]";
const textareaClass =
  "w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-2)] px-3 py-2.5 text-sm leading-5 text-[var(--color-text-strong)] outline-none placeholder:text-[var(--color-text-disabled)]";

type ClientOption = {
  id: string;
  nombre: string | null;
  email: string | null;
};

type RecentEvent = Awaited<ReturnType<typeof fetchWhatsappCloudApiRecentEvents>>[number];

type DisplayGroup = {
  id: string;
  name: string;
  gerencias: Gerencia[];
};

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

function buildDisplayGroups(gerencias: Gerencia[], workGroups: GerenciaWorkGroup[]): DisplayGroup[] {
  if (workGroups.length === 0) {
    return [{ id: "__all__", name: "Todas las gerencias", gerencias }];
  }

  const byId = new Map(gerencias.map((g) => [g.id, g]));
  const groupedIds = new Set<number>();
  const groups = workGroups.map((group) => {
    const groupGerencias = group.gerenciaIds
      .map((id) => byId.get(id))
      .filter((g): g is Gerencia => Boolean(g));
    groupGerencias.forEach((g) => groupedIds.add(g.id));
    return {
      id: String(group.id),
      name: group.name,
      gerencias: groupGerencias,
    };
  });

  const ungrouped = gerencias.filter((g) => !groupedIds.has(g.id));
  if (ungrouped.length > 0) {
    groups.push({ id: "__ungrouped__", name: "Sin grupo", gerencias: ungrouped });
  }

  return groups;
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
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [config, setConfig] = useState<WhatsappCloudApiConfig | null>(null);
  const [gerencias, setGerencias] = useState<Gerencia[]>([]);
  const [workGroups, setWorkGroups] = useState<GerenciaWorkGroup[]>([]);
  const [assignments, setAssignments] = useState<LandingGerenciaAssignment[]>([]);
  const [recentEvents, setRecentEvents] = useState<RecentEvent[]>([]);
  const [pixelOptions, setPixelOptions] = useState<Array<{ pixel_id: string; comment: string }>>([]);
  const [webhookUrlCopied, setWebhookUrlCopied] = useState(false);

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

  const displayGroups = useMemo(() => buildDisplayGroups(gerencias, workGroups), [gerencias, workGroups]);

  const loadTarget = useCallback(async (uid: string, ownerId: string) => {
    setError(null);
    const gerenciasPromise = mode === "admin"
      ? fetchGerenciasForAdmin(ownerId, workspaceCurrency).then((rows) =>
        rows.filter((row) => row.user_id === uid)
      )
      : fetchGerencias(uid, workspaceCurrency);
    const [cfg, gers, groups] = await Promise.all([
      fetchWhatsappCloudApiConfig(uid),
      gerenciasPromise,
      fetchGerenciaWorkGroups(uid),
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
    setWorkGroups(groups);
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
        send_contact_capi: false,
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

  const upsertAssignment = (g: Gerencia) => {
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

  const updateAssignment = (
    gerenciaId: number,
    patch: Partial<LandingGerenciaAssignment>,
  ) => {
    setAssignments((prev) =>
      prev.map((row) => (row.gerencia_id === gerenciaId ? { ...row, ...patch } : row)),
    );
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
        title="WhatsApp Cloud API"
        description="Recibi mensajes Click-to-WhatsApp y deriva al asesor asignado."
        actions={
          <>
            <button
              type="button"
              onClick={() => setInstructionsOpen((value) => !value)}
              className="ui-button ui-button-secondary"
            >
              {instructionsOpen ? "Ocultar instructivo" : "Ver instructivo"}
            </button>
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

      {instructionsOpen ? (
        <section className="rounded-xl border border-sky-900/70 bg-sky-950/20 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-sky-100">Instructivo de WhatsApp Cloud API</p>
              <p className="mt-1 max-w-4xl text-xs leading-relaxed text-zinc-400">
                Esta seccion conecta un numero oficial de Meta. Internamente se comporta como una landing: recibe el mensaje inicial, asigna un telefono de gerencia y responde con el link/promo para continuar.
              </p>
            </div>
            {mode === "admin" ? (
              <a
                href="/admin/documentacion"
                className="inline-flex shrink-0 items-center justify-center rounded-lg border border-sky-700 bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-500"
              >
                Abrir documentacion completa
              </a>
            ) : null}
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
              <p className="text-xs font-semibold text-zinc-100">Configuracion inicial</p>
              <ol className="mt-3 space-y-2 text-xs leading-relaxed text-zinc-300">
                {INSTRUCTION_CHECKLIST.map((item, index) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-sky-800 bg-sky-950 text-[10px] font-semibold text-sky-200">
                      {index + 1}
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
              <p className="text-xs font-semibold text-zinc-100">Que pasa cuando escribe un usuario</p>
              <ol className="mt-3 space-y-2 text-xs leading-relaxed text-zinc-300">
                {INSTRUCTION_FLOW.map((item, index) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-emerald-800 bg-emerald-950 text-[10px] font-semibold text-emerald-200">
                      {index + 1}
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          <div className="mt-4 grid gap-3 text-xs text-zinc-300 lg:grid-cols-3">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
              <p className="font-semibold text-zinc-100">Webhook URL</p>
              <p className="mt-1 break-all font-mono text-[11px] text-sky-200">{webhookUrl || "Sin URL disponible"}</p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
              <p className="font-semibold text-zinc-100">Verify token</p>
              <p className="mt-1 font-mono text-[11px] text-zinc-300">{verifyToken || "Se genera al cargar"}</p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
              <p className="font-semibold text-zinc-100">Contact CAPI</p>
              <p className="mt-1 text-zinc-400">Omitido por diseno para este flujo. El Contact queda interno.</p>
            </div>
          </div>
        </section>
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
                    <button
                      type="button"
                      onClick={() => void copyText(verifyToken, "Verify token")}
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-300 transition hover:bg-zinc-800 hover:text-zinc-100"
                      title="Copiar Verify token"
                      aria-label="Copiar Verify token"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                      </svg>
                    </button>
                  </div>
                </Field>
                <Field label="Meta access token">
                  <input value={accessToken} onChange={(e) => setAccessToken(e.target.value)} className={`${inputClass} font-mono text-xs`} type="password" autoComplete="off" />
                </Field>
                <Field label="Version WhatsApp Cloud API">
                  <select value={apiVersion} onChange={(e) => setApiVersion(e.target.value)} className={inputClass}>
                    {[...(GRAPH_API_VERSION_OPTIONS.includes(apiVersion) ? GRAPH_API_VERSION_OPTIONS : [apiVersion, ...GRAPH_API_VERSION_OPTIONS])]
                      .filter(Boolean)
                      .map((version) => (
                        <option key={version} value={version}>
                          {version}
                        </option>
                      ))}
                  </select>
                  <p className="mt-1 text-[11px] leading-4 text-[var(--color-text-muted)]">
                    Solo aplica al envio de mensajes de WhatsApp Cloud API; CAPI se configura desde Integraciones.
                  </p>
                </Field>
              </div>
            </div>
          </SurfaceCard>

          <CollapsibleSection title="Tracking" defaultOpen>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-400">
                  Pixel ID <span className="text-red-400">*</span>
                </label>
                <select
                  value={pixelId}
                  onChange={(e) => setPixelId(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                >
                  <option value="">Seleccionar pixel</option>
                  {[...(pixelOptions.some((p) => p.pixel_id === pixelId) || !pixelId ? pixelOptions : [{ pixel_id: pixelId, comment: "" }, ...pixelOptions])].map((pixel) => (
                    <option key={pixel.pixel_id} value={pixel.pixel_id}>
                      {pixel.comment ? `${pixel.pixel_id} (${pixel.comment})` : pixel.pixel_id}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-zinc-500">
                  Se configura desde{" "}
                  <a
                    href={mode === "admin" ? "/admin/integraciones" : "/dashboard/integraciones"}
                    className="text-zinc-300 underline hover:text-zinc-100"
                  >
                    Integraciones
                  </a>
                  .
                </p>
              </div>

              <div className="rounded-lg border border-zinc-800 bg-zinc-950/30 px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-zinc-300">Contact CAPI omitido</p>
                    <p className="mt-0.5 text-[11px] text-zinc-500">
                      En WhatsApp Cloud API el Contact se crea interno, pero no se envia a Meta.
                    </p>
                  </div>
                  <span
                    className="inline-flex h-6 items-center rounded-full border border-zinc-700 bg-zinc-800 px-2 text-[10px] font-medium text-zinc-400"
                  >
                    Off
                  </span>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-400">
                  Webhook URL <span className="text-red-400">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={webhookUrl}
                    disabled
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-xs text-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
                    placeholder="Se completa automaticamente desde Supabase"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      if (!webhookUrl) return;
                      await navigator.clipboard.writeText(webhookUrl);
                      setWebhookUrlCopied(true);
                      window.setTimeout(() => setWebhookUrlCopied(false), 1200);
                    }}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-300 transition hover:bg-zinc-800 hover:text-zinc-100"
                    title="Copiar Webhook URL"
                    aria-label="Copiar Webhook URL"
                  >
                    {webhookUrlCopied ? (
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
                  URL para configurar el webhook del numero en Meta.
                </p>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-400">
                  Tag <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={landingTag}
                  onChange={(e) => setLandingTag(cleanTag(e.target.value))}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                  placeholder="ej: miTag123"
                  required
                />
                <p className="mt-1 text-[11px] text-zinc-500">
                  Identificador unico del flujo. Solo letras y numeros, sin espacios.
                </p>
              </div>
            </div>
          </CollapsibleSection>

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

          <CollapsibleSection title="Redirección">
            <div className="mb-3 rounded-lg border border-zinc-700 bg-zinc-900/70 p-3">
              <p className="mb-2 text-xs font-medium text-zinc-300">Selección de gerencias</p>
              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex rounded-lg border border-zinc-700 bg-zinc-900 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setSelectionMode("weighted_random")}
                    className={`cursor-pointer rounded-l-lg border-r border-zinc-700 px-2 py-1 ${
                      selectionMode === "weighted_random" ? "bg-zinc-100 text-zinc-900" : "text-zinc-300 hover:bg-zinc-800"
                    }`}
                    title="Aleatorio por peso de gerencia"
                  >
                    Aleatoria (peso)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectionMode("fair")}
                    className={`cursor-pointer rounded-r-lg px-2 py-1 ${
                      selectionMode === "fair" ? "bg-zinc-100 text-zinc-900" : "text-zinc-300 hover:bg-zinc-800"
                    }`}
                    title="Equitativo entre gerencias (ignora peso)"
                  >
                    Equitativa
                  </button>
                </div>
                {selectionMode === "fair" ? (
                  <div className="inline-flex rounded-lg border border-zinc-700 bg-zinc-900 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setFairCriterion("usage_count")}
                      className={`cursor-pointer rounded-l-lg border-r border-zinc-700 px-2 py-1 ${
                        fairCriterion === "usage_count" ? "bg-zinc-100 text-zinc-900" : "text-zinc-300 hover:bg-zinc-800"
                      }`}
                      title="Equitativo por sumatoria de contador"
                    >
                      Por contador
                    </button>
                    <button
                      type="button"
                      onClick={() => setFairCriterion("messages_received")}
                      className={`cursor-pointer rounded-r-lg px-2 py-1 ${
                        fairCriterion === "messages_received" ? "bg-zinc-100 text-zinc-900" : "text-zinc-300 hover:bg-zinc-800"
                      }`}
                      title="Equitativo por sumatoria de mensajes recibidos"
                    >
                      Mensajes recibidos
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
            <p className="mb-3 text-xs text-zinc-400">
              Configura a dónde redirigirá el mensaje automático del número Cloud API.
            </p>
            <p className="mb-3 text-xs text-zinc-500">
              Desplegá un grupo de trabajo y marcá <strong>Asignar</strong> para incluir sus gerencias. La asignación real sigue siendo por gerencia individual.
            </p>
            {gerencias.length === 0 ? (
              <p className="text-sm text-zinc-500">
                No tienes gerencias.{" "}
                <Link href={mode === "admin" ? "/admin/gerencias" : "/dashboard/gerencias"} className="text-zinc-300 underline hover:text-zinc-100">
                  Crear gerencias
                </Link>
              </p>
            ) : (
              <div className="space-y-3">
                {displayGroups.map((group) => {
                  const assignedCount = group.gerencias.filter((g) => assignments.some((a) => a.gerencia_id === g.id)).length;
                  return (
                    <details key={group.id} className="overflow-hidden rounded-lg border border-zinc-700 bg-zinc-950/30">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 bg-zinc-900/80 px-3 py-2 text-sm font-medium text-zinc-200 marker:hidden">
                        <span>{group.name}</span>
                        <span className="text-[11px] font-normal text-zinc-500">
                          {assignedCount}/{group.gerencias.length} asignadas
                        </span>
                      </summary>
                      <div className="overflow-x-auto border-t border-zinc-800">
                        <table className="min-w-[900px] text-left text-sm md:min-w-full">
                          <thead className="bg-zinc-800/80">
                            <tr>
                              <th className="px-3 py-2 font-medium text-zinc-300">Gerencia</th>
                              <th className="px-3 py-2 font-medium text-zinc-300">Nombre</th>
                              <th className="w-20 px-3 py-2 text-center font-medium text-zinc-300">Asignar</th>
                              {selectionMode === "weighted_random" ? (
                                <th className="w-10 px-3 py-2 font-medium text-zinc-300">Peso</th>
                              ) : null}
                              <th className="w-32 px-3 py-2 font-medium text-zinc-300">Modo</th>
                              <th className="min-w-[140px] px-3 py-2 font-medium text-zinc-300">Tipo</th>
                              <th className="w-56 px-3 py-2 font-medium text-zinc-300">Intervalo</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-800">
                            {group.gerencias.length === 0 ? (
                              <tr>
                                <td colSpan={selectionMode === "weighted_random" ? 7 : 6} className="px-3 py-4 text-center text-xs text-zinc-500">
                                  Este grupo todavía no tiene gerencias.
                                </td>
                              </tr>
                            ) : (
                              group.gerencias.map((g) => {
                                const assignment = assignments.find((row) => row.gerencia_id === g.id);
                                const isAssigned = Boolean(assignment);
                                const intervalStartHour = assignment?.intervalStartHour ?? null;
                                const intervalEndHour = assignment?.intervalEndHour ?? null;
                                return (
                                  <tr key={g.id} className="bg-zinc-950/40">
                                    <td className="px-3 py-2 text-zinc-300">{g.gerencia_id ?? "MANUAL"}</td>
                                    <td className="px-3 py-2 text-zinc-200">{g.nombre}</td>
                                    <td className="px-3 py-2 text-center">
                                      <input
                                        type="checkbox"
                                        checked={isAssigned}
                                        onChange={() => upsertAssignment(g)}
                                        className="rounded border-zinc-600"
                                      />
                                    </td>
                                    {selectionMode === "weighted_random" ? (
                                      <td className="px-3 py-2">
                                        <input
                                          type="number"
                                          min={0}
                                          disabled={!isAssigned}
                                          value={assignment?.weight ?? 0}
                                          onChange={(e) => {
                                            const value = Number(e.target.value);
                                            updateAssignment(g.id, { weight: Number.isNaN(value) ? 0 : Math.max(0, value) });
                                          }}
                                          className="w-16 rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 disabled:opacity-50"
                                        />
                                      </td>
                                    ) : null}
                                    <td className="px-3 py-2">
                                      <select
                                        disabled={!isAssigned}
                                        value={assignment?.phoneMode ?? "random"}
                                        onChange={(e) => updateAssignment(g.id, { phoneMode: e.target.value as "random" | "fair" })}
                                        className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 disabled:opacity-50"
                                      >
                                        <option value="random">Aleatorio</option>
                                        <option value="fair">Equitativo</option>
                                      </select>
                                    </td>
                                    <td className="px-3 py-2">
                                      <select
                                        disabled={!isAssigned}
                                        value={assignment?.phoneKind ?? "carga"}
                                        onChange={(e) => updateAssignment(g.id, { phoneKind: e.target.value as PhoneKind })}
                                        className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 disabled:opacity-50"
                                      >
                                        {PHONE_KIND_OPTIONS.map((option) => (
                                          <option key={option.value} value={option.value}>
                                            {option.label}
                                          </option>
                                        ))}
                                      </select>
                                    </td>
                                    <td className="px-3 py-2 text-zinc-300">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <label className="flex items-center gap-1 text-[11px] text-zinc-400">
                                          <input
                                            type="checkbox"
                                            disabled={!isAssigned}
                                            checked={intervalStartHour !== null && intervalEndHour !== null}
                                            onChange={(e) =>
                                              updateAssignment(g.id, e.target.checked
                                                ? { intervalStartHour: 0, intervalEndHour: 23 }
                                                : { intervalStartHour: null, intervalEndHour: null })
                                            }
                                            className="rounded border-zinc-600"
                                          />
                                          Horario
                                        </label>
                                        {intervalStartHour !== null && intervalEndHour !== null ? (
                                          <div className="flex items-center gap-1">
                                            <select
                                              disabled={!isAssigned}
                                              value={intervalStartHour}
                                              onChange={(e) => {
                                                const value = Number(e.target.value);
                                                updateAssignment(g.id, { intervalStartHour: Number.isNaN(value) ? 0 : Math.max(0, Math.min(23, value)) });
                                              }}
                                              className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-100"
                                            >
                                              {Array.from({ length: 24 }).map((_, hour) => (
                                                <option key={hour} value={hour}>{hour.toString().padStart(2, "0")}:00</option>
                                              ))}
                                            </select>
                                            <span className="text-[11px] text-zinc-500">a</span>
                                            <select
                                              disabled={!isAssigned}
                                              value={intervalEndHour}
                                              onChange={(e) => {
                                                const value = Number(e.target.value);
                                                updateAssignment(g.id, { intervalEndHour: Number.isNaN(value) ? 23 : Math.max(0, Math.min(23, value)) });
                                              }}
                                              className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-100"
                                            >
                                              {Array.from({ length: 24 }).map((_, hour) => (
                                                <option key={hour} value={hour}>{hour.toString().padStart(2, "0")}:00</option>
                                              ))}
                                            </select>
                                          </div>
                                        ) : null}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  );
                })}
              </div>
            )}
          </CollapsibleSection>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <SurfaceCard className="space-y-3 p-4">
            <SectionTitle title="Estado" />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <MetricTile label="Configuracion" value={config ? "Guardada" : "Sin guardar"} tone={config ? "success" : "warning"} />
              <MetricTile label="Webhook" value={webhookUrl ? "URL lista" : "Sin URL"} tone={webhookUrl ? "info" : "warning"} />
              <MetricTile label="Gerencias" value={`${assignments.length} asignadas`} tone={assignments.length > 0 ? "success" : "warning"} />
              <MetricTile label="Contact CAPI" value="Omitido" tone="neutral" />
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
