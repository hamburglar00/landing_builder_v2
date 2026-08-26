"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ModalShell, PageHeader, SurfaceCard } from "@/components/ui/PanelPrimitives";
import DateRangeFilter, {
  type DateRange,
} from "@/components/conversiones/DateRangeFilter";
import {
  isSameDateRange,
  todayRange,
} from "@/components/conversiones/conversionPageShared";
import { supabase } from "@/lib/supabaseClient";
import { invokeFunction } from "@/lib/supabaseFunctions";
import {
  fetchWhatsappCloudApiInboxThreads,
  formatWhatsappCloudApiError,
  logWhatsappCloudApiError,
  markWhatsappCloudApiThreadRead,
  markWhatsappCloudApiThreadsRead,
  type WhatsappCloudApiInboxMessage,
  type WhatsappCloudApiInboxThread,
} from "@/lib/whatsappCloudApiDb";
import { useCurrencyScope } from "@/components/currency/CurrencyScope";
import { CURRENCY_ALL } from "@/lib/currency";
import { formatWhatsAppDisplayPhone } from "@/lib/phoneFormatting";
import { useWhatsappCloudApiHiddenContacts } from "@/lib/whatsappCloudApiHiddenContacts";

type Props = {
  mode: "admin" | "dashboard";
};

const TAG_LABELS: Record<WhatsappCloudApiInboxThread["tag"], string> = {
  nuevo: "Nuevo",
  contacto: "Contacto",
  lead: "Lead",
  cargo: "Cargo",
  recompra: "Recargo",
  premium: "Premium",
};

const TAG_CLASSES: Record<WhatsappCloudApiInboxThread["tag"], string> = {
  nuevo: "border-sky-400/25 bg-sky-400/10 text-sky-200",
  contacto: "border-zinc-600/35 bg-zinc-950/40 text-zinc-300",
  lead: "border-amber-800/40 bg-amber-950/18 text-amber-300",
  cargo: "border-rose-800/40 bg-rose-950/18 text-rose-300",
  recompra: "border-violet-800/40 bg-violet-950/20 text-violet-300",
  premium: "border-amber-500/20 bg-amber-500/8 text-amber-300",
};

const INBOX_PAGE_SIZE = 20;
type InboxTag = WhatsappCloudApiInboxThread["tag"];
type InboxFilter = "all" | InboxTag | "unread";
const headerButtonClassName =
  "inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-[11px] font-medium text-zinc-200 transition hover:bg-zinc-800 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 sm:h-7";

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
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor(
    (today.getTime() - day.getTime()) / (24 * 60 * 60 * 1000),
  );

  if (diffDays === 0) {
    return new Intl.DateTimeFormat("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(date);
  }

  if (diffDays === 1) return "ayer";

  if (diffDays > 1 && diffDays < 7) {
    return new Intl.DateTimeFormat("es-AR", {
      weekday: "long",
    }).format(date).toLowerCase();
  }

  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);
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

function StatusCheckIcon({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  if (normalized === "sending") {
    return <span className="text-[10px] font-semibold text-[#8696a0]">...</span>;
  }
  if (normalized === "failed") {
    return <span className="text-[10px] font-bold text-rose-300">!</span>;
  }
  const color = normalized === "read" ? "#53bdeb" : "#8696a0";
  if (normalized === "read" || normalized === "delivered") {
    return (
      <svg className="h-3.5 w-4" viewBox="0 0 18 12" fill="none" aria-hidden>
        <path
          d="M1.4 6.3 4.3 9.2 10.8 2.7"
          stroke={color}
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M7.1 8.9 8.5 10.3 16.6 2.2"
          stroke={color}
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (normalized === "sent" || normalized === "accepted") {
    return (
      <svg className="h-3.5 w-3.5" viewBox="0 0 12 12" fill="none" aria-hidden>
        <path
          d="M1.4 6.3 4.3 9.2 10.8 2.7"
          stroke={color}
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return null;
}

function SearchIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 5h16" />
      <path d="M7 12h10" />
      <path d="M10 19h4" />
    </svg>
  );
}

function MoreVerticalIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="5" r="1.4" />
      <circle cx="12" cy="12" r="1.4" />
      <circle cx="12" cy="19" r="1.4" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  );
}

function CtaArrowIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M7 17 17 7" />
      <path d="M8 7h9v9" />
    </svg>
  );
}

function EmptyConversationIcon() {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H9l-5 4v-14.5Z" />
      <path d="M8 8h8" />
      <path d="M8 11.5h5" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      className="h-2 w-2"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="m19 6-1 14H6L5 6" />
      <path d="M10 11v5" />
      <path d="M14 11v5" />
    </svg>
  );
}

function messageTime(message: WhatsappCloudApiInboxMessage): string {
  if (!message.created_at) return "-";
  const date = new Date(message.created_at);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
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
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function lastInboundMessageAt(
  messages: WhatsappCloudApiInboxMessage[],
): Date | null {
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
  return thread.assigned_gerencia_id
    ? `Gerencia ${thread.assigned_gerencia_id}`
    : "";
}

type RealtimeRow = Record<string, unknown>;

function asRecord(value: unknown): RealtimeRow {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as RealtimeRow)
    : {};
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return "";
}

