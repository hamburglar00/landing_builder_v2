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
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2 text-xs text-[var(--color-text)]"
    >
      <span
        className={`relative h-5 w-9 rounded-full border transition ${
          checked
            ? "border-emerald-500 bg-emerald-500/25"
            : "border-[var(--color-border)] bg-[var(--color-bg-2)]"
        }`}
      >
        <span
          className={`absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full bg-[var(--color-text-strong)] transition ${
            checked ? "left-5" : "left-0.5"
          }`}
        />
      </span>
      <span>{label}</span>
    </button>
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
    setConfig(cfg);
    setGerencias(gers);
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
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave()}
            className="ui-button ui-button-primary"
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>
        }
      />

      {mode === "admin" && clients.length > 0 ? (
        <SurfaceCard className="p-4">
          <label className="text-xs font-medium text-[var(--color-text-muted)]">
            Cliente
          </label>
          <select
            value={targetUserId ?? ""}
            onChange={(event) => {
              const next = event.target.value;
              setTargetUserId(next);
              void reloadSelected(next);
            }}
            className="mt-2 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-2)] px-3 py-2 text-sm text-[var(--color-text)]"
          >
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.nombre || client.email || client.id}
              </option>
            ))}
          </select>
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

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
        <div className="space-y-4">
          <SurfaceCard className="space-y-4 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-[var(--color-text-strong)]">Identificacion</h2>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                  Datos del numero conectado a la app oficial de Meta.
                </p>
              </div>
              <Toggle checked={active} onChange={setActive} label={active ? "Activo" : "Inactivo"} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nombre interno">
                <input value={name} onChange={(e) => setName(cleanSlug(e.target.value))} className="ui-input" />
              </Field>
              <Field label="Telefono visible">
                <input value={displayPhone} onChange={(e) => setDisplayPhone(e.target.value)} className="ui-input" />
              </Field>
              <Field label="Phone Number ID">
                <input value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value.replace(/\D/g, ""))} className="ui-input" />
              </Field>
              <Field label="WhatsApp Business Account ID">
                <input value={wabaId} onChange={(e) => setWabaId(e.target.value.replace(/\D/g, ""))} className="ui-input" />
              </Field>
              <Field label="Graph API version">
                <input value={apiVersion} onChange={(e) => setApiVersion(e.target.value)} className="ui-input" />
              </Field>
              <Field label="Verify token">
                <input value={verifyToken} onChange={(e) => setVerifyToken(e.target.value.trim())} className="ui-input font-mono text-xs" />
              </Field>
              <Field label="Meta access token">
                <input value={accessToken} onChange={(e) => setAccessToken(e.target.value)} className="ui-input font-mono text-xs" type="password" />
              </Field>
              <Field label="Webhook URL">
                <input value={webhookUrl} readOnly className="ui-input font-mono text-xs" />
              </Field>
            </div>
          </SurfaceCard>

          <SurfaceCard className="space-y-4 p-4">
            <h2 className="text-sm font-semibold text-[var(--color-text-strong)]">Tracking</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Pixel ID">
                <input value={pixelId} onChange={(e) => setPixelId(e.target.value.replace(/\D/g, ""))} className="ui-input" />
              </Field>
              <Field label="Tag promo_code">
                <input value={landingTag} onChange={(e) => setLandingTag(cleanTag(e.target.value))} className="ui-input" />
              </Field>
            </div>
            <Toggle
              checked={sendContactCapi}
              onChange={setSendContactCapi}
              label="Enviar Contact CAPI a Meta"
            />
          </SurfaceCard>

          <SurfaceCard className="space-y-4 p-4">
            <h2 className="text-sm font-semibold text-[var(--color-text-strong)]">Mensaje automatico</h2>
            <Field label="Mensaje de derivacion">
              <textarea
                value={redirectTemplate}
                onChange={(e) => setRedirectTemplate(e.target.value)}
                rows={6}
                className="ui-input min-h-36"
              />
            </Field>
            <Field label="Mensaje fallback sin telefonos">
              <textarea
                value={fallbackTemplate}
                onChange={(e) => setFallbackTemplate(e.target.value)}
                rows={3}
                className="ui-input"
              />
            </Field>
            <p className="text-xs text-[var(--color-text-muted)]">
              Variables disponibles: {"{{name}}"}, {"{{phone}}"}, {"{{promo_code}}"}, {"{{wa_link}}"}.
            </p>
          </SurfaceCard>

          <SurfaceCard className="space-y-4 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-[var(--color-text-strong)]">Asignacion de gerencias</h2>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                  Usa la misma logica de reparto que una landing.
                </p>
              </div>
              <div className="inline-flex rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-2)] text-[11px]">
                <button
                  type="button"
                  onClick={() => setSelectionMode("weighted_random")}
                  className={`rounded-l-lg border-r border-[var(--color-border)] px-2 py-1 ${selectionMode === "weighted_random" ? "bg-zinc-100 text-zinc-950" : "text-zinc-300"}`}
                >
                  Peso
                </button>
                <button
                  type="button"
                  onClick={() => setSelectionMode("fair")}
                  className={`rounded-r-lg px-2 py-1 ${selectionMode === "fair" ? "bg-zinc-100 text-zinc-950" : "text-zinc-300"}`}
                >
                  Equitativa
                </button>
              </div>
            </div>

            {selectionMode === "fair" ? (
              <div className="inline-flex rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-2)] text-[11px]">
                <button
                  type="button"
                  onClick={() => setFairCriterion("usage_count")}
                  className={`rounded-l-lg border-r border-[var(--color-border)] px-2 py-1 ${fairCriterion === "usage_count" ? "bg-zinc-100 text-zinc-950" : "text-zinc-300"}`}
                >
                  Contador
                </button>
                <button
                  type="button"
                  onClick={() => setFairCriterion("messages_received")}
                  className={`rounded-r-lg px-2 py-1 ${fairCriterion === "messages_received" ? "bg-zinc-100 text-zinc-950" : "text-zinc-300"}`}
                >
                  Mensajes
                </button>
              </div>
            ) : null}

            <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
              <table className="min-w-[760px] w-full text-left text-xs">
                <thead className="bg-[var(--color-bg-2)] text-[var(--color-text-muted)]">
                  <tr>
                    <th className="px-3 py-2">Asignar</th>
                    <th className="px-3 py-2">Gerencia</th>
                    {selectionMode === "weighted_random" ? <th className="px-3 py-2">Peso</th> : null}
                    <th className="px-3 py-2">Modo telefono</th>
                    <th className="px-3 py-2">Tipo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {gerencias.map((g) => {
                    const assignment = assignments.find((row) => row.gerencia_id === g.id);
                    const checked = Boolean(assignment);
                    return (
                      <tr key={g.id}>
                        <td className="px-3 py-2">
                          <input type="checkbox" checked={checked} onChange={() => toggleAssignment(g)} />
                        </td>
                        <td className="px-3 py-2 text-[var(--color-text)]">
                          {g.nombre} <span className="text-[var(--color-text-muted)]">(ID {g.gerencia_id ?? g.id})</span>
                        </td>
                        {selectionMode === "weighted_random" ? (
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min={0}
                              disabled={!checked}
                              value={assignment?.weight ?? 0}
                              onChange={(e) => {
                                const next = Math.max(0, Number(e.target.value) || 0);
                                setAssignments((prev) => prev.map((row) => row.gerencia_id === g.id ? { ...row, weight: next } : row));
                              }}
                              className="w-16 rounded border border-[var(--color-border)] bg-[var(--color-bg-2)] px-2 py-1 text-[var(--color-text)] disabled:opacity-50"
                            />
                          </td>
                        ) : null}
                        <td className="px-3 py-2">
                          <select
                            disabled={!checked}
                            value={assignment?.phoneMode ?? "random"}
                            onChange={(e) => setAssignments((prev) => prev.map((row) => row.gerencia_id === g.id ? { ...row, phoneMode: e.target.value as "random" | "fair" } : row))}
                            className="rounded border border-[var(--color-border)] bg-[var(--color-bg-2)] px-2 py-1 text-[var(--color-text)] disabled:opacity-50"
                          >
                            <option value="random">Aleatorio</option>
                            <option value="fair">Equitativo</option>
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <select
                            disabled={!checked}
                            value={assignment?.phoneKind ?? "carga"}
                            onChange={(e) => setAssignments((prev) => prev.map((row) => row.gerencia_id === g.id ? { ...row, phoneKind: e.target.value as PhoneKind } : row))}
                            className="rounded border border-[var(--color-border)] bg-[var(--color-bg-2)] px-2 py-1 text-[var(--color-text)] disabled:opacity-50"
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
                      <td colSpan={5} className="px-3 py-5 text-center text-[var(--color-text-muted)]">
                        No hay gerencias para este workspace.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </SurfaceCard>
        </div>

        <aside className="space-y-4">
          <SurfaceCard className="space-y-3 p-4">
            <h2 className="text-sm font-semibold text-[var(--color-text-strong)]">Estado</h2>
            <StatusRow label="Configuracion" value={config ? "Guardada" : "Sin guardar"} />
            <StatusRow label="Webhook" value={webhookUrl ? "URL lista" : "Sin URL"} />
            <StatusRow label="Gerencias" value={`${assignments.length} asignadas`} />
            <StatusRow label="Contact CAPI" value={sendContactCapi ? "Activo" : "Apagado"} />
          </SurfaceCard>

          <SurfaceCard className="space-y-3 p-4">
            <h2 className="text-sm font-semibold text-[var(--color-text-strong)]">Ultimos eventos</h2>
            {recentEvents.length > 0 ? (
              <div className="space-y-2">
                {recentEvents.map((event) => (
                  <div key={event.id} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-2)] p-2">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-medium text-[var(--color-text)]">{event.event_type}</span>
                      <span className="text-[var(--color-text-muted)]">{event.status}</span>
                    </div>
                    <p className="mt-1 truncate font-mono text-[10px] text-[var(--color-text-muted)]">
                      {event.meta_message_id || event.id}
                    </p>
                    {event.last_error ? (
                      <p className="mt-1 text-[10px] text-rose-300">{event.last_error}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[var(--color-text-muted)]">Todavia no hay webhooks recibidos.</p>
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

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border-subtle)] pb-2 text-xs last:border-0 last:pb-0">
      <span className="text-[var(--color-text-muted)]">{label}</span>
      <span className="font-medium text-[var(--color-text)]">{value}</span>
    </div>
  );
}
