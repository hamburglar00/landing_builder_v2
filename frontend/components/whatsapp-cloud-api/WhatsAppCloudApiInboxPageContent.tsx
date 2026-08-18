"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader, SurfaceCard } from "@/components/ui/PanelPrimitives";
import { supabase } from "@/lib/supabaseClient";
import { invokeFunction } from "@/lib/supabaseFunctions";
import {
  fetchWhatsappCloudApiInboxThreads,
  type WhatsappCloudApiInboxMessage,
  type WhatsappCloudApiInboxThread,
} from "@/lib/whatsappCloudApiDb";
import { useCurrencyScope } from "@/components/currency/CurrencyScope";
import { CURRENCY_ALL } from "@/lib/currency";

type Props = {
  mode: "admin" | "dashboard";
};

const TAG_LABELS: Record<WhatsappCloudApiInboxThread["tag"], string> = {
  contacto: "Contacto",
  lead: "Lead",
  cargo: "Cargo",
  recompra: "Recargo",
  premium: "Premium",
};

const TAG_CLASSES: Record<WhatsappCloudApiInboxThread["tag"], string> = {
  contacto: "border-sky-400/25 bg-sky-400/10 text-sky-200",
  lead: "border-[#facc15]/25 bg-[#facc15]/10 text-[#fde68a]",
  cargo: "border-[#34d399]/25 bg-[#34d399]/10 text-[#a7f3d0]",
  recompra: "border-amber-400/25 bg-amber-400/10 text-amber-200",
  premium: "border-lime-400/25 bg-lime-400/10 text-lime-200",
};

const REDIRECTED_TAG_CLASS = "border-teal-400/25 bg-teal-400/10 text-teal-200";

