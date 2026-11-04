"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  createGerencia,
  updateGerencia,
  deleteGerencia,
  fetchGerenciaWorkGroups,
  createGerenciaWorkGroup,
  updateGerenciaWorkGroup,
  deleteGerenciaWorkGroup,
  formatGerenciaError,
} from "@/lib/gerencias/gerenciasDb";
import { createAtrioClient } from "@/lib/atrio/atrioDb";
import type { Gerencia, GerenciaWorkGroup } from "@/lib/gerencias/types";
import type { ReportingCurrency } from "@/lib/currency";
import type { ImportDirectory } from "@/lib/bots/directory";
import { ModalShell } from "@/components/ui/PanelPrimitives";
import { useAppConfirm } from "@/components/ui/AppConfirmDialog";
import { GerenciaWorkGroupsPanel } from "@/components/gerencias/GerenciaWorkGroupsPanel";
const field = "ui-input w-full";
export function BotsManagement({
  userId,
  workspace,
  gerencias,
  isAdmin,
  canAtrio,
  onChanged,
  onImported,
}: {
  userId: string;
  workspace: ReportingCurrency;
  gerencias: Gerencia[];
  isAdmin: boolean;
  canAtrio: boolean;
  onChanged: () => Promise<void>;
  onImported: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false),
    [mode, setMode] = useState("agency"),
    [id, setId] = useState(""),
    [name, setName] = useState(""),
    [slug, setSlug] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [preview, setPreview] = useState<ImportDirectory | null>(null),
    [notice, setNotice] = useState("");
  const [groupOpen, setGroupOpen] = useState(false),
    [groups, setGroups] = useState<GerenciaWorkGroup[]>([]);
  useEffect(() => {
    setOpen(false);
    setPreview(null);
    setNotice("");
    setGroupOpen(false);
  }, [workspace, userId]);
  async function request(action: "preview" | "import") {
    const numericId = Number(id);
    if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(numericId))
      throw Error("Ingresá un ID entero positivo.");
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw Error("Volvé a iniciar sesión.");
    const response = await fetch("/api/bots/import", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${data.session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action,
        kind: mode,
        id: numericId,
        workspaceCurrency: workspace,
      }),
      signal: AbortSignal.timeout(60000),
    });
    const body = await response.json();
    if (!response.ok) throw Error(body.error || "No se pudo importar.");
    return body;
  }
  async function save() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (mode === "manual") {
        if (!name.trim()) throw Error("Ingresá el nombre de la gerencia.");
        await createGerencia(userId, {
          nombre: name,
          source_type: "manual",
          workspace_currency: workspace,
        });
        setOpen(false);
      } else if (mode === "atrio") {
        await createAtrioClient(userId, {
          workspaceCurrency: workspace,
          slug,
          atrioId: id,
        });
        setOpen(false);
      } else {
        const result = await request("import");
        setNotice(
          `${result.gerencias} gerencia(s) y ${result.asesores} asesor(es) agregados. ${result.existentes} vínculo(s) ya existían.${result.warnings.length ? " " + result.warnings.join(" ") : ""}`,
        );
        setOpen(false);
      }
      await onChanged();
      if (
        preview?.agencies.some((group) =>
          group.bots.some((bot) => bot.channel === "whatsapp"),
        )
      )
        await onImported();
      setPreview(null);
      setId("");
      setName("");
      setSlug("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  }
  async function groupsChanged(action: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await action();
      setGroups(await fetchGerenciaWorkGroups(userId, workspace));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar el grupo.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {!isAdmin && (
          <button
            type="button"
            className="ui-button ui-button-secondary"
            onClick={async () => {
              setError("");
              try {
                setGroups(await fetchGerenciaWorkGroups(userId, workspace));
                setGroupOpen(true);
              } catch (e) {
                setError(
                  e instanceof Error
                    ? e.message
                    : "No se pudieron cargar los grupos.",
                );
              }
            }}
          >
            Grupos de trabajo
          </button>
        )}
        <button
          type="button"
          className="ui-button ui-button-primary"
          onClick={() => {
            setError("");
            setPreview(null);
            setOpen(true);
          }}
        >
          + Agregar gerencia
        </button>
      </div>
      {notice && (
        <p
          role="status"
          className="rounded-lg border border-emerald-900/40 bg-emerald-950/20 p-3 text-xs text-emerald-200"
        >
          {notice}
        </p>
      )}
      {error && !open && !groupOpen && (
        <p role="alert" className="text-xs text-red-300">
          {error}
        </p>
      )}
      <ModalShell
        open={open}
        title="Agregar gerencia"
        description="Importá los bots de PBAdmin o agregá una gerencia manual."
        onClose={() => setOpen(false)}
        closeDisabled={busy}
        width="lg"
        footer={
          mode === "manual" || mode === "atrio" || preview ? (
            <button
              type="button"
              className="ui-button ui-button-primary"
              disabled={busy}
              onClick={() => void save()}
            >
              {busy ? "Guardando…" : preview ? "Importar bots" : "Guardar"}
            </button>
          ) : (
            <button
              type="button"
              className="ui-button ui-button-primary"
              disabled={busy || !id}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  setPreview(await request("preview"));
                } catch (e) {
                  setError(
                    e instanceof Error ? e.message : "No se pudo consultar.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Buscando…" : "Buscar bots"}
            </button>
          )
        }
      >
        <div className="space-y-4">
          <label className="block space-y-1 text-xs text-zinc-400">
            <span>Agregar mediante</span>
            <select
              disabled={busy}
              className={field}
              value={mode}
              onChange={(e) => {
                setMode(e.target.value);
                setPreview(null);
                setId("");
                setError("");
              }}
            >
              <option value="agency">Agency ID · una gerencia</option>
              <option value="owner">Owner ID · todas sus gerencias</option>
              <option value="manual">Gerencia manual</option>
              {canAtrio && (
                <option value="atrio">
                  Vincular asesor de Atrio existente
                </option>
              )}
            </select>
          </label>
          {mode !== "manual" && (
            <label className="block space-y-1 text-xs text-zinc-400">
              <span>
                {mode === "owner"
                  ? "Owner ID"
                  : mode === "atrio"
                    ? "ID del asesor de Atrio"
                    : "Agency ID"}
              </span>
              <input
                className={field}
                disabled={busy}
                value={id}
                inputMode={mode === "atrio" ? "text" : "numeric"}
                onChange={(e) => {
                  setId(e.target.value);
                  setPreview(null);
                }}
              />
            </label>
          )}
          {mode === "manual" && (
            <label className="block space-y-1 text-xs text-zinc-400">
              <span>Nombre de la gerencia</span>
              <input
                className={field}
                disabled={busy}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
          )}
          {mode === "atrio" && (
            <label className="block space-y-1 text-xs text-zinc-400">
              <span>Slug del asesor</span>
              <input
                className={field}
                disabled={busy}
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
              />
            </label>
          )}
          {error && (
            <p role="alert" className="text-xs text-red-300">
              {error}
            </p>
          )}
          {preview && (
            <div className="space-y-3">
              <p className="text-xs text-zinc-300">
                {preview.agencies.length} gerencias ·{" "}
                {preview.agencies.reduce((n, g) => n + g.bots.length, 0) +
                  preview.unassigned.length}{" "}
                bots
              </p>
              {!preview.agencies.length && !preview.unassigned.length && (
                <p className="text-xs text-zinc-400">
                  No se encontraron bots disponibles para importar.
                </p>
              )}
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {preview.agencies.map((group) => (
                  <div
                    key={group.agency_id}
                    className="rounded-lg border border-zinc-800 p-3 text-xs"
                  >
                    <strong className="text-zinc-200">
                      {group.name} · ID {group.agency_id}
                    </strong>
                    <p className="mt-1 text-zinc-400">
                      {
                        group.bots.filter((b) => b.channel === "whatsapp")
                          .length
                      }{" "}
                      WhatsApp ·{" "}
                      {group.bots.filter((b) => b.channel === "atrio").length}{" "}
                      Atrio
                    </p>
                  </div>
                ))}
              </div>
              {preview.unassigned.length > 0 && (
                <p className="text-xs text-amber-300">
                  {preview.unassigned.length} bot(s) sin gerencia. Se vinculan
                  los asesores de Atrio válidos; los teléfonos sin gerencia
                  requieren configuración en PBAdmin.
                </p>
              )}
            </div>
          )}
        </div>
      </ModalShell>
      <ModalShell
        open={groupOpen}
        title="Grupos de trabajo"
        width="lg"
        onClose={() => setGroupOpen(false)}
        closeDisabled={busy}
      >
        {error && (
          <p role="alert" className="mb-3 text-xs text-red-300">
            {error}
          </p>
        )}
        <GerenciaWorkGroupsPanel
          gerencias={gerencias}
          groups={groups}
          saving={busy}
          onCreate={(name, ids) =>
            groupsChanged(() =>
              createGerenciaWorkGroup(userId, name, ids, workspace),
            )
          }
          onUpdate={(groupId, name, ids) =>
            groupsChanged(() => updateGerenciaWorkGroup(groupId, name, ids))
          }
          onDelete={(groupId) =>
            groupsChanged(() => deleteGerenciaWorkGroup(groupId))
          }
        />
      </ModalShell>
    </div>
  );
}