function readPath(source: unknown, path: Array<string | number>): unknown {
  let current: unknown = source;
  for (const segment of path) {
    if (Array.isArray(current) && typeof segment === "number") {
      current = current[segment];
      continue;
    }
    if (current && typeof current === "object" && !Array.isArray(current)) {
      current = (current as RealtimeRow)[String(segment)];
      continue;
    }
    return undefined;
  }
  return current;
}

function messageTimestamp(message: WhatsappCloudApiInboxMessage): number {
  const time = new Date(message.created_at).getTime();
  return Number.isFinite(time) ? time : 0;
}

function isOptimisticMessage(message: WhatsappCloudApiInboxMessage): boolean {
  return message.meta_message_id.startsWith("manual:");
}

function mergeMessages(
  current: WhatsappCloudApiInboxMessage[],
  nextMessage: WhatsappCloudApiInboxMessage,
  replaceMetaMessageId = "",
): WhatsappCloudApiInboxMessage[] {
  const next = current.filter(
    (message) => !replaceMetaMessageId || message.meta_message_id !== replaceMetaMessageId,
  );
  const metaId = nextMessage.meta_message_id.trim();
  let existingIndex = metaId
    ? next.findIndex((message) => message.meta_message_id === metaId)
    : -1;

  if (existingIndex < 0 && metaId && nextMessage.direction === "outbound") {
    const nextTime = messageTimestamp(nextMessage);
    existingIndex = next.findIndex((message) => {
      if (!isOptimisticMessage(message)) return false;
      if (message.direction !== "outbound") return false;
      if (message.body !== nextMessage.body) return false;
      return Math.abs(messageTimestamp(message) - nextTime) < 15_000;
    });
  }

  if (existingIndex >= 0) {
    const existing = next[existingIndex];
    next[existingIndex] = {
      ...existing,
      ...nextMessage,
      created_at: existing.created_at || nextMessage.created_at,
      body: nextMessage.body || existing.body,
      error: nextMessage.error || existing.error,
    };
  } else {
    next.push(nextMessage);
  }

  return next.sort((a, b) => messageTimestamp(a) - messageTimestamp(b));
}

function applyMessageToThread(
  thread: WhatsappCloudApiInboxThread,
  message: WhatsappCloudApiInboxMessage,
  options: { replaceMetaMessageId?: string; incrementUnread?: boolean } = {},
): WhatsappCloudApiInboxThread {
  const messages = mergeMessages(
    thread.messages,
    message,
    options.replaceMetaMessageId,
  );
  const lastMessage = messages[messages.length - 1] ?? message;
  return {
    ...thread,
    messages,
    last_message_at: lastMessage.created_at || thread.last_message_at,
    last_message_text: lastMessage.body || thread.last_message_text,
    last_message_direction: lastMessage.direction || thread.last_message_direction,
    last_message_status: lastMessage.status || thread.last_message_status,
    unread_count: options.incrementUnread
      ? thread.unread_count + 1
      : thread.unread_count,
    unread_last_message_at: options.incrementUnread
      ? message.created_at
      : thread.unread_last_message_at,
  };
}

function sortThreadsByActivity(
  rows: WhatsappCloudApiInboxThread[],
): WhatsappCloudApiInboxThread[] {
  return [...rows].sort((a, b) => {
    const aTime = new Date(a.last_message_at || a.first_message_at || "").getTime();
    const bTime = new Date(b.last_message_at || b.first_message_at || "").getTime();
    return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0);
  });
}

function inboundMessageFromWebhookRow(row: RealtimeRow): {
  configId: string;
  waId: string;
  message: WhatsappCloudApiInboxMessage;
} | null {
  if (firstString(row.event_type) !== "message") return null;
  const payload = asRecord(row.payload);
  const waId = firstString(
    readPath(payload, ["message", "from"]),
    readPath(payload, ["entry", 0, "changes", 0, "value", "messages", 0, "from"]),
  );
  const body = firstString(
    readPath(payload, ["message", "text", "body"]),
    readPath(payload, ["message", "button", "text"]),
    readPath(payload, ["message", "interactive", "button_reply", "title"]),
    readPath(payload, ["entry", 0, "changes", 0, "value", "messages", 0, "text", "body"]),
    readPath(payload, ["entry", 0, "changes", 0, "value", "messages", 0, "button", "text"]),
    readPath(payload, ["entry", 0, "changes", 0, "value", "messages", 0, "interactive", "button_reply", "title"]),
    row.event_type,
  );
  const configId = firstString(row.config_id);
  if (!configId || !waId) return null;
  return {
    configId,
    waId,
    message: {
      created_at: firstString(row.received_at, new Date().toISOString()),
      direction: "inbound",
      body,
      status: firstString(row.status, "pending"),
      meta_message_id: firstString(row.meta_message_id),
      message_type: "text",
      button_title: "",
      button_url: "",
      error: firstString(row.last_error),
    },
  };
}

