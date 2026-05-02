"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { ImageUploader } from "@/components/landing/ImageUploader";
import { uploadLandingImage } from "@/lib/landing/upload";
import {
  createPromotion,
  deletePromotion,
  fetchPromotionParticipants,
  fetchPromotions,
  slugifyPromotion,
  updatePromotion,
  type PromotionDrawStatus,
  type PromotionParticipantRow,
  type PromotionStatus,
  type PromotionWithCount,
} from "@/lib/promotionsDb";
import { DashboardSkeleton } from "@/components/ui/DashboardSkeleton";

type FormState = {
  title: string;
  slug: string;
  message: string;
  prize: string;
  backgroundImageUrl: string;
  drawDate: string;
  drawHour: string;
  status: PromotionStatus;
};

const EMPTY_FORM: FormState = {
  title: "",
  slug: "",
  message: "",
  prize: "",
  backgroundImageUrl: "",
  drawDate: "",
  drawHour: "12",
  status: "active",
};

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, "0"));

function formatDateTime(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function displayStatus(promotion: PromotionWithCount): { label: string; className: string } {
  if (promotion.draw_status === "completed" || promotion.winner_username) {
    return {
      label: "Realizada",
      className: "border-emerald-700 bg-emerald-950/40 text-emerald-300",
    };
  }
  if (promotion.draw_status === "no_participants") {
    return {
      label: "Sin participantes",
      className: "border-amber-700 bg-amber-950/40 text-amber-300",
    };
  }
  if (promotion.status === "closed") {
    return {
      label: "Cerrada",
      className: "border-zinc-700 bg-zinc-900 text-zinc-300",
    };
  }
  return {
    label: "Activa",
    className: "border-cyan-800 bg-cyan-950/30 text-cyan-300",
  };
}

function splitDrawDateHour(value: string | null): Pick<FormState, "drawDate" | "drawHour"> {
  if (!value) return { drawDate: "", drawHour: "12" };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { drawDate: "", drawHour: "12" };
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    drawDate: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    drawHour: pad(date.getHours()),
  };
}