export function GerenciaActions({
  gerencia,
  onChanged,
}: {
  gerencia: Gerencia;
  onChanged: () => Promise<void>;
}) {
  const confirm = useAppConfirm(),
    [open, setOpen] = useState(false),
    [name, setName] = useState(""),
    [id, setId] = useState(""),
    [source, setSource] = useState<"pbadmin" | "manual">("pbadmin"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <>
      <button
        type="button"
        className="ml-auto rounded-lg border border-zinc-700 px-2 py-1 text-xs text-zinc-300"
        onClick={() => {
          setName(gerencia.nombre);
          setId(String(gerencia.gerencia_id ?? ""));
          setSource(gerencia.source_type ?? "pbadmin");
          setError("");
          setOpen(true);
        }}
      >
        Administrar gerencia
      </button>
      <ModalShell
        open={open}
        title="Administrar gerencia"
        onClose={() => setOpen(false)}
        closeDisabled={busy}
        footer={
          <div className="flex w-full justify-between gap-3">
            <button
              className="ui-button ui-button-secondary text-red-300"
              disabled={busy}
              onClick={async () => {
                if (
                  !(await confirm({
                    title: "Eliminar gerencia",
                    description: `Se elimina ${gerencia.nombre} del constructor y sus teléfonos y asignaciones asociados.`,
                    confirmLabel: "Eliminar",
                    danger: true,
                  }))
                )
                  return;
                setBusy(true);
                try {
                  await deleteGerencia(gerencia.id);
                  setOpen(false);
                  await onChanged();
                } catch (e) {
                  setError(formatGerenciaError(e, "No se pudo eliminar."));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Eliminar gerencia
            </button>
            <button
              className="ui-button ui-button-primary"
              disabled={busy || !name.trim()}
              onClick={async () => {
                if (
                  source === "pbadmin" &&
                  (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id)))
                ) {
                  setError("Ingresá un Agency ID entero positivo.");
                  return;
                }
                setBusy(true);
                try {
                  await updateGerencia(gerencia.id, {
                    nombre: name,
                    source_type: source,
                    gerencia_id:
                      source === "pbadmin" ? Number(id) : gerencia.gerencia_id,
                  });
                  setOpen(false);
                  await onChanged();
                } catch (e) {
                  setError(formatGerenciaError(e, "No se pudo guardar."));
                } finally {
                  setBusy(false);
                }
              }}
            >
              Guardar
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <label className="block space-y-1 text-xs text-zinc-400">
            <span>Nombre</span>
            <input
              className={field}
              value={name}
              disabled={busy}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="block space-y-1 text-xs text-zinc-400">
            <span>Origen</span>
            <select
              className={field}
              value={source}
              disabled={busy}
              onChange={(e) =>
                setSource(e.target.value as "pbadmin" | "manual")
              }
            >
              <option value="pbadmin">PBAdmin</option>
              <option value="manual">Manual</option>
            </select>
          </label>
          {source === "pbadmin" && (
            <label className="block space-y-1 text-xs text-zinc-400">
              <span>Agency ID</span>
              <input
                className={field}
                value={id}
                disabled={busy}
                onChange={(e) => setId(e.target.value)}
              />
            </label>
          )}
          {error && (
            <p role="alert" className="text-xs text-red-300">
              {error}
            </p>
          )}
        </div>
      </ModalShell>
    </>
  );
}
