"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { fetchPromotionBySlug, type PromotionDrawStatus, type PromotionRow } from "@/lib/promotionsDb";

type FormState = {
  username: string;
  phone: string;
  email: string;
};

type TimeLeft = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isOver: boolean;
};

function getTimeLeft(targetIso: string): TimeLeft {
  const target = new Date(targetIso).getTime();
  const diff = Math.max(0, target - Date.now());
  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { days, hours, minutes, seconds, isOver: diff <= 0 };
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("es-AR", {
    dateStyle: "full",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function randomToken(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function cssUrl(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export default function PublicPromotionPage() {
  const params = useParams<{ slug: string }>();
  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;
  const [promotion, setPromotion] = useState<PromotionRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [participantReady, setParticipantReady] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>({ username: "", phone: "", email: "" });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);
  const [winnerUsername, setWinnerUsername] = useState("");
  const [drawStatus, setDrawStatus] = useState<PromotionDrawStatus>("pending");
  const [drawMessage, setDrawMessage] = useState<string | null>(null);
  const [animationUsernames, setAnimationUsernames] = useState<string[]>([]);
  const [displayedCandidate, setDisplayedCandidate] = useState("");
  const [isDrawAnimating, setIsDrawAnimating] = useState(false);
  const [revealWinner, setRevealWinner] = useState(false);
  const drawRequestedRef = useRef(false);
  const animationIntervalRef = useRef<number | null>(null);
  const animationTimeoutRef = useRef<number | null>(null);

  const storageKey = useMemo(() => (slug ? `promotion_participant:${slug}` : ""), [slug]);
  const visitorToken = useMemo(() => {
    if (typeof window === "undefined" || !storageKey) return "";
    const stored = window.localStorage.getItem(`${storageKey}:visitor_token`);
    if (stored) return stored;
    const next = randomToken();
    window.localStorage.setItem(`${storageKey}:visitor_token`, next);
    return next;
  }, [storageKey]);

  const clearDrawTimers = useCallback(() => {
    if (animationIntervalRef.current !== null) {
      window.clearInterval(animationIntervalRef.current);
      animationIntervalRef.current = null;
    }
    if (animationTimeoutRef.current !== null) {
      window.clearTimeout(animationTimeoutRef.current);
      animationTimeoutRef.current = null;
    }
  }, []);

  const startDrawAnimation = useCallback(
    (names: string[], finalWinner: string) => {
      clearDrawTimers();
      const cleanNames = names.map((name) => String(name || "").trim()).filter(Boolean);
      const pool = cleanNames.length > 0 ? cleanNames : [finalWinner];
      let index = 0;

      setAnimationUsernames(pool);
      setDisplayedCandidate(pool[0] ?? finalWinner);
      setIsDrawAnimating(true);
      setRevealWinner(false);

      animationIntervalRef.current = window.setInterval(() => {
        index += 1;
        const next = pool[Math.floor(Math.random() * pool.length)] ?? pool[index % pool.length] ?? finalWinner;
        setDisplayedCandidate(next);
      }, 85);

      animationTimeoutRef.current = window.setTimeout(() => {
        clearDrawTimers();
        setDisplayedCandidate(finalWinner);
        setIsDrawAnimating(false);
        setRevealWinner(true);
      }, 7000);
    },
    [clearDrawTimers],
  );

  useEffect(() => clearDrawTimers, [clearDrawTimers]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const row = await fetchPromotionBySlug(slug);
        setPromotion(row);
        setWinnerUsername(row?.winner_username ?? "");
        setDrawStatus(row?.draw_status ?? "pending");
        setRevealWinner(false);
        if (storageKey && window.localStorage.getItem(storageKey) === "1") {
          setParticipantReady(true);
        }
      } catch (err) {
        console.error(err);
        setError("No pudimos cargar esta promocion.");
      } finally {
        setLoading(false);
      }
    };
    if (slug) void load();
  }, [slug, storageKey]);

  useEffect(() => {
    if (!promotion) return;
    setTimeLeft(getTimeLeft(promotion.draw_at));
    const timer = window.setInterval(() => setTimeLeft(getTimeLeft(promotion.draw_at)), 1000);
    return () => window.clearInterval(timer);
  }, [promotion]);

  useEffect(() => {
    const draw = async () => {
      if (!promotion || !timeLeft?.isOver || drawStatus === "no_participants" || revealWinner || drawRequestedRef.current) return;
      drawRequestedRef.current = true;
      try {
        const { data, error: fnError } = await supabase.functions.invoke("promotion-draw", {
          body: { slug: promotion.slug },
        });
        if (fnError) throw fnError;
        if (data?.draw_status) {
          setDrawStatus(String(data.draw_status) as PromotionDrawStatus);
        }
        if (data?.winner_username) {
          const winner = String(data.winner_username);
          const names = Array.isArray(data?.animation_usernames)
            ? data.animation_usernames.map((name: unknown) => String(name)).filter(Boolean)
            : [];
          setWinnerUsername(winner);
          setDrawMessage(null);
          startDrawAnimation(names, winner);
          return;
        }
        if (data?.draw_status === "no_participants") {
          setDrawMessage("El sorteo finalizo sin participantes.");
          return;
        }
        if (data?.error) setDrawMessage(String(data.error));
      } catch (err) {
        console.error(err);
        setDrawMessage("El sorteo esta listo, pero no pudimos obtener el ganador automaticamente.");
      }
    };
    void draw();
  }, [drawStatus, promotion, revealWinner, startDrawAnimation, timeLeft?.isOver]);

  const handleSubmit = async () => {
    if (!promotion || !visitorToken) return;
    setError(null);
    setSuccess(null);

    const username = form.username.trim();
    const phone = form.phone.trim();
    const email = form.email.trim();
    if (!username || !phone || !email) {
      setError("Completa usuario, telefono y email para participar.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("No es un email valido.");
      return;
    }
    const phoneDigits = phone.replace(/\D/g, "");
    if (phoneDigits.length < 8 || phoneDigits.length > 15) {
      setError("No es un telefono valido.");
      return;
    }

    setSubmitting(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("promotion-participate", {
        body: {
          slug: promotion.slug,
          username,
          phone,
          email,
          visitor_token: visitorToken,
        },
      });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(String(data.error));

      window.localStorage.setItem(storageKey, "1");
      setParticipantReady(true);
      setFormOpen(false);
      setSuccess(data?.already_participated ? "Ya estabas participando." : "Participacion registrada.");
    } catch (err) {
      const text = err instanceof Error ? err.message : "No pudimos registrar tu participacion.";
      setError(text);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#07100d] text-zinc-100">
        <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-5">
          <p className="text-sm text-emerald-200">Cargando promocion...</p>
        </div>
      </main>
    );
  }

  if (!promotion) {
    return (
      <main className="min-h-screen bg-[#07100d] text-zinc-100">
        <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-5 text-center">
          <div className="rounded-3xl border border-zinc-800 bg-black/40 p-8">
            <h1 className="text-2xl font-bold">Promocion no disponible</h1>
            <p className="mt-2 text-sm text-zinc-400">El link puede estar cerrado o no existir.</p>
          </div>
        </div>
      </main>
    );
  }

  const units = timeLeft
    ? [
        ["dias", timeLeft.days],
        ["horas", timeLeft.hours],
        ["min", timeLeft.minutes],
        ["seg", timeLeft.seconds],
      ]
    : [];
  const canParticipate = !participantReady && !timeLeft?.isOver;
  const heroLabel = timeLeft?.isOver ? "Sorteo finalizado" : "Promocion activa";
  const backgroundImageUrl = String(promotion.background_image_url ?? "").trim();
  const backgroundStyle = backgroundImageUrl
    ? {
        backgroundImage: `linear-gradient(135deg, rgba(7,16,13,0.82), rgba(3,5,4,0.76) 52%, rgba(13,22,15,0.86)), url("${cssUrl(backgroundImageUrl)}")`,
        backgroundPosition: "center",
        backgroundSize: "cover",
      }
    : undefined;

  const heroCard = (
    <div className="rounded-[2rem] border border-emerald-500/20 bg-black/35 p-6 shadow-[0_30px_120px_rgba(0,0,0,0.45)] backdrop-blur sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-300">{heroLabel}</p>
      <h1 className="mt-4 text-4xl font-black tracking-tight text-white sm:text-5xl">{promotion.title}</h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-zinc-300">{promotion.message}</p>
      <div className="mt-6 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4">
        <p className="text-xs uppercase tracking-[0.25em] text-amber-200">Premio</p>
        <p className="mt-1 text-xl font-bold text-amber-50">{promotion.prize}</p>
      </div>
      <p className="mt-4 text-sm text-zinc-400">Sorteo: {formatDateTime(promotion.draw_at)}</p>
      {canParticipate && (
        <button
          type="button"
          onClick={() => {
            setError(null);
            setFormOpen(true);
          }}
          className="mt-6 w-full rounded-xl bg-emerald-400 px-4 py-3 text-sm font-black uppercase tracking-[0.18em] text-emerald-950 transition hover:bg-emerald-300"
        >
          Participar
        </button>
      )}
    </div>
  );

  const formCard = (
    <section className="rounded-[2rem] border border-zinc-700/70 bg-zinc-950/78 p-5 shadow-2xl backdrop-blur sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-300">Participa por</p>
      <h1 className="mt-3 text-3xl font-black text-white">{promotion.title}</h1>
      <p className="mt-2 text-sm text-zinc-400">
        Completa los datos obligatorios para entrar. Se te notificara a tu email si ganaste.
      </p>
      <div className="mt-5 rounded-2xl border border-amber-400/25 bg-amber-400/10 px-4 py-3">
        <p className="text-[10px] uppercase tracking-[0.22em] text-amber-200">Premio</p>
        <p className="mt-1 text-base font-bold text-amber-50">{promotion.prize}</p>
      </div>
      <div className="mt-5 space-y-3">
        <input
          value={form.username}
          onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
          className="w-full rounded-xl border border-zinc-800 bg-black/70 px-4 py-3 text-sm text-white outline-none focus:border-emerald-500"
          placeholder="Nombre de usuario"
        />
        <input
          value={form.phone}
          onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
          className="w-full rounded-xl border border-zinc-800 bg-black/70 px-4 py-3 text-sm text-white outline-none focus:border-emerald-500"
          placeholder="Telefono"
          inputMode="tel"
        />
        <input
          value={form.email}
          onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
          className="w-full rounded-xl border border-zinc-800 bg-black/70 px-4 py-3 text-sm text-white outline-none focus:border-emerald-500"
          placeholder="Email"
          type="email"
        />
      </div>
      {error && <p className="mt-3 rounded-lg bg-red-950/60 px-3 py-2 text-sm text-red-200">{error}</p>}
      <button
        type="button"
        disabled={submitting}
        onClick={handleSubmit}
        className="mt-5 w-full rounded-xl bg-emerald-400 px-4 py-3 text-sm font-black uppercase tracking-[0.16em] text-emerald-950 transition hover:bg-emerald-300 disabled:opacity-60"
      >
        {submitting ? "Registrando..." : "Participar"}
      </button>
    </section>
  );

  return (
    <main className="min-h-screen overflow-hidden bg-[#07100d] text-zinc-100" style={backgroundStyle}>
      <style>{`
        @keyframes promotion-draw-progress {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
      {!backgroundImageUrl && (
        <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.26),transparent_30%),radial-gradient(circle_at_80%_0%,rgba(245,158,11,0.18),transparent_28%),linear-gradient(135deg,#07100d,#030504_55%,#0d160f)]" />
      )}
      <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-5 py-10">
        <section className={`grid gap-6 ${participantReady || timeLeft?.isOver ? "lg:grid-cols-[1.05fr_0.95fr] lg:items-center" : "mx-auto w-full max-w-lg"}`}>
          {heroCard}
          {(participantReady || timeLeft?.isOver) && (
            <section className="rounded-[2rem] border border-emerald-500/25 bg-zinc-950/78 p-5 text-center shadow-2xl backdrop-blur sm:p-6">
              {success && <p className="mb-3 rounded-lg bg-emerald-950/50 px-3 py-2 text-sm text-emerald-200">{success}</p>}
              {!timeLeft?.isOver ? (
                <>
                  <p className="text-xs font-semibold uppercase tracking-[0.32em] text-emerald-300">Cuenta regresiva</p>
                  <div className="mt-5 grid grid-cols-4 gap-2">
                    {units.map(([label, value]) => (
                      <div key={label} className="rounded-2xl border border-zinc-800 bg-black/55 px-2 py-4">
                        <p className="text-2xl font-black text-white sm:text-3xl">{String(value).padStart(2, "0")}</p>
                        <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-zinc-500">{label}</p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-5 text-sm text-zinc-400">Ya estas participando. Cuando llegue la hora, aca se mostrara el ganador.</p>
                </>
              ) : isDrawAnimating ? (
                <div className="relative overflow-hidden py-6">
                  <div className="pointer-events-none absolute inset-0 opacity-60 [background-image:radial-gradient(circle_at_50%_0%,rgba(16,185,129,0.24),transparent_35%),radial-gradient(circle_at_50%_100%,rgba(251,191,36,0.18),transparent_32%)]" />
                  <div className="relative">
                    <p className="text-xs font-semibold uppercase tracking-[0.32em] text-emerald-300">Sorteando ganador</p>
                    <p className="mt-2 text-xs text-zinc-500">Participantes verificados: {animationUsernames.length}</p>
                    <div className="mx-auto mt-6 max-w-sm rounded-[1.7rem] border border-emerald-400/40 bg-black/70 p-4 shadow-[0_0_90px_rgba(16,185,129,0.25)]">
                      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-7">
                        <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-zinc-500">Ahora pasa por</p>
                        <p className="mt-3 min-h-[3rem] break-words text-3xl font-black text-white sm:text-4xl">
                          {displayedCandidate || "..."}
                        </p>
                      </div>
                    </div>
                    <div className="mx-auto mt-5 h-2 max-w-sm overflow-hidden rounded-full bg-zinc-900">
                      <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-amber-300 to-emerald-400 [animation:promotion-draw-progress_7s_linear_forwards]" />
                    </div>
                    <div className="mt-5 grid grid-cols-3 gap-2 text-[10px] uppercase tracking-[0.16em] text-zinc-500">
                      <span className="rounded-full border border-zinc-800 bg-black/40 px-2 py-2">Mezclando</span>
                      <span className="rounded-full border border-zinc-800 bg-black/40 px-2 py-2">Auditando</span>
                      <span className="rounded-full border border-zinc-800 bg-black/40 px-2 py-2">Sellando</span>
                    </div>
                  </div>
                </div>
              ) : winnerUsername && revealWinner ? (
                <div className="py-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.32em] text-amber-200">Ganador del sorteo</p>
                  <div className="mx-auto mt-6 flex h-44 w-44 animate-pulse items-center justify-center rounded-full border border-amber-300/50 bg-amber-300/15 shadow-[0_0_100px_rgba(251,191,36,0.42)]">
                    <span className="text-5xl font-black text-amber-100">1</span>
                  </div>
                  <h2 className="mt-6 break-words text-4xl font-black text-white">{winnerUsername}</h2>
                  <p className="mt-3 text-sm text-zinc-400">Premio: {promotion.prize}</p>
                </div>
              ) : drawStatus === "no_participants" ? (
                <div className="py-8">
                  <p className="text-xs font-semibold uppercase tracking-[0.32em] text-zinc-400">Sorteo finalizado</p>
                  <div className="mx-auto mt-6 flex h-32 w-32 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900/70 shadow-[0_0_70px_rgba(113,113,122,0.22)]">
                    <span className="text-4xl font-black text-zinc-300">0</span>
                  </div>
                  <h2 className="mt-6 text-2xl font-black text-white">El sorteo finalizo sin participantes.</h2>
                  <p className="mt-3 text-sm text-zinc-400">Premio: {promotion.prize}</p>
                </div>
              ) : (
                <div className="py-10">
                  <p className="text-sm text-zinc-300">El sorteo esta listo.</p>
                  <p className="mt-2 text-xs text-zinc-500">{drawMessage ?? "Buscando ganador..."}</p>
                </div>
              )}
            </section>
          )}
        </section>
      </div>
      {formOpen && canParticipate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4">
          <div className="relative w-full max-w-lg">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="absolute -right-2 -top-10 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-900"
            >
              Cerrar
            </button>
            {formCard}
          </div>
        </div>
      )}
    </main>
  );
}