const WHATSAPP_DOODLE_PATTERN = encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320">
  <defs>
    <symbol id="bubble" viewBox="0 0 64 44"><path d="M6 8a6 6 0 0 1 6-6h40a6 6 0 0 1 6 6v18a6 6 0 0 1-6 6H24L10 42l3-10h-1a6 6 0 0 1-6-6V8Z"/><path d="M17 12h30M17 20h24"/></symbol>
    <symbol id="astronaut" viewBox="0 0 72 82"><path d="M27 36c-6 5-10 12-10 22v12M45 36c6 5 10 12 10 22v12"/><path d="M22 38h28l7 30a7 7 0 0 1-7 9H22a7 7 0 0 1-7-9l7-30Z"/><circle cx="36" cy="25" r="23"/><path d="M22 23c8-8 21-10 32-4v10c-10 8-24 9-35 2 0-3 1-6 3-8Z"/><path d="M28 47h16M28 55h6M39 55h5M23 73l-7 6M49 73l7 6"/></symbol>
    <symbol id="scooter" viewBox="0 0 76 52"><path d="M15 38h34c11 0 18-6 18-16H47c-9 0-17 5-23 16"/><path d="M33 22h12l11-13M50 9h13M18 38l-9 7M56 38l9 7"/><circle cx="17" cy="43" r="6"/><circle cx="58" cy="43" r="6"/><path d="M33 25c-4 0-8 3-10 7M45 18l-7-7"/></symbol>
    <symbol id="backpack" viewBox="0 0 48 56"><path d="M12 18a12 12 0 0 1 24 0v28a6 6 0 0 1-6 6H18a6 6 0 0 1-6-6V18Z"/><path d="M18 18V9h12v9M12 28H5v14h7M36 28h7v14h-7M19 34h10M19 42h14"/></symbol>
    <symbol id="thumb" viewBox="0 0 42 48"><path d="M17 20V9c0-5 7-5 8-1l1 12h8c5 0 7 4 6 8l-3 11c-1 5-4 7-9 7H13V21l4-1Z"/><path d="M5 22h8v22H5zM25 20h9M25 28h11M25 36h9"/></symbol>
    <symbol id="camera" viewBox="0 0 44 34"><path d="M4 10h8l4-5h12l4 5h8a3 3 0 0 1 3 3v15a3 3 0 0 1-3 3H4a3 3 0 0 1-3-3V13a3 3 0 0 1 3-3Z"/><circle cx="22" cy="20" r="8"/><circle cx="35" cy="15" r="2"/></symbol>
    <symbol id="phone" viewBox="0 0 34 52"><rect x="5" y="2" width="24" height="48" rx="5"/><path d="M13 43h8M12 8h10M12 18h10M12 25h8"/></symbol>
    <symbol id="glasses" viewBox="0 0 54 24"><path d="M3 7h16l6 5 6-5h20M4 9l4 12h13l5-11M50 9l-4 12H33l-5-11"/></symbol>
    <symbol id="paper" viewBox="0 0 38 34"><path d="M3 17 35 3 24 31l-7-12-14-2Z"/><path d="M17 19 35 3"/></symbol>
    <symbol id="compass" viewBox="0 0 42 42"><circle cx="21" cy="21" r="18"/><path d="m26 12-5 17-6 2 5-17 6-2Z"/></symbol>
    <symbol id="drink" viewBox="0 0 34 54"><path d="M6 18h22l-4 32H10L6 18Z"/><path d="M9 26h16M17 18l11-14M25 4h7M10 13l4 5M24 13l-4 5"/></symbol>
    <symbol id="rocket" viewBox="0 0 48 56"><path d="M26 4c12 8 16 25 8 38l-14 6-8-14C14 18 18 9 26 4Z"/><path d="M13 35 4 43l10 1M33 40l1 10 8-9"/><circle cx="27" cy="21" r="5"/></symbol>
    <symbol id="mail" viewBox="0 0 44 34"><rect x="3" y="7" width="38" height="24" rx="3"/><path d="m4 9 18 14L40 9"/></symbol>
    <symbol id="cloud" viewBox="0 0 46 24"><path d="M14 21H36a8 8 0 0 0 1-16 12 12 0 0 0-22-1A9 9 0 0 0 14 21Z"/></symbol>
    <symbol id="heart" viewBox="0 0 26 24"><path d="M13 22S3 16 3 8.5C3 5 5.6 3 8.4 3c2 0 3.6 1 4.6 2.7C14 4 15.6 3 17.6 3 20.4 3 23 5 23 8.5 23 16 13 22 13 22Z"/></symbol>
    <symbol id="star" viewBox="0 0 28 28"><path d="m14 2 3.4 7.5 8.2.8-6.1 5.5 1.7 8.1-7.2-4.2-7.2 4.2 1.7-8.1-6.1-5.5 8.2-.8L14 2Z"/></symbol>
    <symbol id="spark" viewBox="0 0 24 24"><path d="M12 2v7M12 15v7M2 12h7M15 12h7M6 6l4 4M14 14l4 4M18 6l-4 4M10 14l-4 4"/></symbol>
    <symbol id="bolt" viewBox="0 0 24 28"><path d="M14 2 4 16h8l-2 10 10-15h-8l2-9Z"/></symbol>
    <symbol id="clock" viewBox="0 0 34 34"><circle cx="17" cy="17" r="14"/><path d="M17 8v10l6 3"/></symbol>
    <symbol id="pin" viewBox="0 0 26 34"><path d="M13 32s9-10 9-19a9 9 0 0 0-18 0c0 9 9 19 9 19Z"/><circle cx="13" cy="13" r="3"/></symbol>
    <symbol id="music" viewBox="0 0 30 36"><path d="M11 28V7l16-4v20"/><circle cx="7" cy="28" r="5"/><circle cx="23" cy="23" r="5"/></symbol>
    <symbol id="pill" viewBox="0 0 46 14"><rect x="2" y="2" width="42" height="10" rx="5"/><path d="M13 7h20"/></symbol>
  </defs>
  <rect width="320" height="320" fill="none"/>
  <g fill="none" stroke="#8aa1a8" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" opacity=".22">
    <use href="#bubble" x="10" y="28" width="70" height="50" transform="rotate(-11 45 53)"/>
    <use href="#astronaut" x="82" y="32" width="78" height="90" transform="rotate(-7 121 77)"/>
    <use href="#camera" x="207" y="47" width="43" height="34" transform="rotate(-5 229 64)"/>
    <use href="#rocket" x="254" y="-9" width="50" height="58" transform="rotate(27 279 20)"/>
    <use href="#glasses" x="260" y="87" width="54" height="26" transform="rotate(10 287 100)"/>
    <use href="#thumb" x="191" y="118" width="48" height="55" transform="rotate(-10 215 145)"/>
    <use href="#drink" x="86" y="139" width="40" height="61" transform="rotate(13 106 169)"/>
    <use href="#scooter" x="120" y="183" width="82" height="58" transform="rotate(-8 161 212)"/>
    <use href="#phone" x="252" y="178" width="38" height="58" transform="rotate(12 271 207)"/>
    <use href="#backpack" x="205" y="239" width="54" height="62" transform="rotate(-4 232 270)"/>
    <use href="#mail" x="44" y="218" width="48" height="38" transform="rotate(-8 68 237)"/>
    <use href="#compass" x="41" y="271" width="38" height="38" transform="rotate(12 60 290)"/>
    <use href="#bubble" x="131" y="270" width="68" height="48" transform="rotate(9 165 294)"/>
    <use href="#cloud" x="252" y="285" width="50" height="27" transform="rotate(-7 277 298)"/>
  </g>
  <g fill="none" stroke="#8aa1a8" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" opacity=".19">
    <use href="#paper" x="206" y="93" width="34" height="31" transform="rotate(-16 223 108)"/>
    <use href="#cloud" x="51" y="91" width="38" height="22" transform="rotate(4 70 102)"/>
    <use href="#clock" x="20" y="134" width="34" height="34" transform="rotate(-11 37 151)"/>
    <use href="#pill" x="249" y="133" width="44" height="14" transform="rotate(-4 271 140)"/>
    <use href="#bubble" x="-9" y="176" width="57" height="40" transform="rotate(13 19 196)"/>
    <use href="#star" x="72" y="257" width="24" height="24" transform="rotate(-18 84 269)"/>
    <use href="#music" x="118" y="247" width="28" height="34" transform="rotate(18 132 264)"/>
    <use href="#pin" x="294" y="24" width="23" height="30" transform="rotate(-12 305 39)"/>
    <use href="#heart" x="167" y="76" width="25" height="23" transform="rotate(12 180 88)"/>
    <use href="#bolt" x="25" y="263" width="24" height="29" transform="rotate(-20 37 277)"/>
    <use href="#spark" x="276" y="245" width="24" height="24" transform="rotate(23 288 257)"/>
    <use href="#paper" x="96" y="8" width="30" height="27" transform="rotate(23 111 21)"/>
    <use href="#star" x="235" y="20" width="24" height="24" transform="rotate(13 247 32)"/>
    <use href="#cloud" x="2" y="299" width="40" height="22" transform="rotate(7 22 310)"/>
    <path d="M181 37c7 4 12 4 18 0M251 69l11 8M263 66l-12 12M170 134c6 5 12 4 16-2M283 166c7 5 13 5 18 0M98 227l15 0M102 235l10-8M291 278c5 5 10 5 15 0M14 102l10 10M24 102l-10 10"/>
  </g>
  <g fill="none" stroke="#8aa1a8" stroke-width="1.05" stroke-linecap="round" stroke-linejoin="round" opacity=".16">
    <use href="#star" x="18" y="5" width="18" height="18" transform="rotate(11 27 14)"/>
    <use href="#spark" x="52" y="5" width="18" height="18" transform="rotate(-24 61 14)"/>
    <use href="#heart" x="176" y="8" width="18" height="17" transform="rotate(-12 185 16)"/>
    <use href="#bolt" x="306" y="61" width="18" height="21" transform="rotate(18 315 71)"/>
    <use href="#star" x="31" y="117" width="17" height="17" transform="rotate(-6 39 125)"/>
    <use href="#spark" x="133" y="132" width="20" height="20" transform="rotate(12 143 142)"/>
    <use href="#heart" x="244" y="151" width="18" height="17" transform="rotate(18 253 159)"/>
    <use href="#bolt" x="62" y="179" width="18" height="21" transform="rotate(-14 71 189)"/>
    <use href="#star" x="226" y="202" width="18" height="18" transform="rotate(31 235 211)"/>
    <use href="#spark" x="99" y="295" width="18" height="18" transform="rotate(-19 108 304)"/>
    <use href="#heart" x="303" y="294" width="17" height="16" transform="rotate(8 311 302)"/>
  </g>
  <g fill="#8aa1a8" opacity=".18">
    <circle cx="14" cy="16" r="2.2"/><circle cx="39" cy="21" r="1.7"/><circle cx="67" cy="33" r="2"/><circle cx="173" cy="29" r="1.6"/><circle cx="202" cy="24" r="2.1"/><circle cx="231" cy="43" r="1.7"/><circle cx="306" cy="22" r="2"/>
    <circle cx="91" cy="84" r="1.6"/><circle cx="171" cy="105" r="2.1"/><circle cx="251" cy="111" r="1.7"/><circle cx="303" cy="125" r="2.1"/><circle cx="18" cy="128" r="1.5"/><circle cx="70" cy="135" r="2"/>
    <circle cx="147" cy="157" r="1.7"/><circle cx="181" cy="178" r="2.3"/><circle cx="238" cy="184" r="1.6"/><circle cx="305" cy="193" r="2"/><circle cx="34" cy="203" r="1.8"/><circle cx="99" cy="208" r="1.5"/>
    <circle cx="25" cy="244" r="2.2"/><circle cx="115" cy="258" r="1.6"/><circle cx="184" cy="249" r="2"/><circle cx="272" cy="265" r="1.7"/><circle cx="306" cy="259" r="2.1"/><circle cx="52" cy="304" r="1.5"/>
    <circle cx="158" cy="304" r="2.2"/><circle cx="220" cy="312" r="1.6"/><circle cx="286" cy="312" r="2"/>
  </g>
  <g fill="none" stroke="#8aa1a8" stroke-width=".8" opacity=".13">
    <circle cx="7" cy="61" r="3.5"/><circle cx="89" cy="22" r="3"/><circle cx="191" cy="69" r="3.5"/><circle cx="272" cy="56" r="3"/><circle cx="310" cy="99" r="3.6"/>
    <circle cx="58" cy="158" r="3"/><circle cx="111" cy="126" r="3.5"/><circle cx="156" cy="220" r="3.2"/><circle cx="216" cy="190" r="3.6"/><circle cx="302" cy="226" r="3"/>
    <circle cx="16" cy="284" r="3.4"/><circle cx="128" cy="306" r="3"/><circle cx="246" cy="225" r="3.4"/>
  </g>