function outboundMessageFromRow(row: RealtimeRow): {
  configId: string;
  waId: string;
  message: WhatsappCloudApiInboxMessage;
} | null {
  const payload = asRecord(row.payload);
  const configId = firstString(row.config_id);
  const waId = firstString(row.recipient_wa_id);
  if (!configId || !waId) return null;
  return {
    configId,
    waId,
    message: {
      created_at: firstString(row.created_at, row.sent_at, new Date().toISOString()),
      direction: "outbound",
      body: firstString(
        readPath(payload, ["text", "body"]),
        readPath(payload, ["interactive", "body", "text"]),
        row.message_type,
      ),
      status: firstString(row.status, "accepted"),
      meta_message_id: firstString(row.meta_message_id),
      message_type: firstString(row.message_type, readPath(payload, ["type"]), "text"),
      button_title: firstString(readPath(payload, ["interactive", "action", "parameters", "display_text"])),
      button_url: firstString(readPath(payload, ["interactive", "action", "parameters", "url"])),
      error: firstString(row.last_error),
    },
  };
}

export default function WhatsAppCloudApiInboxPageContent({ mode }: Props) {
  const router = useRouter();
  const { currencyScope } = useCurrencyScope();
  const workspaceCurrency =
    currencyScope === CURRENCY_ALL ? null : currencyScope;
  const basePath =
    mode === "admin"
      ? "/admin/whatsapp-cloud-api"
      : "/dashboard/whatsapp-cloud-api";
  const [threads, setThreads] = useState<WhatsappCloudApiInboxThread[]>([]);
  const [totalThreads, setTotalThreads] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | null>(todayRange());
  const dateRangeRef = useRef<DateRange | null>(dateRange);
  const [tagFilter, setTagFilter] = useState<InboxFilter>("all");
  const [gerenciaFilter, setGerenciaFilter] = useState("");
  const [draftGerenciaFilter, setDraftGerenciaFilter] = useState("");
  const [gerenciaFilterOpen, setGerenciaFilterOpen] = useState(false);
  const [threadActionsOpen, setThreadActionsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [manualMessage, setManualMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [sendNotice, setSendNotice] = useState<string | null>(null);
  const { hiddenContactIds, hideContactId } = useWhatsappCloudApiHiddenContacts(
    workspaceCurrency,
  );
  const [threadToHide, setThreadToHide] =
    useState<WhatsappCloudApiInboxThread | null>(null);
  const lastMarkedReadRef = useRef("");
  const selectedIdRef = useRef(selectedId);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const silentRefreshTimeoutRef = useRef<number | null>(null);
  const serverTagFilter: "all" | InboxTag =
    tagFilter === "unread" ? "all" : tagFilter;
  const unreadOnly = tagFilter === "unread";

  const loadThreads = useCallback(async (options: { silent?: boolean } = {}) => {
    if (!options.silent) setLoading(true);
    setError(null);
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) {
        router.replace("/login");
        return;
      }
      const rows = await fetchWhatsappCloudApiInboxThreads(
        INBOX_PAGE_SIZE,
        workspaceCurrency,
        pageIndex * INBOX_PAGE_SIZE,
        serverTagFilter,
        unreadOnly,
        dateRange,
      );
      setThreads(rows);
      setTotalThreads(
        rows[0]?.total_threads ?? (pageIndex === 0 ? rows.length : 0),
      );
      setSelectedId((current) =>
        rows.some((row) => row.contact_id === current)
          ? current
          : ""
      );
    } catch (err) {
      logWhatsappCloudApiError("inbox page load failed", err, {
        mode,
        workspaceCurrency,
        pageIndex,
        limit: INBOX_PAGE_SIZE,
        offset: pageIndex * INBOX_PAGE_SIZE,
        tagFilter,
        dateRange: dateRange
          ? {
              start: dateRange.start.toISOString(),
              end: dateRange.end.toISOString(),
            }
          : null,
      });
      setError(formatWhatsappCloudApiError(err, "No se pudo cargar el Inbox."));
    } finally {
      if (!options.silent) setLoading(false);
    }
  }, [dateRange, mode, pageIndex, router, serverTagFilter, tagFilter, unreadOnly, workspaceCurrency]);

  useEffect(() => {
    void loadThreads();
  }, [loadThreads]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    setPageIndex(0);
    setTotalThreads(0);
    setSelectedId("");
  }, [dateRange, tagFilter, workspaceCurrency]);

  const handleDateRangeChange = useCallback((nextRange: DateRange | null) => {
    const previousRange = dateRangeRef.current;
    if (isSameDateRange(previousRange, nextRange)) return;
    dateRangeRef.current = nextRange;
    setDateRange(nextRange);
    setPageIndex(0);
    setTotalThreads(0);
    setSelectedId("");
  }, []);

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
    return Array.from(
      new Set(threads.map(gerenciaFilterLabel).filter(Boolean)),
    ).sort((a, b) => a.localeCompare(b, "es-AR", { numeric: true }));
  }, [threads]);

  const filteredThreads = useMemo(() => {
    const term = search.trim().toLowerCase();
    return threads.filter((thread) => {
      if (hiddenContactIds.has(thread.contact_id)) return false;
      if (tagFilter === "unread" && thread.unread_count <= 0) return false;
      if (tagFilter !== "all" && tagFilter !== "unread" && thread.tag !== tagFilter) return false;
      if (gerenciaFilter && gerenciaFilterLabel(thread) !== gerenciaFilter)
        return false;
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
  }, [gerenciaFilter, hiddenContactIds, search, tagFilter, threads]);

  const selectedThread = useMemo(
    () =>
      filteredThreads.find((thread) => thread.contact_id === selectedId) ??
      null,
    [filteredThreads, selectedId],
  );

  const selectedMessages = useMemo(
    () => selectedThread?.messages ?? [],
    [selectedThread],
  );
  const lastSelectedMessage = selectedMessages[selectedMessages.length - 1];
  const lastInboundAt = useMemo(
    () => lastInboundMessageAt(selectedMessages),
    [selectedMessages],
  );
  const serviceWindowExpiresAt = useMemo(
    () =>
      lastInboundAt
        ? new Date(lastInboundAt.getTime() + 24 * 60 * 60 * 1000)
        : null,
    [lastInboundAt],
  );
  const serviceWindowActive = Boolean(
    serviceWindowExpiresAt && Date.now() <= serviceWindowExpiresAt.getTime(),
  );
  const canGoPrevious = pageIndex > 0;
  const visibleTotalThreads = Math.max(0, totalThreads);
  const visiblePageThreadCount = threads.length;
  const pageEnd = Math.min(
    visibleTotalThreads,
    pageIndex * INBOX_PAGE_SIZE + visiblePageThreadCount,
  );
  const canGoNext = pageEnd < visibleTotalThreads;
  const hasGerenciaFilter = Boolean(gerenciaFilter);

  const messageIsInsideCurrentRange = useCallback((createdAt: string) => {
    const range = dateRangeRef.current;
    if (!range) return true;
    const time = new Date(createdAt).getTime();
    if (!Number.isFinite(time)) return true;
    return time >= range.start.getTime() && time <= range.end.getTime();
  }, []);

  const updateThreadMessage = useCallback(
    (
      contactId: string,
      message: WhatsappCloudApiInboxMessage,
      options: { replaceMetaMessageId?: string; incrementUnread?: boolean } = {},
    ) => {
      if (!messageIsInsideCurrentRange(message.created_at)) return;
      setThreads((current) =>
        sortThreadsByActivity(
          current.map((thread) =>
            thread.contact_id === contactId
              ? applyMessageToThread(thread, message, options)
              : thread,
          ),
        ),
      );
    },
    [messageIsInsideCurrentRange],
  );

  const updateMatchingThreadMessage = useCallback(
    (
      configId: string,
      waId: string,
      message: WhatsappCloudApiInboxMessage,
    ): boolean => {
      if (!messageIsInsideCurrentRange(message.created_at)) return true;
      let matched = false;
      setThreads((current) => {
        const next = current.map((thread) => {
          const sameThread = thread.config_id === configId && thread.wa_id === waId;
          if (!sameThread) return thread;
          matched = true;
          return applyMessageToThread(thread, message, {
            incrementUnread:
              message.direction === "inbound" &&
              thread.contact_id !== selectedIdRef.current,
          });
        });
        return matched ? sortThreadsByActivity(next) : current;
      });
      return matched;
    },
    [messageIsInsideCurrentRange],
  );

  const scheduleSilentRefresh = useCallback(() => {
    if (silentRefreshTimeoutRef.current !== null) return;
    silentRefreshTimeoutRef.current = window.setTimeout(() => {
      void loadThreads({ silent: true });
      silentRefreshTimeoutRef.current = window.setTimeout(() => {
        silentRefreshTimeoutRef.current = null;
        void loadThreads({ silent: true });
      }, 1800);
    }, 900);
  }, [loadThreads]);

  const hideThreadFromUi = () => {
    if (!threadToHide) return;
    const contactId = threadToHide.contact_id;
    hideContactId(contactId);
    if (selectedId === contactId) setSelectedId("");
    setThreadToHide(null);
  };

  useEffect(() => {
    if (!selectedThread || selectedThread.unread_count <= 0) return;
    const markKey = `${selectedThread.contact_id}:${selectedThread.unread_last_message_at ?? ""}:${selectedThread.unread_count}`;
    if (lastMarkedReadRef.current === markKey) return;
    lastMarkedReadRef.current = markKey;

    void markWhatsappCloudApiThreadRead(selectedThread.contact_id)
      .then(() => {
        setThreads((current) =>
          current.map((thread) =>
            thread.contact_id === selectedThread.contact_id
              ? { ...thread, unread_count: 0, unread_last_message_at: null }
              : thread,
          ),
        );
      })
      .catch((err) => {
        console.error("[whatsapp-cloud-inbox] mark read failed", err);
        lastMarkedReadRef.current = "";
      });
  }, [selectedThread]);

  useEffect(() => {
    const node = chatScrollRef.current;
    if (!node || !selectedThread) return;
    node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
  }, [
    selectedId,
    selectedMessages.length,
    lastSelectedMessage?.meta_message_id,
    lastSelectedMessage?.status,
    selectedThread,
  ]);

  useEffect(() => {
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    void supabase.auth.getUser().then(({ data, error: authError }) => {
      if (!active || authError || !data.user) return;
      channel = supabase
        .channel(`whatsapp-cloud-inbox:${mode}:${data.user.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "whatsapp_cloud_api_outbound_messages",
          },
          (payload) => {
            const update = outboundMessageFromRow(asRecord(payload.new));
            if (!update) return;
            updateMatchingThreadMessage(
              update.configId,
              update.waId,
              update.message,
            );
          },
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "whatsapp_cloud_api_outbound_messages",
          },
          (payload) => {
            const update = outboundMessageFromRow(asRecord(payload.new));
            if (!update) return;
            updateMatchingThreadMessage(
              update.configId,
              update.waId,
              update.message,
            );
          },
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "whatsapp_cloud_api_webhook_events",
          },
          (payload) => {
            const update = inboundMessageFromWebhookRow(asRecord(payload.new));
            if (!update) return;
            const matched = updateMatchingThreadMessage(
              update.configId,
              update.waId,
              update.message,
            );
            if (!matched) scheduleSilentRefresh();
          },
        )
        .subscribe((status) => {
          if (status === "CHANNEL_ERROR") {
            console.warn("[whatsapp-cloud-inbox] realtime channel error");
          }
        });
    });

    return () => {
      active = false;
      if (silentRefreshTimeoutRef.current !== null) {
        window.clearTimeout(silentRefreshTimeoutRef.current);
        silentRefreshTimeoutRef.current = null;
      }
      if (channel) void supabase.removeChannel(channel);
    };
  }, [mode, scheduleSilentRefresh, updateMatchingThreadMessage]);

  const sendManualMessage = async () => {
    if (!selectedThread || !manualMessage.trim() || sending) return;
    const contactId = selectedThread.contact_id;
    const body = manualMessage.trim();
    const createdAt = new Date().toISOString();
    const tempMetaMessageId = `manual:${contactId}:${Date.now()}`;
    const optimisticMessage: WhatsappCloudApiInboxMessage = {
      created_at: createdAt,
      direction: "outbound",
      body,
      status: "sending",
      meta_message_id: tempMetaMessageId,
      message_type: "manual_text",
      button_title: "",
      button_url: "",
      error: "",
    };

    setSending(true);
    setError(null);
    setSendNotice(null);
    setManualMessage("");
    updateThreadMessage(contactId, optimisticMessage);
    try {
      const { data, error: sendError } = await invokeFunction<{
        ok: boolean;
        meta_message_id?: string;
        customer_service_window_expires_at?: string;
      }>(
        supabase,
        "whatsapp-cloud-send-message",
        {
          body: {
            contact_id: contactId,
            body,
          },
        },
      );
      if (sendError) throw new Error(sendError.message);
      updateThreadMessage(
        contactId,
        {
          ...optimisticMessage,
          status: "accepted",
          meta_message_id: data?.meta_message_id || tempMetaMessageId,
        },
        { replaceMetaMessageId: tempMetaMessageId },
      );
      setSendNotice("Mensaje enviado.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "No se pudo enviar el mensaje.";
      updateThreadMessage(
        contactId,
        {
          ...optimisticMessage,
          status: "failed",
          error: message,
        },
        { replaceMetaMessageId: tempMetaMessageId },
      );
      setError(message);
    } finally {
      setSending(false);
    }
  };

  const markAllRead = async () => {
    if (markingAllRead) return;
    setMarkingAllRead(true);
    setError(null);
    setSendNotice(null);
    try {
      const count = await markWhatsappCloudApiThreadsRead(
        workspaceCurrency,
        serverTagFilter,
        dateRange,
      );
      setThreadActionsOpen(false);
      setSendNotice(
        count > 0
          ? `${count} chat${count === 1 ? "" : "s"} marcado${count === 1 ? "" : "s"} como leido${count === 1 ? "" : "s"}.`
          : "No habia chats sin leer.",
      );
      await loadThreads();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudieron marcar los chats como leidos.",
      );
    } finally {
      setMarkingAllRead(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inbox WhatsApp Cloud API"
        description="Conversaciones recibidas desde el numero oficial conectado a Meta."
        actions={
          <div className="relative flex flex-col items-end gap-2">
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className={`col-span-2 ${headerButtonClassName} ${
                  hasGerenciaFilter
                    ? "border-emerald-700 bg-emerald-950/40 text-emerald-300"
                    : ""
                }`}
                onClick={() => {
                  setDraftGerenciaFilter(gerenciaFilter);
                  setGerenciaFilterOpen((value) => !value);
                }}
              >
                <FilterIcon />
                Aplicar filtro
                {hasGerenciaFilter ? (
                  <>
                    <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                      1
                    </span>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setDraftGerenciaFilter("");
                        setGerenciaFilter("");
                        setGerenciaFilterOpen(false);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          event.stopPropagation();
                          setDraftGerenciaFilter("");
                          setGerenciaFilter("");
                          setGerenciaFilterOpen(false);
                        }
                      }}
                      className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-red-500/70 bg-red-950/70 text-[10px] font-bold leading-none text-red-200 hover:bg-red-900/80"
                      title="Quitar filtro"
                      aria-label="Quitar filtro"
                    >
                      x
                    </span>
                  </>
                ) : null}
              </button>
              <button
                type="button"
                className={headerButtonClassName}
                onClick={() => void loadThreads()}
                disabled={loading}
              >
                Actualizar
              </button>
              <Link href={basePath} className={headerButtonClassName}>
                Volver
              </Link>
            </div>
            <DateRangeFilter
              onChange={handleDateRangeChange}
              initialPreset="hoy"
            />
            {gerenciaFilterOpen ? (
              <div className="absolute right-0 top-full z-20 mt-2 w-80 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-1)] p-3 text-left shadow-2xl">
                <p className="text-xs font-semibold text-[var(--color-text-muted)]">
                  Gerencia asignada
                </p>
                <div className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-2)] p-1">
                  <button
                    type="button"
                    className={`flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-xs transition hover:bg-zinc-800/70 ${
                      !draftGerenciaFilter
                        ? "bg-emerald-500/10 text-emerald-300"
                        : "text-[var(--color-text)]"
                    }`}
                    onClick={() => setDraftGerenciaFilter("")}
                  >
                    <span>Todas las gerencias</span>
                    {!draftGerenciaFilter ? <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" aria-hidden /> : null}
                  </button>
                  {gerenciaOptions.map((label) => {
                    const selected = draftGerenciaFilter === label;
                    return (
                      <button
                        key={label}
                        type="button"
                        className={`mt-1 flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-xs transition hover:bg-zinc-800/70 ${
                          selected
                            ? "bg-emerald-500/10 text-emerald-300"
                            : "text-[var(--color-text)]"
                        }`}
                        onClick={() => setDraftGerenciaFilter(label)}
                      >
                        <span className="min-w-0 truncate">{label}</span>
                        {selected ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-300" aria-hidden /> : null}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    className={headerButtonClassName}
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
                    className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-emerald-700 bg-emerald-600 px-2 text-[11px] font-semibold text-zinc-950 transition hover:bg-emerald-500 sm:h-7"
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
      {sendNotice ? (
        <div className="ui-alert ui-alert-success text-sm">{sendNotice}</div>
      ) : null}

      <SurfaceCard className="grid h-[38rem] overflow-hidden xl:grid-cols-[20rem_minmax(0,1fr)_18rem]">
        <aside className="flex min-h-0 flex-col border-b border-[var(--color-border-subtle)] xl:border-b-0 xl:border-r">
          <div className="space-y-3 border-b border-[var(--color-border-subtle)] p-4">
            <div className="relative flex h-10 items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-2)] px-3 text-[var(--color-text-muted)]">
              <SearchIcon />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar contacto"
                className="min-w-0 flex-1 bg-transparent text-sm text-[var(--color-text-strong)] outline-none placeholder:text-[var(--color-text-disabled)]"
              />
              <button
                type="button"
                aria-label="Acciones del inbox"
                title="Acciones"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-transparent text-[var(--color-text-muted)] transition hover:border-[var(--color-border-subtle)] hover:bg-[rgba(148,163,184,0.08)] hover:text-[var(--color-text-strong)]"
                onClick={() => setThreadActionsOpen((value) => !value)}
              >
                <MoreVerticalIcon />
              </button>
              {threadActionsOpen ? (
                <div className="absolute right-2 top-11 z-20 w-52 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-1)] p-1.5 shadow-2xl">
                  <button
                    type="button"
                    className="flex w-full items-center rounded-lg px-3 py-2 text-left text-xs font-medium text-[var(--color-text-strong)] transition hover:bg-[rgba(148,163,184,0.08)] disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={markingAllRead}
                    onClick={() => void markAllRead()}
                  >
                    {markingAllRead ? "Marcando..." : "Marcar todos como leidos"}
                  </button>
                </div>
              ) : null}
            </div>
            <div className="scrollbar-none flex gap-2 overflow-x-auto">
              {(
                [
                  "all",
                  "unread",
                  "nuevo",
                  "contacto",
                  "lead",
                  "cargo",
                  "recompra",
                  "premium",
                ] as const
              ).map((tag: InboxFilter) => (
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
                  {tag === "all"
                    ? "Todos"
                    : tag === "unread"
                      ? "No leidos"
                      : TAG_LABELS[tag]}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 max-h-[27.5rem] overflow-y-auto">
            {loading ? (
              <div className="p-4 text-sm text-[var(--color-text-muted)]">
                Cargando conversaciones...
              </div>
            ) : filteredThreads.length === 0 ? (
              <div className="flex h-full items-center justify-center p-6 text-center">
                <div className="max-w-xs">
                  <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--color-primary-soft-border)] bg-[var(--color-primary-soft-bg)] text-[var(--color-primary)]">
                    <EmptyConversationIcon />
                  </span>
                  <p className="mt-4 text-sm font-semibold text-[var(--color-text-strong)]">
                    Sin conversaciones
                  </p>
                  <p className="mt-2 text-xs leading-5 text-[var(--color-text-muted)]">
                    No hay threads para los filtros seleccionados.
                  </p>
                </div>
              </div>
            ) : (
              filteredThreads.map((thread) => {
                const selected =
                  selectedThread?.contact_id === thread.contact_id;
                const unreadCount = Math.max(
                  0,
                  Number(thread.unread_count || 0),
                );
                return (
                  <div
                    key={thread.contact_id}
                    className={`relative border-b border-[var(--color-border-subtle)] transition hover:bg-[rgba(148,163,184,0.06)] ${
                      selected ? "bg-[rgba(148,163,184,0.08)]" : ""
                    }`}
                  >
                    {selected ? (
                      <span className="absolute bottom-0 left-0 top-0 w-1 bg-[var(--color-primary)]" />
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setSelectedId(thread.contact_id)}
                      className="flex w-full gap-3 px-4 py-3 pr-9 text-left"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-bg-2)] text-xs font-semibold text-[var(--color-text-muted)]">
                        {initials(thread.profile_name, thread.wa_id)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-2">
                          <span
                            className={`truncate text-sm text-[var(--color-text-strong)] ${unreadCount > 0 ? "font-bold" : "font-semibold"}`}
                          >
                            {thread.profile_name || thread.wa_id}
                          </span>
                          <span className="flex shrink-0 flex-col items-end gap-1">
                            <span
                              className={`text-[10px] ${unreadCount > 0 ? "font-semibold text-[#25d366]" : "text-[var(--color-text-disabled)]"}`}
                            >
                              {formatTime(
                                thread.last_message_at ||
                                  thread.first_message_at,
                              )}
                            </span>
                            {unreadCount > 0 ? (
                              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#25d366] px-1.5 text-[10px] font-bold leading-none text-[#0b141a]">
                                {unreadCount > 99 ? "99+" : unreadCount}
                              </span>
                            ) : null}
                          </span>
                        </span>
                        <span
                          className={`mt-1 block truncate text-xs ${unreadCount > 0 ? "font-semibold text-[var(--color-text-strong)]" : "text-[var(--color-text-muted)]"}`}
                        >
                          {thread.last_message_text || "Sin mensajes"}
                        </span>
                        <span className="mt-2 flex flex-wrap gap-1.5">
                          <span
                            className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${TAG_CLASSES[thread.tag]}`}
                          >
                            {TAG_LABELS[thread.tag]}
                          </span>
                          {gerenciaFilterLabel(thread) ? (
                            <span
                              className="inline-flex max-w-full rounded-full border border-[var(--color-border-subtle)] bg-[rgba(148,163,184,0.07)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-text-muted)]"
                              title={`Gerencia: ${gerenciaFilterLabel(thread)}`}
                            >
                              <span className="truncate">
                                {gerenciaFilterLabel(thread)}
                              </span>
                            </span>
                          ) : null}
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      aria-label="Ocultar chat"
                      title="Ocultar chat"
                      onClick={() => setThreadToHide(thread)}
                      className="absolute bottom-3 right-3 flex h-4 w-4 items-center justify-center rounded border border-transparent text-[var(--color-text-disabled)] transition hover:border-rose-400/25 hover:bg-rose-400/10 hover:text-rose-200"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                );
              })
            )}
          </div>
          {!loading && threads.length > 0 ? (
            <div className="flex shrink-0 items-center justify-between gap-2 border-t border-[var(--color-border-subtle)] bg-[var(--color-bg-1)] px-3 py-2">
              <span className="text-[10px] font-medium text-[var(--color-text-disabled)]">
                {pageEnd}/{totalThreads}
              </span>
              <span className="flex gap-2">
                <button
                  type="button"
                  className="ui-button ui-button-secondary h-8 px-3 text-xs"
                  onClick={() =>
                    setPageIndex((current) => Math.max(0, current - 1))
                  }
                  disabled={!canGoPrevious || loading}
                >
                  Anterior
                </button>
                <button
                  type="button"
                  className="ui-button ui-button-secondary h-8 px-3 text-xs"
                  onClick={() => setPageIndex((current) => current + 1)}
                  disabled={!canGoNext || loading}
                >
                  Siguiente
                </button>
              </span>
            </div>
          ) : null}
        </aside>

        <section className="flex min-h-[34rem] flex-col border-b border-[var(--color-border-subtle)] xl:border-b-0 xl:border-r">
          {selectedThread ? (
            <>
              <div className="flex items-center justify-between border-b border-[#26343d] bg-[#111b21] px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#2a3942] bg-[#202c33] text-xs font-semibold text-[#aebac1]">
                    {initials(
                      selectedThread.profile_name,
                      selectedThread.wa_id,
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#e9edef]">
                      {selectedThread.profile_name || selectedThread.wa_id}
                    </p>
                    <p className="text-xs text-[#8696a0]">
                      {formatWhatsAppDisplayPhone(
                        selectedThread.phone || selectedThread.wa_id,
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${TAG_CLASSES[selectedThread.tag]}`}
                  >
                    {TAG_LABELS[selectedThread.tag]}
                  </span>
                </div>
              </div>

              <div
                ref={chatScrollRef}
                className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-5 py-5"
                style={WHATSAPP_CHAT_BACKGROUND}
              >
                {selectedMessages.length === 0 ? (
                  <div className="m-auto max-w-sm rounded-xl border border-dashed border-[#2a3942] bg-[#111b21]/90 px-5 py-6 text-center shadow-lg">
                    <p className="text-sm font-semibold text-[#e9edef]">
                      Sin mensajes normalizados
                    </p>
                    <p className="mt-2 text-xs leading-5 text-[#8696a0]">
                      El thread existe, pero no hay mensajes disponibles para
                      mostrar.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="mb-2 self-center rounded-lg bg-[#182229] px-3 py-1 text-[11px] font-medium text-[#8696a0] shadow">
                      {messageDateLabel(
                        selectedMessages[0]?.created_at ?? null,
                      )}
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
                          <p className="whitespace-pre-wrap break-words pr-11">
                            {message.body || "-"}
                          </p>
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
                            {outbound ? (
                              <StatusCheckIcon status={message.status} />
                            ) : null}
                          </span>
                          {message.error ? (
                            <p className="clear-both mt-2 text-[10px] text-rose-300">
                              {message.error}
                            </p>
                          ) : null}
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
                    placeholder={
                      serviceWindowActive
                        ? "Escribir respuesta"
                        : "Ventana de 24 hs no disponible"
                    }
                    maxLength={4096}
                  />
                  <button
                    type="button"
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-[#00a884] text-[#0b141a] transition hover:bg-[#06cf9c] disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={
                      !serviceWindowActive || !manualMessage.trim() || sending
                    }
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
                <p className="text-sm font-semibold text-[var(--color-text-strong)]">
                  Selecciona una conversacion
                </p>
                <p className="mt-2 text-xs leading-5 text-[var(--color-text-muted)]">
                  El detalle se muestra al seleccionar un thread.
                </p>
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
                <p className="mt-3 text-sm font-semibold text-[var(--color-text-strong)]">
                  {selectedThread.profile_name || selectedThread.wa_id}
                </p>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                  {formatWhatsAppDisplayPhone(
                    selectedThread.phone || selectedThread.wa_id,
                  )}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-2)] p-3">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-disabled)]">
                    Cargas
                  </p>
                  <p className="mt-1 text-lg font-semibold text-[var(--color-text-strong)]">
                    {selectedThread.purchase_count}
                  </p>
                </div>
                <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-2)] p-3">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-disabled)]">
                    Total
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[var(--color-primary)]">
                    {formatMoney(selectedThread.total_loaded)}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-disabled)]">
                  Derivacion
                </p>
                <div className="mt-3 space-y-2 text-xs">
                  <InfoRow
                    label="Telefono"
                    value={
                      formatWhatsAppDisplayPhone(selectedThread.assigned_phone) || "-"
                    }
                  />
                  <InfoRow
                    label="Gerencia"
                    value={
                      selectedThread.assigned_gerencia_label ||
                      selectedThread.assigned_gerencia_id?.toString() ||
                      "-"
                    }
                  />
                  <InfoRow
                    label="Promo"
                    value={selectedThread.promo_code || "-"}
                  />
                  <InfoRow
                    label="Redireccion"
                    value={
                      selectedThread.redirect_clicked
                        ? `${selectedThread.redirect_click_count} click${selectedThread.redirect_click_count === 1 ? "" : "s"}`
                        : "-"
                    }
                  />
                </div>
              </div>

              {selectedThread.ctwa_clid ||
              selectedThread.source_type ||
              selectedThread.headline ||
              selectedThread.last_purchase_at ? (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-disabled)]">
                    Atribucion
                  </p>
                  <div className="mt-3 space-y-2 text-xs">
                    {selectedThread.ctwa_clid ? (
                      <InfoRow
                        label="ctwa_clid"
                        value={selectedThread.ctwa_clid}
                        mono
                      />
                    ) : null}
                    {selectedThread.source_type ? (
                      <InfoRow
                        label="Tipo anuncio"
                        value={selectedThread.source_type}
                      />
                    ) : null}
                    {selectedThread.headline ? (
                      <InfoRow
                        label="Titulo anuncio"
                        value={selectedThread.headline}
                      />
                    ) : null}
                    {selectedThread.last_purchase_at ? (
                      <InfoRow
                        label="Ultima carga"
                        value={formatDateTime(selectedThread.last_purchase_at)}
                      />
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-[var(--color-text-muted)]">
              Sin thread seleccionado.
            </p>
          )}
        </aside>
      </SurfaceCard>

      <ModalShell
        open={Boolean(threadToHide)}
        title="Ocultar chat"
        description={
          threadToHide
            ? `${threadToHide.profile_name || threadToHide.wa_id} se quitara de esta vista. No se elimina de la base de datos.`
            : undefined
        }
        onClose={() => setThreadToHide(null)}
        width="sm"
        footer={
          <>
            <button
              type="button"
              className="ui-button ui-button-secondary"
              onClick={() => setThreadToHide(null)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="ui-button ui-button-danger"
              onClick={hideThreadFromUi}
            >
              Ocultar
            </button>
          </>
        }
      >
        {null}
      </ModalShell>
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-[var(--color-border-subtle)] bg-[rgba(255,255,255,0.02)] px-3 py-2">
      <span className="shrink-0 text-[var(--color-text-muted)]">{label}</span>
      <span
        className={`min-w-0 break-words text-right font-medium text-[var(--color-text-strong)] ${mono ? "font-mono text-[10px]" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}