function drawDateHourToIso(dateValue: string, hourValue: string): string {
  if (!dateValue) return "";
  const hour = Math.min(23, Math.max(0, Number(hourValue)));
  const date = new Date(`${dateValue}T${String(hour).padStart(2, "0")}:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString();
}

export default function DashboardPromocionesPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [promotions, setPromotions] = useState<PromotionWithCount[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [participantsFor, setParticipantsFor] = useState<string | null>(null);
  const [participants, setParticipants] = useState<PromotionParticipantRow[]>([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);
  const [selectedParticipantsPromotionId, setSelectedParticipantsPromotionId] = useState("");
  const [tableParticipants, setTableParticipants] = useState<PromotionParticipantRow[]>([]);
  const [loadingTableParticipants, setLoadingTableParticipants] = useState(false);

  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const editingPromotion = useMemo(
    () => promotions.find((promotion) => promotion.id === editingId) ?? null,
    [editingId, promotions],
  );

  const showMessage = (text: string, type: "success" | "error" = "success") => {
    setMessage(text);
    setMessageType(type);
    window.setTimeout(() => setMessage(null), 3200);
  };

  const reload = useCallback(async (currentUserId: string | null) => {
    if (!currentUserId) return;
    const rows = await fetchPromotions(currentUserId);
    setPromotions(rows);
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();
        if (error || !user) {
          router.replace("/login");
          return;
        }
        setUserId(user.id);
        await reload(user.id);
      } catch (err) {
        console.error(err);
        showMessage("No se pudieron cargar las promociones.", "error");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [router, reload]);

  useEffect(() => {
    if (promotions.length === 0) {
      setSelectedParticipantsPromotionId("");
      setTableParticipants([]);
      return;
    }
    if (!selectedParticipantsPromotionId || !promotions.some((promotion) => promotion.id === selectedParticipantsPromotionId)) {
      setSelectedParticipantsPromotionId(promotions[0]?.id ?? "");
    }
  }, [promotions, selectedParticipantsPromotionId]);

  useEffect(() => {
    const load = async () => {
      if (!selectedParticipantsPromotionId) {
        setTableParticipants([]);
        return;
      }
      setLoadingTableParticipants(true);
      try {
        const rows = await fetchPromotionParticipants(selectedParticipantsPromotionId);
        setTableParticipants(rows);
      } catch (err) {
        console.error(err);
        showMessage("No se pudieron cargar los participantes.", "error");
      } finally {
        setLoadingTableParticipants(false);
      }
    };
    void load();
  }, [selectedParticipantsPromotionId]);

  const resetForm = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const startEdit = (promotion: PromotionWithCount) => {
    const draw = splitDrawDateHour(promotion.draw_at);
    setEditingId(promotion.id);
    setForm({
      title: promotion.title,
      slug: promotion.slug,
      message: promotion.message,
      prize: promotion.prize,
      backgroundImageUrl: promotion.background_image_url ?? "",
      drawDate: draw.drawDate,
      drawHour: draw.drawHour,
      status: promotion.status,
    });
  };

  const handleTitleChange = (title: string) => {
    setForm((prev) => ({
      ...prev,
      title,
      slug: editingId || prev.slug ? prev.slug : slugifyPromotion(title),
    }));
  };

  const handleSave = async () => {
    if (!userId) return;
    const title = form.title.trim();
    const slug = slugifyPromotion(form.slug || form.title);
    const messageText = form.message.trim();
    const prize = form.prize.trim();
    const backgroundImageUrl = form.backgroundImageUrl.trim();
    const drawAt = drawDateHourToIso(form.drawDate, form.drawHour);

    if (!title || !slug || !messageText || !prize || !drawAt) {
      showMessage("Completa titulo, mensaje, premio, fecha y hora del sorteo.", "error");
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await updatePromotion(editingId, {
          title,
          slug,
          message: messageText,
          prize,
          background_image_url: backgroundImageUrl,
          draw_at: drawAt,
          status: form.status,
        });
        showMessage("Promocion actualizada.");
      } else {
        await createPromotion({
          user_id: userId,
          title,
          slug,
          message: messageText,
          prize,
          background_image_url: backgroundImageUrl,
          draw_at: drawAt,
          status: form.status,
        });
        showMessage("Promocion creada.");
      }
      resetForm();
      await reload(userId);
    } catch (err) {
      console.error(err);
      showMessage("No se pudo guardar. Revisa que el link no este repetido.", "error");
    } finally {
      setSaving(false);
    }
  };

  const copyPublicLink = async (slug: string) => {
    const link = `${origin}/promo/${slug}`;
    await navigator.clipboard.writeText(link);
    setCopiedSlug(slug);
    window.setTimeout(() => setCopiedSlug(null), 1500);
  };

  const loadParticipants = async (promotionId: string) => {
    setParticipantsFor(promotionId);
    setLoadingParticipants(true);
    try {
      const rows = await fetchPromotionParticipants(promotionId);
      setParticipants(rows);
    } catch (err) {
      console.error(err);
      showMessage("No se pudieron cargar los participantes.", "error");
    } finally {
      setLoadingParticipants(false);
    }
  };

  const runDraw = async (slug: string) => {
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("promotion-draw", {
        body: { slug },
      });
      if (error) throw error;
      if (data?.error) throw new Error(String(data.error));
      const drawStatus = String(data?.draw_status ?? "") as PromotionDrawStatus | "";
      if (drawStatus === "no_participants") {
        showMessage("Sorteo finalizado sin participantes.");
      } else {
        showMessage(`Sorteo realizado. Ganador: ${String(data?.winner_username ?? "-")}`);
      }
      await reload(userId);
    } catch (err) {
      const text = err instanceof Error ? err.message : "No se pudo realizar el sorteo.";
      showMessage(text, "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <DashboardSkeleton title="Cargando promociones..." />;

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-zinc-50">PROMOCIONES</h1>
          <p className="mt-1 max-w-3xl text-sm text-zinc-400">
            Crea un link de sorteo para enviarselos a tus jugadores.
          </p>
        </div>
        <button
          type="button"
          onClick={resetForm}
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-semibold text-zinc-100 hover:bg-zinc-800"
        >
          Nueva promocion
        </button>
      </div>

      {message && (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            messageType === "error" ? "bg-red-950/50 text-red-300" : "bg-emerald-950/50 text-emerald-300"
          }`}
          role="alert"
        >
          {message}
        </p>
      )}

      <section className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">
              {editingPromotion ? `Editando: ${editingPromotion.title}` : "Crear promocion"}
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              Se te enviara la notificacion del ganador via Telegram que hayas configurado en la seccion de notificaciones.
            </p>
          </div>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-900"
            >
              Cancelar edicion
            </button>
          )}
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs text-zinc-400">Titulo</span>
            <input
              value={form.title}
              onChange={(e) => handleTitleChange(e.target.value)}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-cyan-700"
              placeholder="Sorteo Mundial VIP"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-zinc-400">Link publico</span>
            <div className="flex gap-2">
              <span className="hidden rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-500 sm:inline">
                /promo/
              </span>
              <input
                value={form.slug}
                onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value }))}
                className="min-w-0 flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-cyan-700"
                placeholder="sorteo-mundial-vip"
              />
            </div>
          </label>
          <label className="space-y-1">
            <span className="text-xs text-zinc-400">Premio</span>
            <input
              value={form.prize}
              onChange={(e) => setForm((prev) => ({ ...prev, prize: e.target.value }))}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-cyan-700"
              placeholder="Bono, fichas, etc..."
            />
          </label>
          <div className="space-y-1">
            <span className="text-xs text-zinc-400">Imagen de fondo (.avif)</span>
            <ImageUploader
              value={form.backgroundImageUrl ? [form.backgroundImageUrl] : []}
              onChange={(urls) =>
                setForm((prev) => ({ ...prev, backgroundImageUrl: urls[0] ?? "" }))
              }
              onUpload={async (file) => {
                if (!userId) throw new Error("Usuario no encontrado.");
                return uploadLandingImage(supabase, userId, file);
              }}
              label=""
            />
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_7.5rem] gap-3">
            <label className="space-y-1">
              <span className="text-xs text-zinc-400">Fecha del sorteo</span>
              <input
                type="date"
                value={form.drawDate}
                onChange={(e) => setForm((prev) => ({ ...prev, drawDate: e.target.value }))}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-cyan-700"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs text-zinc-400">Hora</span>
              <select
                value={form.drawHour}
                onChange={(e) => setForm((prev) => ({ ...prev, drawHour: e.target.value }))}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-cyan-700"
              >
                {HOUR_OPTIONS.map((hour) => (
                  <option key={hour} value={hour}>
                    {hour}:00
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="space-y-1 lg:col-span-2">
            <span className="text-xs text-zinc-400">Mensaje para participantes</span>
            <textarea
              value={form.message}
              onChange={(e) => setForm((prev) => ({ ...prev, message: e.target.value }))}
              rows={3}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-cyan-700"
              placeholder="Completa tus datos para participar. El sorteo se realiza en vivo y anunciaremos el ganador al finalizar la cuenta regresiva."
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs text-zinc-400">Estado</span>
            <select
              value={form.status}
              onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as PromotionStatus }))}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-cyan-700"
            >
              <option value="active">Activa</option>
              <option value="closed">Cerrada</option>
            </select>
          </label>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="rounded-lg border border-cyan-700 bg-cyan-950/60 px-4 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-900/50 disabled:opacity-50"
          >
            {saving ? "Guardando..." : editingId ? "Guardar cambios" : "Crear promocion"}
          </button>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-100">Promociones creadas</h2>
        {promotions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/40 p-8 text-center text-sm text-zinc-500">
            Aun no hay promociones. Crea la primera y comparte el link publico.
          </div>
        ) : (
          <div className="space-y-3">
            {promotions.map((promotion) => {
              const publicLink = `${origin}/promo/${promotion.slug}`;
              const drawReady = new Date(promotion.draw_at).getTime() <= Date.now();
              const badge = displayStatus(promotion);
              return (
                <article key={promotion.id} className="rounded-2xl border border-zinc-800 bg-zinc-950/55 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-sm font-semibold text-zinc-50">{promotion.title}</h3>
                        <span className={`rounded-full border px-2 py-0.5 text-[11px] ${badge.className}`}>
                          {badge.label}
                        </span>
                        {promotion.winner_username && (
                          <span className="rounded-full border border-emerald-700 bg-emerald-950/40 px-2 py-0.5 text-[11px] text-emerald-300">
                            Ganador: {promotion.winner_username}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 truncate font-mono text-xs text-cyan-300">{publicLink}</p>
                      <p className="mt-2 text-xs text-zinc-500">
                        Sorteo: {formatDateTime(promotion.draw_at)} | Participantes: {promotion.participant_count}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 sm:justify-end">
                      <button
                        type="button"
                        onClick={() => void copyPublicLink(promotion.slug)}
                        className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-900"
                      >
                        {copiedSlug === promotion.slug ? "Copiado" : "Copiar link"}
                      </button>
                      <button
                        type="button"
                        onClick={() => startEdit(promotion)}
                        className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-900"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => void loadParticipants(promotion.id)}
                        className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-900"
                      >
                        Participantes
                      </button>
                      <button
                        type="button"
                        disabled={saving || !drawReady || promotion.draw_status !== "pending"}
                        onClick={() => void runDraw(promotion.slug)}
                        className="rounded-lg border border-amber-700/70 px-3 py-1.5 text-xs text-amber-200 hover:bg-amber-950/40 disabled:opacity-40"
                        title={!drawReady ? "Disponible cuando llegue la fecha del sorteo" : undefined}
                      >
                        Sortear
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={async () => {
                          if (!window.confirm("Eliminar esta promocion y sus participantes?")) return;
                          try {
                            await deletePromotion(promotion.id);
                            await reload(userId);
                            showMessage("Promocion eliminada.");
                          } catch (err) {
                            console.error(err);
                            showMessage("No se pudo eliminar la promocion.", "error");
                          }
                        }}
                        className="rounded-lg border border-red-800/70 px-3 py-1.5 text-xs text-red-300 hover:bg-red-950/40 disabled:opacity-50"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">Participantes inscritos</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Consulta los jugadores que completaron el formulario del sorteo.
            </p>
          </div>
          <label className="space-y-1 sm:min-w-72">
            <span className="text-xs text-zinc-400">Promocion</span>
            <select
              value={selectedParticipantsPromotionId}
              onChange={(e) => setSelectedParticipantsPromotionId(e.target.value)}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-cyan-700"
            >
              {promotions.length === 0 ? (
                <option value="">Sin promociones</option>
              ) : (
                promotions.map((promotion) => (
                  <option key={promotion.id} value={promotion.id}>
                    {promotion.title}
                  </option>
                ))
              )}
            </select>
          </label>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-zinc-800">
          <div className="max-h-[360px] overflow-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="sticky top-0 bg-zinc-900 text-zinc-400">
                <tr>
                  <th className="px-3 py-2 font-medium">ID</th>
                  <th className="px-3 py-2 font-medium">Nombre</th>
                  <th className="px-3 py-2 font-medium">Telefono</th>
                  <th className="px-3 py-2 font-medium">Email</th>
                </tr>
              </thead>
              <tbody>
                {loadingTableParticipants ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-zinc-500">
                      Cargando participantes...
                    </td>
                  </tr>
                ) : tableParticipants.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-zinc-500">
                      Todavia no hay participantes inscritos.
                    </td>
                  </tr>
                ) : (
                  tableParticipants.map((participant) => (
                    <tr key={participant.id} className="border-t border-zinc-900 text-zinc-200">
                      <td className="px-3 py-2 font-mono text-[11px] text-zinc-500">
                        {participant.id.slice(0, 8)}
                      </td>
                      <td className="px-3 py-2">{participant.username}</td>
                      <td className="px-3 py-2 font-mono">{participant.phone}</td>
                      <td className="px-3 py-2">{participant.email}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {participantsFor && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 px-4">
          <div className="max-h-[86vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
              <div>
                <h3 className="text-sm font-semibold text-zinc-100">Participantes</h3>
                <p className="text-xs text-zinc-500">Datos captados por el formulario publico.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setParticipantsFor(null);
                  setParticipants([]);
                }}
                className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-900"
              >
                Cerrar
              </button>
            </div>
            <div className="max-h-[70vh] overflow-auto p-4">
              {loadingParticipants ? (
                <p className="py-8 text-center text-sm text-zinc-500">Cargando participantes...</p>
              ) : participants.length === 0 ? (
                <p className="py-8 text-center text-sm text-zinc-500">Todavia no hay participantes.</p>
              ) : (
                <table className="min-w-full text-left text-xs">
                  <thead className="bg-zinc-900 text-zinc-400">
                    <tr>
                      <th className="px-3 py-2 font-medium">Usuario</th>
                      <th className="px-3 py-2 font-medium">Telefono</th>
                      <th className="px-3 py-2 font-medium">Email</th>
                      <th className="px-3 py-2 font-medium text-center">Emails completados</th>
                      <th className="px-3 py-2 font-medium">Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {participants.map((participant) => (
                      <tr key={participant.id} className="border-b border-zinc-900 text-zinc-200">
                        <td className="px-3 py-2">{participant.username}</td>
                        <td className="px-3 py-2 font-mono">{participant.phone}</td>
                        <td className="px-3 py-2">{participant.email}</td>
                        <td className="px-3 py-2 text-center">{participant.matched_conversion_count}</td>
                        <td className="px-3 py-2 text-zinc-400">{formatDateTime(participant.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