</svg>
`);

const WHATSAPP_CHAT_BACKGROUND: CSSProperties = {
  backgroundColor: "#0b141a",
  backgroundImage: `linear-gradient(rgba(11, 20, 26, 0.58), rgba(11, 20, 26, 0.58)), url("data:image/svg+xml,${WHATSAPP_DOODLE_PATTERN}")`,
  backgroundSize: "auto, 320px 320px",
  backgroundPosition: "0 0, 0 0",
};

function initials(name: string, fallback: string): string {
  const source = name.trim() || fallback.trim();
  if (!source) return "WA";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

function formatTime(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) {
    return new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
  }
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit" }).format(date);
}

function formatDateTime(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatWhatsAppPhone(value: string | null | undefined): string {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return "";

  if (digits.startsWith("549") && digits.length === 13) {
    const local = digits.slice(3);
    return `+54 9 ${local.slice(0, 4)} ${local.slice(4, 6)}-${local.slice(6)}`;
  }

  if (digits.startsWith("54") && digits.length === 12) {
    const local = digits.slice(2);
    return `+54 ${local.slice(0, 4)} ${local.slice(4, 6)}-${local.slice(6)}`;
  }

  return digits.startsWith("+") ? digits : `+${digits}`;
}

function StatusCheckIcon({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  if (normalized === "failed") {
    return <span className="text-[10px] font-bold text-rose-300">!</span>;
  }
  const color = normalized === "read" ? "#53bdeb" : "#8696a0";
  if (normalized === "read" || normalized === "delivered") {
    return (
      <svg className="h-3.5 w-4" viewBox="0 0 18 12" fill="none" aria-hidden>
        <path d="M1.4 6.3 4.3 9.2 10.8 2.7" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M7.1 8.9 8.5 10.3 16.6 2.2" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (normalized === "sent" || normalized === "accepted") {
    return (
      <svg className="h-3.5 w-3.5" viewBox="0 0 12 12" fill="none" aria-hidden>
        <path d="M1.4 6.3 4.3 9.2 10.8 2.7" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return null;
}

function SearchIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 5h16" />
      <path d="M7 12h10" />
      <path d="M10 19h4" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  );
}

function CtaArrowIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M7 17 17 7" />
      <path d="M8 7h9v9" />
    </svg>
  );
}

function EmptyConversationIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H9l-5 4v-14.5Z" />
      <path d="M8 8h8" />
      <path d="M8 11.5h5" />
    </svg>
  );
}

function messageTime(message: WhatsappCloudApiInboxMessage): string {
  if (!message.created_at) return "-";
  const date = new Date(message.created_at);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
}

function messageDateLabel(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Hoy";
  if (date.toDateString() === yesterday.toDateString()) return "Ayer";
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

function lastInboundMessageAt(messages: WhatsappCloudApiInboxMessage[]): Date | null {
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index];
    if (message.direction !== "inbound") continue;
    const date = new Date(message.created_at);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return null;
}

function gerenciaFilterLabel(thread: WhatsappCloudApiInboxThread): string {
  const label = String(thread.assigned_gerencia_label ?? "").trim();
  if (label) return label;
  return thread.assigned_gerencia_id ? `Gerencia ${thread.assigned_gerencia_id}` : "";
}

export default function WhatsAppCloudApiInboxPageContent({ mode }: Props) {
  const router = useRouter();
  const { currencyScope } = useCurrencyScope();
  const workspaceCurrency = currencyScope === CURRENCY_ALL ? null : currencyScope;
  const basePath = mode === "admin" ? "/admin/whatsapp-cloud-api" : "/dashboard/whatsapp-cloud-api";
  const [threads, setThreads] = useState<WhatsappCloudApiInboxThread[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState<"all" | WhatsappCloudApiInboxThread["tag"]>("all");
  const [gerenciaFilter, setGerenciaFilter] = useState("");
  const [draftGerenciaFilter, setDraftGerenciaFilter] = useState("");
  const [gerenciaFilterOpen, setGerenciaFilterOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [manualMessage, setManualMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sendNotice, setSendNotice] = useState<string | null>(null);

  const loadThreads = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) {
        router.replace("/login");
        return;
      }
      const rows = await fetchWhatsappCloudApiInboxThreads(80, workspaceCurrency);
      setThreads(rows);
      setSelectedId((current) => current || rows[0]?.contact_id || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el Inbox.");
    } finally {
      setLoading(false);
    }
  }, [router, workspaceCurrency]);

  useEffect(() => {
    void loadThreads();
  }, [loadThreads]);

  useEffect(() => {
    setManualMessage("");
    setSendNotice(null);
  }, [selectedId]);

  useEffect(() => {
    if (!sendNotice) return;
    const timeout = window.setTimeout(() => setSendNotice(null), 3500);
    return () => window.clearTimeout(timeout);
  }, [sendNotice]);

  const gerenciaOptions = useMemo(() => {
    return Array.from(new Set(threads.map(gerenciaFilterLabel).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, "es-AR", { numeric: true }),
    );
  }, [threads]);

  const filteredThreads = useMemo(() => {
    const term = search.trim().toLowerCase();
    return threads.filter((thread) => {
      if (tagFilter !== "all" && thread.tag !== tagFilter) return false;
      if (gerenciaFilter && gerenciaFilterLabel(thread) !== gerenciaFilter) return false;
      if (!term) return true;
      return [
        thread.profile_name,
        thread.wa_id,
        thread.phone,
        thread.last_message_text,
        thread.assigned_phone,
        thread.assigned_gerencia_label,
        thread.promo_code,
        thread.ctwa_clid,
      ].some((value) => value.toLowerCase().includes(term));
    });
  }, [gerenciaFilter, search, tagFilter, threads]);

  const selectedThread = useMemo(
    () => filteredThreads.find((thread) => thread.contact_id === selectedId) ?? filteredThreads[0] ?? null,
    [filteredThreads, selectedId],
  );

  const selectedMessages = useMemo(() => selectedThread?.messages ?? [], [selectedThread]);
  const lastInboundAt = useMemo(() => lastInboundMessageAt(selectedMessages), [selectedMessages]);
  const serviceWindowExpiresAt = useMemo(
    () => lastInboundAt ? new Date(lastInboundAt.getTime() + 24 * 60 * 60 * 1000) : null,
    [lastInboundAt],
  );
  const serviceWindowActive = Boolean(serviceWindowExpiresAt && Date.now() <= serviceWindowExpiresAt.getTime());

  const sendManualMessage = async () => {
    if (!selectedThread || !manualMessage.trim() || sending) return;
    setSending(true);
    setError(null);
    setSendNotice(null);
    try {
      const { error: sendError } = await invokeFunction<{ ok: boolean }>(
        supabase,
        "whatsapp-cloud-send-message",
        {
          body: {
            contact_id: selectedThread.contact_id,
            body: manualMessage.trim(),
          },
        },
      );
      if (sendError) throw new Error(sendError.message);
      setManualMessage("");
      setSendNotice("Mensaje enviado.");
      await loadThreads();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar el mensaje.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inbox WhatsApp Cloud API"
        description="Conversaciones recibidas desde el numero oficial conectado a Meta."
        actions={
          <div className="relative flex flex-wrap gap-2">
            <button
              type="button"
              className={`ui-button ui-button-secondary ${gerenciaFilter ? "border-[var(--color-primary-soft-border)] text-[var(--color-primary)]" : ""}`}
              onClick={() => {
                setDraftGerenciaFilter(gerenciaFilter);
                setGerenciaFilterOpen((value) => !value);
              }}
            >
              <FilterIcon />
              Aplicar filtro{gerenciaFilter ? " (1)" : ""}
            </button>
            <button type="button" className="ui-button ui-button-secondary" onClick={() => void loadThreads()} disabled={loading}>
              Actualizar
            </button>
            <Link href={basePath} className="ui-button ui-button-secondary">
              Volver
            </Link>
            {gerenciaFilterOpen ? (
              <div className="absolute right-0 top-12 z-20 w-80 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-1)] p-4 text-left shadow-2xl">
                <label className="text-xs font-semibold text-[var(--color-text-muted)]" htmlFor="whatsapp-cloud-inbox-gerencia-filter">
                  Gerencia asignada
                </label>
                <select
                  id="whatsapp-cloud-inbox-gerencia-filter"
                  value={draftGerenciaFilter}
                  onChange={(event) => setDraftGerenciaFilter(event.target.value)}
                  className="mt-2 h-10 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-2)] px-3 text-sm text-[var(--color-text-strong)] outline-none"
                >
                  <option value="">Todas las gerencias</option>
                  {gerenciaOptions.map((label) => (
                    <option key={label} value={label}>
                      {label}
                    </option>
                  ))}
                </select>
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    className="ui-button ui-button-secondary"
                    onClick={() => {
                      setDraftGerenciaFilter("");
                      setGerenciaFilter("");
                      setGerenciaFilterOpen(false);
                    }}
                  >
                    Limpiar
                  </button>
                  <button
                    type="button"
                    className="ui-button ui-button-primary"
                    onClick={() => {
                      setGerenciaFilter(draftGerenciaFilter);
                      setGerenciaFilterOpen(false);
                    }}
                  >
                    Aplicar
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        }
      />

      {error ? <div className="ui-alert-error">{error}</div> : null}
      {sendNotice ? <div className="ui-alert ui-alert-success text-sm">{sendNotice}</div> : null}

      <SurfaceCard className="grid min-h-[38rem] overflow-hidden xl:grid-cols-[20rem_minmax(0,1fr)_18rem]">
        <aside className="flex min-h-0 flex-col border-b border-[var(--color-border-subtle)] xl:border-b-0 xl:border-r">
          <div className="space-y-3 border-b border-[var(--color-border-subtle)] p-4">
            <div className="flex h-10 items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-2)] px-3 text-[var(--color-text-muted)]">
              <SearchIcon />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar contacto"
                className="min-w-0 flex-1 bg-transparent text-sm text-[var(--color-text-strong)] outline-none placeholder:text-[var(--color-text-disabled)]"
              />
            </div>
            <div className="scrollbar-none flex gap-2 overflow-x-auto">
              {(["all", "contacto", "lead", "cargo", "recompra", "premium"] as const).map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setTagFilter(tag)}
                  className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${
                    tagFilter === tag
                      ? "border-[var(--color-primary-soft-border)] bg-[var(--color-primary-soft-bg)] text-[var(--color-primary)]"
                      : "border-[var(--color-border)] bg-[var(--color-bg-2)] text-[var(--color-text-muted)]"
                  }`}
                >
                  {tag === "all" ? "Todos" : TAG_LABELS[tag]}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-sm text-[var(--color-text-muted)]">Cargando conversaciones...</div>
            ) : filteredThreads.length === 0 ? (
              <div className="flex h-full items-center justify-center p-6 text-center">
                <div className="max-w-xs">
                  <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--color-primary-soft-border)] bg-[var(--color-primary-soft-bg)] text-[var(--color-primary)]">
                    <EmptyConversationIcon />
                  </span>
                  <p className="mt-4 text-sm font-semibold text-[var(--color-text-strong)]">Sin conversaciones</p>
                  <p className="mt-2 text-xs leading-5 text-[var(--color-text-muted)]">No hay threads para los filtros seleccionados.</p>
                </div>
              </div>
            ) : filteredThreads.map((thread) => {
              const selected = selectedThread?.contact_id === thread.contact_id;
              return (
                <button
                  key={thread.contact_id}
                  type="button"
                  onClick={() => setSelectedId(thread.contact_id)}
                  className={`relative flex w-full gap-3 border-b border-[var(--color-border-subtle)] px-4 py-3 text-left transition hover:bg-[rgba(148,163,184,0.06)] ${
                    selected ? "bg-[rgba(148,163,184,0.08)]" : ""
                  }`}
                >
                  {selected ? <span className="absolute bottom-0 left-0 top-0 w-1 bg-[var(--color-primary)]" /> : null}
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-bg-2)] text-xs font-semibold text-[var(--color-text-muted)]">
                    {initials(thread.profile_name, thread.wa_id)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-[var(--color-text-strong)]">
                        {thread.profile_name || thread.wa_id}
                      </span>
                      <span className="shrink-0 text-[10px] text-[var(--color-text-disabled)]">
                        {formatTime(thread.last_message_at || thread.first_message_at)}
                      </span>
                    </span>
                    <span className="mt-1 block truncate text-xs text-[var(--color-text-muted)]">
                      {thread.last_message_text || "Sin mensajes"}
                    </span>
                    <span className="mt-2 flex flex-wrap gap-1.5">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${TAG_CLASSES[thread.tag]}`}>
                        {TAG_LABELS[thread.tag]}
                      </span>
                      {gerenciaFilterLabel(thread) ? (
                        <span
                          className="inline-flex max-w-full rounded-full border border-[var(--color-border-subtle)] bg-[rgba(148,163,184,0.07)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-text-muted)]"
                          title={`Gerencia: ${gerenciaFilterLabel(thread)}`}
                        >
                          <span className="truncate">{gerenciaFilterLabel(thread)}</span>
                        </span>
                      ) : null}
                      {thread.redirect_clicked ? (
                        <span
                          className={`inline-flex max-w-full rounded-full border px-2 py-0.5 text-[10px] font-semibold ${REDIRECTED_TAG_CLASS}`}
                          title={thread.redirect_last_clicked_at ? `Ultima redireccion: ${formatDateTime(thread.redirect_last_clicked_at)}` : "Redirigido"}
                        >
                          Redirigido
                        </span>
                      ) : null}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="flex min-h-[34rem] flex-col border-b border-[var(--color-border-subtle)] xl:border-b-0 xl:border-r">
          {selectedThread ? (
            <>
              <div className="flex items-center justify-between border-b border-[#26343d] bg-[#111b21] px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#2a3942] bg-[#202c33] text-xs font-semibold text-[#aebac1]">
                    {initials(selectedThread.profile_name, selectedThread.wa_id)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#e9edef]">{selectedThread.profile_name || selectedThread.wa_id}</p>
                    <p className="text-xs text-[#8696a0]">{formatWhatsAppPhone(selectedThread.phone || selectedThread.wa_id)}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${TAG_CLASSES[selectedThread.tag]}`}>
                    {TAG_LABELS[selectedThread.tag]}
                  </span>
                  {selectedThread.redirect_clicked ? (
                    <span
                      className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${REDIRECTED_TAG_CLASS}`}
                      title={selectedThread.redirect_last_clicked_at ? `Ultima redireccion: ${formatDateTime(selectedThread.redirect_last_clicked_at)}` : "Redirigido"}
                    >
                      Redirigido
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-5 py-5" style={WHATSAPP_CHAT_BACKGROUND}>
                {selectedMessages.length === 0 ? (
                  <div className="m-auto max-w-sm rounded-xl border border-dashed border-[#2a3942] bg-[#111b21]/90 px-5 py-6 text-center shadow-lg">
                    <p className="text-sm font-semibold text-[#e9edef]">Sin mensajes normalizados</p>
                    <p className="mt-2 text-xs leading-5 text-[#8696a0]">El thread existe, pero no hay mensajes disponibles para mostrar.</p>
                  </div>
                ) : (
                  <>
                    <div className="mb-2 self-center rounded-lg bg-[#182229] px-3 py-1 text-[11px] font-medium text-[#8696a0] shadow">
                      {messageDateLabel(selectedMessages[0]?.created_at ?? null)}
                    </div>
                    {selectedMessages.map((message, index) => {
                      const outbound = message.direction === "outbound";
                      const ctaTitle = message.button_title || "";
                      const ctaUrl = message.button_url || "";
                      return (
                        <div
                          key={`${message.meta_message_id || message.created_at}-${index}`}
                          className={`relative max-w-[78%] px-2.5 py-1.5 text-[13px] leading-5 shadow-sm ${
                            outbound
                              ? "self-end rounded-lg rounded-tr-sm bg-[#005c4b] text-[#e9edef]"
                              : "self-start rounded-lg rounded-tl-sm bg-[#202c33] text-[#e9edef]"
                          }`}
                        >
                          <span
                            className={`absolute top-0 h-3 w-3 ${
                              outbound
                                ? "-right-1 bg-[#005c4b] [clip-path:polygon(0_0,100%_0,0_100%)]"
                                : "-left-1 bg-[#202c33] [clip-path:polygon(0_0,100%_0,100%_100%)]"
                            }`}
                            aria-hidden
                          />
                          <p className="whitespace-pre-wrap break-words pr-11">{message.body || "-"}</p>
                          {outbound && ctaTitle ? (
                            <a
                              href={ctaUrl || undefined}
                              target={ctaUrl ? "_blank" : undefined}
                              rel={ctaUrl ? "noreferrer" : undefined}
                              className="clear-both mt-2 flex items-center justify-center gap-2 border-t border-white/10 pt-2 text-xs font-semibold uppercase tracking-wide text-[#53bdeb] hover:text-[#7fd0ff]"
                              onClick={(event) => {
                                if (!ctaUrl) event.preventDefault();
                              }}
                            >
                              <CtaArrowIcon />
                              {ctaTitle}
                            </a>
                          ) : null}
                          <span className="float-right -mb-0.5 ml-2 mt-1 flex items-center gap-1 text-[10px] leading-none text-[#8696a0]">
                            {messageTime(message)}
                            {outbound ? <StatusCheckIcon status={message.status} /> : null}
                          </span>
                          {message.error ? <p className="clear-both mt-2 text-[10px] text-rose-300">{message.error}</p> : null}
                        </div>
                      );
                    })}
                  </>
                )}
              </div>

              <div className="border-t border-[#26343d] bg-[#111b21] px-4 py-3">
                <div className="mb-2 text-[11px] text-[#8696a0]">
                  {serviceWindowExpiresAt
                    ? serviceWindowActive
                      ? `Ventana activa hasta ${formatDateTime(serviceWindowExpiresAt.toISOString())}`
                      : `Ventana vencida el ${formatDateTime(serviceWindowExpiresAt.toISOString())}`
                    : "Sin mensaje entrante para validar ventana de 24 hs"}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    value={manualMessage}
                    onChange={(event) => setManualMessage(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void sendManualMessage();
                      }
                    }}
                    disabled={!serviceWindowActive || sending}
                    className="min-w-0 flex-1 rounded-full border border-[#2a3942] bg-[#202c33] px-4 py-2 text-sm text-[#e9edef] outline-none placeholder:text-[#8696a0] disabled:cursor-not-allowed disabled:opacity-60"
                    placeholder={serviceWindowActive ? "Escribir respuesta" : "Ventana de 24 hs no disponible"}
                    maxLength={4096}
                  />
                  <button
                    type="button"
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-[#00a884] text-[#0b141a] transition hover:bg-[#06cf9c] disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!serviceWindowActive || !manualMessage.trim() || sending}
                    onClick={() => void sendManualMessage()}
                    title="Enviar respuesta"
                  >
                  <SendIcon />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center p-6 text-center">
              <div className="max-w-sm rounded-xl border border-dashed border-[var(--color-border-strong)] bg-[rgba(255,255,255,0.02)] px-5 py-6">
                <p className="text-sm font-semibold text-[var(--color-text-strong)]">Selecciona una conversacion</p>
                <p className="mt-2 text-xs leading-5 text-[var(--color-text-muted)]">El detalle se muestra al seleccionar un thread.</p>
              </div>
            </div>
          )}
        </section>

        <aside className="min-h-0 overflow-y-auto p-4">
          {selectedThread ? (
            <div className="space-y-5">
              <div className="text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-bg-2)] text-sm font-semibold text-[var(--color-text-muted)]">
                  {initials(selectedThread.profile_name, selectedThread.wa_id)}
                </span>
                <p className="mt-3 text-sm font-semibold text-[var(--color-text-strong)]">{selectedThread.profile_name || selectedThread.wa_id}</p>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">{formatWhatsAppPhone(selectedThread.phone || selectedThread.wa_id)}</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-2)] p-3">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-disabled)]">Cargas</p>
                  <p className="mt-1 text-lg font-semibold text-[var(--color-text-strong)]">{selectedThread.purchase_count}</p>
                </div>
                <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-2)] p-3">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-disabled)]">Total</p>
                  <p className="mt-1 text-sm font-semibold text-[var(--color-primary)]">{formatMoney(selectedThread.total_loaded)}</p>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-disabled)]">Derivacion</p>
                <div className="mt-3 space-y-2 text-xs">
                  <InfoRow label="Telefono" value={formatWhatsAppPhone(selectedThread.assigned_phone) || "-"} />
                  <InfoRow label="Gerencia" value={selectedThread.assigned_gerencia_label || selectedThread.assigned_gerencia_id?.toString() || "-"} />
                  <InfoRow label="Promo" value={selectedThread.promo_code || "-"} />
                  <InfoRow
                    label="Redireccion"
                    value={selectedThread.redirect_clicked
                      ? `${selectedThread.redirect_click_count} click${selectedThread.redirect_click_count === 1 ? "" : "s"}`
                      : "-"}
                  />
                </div>
              </div>

              {(selectedThread.ctwa_clid || selectedThread.source_type || selectedThread.headline || selectedThread.last_purchase_at) ? (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-disabled)]">Atribucion</p>
                  <div className="mt-3 space-y-2 text-xs">
                    {selectedThread.ctwa_clid ? <InfoRow label="ctwa_clid" value={selectedThread.ctwa_clid} mono /> : null}
                    {selectedThread.source_type ? <InfoRow label="Tipo anuncio" value={selectedThread.source_type} /> : null}
                    {selectedThread.headline ? <InfoRow label="Titulo anuncio" value={selectedThread.headline} /> : null}
                    {selectedThread.last_purchase_at ? <InfoRow label="Ultima carga" value={formatDateTime(selectedThread.last_purchase_at)} /> : null}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-[var(--color-text-muted)]">Sin thread seleccionado.</p>
          )}
        </aside>
      </SurfaceCard>
    </div>
  );
}

function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-[var(--color-border-subtle)] bg-[rgba(255,255,255,0.02)] px-3 py-2">
      <span className="shrink-0 text-[var(--color-text-muted)]">{label}</span>
      <span className={`min-w-0 break-words text-right font-medium text-[var(--color-text-strong)] ${mono ? "font-mono text-[10px]" : ""}`}>
        {value}
      </span>
    </div>
  );
}
