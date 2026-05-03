"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
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
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
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

const COIN_RAIN = Array.from({ length: 34 }, (_, index) => index);

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
  const [showJoinCelebration, setShowJoinCelebration] = useState(false);
  const drawRequestedRef = useRef(false);
  const animationIntervalRef = useRef<number | null>(null);
  const animationTimeoutRef = useRef<number | null>(null);
  const celebrationTimeoutRef = useRef<number | null>(null);
  const resultAnimationStartedRef = useRef(false);

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

  const startWinnerReveal = useCallback(
    (names: string[], finalWinner: string) => {
      if (!finalWinner || resultAnimationStartedRef.current) return;
      resultAnimationStartedRef.current = true;
      startDrawAnimation(names, finalWinner);
    },
    [startDrawAnimation],
  );

  useEffect(() => clearDrawTimers, [clearDrawTimers]);

  useEffect(
    () => () => {
      if (celebrationTimeoutRef.current !== null) {
        window.clearTimeout(celebrationTimeoutRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const row = await fetchPromotionBySlug(slug);
        setPromotion(row);
        setWinnerUsername(row?.winner_username ?? "");
        setDrawStatus(row?.draw_status ?? "pending");
        resultAnimationStartedRef.current = false;
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
    if (!slug || !promotion || drawStatus !== "pending") return;
    const refresh = async () => {
      try {
        const row = await fetchPromotionBySlug(slug);
        if (!row) return;
        setPromotion(row);
        setWinnerUsername(row.winner_username ?? "");
        setDrawStatus(row.draw_status ?? "pending");
      } catch (err) {
        console.error("promotion refresh error:", err);
      }
    };
    const timer = window.setInterval(() => void refresh(), 4000);
    return () => window.clearInterval(timer);
  }, [drawStatus, promotion, slug]);

  useEffect(() => {
    const draw = async () => {
      if (!promotion || !timeLeft?.isOver || drawStatus !== "pending" || revealWinner || drawRequestedRef.current) return;
      const processedAtMs = new Date(promotion.draw_processed_at ?? promotion.winner_selected_at ?? "").getTime();
      if (Number.isFinite(processedAtMs) && Date.now() - processedAtMs > 60 * 60 * 1000) return;
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
          startWinnerReveal(names, winner);
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
  }, [drawStatus, promotion, revealWinner, startWinnerReveal, timeLeft?.isOver]);

  useEffect(() => {
    if (!promotion || drawStatus !== "completed" || !winnerUsername) return;
    const processedAtMs = new Date(promotion.draw_processed_at ?? promotion.winner_selected_at ?? "").getTime();
    if (Number.isFinite(processedAtMs) && Date.now() - processedAtMs > 60 * 60 * 1000) return;
    setDrawMessage(null);
    startWinnerReveal([winnerUsername], winnerUsername);
  }, [drawStatus, promotion, startWinnerReveal, winnerUsername]);

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
      setShowJoinCelebration(true);
      if (celebrationTimeoutRef.current !== null) window.clearTimeout(celebrationTimeoutRef.current);
      celebrationTimeoutRef.current = window.setTimeout(() => setShowJoinCelebration(false), 2600);
    } catch (err) {
      const text = err instanceof Error ? err.message : "No pudimos registrar tu participacion.";
      setError(text);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-[100svh] bg-[#07100d] text-zinc-100">
        <div className="mx-auto flex min-h-[100svh] max-w-3xl items-center justify-center px-5">
          <p className="text-sm text-emerald-200">Cargando promocion...</p>
        </div>
      </main>
    );
  }

  if (!promotion) {
    return (
      <main className="min-h-[100svh] bg-[#07100d] text-zinc-100">
        <div className="mx-auto flex min-h-[100svh] max-w-3xl items-center justify-center px-4 text-center">
          <div className="rounded-[1.75rem] border border-zinc-800 bg-black/40 p-6 shadow-2xl backdrop-blur sm:p-8">
            <h1 className="text-2xl font-black">Promocion no disponible</h1>
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
  const tickerText = String(promotion.ticker_text ?? "").trim() || "Sorteo exclusivo";
  const prizeDescription = String(promotion.prize_description ?? "").trim() || "en fichas de casino";
  const participationSteps = Array.isArray(promotion.participation_steps)
    ? promotion.participation_steps.map((step) => String(step ?? "").trim()).filter(Boolean).slice(0, 3)
    : [];
  const ctaLabel = String(promotion.cta_label ?? "").trim() || "Quiero participar";
  const hasDrawResult = drawStatus === "completed" || !!winnerUsername;
  const hasNoParticipants = drawStatus === "no_participants";
  const drawIsOver = !!timeLeft?.isOver || hasDrawResult || hasNoParticipants;
  const canParticipate = !participantReady && !drawIsOver;
  const drawProcessedMs = new Date(promotion.draw_processed_at ?? promotion.winner_selected_at ?? "").getTime();
  const resultExpired =
    drawIsOver && Number.isFinite(drawProcessedMs) && Date.now() - drawProcessedMs > 60 * 60 * 1000;
  const showParticipantWaiting = participantReady && !drawIsOver;
  const showFinalResultOnly = resultExpired || drawStatus === "no_participants" || (winnerUsername && revealWinner);
  const backgroundImageUrl = String(promotion.background_image_url ?? "").trim();
  const backgroundStyle = backgroundImageUrl
    ? {
        backgroundImage: `linear-gradient(180deg, rgba(12,12,20,0.18), rgba(12,12,20,0.28)), url("${cssUrl(backgroundImageUrl)}")`,
        backgroundPosition: "center",
        backgroundSize: "cover",
      }
    : undefined;

  const heroShellClassName = backgroundImageUrl
    ? showParticipantWaiting
      ? "relative min-h-[calc(100svh-2rem)] overflow-hidden rounded-[2rem] px-5 pb-64 pt-8 text-center sm:min-h-[680px] sm:px-7 sm:pt-10"
      : "relative min-h-[calc(100svh-2rem)] overflow-hidden rounded-[2rem] px-5 pb-28 pt-8 text-center sm:min-h-[680px] sm:px-7 sm:pt-10"
    : showParticipantWaiting
      ? "relative min-h-[calc(100svh-2rem)] overflow-hidden rounded-[2rem] border border-white/10 bg-[#0c0c14] px-5 pb-64 pt-8 text-center shadow-[0_30px_100px_rgba(0,0,0,0.55)] sm:min-h-[680px] sm:px-7 sm:pt-10"
      : "relative min-h-[calc(100svh-2rem)] overflow-hidden rounded-[2rem] border border-white/10 bg-[#0c0c14] px-5 pb-28 pt-8 text-center shadow-[0_30px_100px_rgba(0,0,0,0.55)] sm:min-h-[680px] sm:px-7 sm:pt-10";
  const ctaZoneClassName = backgroundImageUrl
    ? "absolute inset-x-0 bottom-0 px-5 pb-6 pt-12"
    : "absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#0c0c14] via-[#0c0c14] to-transparent px-5 pb-6 pt-12";

  const heroCard = (
    <div className={heroShellClassName}>
      <div className="pointer-events-none absolute left-1/2 top-[-90px] h-72 w-72 -translate-x-1/2 rounded-full bg-amber-400/15 blur-3xl" />
      <div className="relative mx-auto max-w-[260px] overflow-hidden rounded-full border border-amber-500/55 bg-amber-500/10 py-1.5">
        <div className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.26em] text-amber-300 [animation:promotion-marquee_10s_linear_infinite]">
          {tickerText} - {tickerText} - {tickerText} -
        </div>
      </div>
      <h1 className="relative mx-auto mt-5 max-w-[310px] break-words text-[clamp(3.2rem,17vw,5.6rem)] font-black uppercase leading-[0.86] tracking-wide text-amber-500 [font-family:Impact,'Arial_Narrow',sans-serif]">
        {promotion.title}
      </h1>
      <p className="relative mx-auto mt-4 max-w-[312px] text-center text-[13px] font-bold leading-6 text-zinc-400 [text-wrap:balance] sm:text-sm">
        {promotion.message}
      </p>
      <div className="relative mt-7 flex items-center gap-3 rounded-2xl border border-amber-500/45 bg-[#1b152b] p-4 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-amber-500/35 bg-amber-500/10 text-xl font-black text-amber-300">
          $
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">Premio principal</p>
          <p className="mt-1 break-words text-3xl font-black uppercase leading-none text-amber-400 [font-family:Impact,'Arial_Narrow',sans-serif]">
            {promotion.prize}
          </p>
          <p className="mt-1 text-[11px] text-zinc-500">{prizeDescription}</p>
        </div>
      </div>
      {!showParticipantWaiting && !drawIsOver && (
        <>
          <p className="mt-6 text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Termina en</p>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {units.map(([label, value]) => (
              <div key={label} className="rounded-xl border border-white/10 bg-white/[0.05] px-1.5 py-3">
                <p className="text-2xl font-black leading-none text-white [font-family:Impact,'Arial_Narrow',sans-serif]">
                  {String(value).padStart(2, "0")}
                </p>
                <p className="mt-1 text-[8px] uppercase tracking-[0.12em] text-zinc-500">{label}</p>
              </div>
            ))}
          </div>
        </>
      )}
      {participationSteps.length > 0 && !showParticipantWaiting && !drawIsOver && (
        <>
          <div className="my-5 h-px bg-white/10" />
          <p className="text-left text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Como participar</p>
          <div className="mt-3 space-y-2 text-left">
            {participationSteps.map((step, index) => (
              <div key={`${step}-${index}`} className="flex items-start gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-amber-500/60 bg-amber-500/10 text-[10px] font-bold text-amber-300">
                  {index + 1}
                </span>
                <span className="text-[11px] leading-5 text-zinc-300">{step}</span>
              </div>
            ))}
          </div>
        </>
      )}
      {canParticipate && (
        <div className={ctaZoneClassName}>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setFormOpen(true);
            }}
            className="min-h-14 w-full rounded-2xl bg-amber-500 px-5 py-4 text-sm font-black uppercase tracking-[0.18em] text-[#0c0c14] transition active:scale-[0.99] hover:bg-amber-400 hover:[animation-play-state:paused] [animation:promotion-heartbeat_2.6s_ease-in-out_infinite]"
          >
            {ctaLabel}
          </button>
        </div>
      )}
      {showParticipantWaiting && (
        <div className={ctaZoneClassName}>
          {success && (
            <p className="mb-4 rounded-lg bg-amber-500/10 px-3 py-2 text-sm font-semibold text-amber-100">
              {success}
            </p>
          )}
          <p className="text-[11px] font-black uppercase tracking-[0.42em] text-amber-300">Ya estas participando</p>
          <div className="mt-5 grid grid-cols-4 gap-2">
            {units.map(([label, value]) => (
              <div key={label} className="rounded-xl border border-white/10 bg-black/35 px-1.5 py-3 backdrop-blur-[2px]">
                <p className="text-2xl font-black leading-none text-white [font-family:Impact,'Arial_Narrow',sans-serif]">
                  {String(value).padStart(2, "0")}
                </p>
                <p className="mt-1 text-[8px] uppercase tracking-[0.12em] text-zinc-500">{label}</p>
              </div>
            ))}
          </div>
          <p className="mx-auto mt-5 max-w-[300px] text-center text-sm font-bold leading-6 text-zinc-300 [text-wrap:balance]">
            Cuando llegue la hora, aca se mostrara el sorteo en vivo y el ganador.
          </p>
        </div>
      )}
    </div>
  );

  const formCard = (
    <section className="rounded-[1.65rem] border border-amber-500/25 bg-[#0c0c14]/95 p-4 shadow-2xl backdrop-blur-xl sm:rounded-[2rem] sm:p-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-300 sm:text-xs sm:tracking-[0.28em]">Participa por</p>
      <h1 className="mt-3 break-words text-4xl font-black uppercase leading-none text-white [font-family:Impact,'Arial_Narrow',sans-serif]">{promotion.title}</h1>
      <p className="mt-2 text-sm text-zinc-400">
        Completa los datos obligatorios para entrar. Se te notificara a tu email si ganaste.
      </p>
      <div className="mt-5 rounded-2xl border border-amber-500/35 bg-amber-500/10 px-4 py-3">
        <p className="text-[10px] uppercase tracking-[0.22em] text-amber-300">Premio</p>
        <p className="mt-1 text-xl font-black text-amber-100 [font-family:Impact,'Arial_Narrow',sans-serif]">{promotion.prize}</p>
      </div>
      <div className="mt-5 space-y-3">
        <input
          value={form.username}
          onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
          className="w-full rounded-xl border border-zinc-800 bg-black/70 px-4 py-3 text-base text-white outline-none focus:border-amber-500 sm:text-sm"
          placeholder="Nombre de usuario"
        />
        <input
          value={form.phone}
          onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
          className="w-full rounded-xl border border-zinc-800 bg-black/70 px-4 py-3 text-base text-white outline-none focus:border-amber-500 sm:text-sm"
          placeholder="Telefono"
          inputMode="tel"
        />
        <input
          value={form.email}
          onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
          className="w-full rounded-xl border border-zinc-800 bg-black/70 px-4 py-3 text-base text-white outline-none focus:border-amber-500 sm:text-sm"
          placeholder="Email"
          type="email"
        />
      </div>
      {error && <p className="mt-3 rounded-lg bg-red-950/60 px-3 py-2 text-sm text-red-200">{error}</p>}
      <button
        type="button"
        disabled={submitting}
        onClick={handleSubmit}
        className="mt-5 min-h-[52px] w-full rounded-xl bg-amber-500 px-4 py-3 text-sm font-black uppercase tracking-[0.16em] text-[#0c0c14] transition active:scale-[0.99] hover:bg-amber-400 disabled:opacity-60"
      >
        {submitting ? "Registrando..." : ctaLabel}
      </button>
    </section>
  );

  const resultCard = (
    <section className="mx-auto w-full max-w-lg rounded-[1.9rem] border border-emerald-500/35 bg-zinc-950/86 p-5 text-center shadow-2xl backdrop-blur-md sm:rounded-[2.25rem] sm:p-7">
      {success && !resultExpired && (
        <p className="mb-5 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-100">{success}</p>
      )}
      {resultExpired ? (
        <div className="py-10">
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-zinc-500">Sorteo finalizado</p>
          <h2 className="mt-5 text-3xl font-black uppercase text-white [font-family:Impact,'Arial_Narrow',sans-serif]">
            Gracias por participar
          </h2>
          <p className="mt-3 text-sm leading-6 text-zinc-400">
            El resultado ya estuvo disponible durante una hora y este link caduco.
          </p>
        </div>
      ) : winnerUsername && revealWinner ? (
        <div className="py-7 sm:py-8">
          <p className="text-xs font-semibold uppercase tracking-[0.42em] text-amber-200">Ganador del sorteo</p>
          <div className="mx-auto mt-8 flex h-44 w-44 animate-pulse items-center justify-center rounded-full border border-amber-300/50 bg-amber-300/15 shadow-[0_0_100px_rgba(251,191,36,0.42)] sm:h-48 sm:w-48">
            <span className="text-6xl font-black text-amber-100">1</span>
          </div>
          <h2 className="mt-8 break-words text-[clamp(2.75rem,14vw,4rem)] font-black leading-tight text-white">
            {winnerUsername}
          </h2>
          <p className="mt-4 text-sm text-zinc-400">Premio: {promotion.prize}</p>
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
      ) : null}
    </section>
  );

  return (
    <main className="min-h-[100svh] overflow-hidden bg-[#07100d] text-zinc-100" style={backgroundStyle}>
      <style>{`
        @keyframes promotion-marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-33.333%); }
        }
        @keyframes promotion-heartbeat {
          0%, 100% {
            transform: scale(1);
          }
          14% {
            transform: scale(1.025);
          }
          28% {
            transform: scale(1);
          }
          42% {
            transform: scale(1.018);
          }
          70% {
            transform: scale(1);
          }
        }
        @keyframes promotion-draw-progress {
          from { width: 0%; }
          to { width: 100%; }
        }
        @keyframes promotion-coin-rain {
          0% {
            transform: translate3d(0, -12vh, 0) rotate(0deg);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          100% {
            transform: translate3d(var(--coin-drift), 112vh, 0) rotate(720deg);
            opacity: 0;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          [class*="promotion-heartbeat"],
          [class*="promotion-draw-progress"],
          [class*="promotion-coin-rain"],
          [class*="promotion-marquee"] {
            animation: none !important;
          }
        }
      `}</style>
      {!backgroundImageUrl && (
        <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(245,158,11,0.18),transparent_34%),radial-gradient(circle_at_20%_85%,rgba(120,53,15,0.24),transparent_30%),linear-gradient(160deg,#050507,#0c0c14_52%,#050507)]" />
      )}
      {(showJoinCelebration || (winnerUsername && revealWinner && !resultExpired)) && (
        <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
          {COIN_RAIN.map((coin) => (
            <span
              key={coin}
              className="absolute top-0 h-3 w-3 rounded-full border border-amber-200/70 bg-gradient-to-br from-yellow-200 via-amber-400 to-yellow-700 shadow-[0_0_16px_rgba(245,158,11,0.55)] [animation:promotion-coin-rain_2.8s_linear_infinite]"
              style={
                {
                  left: `${(coin * 29) % 100}%`,
                  animationDelay: `${(coin % 9) * 0.16}s`,
                  animationDuration: `${2.2 + (coin % 5) * 0.22}s`,
                  "--coin-drift": `${coin % 2 === 0 ? "" : "-"}${18 + (coin % 7) * 6}px`,
                } as CSSProperties
              }
            />
          ))}
        </div>
      )}
      <div className="relative mx-auto flex min-h-[100svh] max-w-5xl flex-col justify-center px-4 py-6 sm:px-5 sm:py-10">
        {showFinalResultOnly ? (
          resultCard
        ) : (
        <section className={`grid w-full gap-4 sm:gap-6 ${drawIsOver ? "lg:grid-cols-[1.05fr_0.95fr] lg:items-center" : "mx-auto max-w-lg"}`}>
          {heroCard}
          {drawIsOver && (
            <section className="rounded-[1.7rem] border border-emerald-500/25 bg-zinc-950/82 p-4 text-center shadow-2xl backdrop-blur-md sm:rounded-[2rem] sm:p-6">
              {success && <p className="mb-3 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-100">{success}</p>}
              {resultExpired ? (
                <div className="py-10">
                  <p className="text-xs font-semibold uppercase tracking-[0.32em] text-zinc-500">Sorteo finalizado</p>
                  <h2 className="mt-5 text-3xl font-black uppercase text-white [font-family:Impact,'Arial_Narrow',sans-serif]">
                    Gracias por participar
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-zinc-400">
                    El resultado ya estuvo disponible durante una hora y este link caduco.
                  </p>
                </div>
              ) : isDrawAnimating ? (
                <div className="relative overflow-hidden py-5 sm:py-6">
                  <div className="pointer-events-none absolute inset-0 opacity-60 [background-image:radial-gradient(circle_at_50%_0%,rgba(16,185,129,0.24),transparent_35%),radial-gradient(circle_at_50%_100%,rgba(251,191,36,0.18),transparent_32%)]" />
                  <div className="relative">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-amber-300 sm:text-xs sm:tracking-[0.32em]">Sorteando ganador</p>
                    <p className="mt-2 text-xs text-zinc-500">Participantes verificados: {animationUsernames.length}</p>
                    <div className="mx-auto mt-6 max-w-sm rounded-[1.5rem] border border-emerald-400/40 bg-black/70 p-3 shadow-[0_0_90px_rgba(16,185,129,0.25)] sm:rounded-[1.7rem] sm:p-4">
                      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-7">
                        <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-zinc-500">Ahora pasa por</p>
                        <p className="mt-3 min-h-[3rem] break-words text-[clamp(1.65rem,9vw,2.25rem)] font-black leading-tight text-white sm:text-4xl">
                          {displayedCandidate || "..."}
                        </p>
                      </div>
                    </div>
                    <div className="mx-auto mt-5 h-2 max-w-sm overflow-hidden rounded-full bg-zinc-900">
                      <div className="h-full rounded-full bg-gradient-to-r from-amber-500 via-yellow-200 to-amber-500 [animation:promotion-draw-progress_7s_linear_forwards]" />
                    </div>
                    <div className="mt-5 grid grid-cols-3 gap-1.5 text-[9px] uppercase tracking-[0.1em] text-zinc-500 sm:gap-2 sm:text-[10px] sm:tracking-[0.16em]">
                      <span className="rounded-full border border-zinc-800 bg-black/40 px-2 py-2">Mezclando</span>
                      <span className="rounded-full border border-zinc-800 bg-black/40 px-2 py-2">Auditando</span>
                      <span className="rounded-full border border-zinc-800 bg-black/40 px-2 py-2">Sellando</span>
                    </div>
                  </div>
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
        )}
      </div>
      {formOpen && canParticipate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/78 px-3 py-6 backdrop-blur-sm sm:px-4">
          <div className="relative w-full max-w-lg">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="absolute right-3 top-3 z-10 rounded-lg border border-zinc-700 bg-zinc-950/90 px-3 py-1.5 text-xs text-zinc-200 shadow-lg hover:bg-zinc-900"
            >
              Cerrar
            </button>
            <div className="max-h-[calc(100svh-1.5rem)] overflow-y-auto rounded-[1.65rem] sm:max-h-[calc(100svh-3rem)] sm:rounded-[2rem]">
              {formCard}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
