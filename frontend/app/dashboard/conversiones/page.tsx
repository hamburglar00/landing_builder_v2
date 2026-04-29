"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import {
  fetchConversionsConfig,
  upsertConversionsConfig,
  fetchPixelConfigs,
  upsertPixelConfig,
  deletePixelConfig,
  fetchConversionsFiltered,
  fetchFunnelContactsFiltered,
  fetchConversionLogsFiltered,
  fetchConversionInbox,
  updateConversionEmail,
  hideConversions,
  hideConversionLogs,
  type ConversionsConfig,
  type PixelConfig,
  type ConversionRow,
  type ConversionLogRow,
  type ConversionInboxRow,
  type FunnelContact,
} from "@/lib/conversionsDb";
import FunnelBoard from "@/components/conversiones/FunnelBoard";
import TrackingBoard from "@/components/conversiones/TrackingBoard";
import StatsPanel from "@/components/conversiones/StatsPanel";
import DateRangeFilter, {
  type DateRange,
  filterByDateRange,
  filterFunnelByDateRange,
} from "@/components/conversiones/DateRangeFilter";

type Tab = "funnel" | "seguimiento" | "tabla" | "estadisticas" | "configuracion" | "inbox" | "logs";
type PixelEditDraft = {
  id: string;
  pixel_id: string;
  meta_access_token: string;
  meta_currency: string;
  meta_api_version: string;
  send_contact_capi: boolean;
  geo_use_ipapi: boolean;
  geo_fill_only_when_missing: boolean;
  is_default: boolean;
};

const TAB_ORDER_BASE: Tab[] = ["funnel", "tabla", "estadisticas", "configuracion"];

const TAB_LABELS: Record<Tab, string> = {
  funnel: "Funnel",
  seguimiento: "Seguimiento",
  tabla: "Tabla",
  estadisticas: "Estadisticas",
  configuracion: "Configuracion",
  inbox: "Inbox",
  logs: "Logs",
};

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-4 w-4 text-zinc-400 transition-transform ${open ? "rotate-90" : ""}`}
      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  );
}

function FunnelTabIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h18l-7 8v5l-4 2v-7L3 5z" />
    </svg>
  );
}

function TrackingTabIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 19h16M7 15l3-3 3 2 4-5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 10h2v2" />
    </svg>
  );
}

function TableTabIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18M9 5v14M15 5v14" />
    </svg>
  );
}

function StatsTabIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 19h16" />
      <rect x="6" y="11" width="3" height="6" rx="1" />
      <rect x="11" y="8" width="3" height="9" rx="1" />
      <rect x="16" y="5" width="3" height="12" rx="1" />
    </svg>
  );
}

function GearTabIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.8 1.8 0 0 0 .37 2l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.8 1.8 0 0 0-2-.37 1.8 1.8 0 0 0-1 1.62V21a2 2 0 1 1-4 0v-.09a1.8 1.8 0 0 0-1-1.62 1.8 1.8 0 0 0-2 .37l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.8 1.8 0 0 0 .37-2 1.8 1.8 0 0 0-1.62-1H3a2 2 0 0 1 0-4h.09a1.8 1.8 0 0 0 1.62-1 1.8 1.8 0 0 0-.37-2l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.8 1.8 0 0 0 2 .37H9A1.8 1.8 0 0 0 10 3.09V3a2 2 0 1 1 4 0v.09a1.8 1.8 0 0 0 1 1.62 1.8 1.8 0 0 0 2-.37l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.8 1.8 0 0 0-.37 2V11c0 .74.42 1.4 1.1 1.73" />
    </svg>
  );
}

function LogsTabIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17h6M9 13h6M9 9h6" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 3h8l4 4v14H7a2 2 0 01-2-2V5a2 2 0 012-2z" />
    </svg>
  );
}

function InboxTabIcon() {
  return (
    <svg className="h-3.5 w-3.5 overflow-visible" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h13A2.5 2.5 0 0 1 21 7.5v9A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5v-9Z" />
      <path d="M3 14h4.6l1.8 2h5.2l1.8-2H21" />
    </svg>
  );
}

function estadoBadge(estado: string, isRepeat = false) {
  const cls =
    estado === "purchase" && isRepeat
      ? "bg-violet-950 text-violet-300"
      : estado === "purchase"
        ? "bg-rose-950 text-rose-300"
        : estado === "lead"
          ? "bg-amber-950 text-amber-300"
          : "bg-zinc-800 text-zinc-400";
  return <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium whitespace-nowrap ${cls}`}>{estado === "purchase" && isRepeat ? "purchase repeat" : estado}</span>;
}

function statusText(status: string) {
  if (status === "enviado") return <span className="text-emerald-400">enviado</span>;
  if (status === "error") return <span className="text-red-400">error</span>;
  return <span className="text-zinc-600">-</span>;
}

function levelBadge(level: string, functionName?: string, message?: string) {
  const cls =
    level === "ERROR"
      ? "bg-red-950 text-red-300"
      : level === "DEBUG"
        ? "bg-zinc-800 text-zinc-500"
        : "bg-blue-950 text-blue-300";
  const msg = String(message ?? "").toLowerCase();
  const fn = String(functionName ?? "").toLowerCase();
  const event = fn.includes("handlecontact") ? "CONTACT"
    : fn.includes("handlelead") ? "LEAD"
    : fn.includes("handlepurchase") || fn.includes("handlesimplepurchase") ? "PURCHASE"
    : (
      msg.includes("contact") ? "CONTACT" :
      msg.includes("lead") ? "LEAD" :
      msg.includes("purchase") || msg.includes("compra") || msg.includes("recarga") ? "PURCHASE" :
      null
    );
  const text = level === "ERROR"
    ? (event ? `ERROR / ${event}` : "ERROR")
    : (event ?? level);
  return <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${cls}`}>{text}</span>;
}

function truncateId(id: string, len = 8) {
  if (!id) return "-";
  return id.length > len ? id.slice(0, len) + "..." : id;
}

function truncateText(value: string, len = 35) {
  if (!value) return "-";
  return value.length > len ? value.slice(0, len) + "..." : value;
}

function formatIntegerWithThousands(value: number) {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(
    Math.max(0, Math.trunc(value || 0)),
  );
}

function normalizePhone(value: string | null | undefined): string {
  return String(value ?? "").replace(/\D/g, "");
}

function normalizeSexValue(value: unknown): string {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return "";
  if (raw === "m" || raw === "male" || raw === "masculino" || raw === "hombre") return "male";
  if (raw === "f" || raw === "female" || raw === "femenino" || raw === "mujer") return "female";
  return "unknown";
}

function todayRange(): DateRange {
  const now = new Date();
  return {
    start: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
    end: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999),
  };
}

function sexLabel(value: string): string {
  if (value === "male") return "Masculino";
  if (value === "female") return "Femenino";
  return "Sin inferir";
}

const ALL_COLUMNS = [
  "phone","email","fn","ln","ct","st","zip","country","fbp","fbc","from_meta_ads","meta_pixel_id","pixel_id","source_platform",
  "contact_event_id","contact_event_time","sendContactPixel","contact_payload_raw","lead_event_id","lead_event_time","lead_payload_raw",
  "purchase_event_id","purchase_event_time","purchase_payload_raw","timestamp","clientIP","agentuser",
  "estado","valor","purchase_type","contact_status_capi","lead_status_capi","purchase_status_capi",
  "observaciones","external_id","test_event_code","utm_campaign","telefono_asignado","promo_code",
  "device_type","geo_city","geo_region","geo_country","geo_source",
  "cuit_cuil","inferred_sex","sex_source",
] as const;

type ColKey = (typeof ALL_COLUMNS)[number];

const COLUMN_NOTES: Partial<Record<ColKey | "id", string>> = {
  id: "ID interno de la fila de conversion en la tabla.",
  timestamp: "Fecha y hora de creacion de la fila (created_at).",
  phone: "Telefono recibido en payload (normalizado a digitos). Puede actualizarse con LEAD/PURCHASE.",
  email: "Email recibido en payload.",
  cuit_cuil: "CUIT/CUIL recibido en payload (normalizado a digitos).",
  inferred_sex: "Sexo inferido desde prefijo CUIT/CUIL: 20/23=male, 27=female, resto=unknown.",
  sex_source: "Origen del sexo inferido: cuit_cuil, name_catalog o unknown.",
  fn: "Nombre (first name) recibido en payload.",
  ln: "Apellido (last name) recibido en payload.",
  ct: "Ciudad recibida en payload o enriquecida por geolocalizacion.",
  st: "Provincia/estado recibido en payload o enriquecido por geolocalizacion.",
  zip: "Codigo postal recibido en payload o enriquecido por geolocalizacion.",
  country: "Pais recibido en payload o enriquecido por geolocalizacion.",
  fbp: "Parametro fbp de Meta enviado por la fuente.",
  fbc: "Parametro fbc de Meta enviado por la fuente.",
  from_meta_ads: "Indica origen probable en Meta Ads. True cuando la fila trae fbc o, en fallback, promo_code valido (TAG-SUFIX).",
  geo_source: "Fuente usada para completar geo: payload, ip, phone_prefix o none.",
  meta_pixel_id: "Pixel ID recibido en el payload de entrada (landing/chatrace/backend).",
  pixel_id: "Pixel ID efectivo usado para CAPI. Si falta meta_pixel_id, puede resolverse por fallback de configuracion.",
  source_platform: "Origen declarado del payload (ej: landing, chatrace).",
  contact_event_id: "Event ID del Contact (dedupe Pixel/CAPI).",
  contact_event_time: "Event time (unix) del Contact.",
  sendContactPixel: "Bandera enviada por la fuente para indicar si Contact tambien salio por Pixel browser.",
  contact_payload_raw: "Payload crudo recibido para Contact (trazabilidad).",
  lead_event_id: "Event ID del Lead enviado por CAPI.",
  lead_event_time: "Event time (unix) del Lead.",
  lead_payload_raw: "Payload crudo recibido para action=LEAD (trazabilidad).",
  purchase_event_id: "Event ID del Purchase enviado por CAPI.",
  purchase_event_time: "Event time (unix) del Purchase.",
  purchase_payload_raw: "Payload crudo recibido para action=PURCHASE (trazabilidad).",
  clientIP: "IP recibida en payload (clientIP/client_ip_address).",
  agentuser: "User-Agent recibido en payload (agentuser/client_user_agent).",
  estado: "Estado actual de la conversion (contact, lead o purchase).",
  valor: "Monto de compra/carga recibido para Purchase.",
  purchase_type: "Tipo de compra: first (primera) o repeat (recompra).",
  contact_status_capi: "Resultado de envio CAPI para Contact.",
  lead_status_capi: "Resultado de envio CAPI para Lead.",
  purchase_status_capi: "Resultado de envio CAPI para Purchase.",
  observaciones: "Notas internas de procesamiento (tokens de estado/error).",
  external_id: "ID externo de usuario/contacto para matching en Meta (hasheado al enviar).",
  test_event_code: "Codigo de test de Meta (si se envio en modo prueba).",
  utm_campaign: "UTM campaign recibida en payload.",
  telefono_asignado: "Telefono de destino asignado para derivacion (landing/chatrace).",
  promo_code: "Codigo de promo/track para matchear Contact->Lead->Purchase.",
  device_type: "Tipo de dispositivo reportado por la fuente (mobile/tablet/desktop).",
  geo_city: "Ciudad enriquecida por geolocalizacion IP.",
  geo_region: "Region/provincia enriquecida por geolocalizacion IP.",
  geo_country: "Pais enriquecido por geolocalizacion IP.",
};

function normalizeVisibleColumnName(col: string): string {
  switch (col) {
    case "send_contact_pixel":
      return "sendContactPixel";
    case "client_ip":
      return "clientIP";
    case "agent_user":
      return "agentuser";
    default:
      return col;
  }
}

function EditableEmailCell({ row, onSaved }: { row: ConversionRow; onSaved: (id: string, email: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(row.email);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const trimmed = value.trim();
    if (trimmed === row.email) { setEditing(false); return; }
    setSaving(true);
    try { await updateConversionEmail(row.id, trimmed); onSaved(row.id, trimmed); }
    catch { setValue(row.email); }
    finally { setSaving(false); setEditing(false); }
  };

  if (editing) {
    return (
      <td className="px-1 py-0.5">
        <input autoFocus type="email" value={value}
          onChange={(e) => setValue(e.target.value)} onBlur={save}
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") { setValue(row.email); setEditing(false); } }}
          disabled={saving}
          className="w-full min-w-[140px] rounded border border-zinc-600 bg-zinc-900 px-1.5 py-0.5 text-[11px] text-zinc-100 outline-none focus:border-zinc-400" />
      </td>
    );
  }

  return (
    <td className="px-2 py-1.5 whitespace-nowrap text-zinc-400 cursor-pointer hover:text-zinc-200 group"
      onClick={() => { setValue(row.email); setEditing(true); }} title="Click para editar email">
      {row.email || <span className="text-zinc-600 group-hover:text-zinc-400">+ email</span>}
    </td>
  );
}

function cellValue(c: ConversionRow, col: ColKey): React.ReactNode {
  const cell = "px-2 py-1.5 whitespace-nowrap";
  const mono = `${cell} font-mono`;
  const dim = `${cell} text-zinc-400`;
  const dimMono = `${dim} font-mono`;
  const tip = (v: unknown) => String(v ?? "-") || "-";
  const tipRawJson = (v: unknown) => {
    const s = String(v ?? "").trim();
    if (!s) return "-";
    try { return JSON.stringify(JSON.parse(s), null, 2); } catch { return s; }
  };
  const timestampText = new Date(c.created_at).toLocaleString("es-AR", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  });

  switch (col) {
    case "phone": return <td key={col} className={`${mono} text-zinc-200`} title={tip(c.phone)}>{c.phone || "-"}</td>;
    case "email": return <td key={col} className={dim} title={tip(c.email)}>{c.email || "-"}</td>;
    case "cuit_cuil": return <td key={col} className={dimMono} title={tip(c.cuit_cuil)}>{c.cuit_cuil || "-"}</td>;
    case "inferred_sex": return <td key={col} className={dim} title={tip(c.inferred_sex)}>{c.inferred_sex || "-"}</td>;
    case "sex_source": return <td key={col} className={dim} title={tip(c.sex_source)}>{c.sex_source || "-"}</td>;
    case "fn": return <td key={col} className={dim} title={tip(c.fn)}>{c.fn || "-"}</td>;
    case "ln": return <td key={col} className={dim} title={tip(c.ln)}>{c.ln || "-"}</td>;
    case "ct": return <td key={col} className={dim} title={tip(c.ct)}>{c.ct || "-"}</td>;
    case "st": return <td key={col} className={dim} title={tip(c.st)}>{c.st || "-"}</td>;
    case "zip": return <td key={col} className={dim} title={tip(c.zip)}>{c.zip || "-"}</td>;
    case "country": return <td key={col} className={dim} title={tip(c.country)}>{c.country || "-"}</td>;
    case "fbp": return <td key={col} className={dimMono} title={tip(c.fbp)}>{c.fbp ? truncateId(c.fbp, 12) : "-"}</td>;
    case "fbc": return <td key={col} className={dimMono} title={tip(c.fbc)}>{c.fbc ? truncateId(c.fbc, 12) : "-"}</td>;
    case "from_meta_ads":
      return <td key={col} className={dim} title={tip(c.from_meta_ads)}>{c.from_meta_ads ? "true" : "false"}</td>;
    case "geo_source": return <td key={col} className={dim} title={tip(c.geo_source)}>{c.geo_source || "-"}</td>;
    case "meta_pixel_id": {
      const px = c.meta_pixel_id || c.pixel_id;
      return <td key={col} className={dimMono} title={tip(px)}>{px || "-"}</td>;
    }
    case "pixel_id": return <td key={col} className={dimMono} title={tip(c.pixel_id)}>{c.pixel_id || "-"}</td>;
    case "source_platform": return <td key={col} className={dim} title={tip(c.source_platform)}>{c.source_platform || "-"}</td>;
    case "contact_event_id": return <td key={col} className={dimMono} title={c.contact_event_id}>{truncateId(c.contact_event_id)}</td>;
    case "contact_event_time": return <td key={col} className={dim} title={tip(c.contact_event_time)}>{c.contact_event_time ?? "-"}</td>;
    case "sendContactPixel": return <td key={col} className={dim} title={tip(c.sendContactPixel)}>{c.sendContactPixel ? "true" : "false"}</td>;
    case "contact_payload_raw": return <td key={col} className={`${dim} max-w-[220px] truncate`} title={tipRawJson(c.contact_payload_raw)}>{truncateText(c.contact_payload_raw || "-", 35)}</td>;
    case "lead_event_id": return <td key={col} className={dimMono} title={c.lead_event_id}>{truncateId(c.lead_event_id)}</td>;
    case "lead_event_time": return <td key={col} className={dim} title={tip(c.lead_event_time)}>{c.lead_event_time ?? "-"}</td>;
    case "lead_payload_raw": return <td key={col} className={`${dim} max-w-[220px] truncate`} title={tipRawJson(c.lead_payload_raw)}>{truncateText(c.lead_payload_raw || "-", 35)}</td>;
    case "purchase_event_id": return <td key={col} className={dimMono} title={c.purchase_event_id}>{truncateId(c.purchase_event_id)}</td>;
    case "purchase_event_time": return <td key={col} className={dim} title={tip(c.purchase_event_time)}>{c.purchase_event_time ?? "-"}</td>;
    case "purchase_payload_raw": return <td key={col} className={`${dim} max-w-[220px] truncate`} title={tipRawJson(c.purchase_payload_raw)}>{truncateText(c.purchase_payload_raw || "-", 35)}</td>;
    case "test_event_code": return <td key={col} className={dimMono} title={tip(c.test_event_code)}>{c.test_event_code || "-"}</td>;
    case "timestamp": return <td key={col} className={dim} title={timestampText}>{timestampText}</td>;
    case "clientIP": return <td key={col} className={dimMono} title={tip(c.client_ip)}>{c.client_ip || "-"}</td>;
    case "agentuser": return <td key={col} className={dim} title={c.agent_user || "-"}>{truncateText(c.agent_user || "-", 35)}</td>;
    case "estado": {
      const isRepeat = c.estado === "purchase" && c.observaciones?.includes("REPEAT");
      return <td key={col} className={cell}>{estadoBadge(c.estado, isRepeat)}</td>;
    }
    case "valor": return <td key={col} className={`${cell} text-zinc-200`} title={tip(c.valor)}>{c.valor > 0 ? c.valor : "-"}</td>;
    case "purchase_type": return <td key={col} className={dim} title={tip(c.purchase_type)}>{c.purchase_type || "-"}</td>;
    case "contact_status_capi": return <td key={col} className={cell} title={tip(c.contact_status_capi)}>{statusText(c.contact_status_capi)}</td>;
    case "lead_status_capi": return <td key={col} className={cell} title={tip(c.lead_status_capi)}>{statusText(c.lead_status_capi)}</td>;
    case "purchase_status_capi": return <td key={col} className={cell} title={tip(c.purchase_status_capi)}>{statusText(c.purchase_status_capi)}</td>;
    case "observaciones": return <td key={col} className={`${cell} text-zinc-500 max-w-[200px] truncate`} title={c.observaciones}>{c.observaciones || "-"}</td>;
    case "external_id": return <td key={col} className={dimMono} title={tip(c.external_id)}>{c.external_id ? truncateId(c.external_id) : "-"}</td>;
    case "utm_campaign": return <td key={col} className={dim} title={tip(c.utm_campaign)}>{c.utm_campaign || "-"}</td>;
    case "telefono_asignado": return <td key={col} className={dim} title={tip(c.telefono_asignado)}>{c.telefono_asignado || "-"}</td>;
    case "promo_code": return <td key={col} className={dim} title={tip(c.promo_code)}>{c.promo_code || "-"}</td>;
    case "device_type": return <td key={col} className={dim} title={tip(c.device_type)}>{c.device_type || "-"}</td>;
    case "geo_city": return <td key={col} className={dim} title={tip(c.geo_city)}>{c.geo_city || "-"}</td>;
    case "geo_region": return <td key={col} className={dim} title={tip(c.geo_region)}>{c.geo_region || "-"}</td>;
    case "geo_country": return <td key={col} className={dim} title={tip(c.geo_country)}>{c.geo_country || "-"}</td>;
    default: return <td key={col} className={dim} title="-">-</td>;
  }
}

export default function DashboardConversionesPage() {
  const searchParams = useSearchParams();
  const [userId, setUserId] = useState<string | null>(null);
  const [config, setConfig] = useState<ConversionsConfig | null>(null);
  const [conversions, setConversions] = useState<ConversionRow[]>([]);
  const [funnelContacts, setFunnelContacts] = useState<FunnelContact[]>([]);
  const [logs, setLogs] = useState<ConversionLogRow[]>([]);
  const [inboxRows, setInboxRows] = useState<ConversionInboxRow[]>([]);
  const [clientName, setClientName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [clearMsg, setClearMsg] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("funnel");
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [expandedLog, setExpandedLog] = useState<number | null>(null);
  const [inboxSearch, setInboxSearch] = useState("");
  const [inboxActionFilter, setInboxActionFilter] = useState<"all" | "CONTACT" | "LEAD" | "PURCHASE">("LEAD");
  const [tableSearch, setTableSearch] = useState("");
  const [tablePage, setTablePage] = useState(1);
  const [statsLandingFilter, setStatsLandingFilter] = useState<string>("__all__");
  const [statsPixelFilter, setStatsPixelFilter] = useState<string>("__all__");
  const [statsGerenciaFilter, setStatsGerenciaFilter] = useState<string>("__all__");
  const [statsTelefonoFilter, setStatsTelefonoFilter] = useState<string>("__all__");
  const [statsFromMetaAdsFilter, setStatsFromMetaAdsFilter] = useState<string>("__all__");
  const [statsSourcePlatformFilter, setStatsSourcePlatformFilter] = useState<string>("__all__");
  const [statsSexoFilter, setStatsSexoFilter] = useState<string>("__all__");
  const [statsCampaignFilter, setStatsCampaignFilter] = useState<string[]>([]);
  const [statsDeviceFilter, setStatsDeviceFilter] = useState<string>("__all__");
  const [statsFilterModalOpen, setStatsFilterModalOpen] = useState(false);
  const [draftLandingFilter, setDraftLandingFilter] = useState<string>("__all__");
  const [draftPixelFilter, setDraftPixelFilter] = useState<string>("__all__");
  const [draftGerenciaFilter, setDraftGerenciaFilter] = useState<string>("__all__");
  const [draftTelefonoFilter, setDraftTelefonoFilter] = useState<string>("__all__");
  const [draftFromMetaAdsFilter, setDraftFromMetaAdsFilter] = useState<string>("__all__");
  const [draftSourcePlatformFilter, setDraftSourcePlatformFilter] = useState<string>("__all__");
  const [draftSexoFilter, setDraftSexoFilter] = useState<string>("__all__");
  const [draftCampaignFilter, setDraftCampaignFilter] = useState<string[]>([]);
  const [draftDeviceFilter, setDraftDeviceFilter] = useState<string>("__all__");
  const [gerenciaByPhone, setGerenciaByPhone] = useState<Record<string, string[]>>({});

  const [dateRange, setDateRange] = useState<DateRange | null>(todayRange());
  const [refreshingTable, setRefreshingTable] = useState(false);
  const [hidingTable, setHidingTable] = useState(false);
  const [hidingFunnel, setHidingFunnel] = useState(false);
  const [hidingStats, setHidingStats] = useState(false);
  const [hidingLogs, setHidingLogs] = useState(false);
  const hasSyncedDateRangeOnceRef = useRef(false);
  const initialDateRangeRef = useRef<DateRange | null>(dateRange);

  useEffect(() => {
    const view = (searchParams.get("view") || "").toLowerCase();
    const tabParam = (searchParams.get("tab") || "").toLowerCase();
    if (tabParam === "configuracion") {
      setTab("configuracion");
      return;
    }
    if (view === "seguimiento") {
      setTab("seguimiento");
    }
  }, [searchParams]);

  const [configOpen, setConfigOpen] = useState(false);
  const [endpointOpen, setEndpointOpen] = useState(false);
  const [funnelConfigOpen, setFunnelConfigOpen] = useState(false);
  const [editingPixelId, setEditingPixelId] = useState<string | null>(null);
  const [pixelEditOpen, setPixelEditOpen] = useState(false);
  const [pixelEditDraft, setPixelEditDraft] = useState<PixelEditDraft | null>(null);
  const [pixelDeleteWarn, setPixelDeleteWarn] = useState<{
    pixelId: string;
    landings: Array<{ id: string; name: string }>;
  } | null>(null);
  const [editPixelId, setEditPixelId] = useState(false);
  const [editAccessToken, setEditAccessToken] = useState(false);
  const [pixelConfigs, setPixelConfigs] = useState<PixelConfig[]>([]);

  const activeConversions = useMemo(() => filterByDateRange(conversions, dateRange), [conversions, dateRange]);
  const activeFunnel = useMemo(() => filterFunnelByDateRange(funnelContacts, dateRange), [funnelContacts, dateRange]);
  const activeLogs = useMemo(() => filterByDateRange(logs, dateRange), [logs, dateRange]);
  const activeInbox = useMemo(() => filterByDateRange(inboxRows, dateRange), [inboxRows, dateRange]);
  const statsConversions = useMemo(
    () => activeConversions.filter((r) => !String(r.test_event_code ?? "").trim()),
    [activeConversions],
  );
  const statsAllConversions = useMemo(
    () => conversions.filter((r) => !String(r.test_event_code ?? "").trim()),
    [conversions],
  );
  const statsLandingOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of statsAllConversions) {
      const name = String(r.landing_name ?? "").trim();
      if (name) set.add(name);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  }, [statsAllConversions]);
  const statsPixelOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of statsAllConversions) {
      const px = String(r.meta_pixel_id ?? r.pixel_id ?? "").trim();
      if (px) set.add(px);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [statsAllConversions]);
  const statsTelefonoOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of statsAllConversions) {
      const phone = normalizePhone(r.telefono_asignado);
      if (phone) set.add(phone);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [statsAllConversions]);
  const statsGerenciaOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of statsAllConversions) {
      const phone = normalizePhone(r.telefono_asignado);
      if (!phone) continue;
      const labels = gerenciaByPhone[phone] ?? [];
      for (const label of labels) set.add(label);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  }, [statsAllConversions, gerenciaByPhone]);
  const statsSourcePlatformOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of statsAllConversions) {
      const src = String(r.source_platform ?? "").trim().toLowerCase();
      if (src) set.add(src);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  }, [statsAllConversions]);
  const statsSexoOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of statsAllConversions) {
      const sex = normalizeSexValue((r as { inferred_sex?: string | null }).inferred_sex);
      if (sex) set.add(sex);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  }, [statsAllConversions]);
  const statsCampaignOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of statsAllConversions) {
      const campaign = String(r.utm_campaign ?? "").trim();
      if (campaign) set.add(campaign);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  }, [statsAllConversions]);
  const statsDeviceOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of statsAllConversions) {
      const device = String(r.device_type ?? "").trim().toLowerCase();
      if (device) set.add(device);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  }, [statsAllConversions]);
  useEffect(() => {
    if (statsLandingFilter !== "__all__" && !statsLandingOptions.includes(statsLandingFilter)) {
      setStatsLandingFilter("__all__");
    }
  }, [statsLandingFilter, statsLandingOptions]);
  useEffect(() => {
    if (statsPixelFilter !== "__all__" && !statsPixelOptions.includes(statsPixelFilter)) {
      setStatsPixelFilter("__all__");
    }
  }, [statsPixelFilter, statsPixelOptions]);
  useEffect(() => {
    if (statsGerenciaFilter !== "__all__" && !statsGerenciaOptions.includes(statsGerenciaFilter)) {
      setStatsGerenciaFilter("__all__");
    }
  }, [statsGerenciaFilter, statsGerenciaOptions]);
  useEffect(() => {
    if (statsTelefonoFilter !== "__all__" && !statsTelefonoOptions.includes(statsTelefonoFilter)) {
      setStatsTelefonoFilter("__all__");
    }
  }, [statsTelefonoFilter, statsTelefonoOptions]);
  useEffect(() => {
    if (statsSourcePlatformFilter !== "__all__" && !statsSourcePlatformOptions.includes(statsSourcePlatformFilter)) {
      setStatsSourcePlatformFilter("__all__");
    }
  }, [statsSourcePlatformFilter, statsSourcePlatformOptions]);
  useEffect(() => {
    if (statsSexoFilter !== "__all__" && !statsSexoOptions.includes(statsSexoFilter)) {
      setStatsSexoFilter("__all__");
    }
  }, [statsSexoFilter, statsSexoOptions]);
  useEffect(() => {
    const validCampaigns = statsCampaignFilter.filter((campaign) => statsCampaignOptions.includes(campaign));
    if (validCampaigns.length !== statsCampaignFilter.length) {
      setStatsCampaignFilter(validCampaigns);
    }
  }, [statsCampaignFilter, statsCampaignOptions]);
  useEffect(() => {
    if (statsDeviceFilter !== "__all__" && !statsDeviceOptions.includes(statsDeviceFilter)) {
      setStatsDeviceFilter("__all__");
    }
  }, [statsDeviceFilter, statsDeviceOptions]);
  const statsConversionsFiltered = useMemo(() => {
    return statsConversions.filter((r) => {
      const byLanding = statsLandingFilter === "__all__" || String(r.landing_name ?? "").trim() === statsLandingFilter;
      const byPixel = statsPixelFilter === "__all__" || String(r.meta_pixel_id ?? r.pixel_id ?? "").trim() === statsPixelFilter;
      const assignedPhone = normalizePhone(r.telefono_asignado);
      const byTelefono = statsTelefonoFilter === "__all__" || assignedPhone === statsTelefonoFilter;
      const labels = assignedPhone ? (gerenciaByPhone[assignedPhone] ?? []) : [];
      const byGerencia = statsGerenciaFilter === "__all__" || labels.includes(statsGerenciaFilter);
      const byFromMetaAds =
        statsFromMetaAdsFilter === "__all__" ||
        (statsFromMetaAdsFilter === "true" ? !!r.from_meta_ads : !r.from_meta_ads);
      const bySourcePlatform =
        statsSourcePlatformFilter === "__all__" ||
        String(r.source_platform ?? "").trim().toLowerCase() === statsSourcePlatformFilter;
      const bySexo =
        statsSexoFilter === "__all__" ||
        normalizeSexValue((r as { inferred_sex?: string | null }).inferred_sex) === statsSexoFilter;
      const byCampaign = statsCampaignFilter.length === 0 || statsCampaignFilter.includes(String(r.utm_campaign ?? "").trim());
      const byDevice = statsDeviceFilter === "__all__" || String(r.device_type ?? "").trim().toLowerCase() === statsDeviceFilter;
      return byLanding && byPixel && byGerencia && byTelefono && byFromMetaAds && bySourcePlatform && bySexo && byCampaign && byDevice;
    });
  }, [statsConversions, statsLandingFilter, statsPixelFilter, statsGerenciaFilter, statsTelefonoFilter, statsFromMetaAdsFilter, statsSourcePlatformFilter, statsSexoFilter, statsCampaignFilter, statsDeviceFilter, gerenciaByPhone]);
  const statsAllConversionsFiltered = useMemo(() => {
    return statsAllConversions.filter((r) => {
      const byLanding = statsLandingFilter === "__all__" || String(r.landing_name ?? "").trim() === statsLandingFilter;
      const byPixel = statsPixelFilter === "__all__" || String(r.meta_pixel_id ?? r.pixel_id ?? "").trim() === statsPixelFilter;
      const assignedPhone = normalizePhone(r.telefono_asignado);
      const byTelefono = statsTelefonoFilter === "__all__" || assignedPhone === statsTelefonoFilter;
      const labels = assignedPhone ? (gerenciaByPhone[assignedPhone] ?? []) : [];
      const byGerencia = statsGerenciaFilter === "__all__" || labels.includes(statsGerenciaFilter);
      const byFromMetaAds =
        statsFromMetaAdsFilter === "__all__" ||
        (statsFromMetaAdsFilter === "true" ? !!r.from_meta_ads : !r.from_meta_ads);
      const bySourcePlatform =
        statsSourcePlatformFilter === "__all__" ||
        String(r.source_platform ?? "").trim().toLowerCase() === statsSourcePlatformFilter;
      const bySexo =
        statsSexoFilter === "__all__" ||
        normalizeSexValue((r as { inferred_sex?: string | null }).inferred_sex) === statsSexoFilter;
      const byCampaign = statsCampaignFilter.length === 0 || statsCampaignFilter.includes(String(r.utm_campaign ?? "").trim());
      const byDevice = statsDeviceFilter === "__all__" || String(r.device_type ?? "").trim().toLowerCase() === statsDeviceFilter;
      return byLanding && byPixel && byGerencia && byTelefono && byFromMetaAds && bySourcePlatform && bySexo && byCampaign && byDevice;
    });
  }, [statsAllConversions, statsLandingFilter, statsPixelFilter, statsGerenciaFilter, statsTelefonoFilter, statsFromMetaAdsFilter, statsSourcePlatformFilter, statsSexoFilter, statsCampaignFilter, statsDeviceFilter, gerenciaByPhone]);
  const filteredPhoneSet = useMemo(
    () => new Set(
      statsConversionsFiltered
        .map((r) => String(r.phone ?? "").trim())
        .filter(Boolean),
    ),
    [statsConversionsFiltered],
  );
  const activeFunnelFiltered = useMemo(() => {
    return activeFunnel.filter((r) => {
      const byLanding = statsLandingFilter === "__all__" || String(r.landing_name ?? "").trim() === statsLandingFilter;
      const byPhone = filteredPhoneSet.has(String(r.phone ?? "").trim());
      return byLanding && byPhone;
    });
  }, [activeFunnel, statsLandingFilter, filteredPhoneSet]);
  const tableConversionsFiltered = useMemo(() => {
    return activeConversions.filter((r) => {
      const byLanding = statsLandingFilter === "__all__" || String(r.landing_name ?? "").trim() === statsLandingFilter;
      const byPixel = statsPixelFilter === "__all__" || String(r.meta_pixel_id ?? r.pixel_id ?? "").trim() === statsPixelFilter;
      const assignedPhone = normalizePhone(r.telefono_asignado);
      const byTelefono = statsTelefonoFilter === "__all__" || assignedPhone === statsTelefonoFilter;
      const labels = assignedPhone ? (gerenciaByPhone[assignedPhone] ?? []) : [];
      const byGerencia = statsGerenciaFilter === "__all__" || labels.includes(statsGerenciaFilter);
      const byFromMetaAds =
        statsFromMetaAdsFilter === "__all__" ||
        (statsFromMetaAdsFilter === "true" ? !!r.from_meta_ads : !r.from_meta_ads);
      const bySourcePlatform =
        statsSourcePlatformFilter === "__all__" ||
        String(r.source_platform ?? "").trim().toLowerCase() === statsSourcePlatformFilter;
      const bySexo =
        statsSexoFilter === "__all__" ||
        normalizeSexValue((r as { inferred_sex?: string | null }).inferred_sex) === statsSexoFilter;
      const byCampaign = statsCampaignFilter.length === 0 || statsCampaignFilter.includes(String(r.utm_campaign ?? "").trim());
      const byDevice = statsDeviceFilter === "__all__" || String(r.device_type ?? "").trim().toLowerCase() === statsDeviceFilter;
      return byLanding && byPixel && byGerencia && byTelefono && byFromMetaAds && bySourcePlatform && bySexo && byCampaign && byDevice;
    });
  }, [activeConversions, statsLandingFilter, statsPixelFilter, statsGerenciaFilter, statsTelefonoFilter, statsFromMetaAdsFilter, statsSourcePlatformFilter, statsSexoFilter, statsCampaignFilter, statsDeviceFilter, gerenciaByPhone]);
  const filteredConversions = useMemo(() => {
    const q = tableSearch.trim().toLowerCase();
    if (!q) return tableConversionsFiltered;
    const conditionalMatch = q.match(/^valor\s*(>=|<=|>|<|==|=)\s*([-+]?[\d.,\s]+)$/i);
    if (conditionalMatch) {
      const op = conditionalMatch[1];
      const raw = conditionalMatch[2] ?? "";
      const normalizedDigits = raw.replace(/[^\d-]/g, "");
      const target = Number(normalizedDigits);
      if (Number.isFinite(target)) {
        return tableConversionsFiltered.filter((c) => {
          const value = Number(c.valor ?? 0);
          if (!Number.isFinite(value)) return false;
          if (op === ">") return value > target;
          if (op === ">=") return value >= target;
          if (op === "<") return value < target;
          if (op === "<=") return value <= target;
          return value === target;
        });
      }
    }
    return tableConversionsFiltered.filter((c) => {
      const hay = [
        c.phone,
        c.email,
        c.promo_code,
        c.external_id,
        c.utm_campaign,
        c.telefono_asignado,
        c.landing_name,
        c.estado,
        c.purchase_type,
        c.meta_pixel_id,
        c.pixel_id,
        c.source_platform,
        c.device_type,
        c.fn,
        c.ln,
        c.ct,
        c.st,
        c.country,
        c.geo_city,
        c.geo_region,
        c.geo_country,
        c.contact_event_id,
        c.lead_event_id,
        c.purchase_event_id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [tableConversionsFiltered, tableSearch]);
  const filteredInbox = useMemo(() => {
    const q = inboxSearch.trim().toLowerCase();
    const byAction = activeInbox.filter((r) =>
      inboxActionFilter === "all" ? true : String(r.action ?? "").toUpperCase() === inboxActionFilter,
    );
    if (!q) return byAction;
    return byAction.filter((r) => {
      const hay = [
        r.action,
        r.status,
        r.promo_code,
        r.phone,
        r.action_event_id ?? "",
        r.response_body,
        r.landing_name,
        r.payload_raw,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [activeInbox, inboxSearch, inboxActionFilter]);
  const tablePageSize = 50;
  const totalTablePages = Math.max(1, Math.ceil(filteredConversions.length / tablePageSize));
  const pagedConversions = useMemo(() => {
    const start = (tablePage - 1) * tablePageSize;
    return filteredConversions.slice(start, start + tablePageSize);
  }, [filteredConversions, tablePage]);
  useEffect(() => {
    setTablePage(1);
  }, [tableSearch, dateRange, statsLandingFilter, statsPixelFilter, statsGerenciaFilter, statsTelefonoFilter, statsFromMetaAdsFilter, statsSourcePlatformFilter, statsSexoFilter, statsCampaignFilter, statsDeviceFilter]);
  useEffect(() => {
    if (tablePage > totalTablePages) setTablePage(totalTablePages);
  }, [tablePage, totalTablePages]);

  const visibleCols = useMemo(() => {
    const cols = (config?.visible_columns ?? []).map((c) =>
      normalizeVisibleColumnName(String(c)),
    );
    const valid = cols.filter((c): c is ColKey =>
      (ALL_COLUMNS as readonly string[]).includes(c),
    );
    // Fallback defensivo: si por algun motivo quedaron columnas legacy/invalidas,
    // mostramos el set completo para no dejar la tabla "vacia".
    return new Set<ColKey>(valid.length > 0 ? valid : [...ALL_COLUMNS]);
  }, [config]);
  const displayedCols = useMemo(
    () => ALL_COLUMNS.filter((c) => visibleCols.has(c)),
    [visibleCols],
  );
  const displayedColsWithoutTimestamp = useMemo(
    () => displayedCols.filter((c) => c !== "timestamp"),
    [displayedCols],
  );
  const internalIdByConversionId = useMemo(
    () => new Map(conversions.map((c) => [c.id, c.internal_id])),
    [conversions],
  );
  const logGroupMetaByIndex = useMemo(() => {
    const keys = logs.map((log) =>
      log.conversion_id
        ? String(internalIdByConversionId.get(log.conversion_id) ?? "-")
        : "-"
    );
    const toneByKey = new Map<string, 0 | 1>();
    let nextTone: 0 | 1 = 0;
    const toneByIndex: (0 | 1)[] = [];
    keys.forEach((key) => {
      if (!toneByKey.has(key)) {
        toneByKey.set(key, nextTone);
        nextTone = nextTone === 0 ? 1 : 0;
      }
      toneByIndex.push(toneByKey.get(key)!);
    });
    return toneByIndex.map((tone, idx) => {
      const isStart = idx === 0 || keys[idx - 1] !== keys[idx];
      const isEnd = idx === keys.length - 1 || keys[idx + 1] !== keys[idx];
      return { base: tone === 0 ? "bg-zinc-800/30" : "bg-zinc-950/70", isStart, isEnd };
    });
  }, [logs, internalIdByConversionId]);
  const tabOrder = useMemo<Tab[]>(
    () => {
      const base = [...TAB_ORDER_BASE];
      if (config?.show_inbox === true) base.push("inbox");
      if (config?.show_logs !== false) base.push("logs");
      return base;
    },
    [config?.show_logs, config?.show_inbox],
  );
  const hasStatsFiltersApplied = useMemo(
    () =>
      statsLandingFilter !== "__all__" ||
      statsPixelFilter !== "__all__" ||
      statsGerenciaFilter !== "__all__" ||
      statsTelefonoFilter !== "__all__" ||
      statsFromMetaAdsFilter !== "__all__" ||
      statsSourcePlatformFilter !== "__all__" ||
      statsSexoFilter !== "__all__" ||
      statsCampaignFilter.length > 0 ||
      statsDeviceFilter !== "__all__",
    [statsLandingFilter, statsPixelFilter, statsGerenciaFilter, statsTelefonoFilter, statsFromMetaAdsFilter, statsSourcePlatformFilter, statsSexoFilter, statsCampaignFilter, statsDeviceFilter],
  );
  const statsFiltersCount = useMemo(
    () =>
      [
        statsLandingFilter,
        statsPixelFilter,
        statsGerenciaFilter,
        statsTelefonoFilter,
        statsFromMetaAdsFilter,
        statsSourcePlatformFilter,
        statsSexoFilter,
        statsCampaignFilter.length > 0 ? statsCampaignFilter.join(", ") : "__all__",
        statsDeviceFilter,
      ].filter((v) => v !== "__all__").length,
    [statsLandingFilter, statsPixelFilter, statsGerenciaFilter, statsTelefonoFilter, statsFromMetaAdsFilter, statsSourcePlatformFilter, statsSexoFilter, statsCampaignFilter, statsDeviceFilter],
  );

  useEffect(() => {
    if (config?.show_logs === false && tab === "logs") {
      setTab("funnel");
    }
    if (config?.show_inbox !== true && tab === "inbox") {
      setTab("funnel");
    }
  }, [config?.show_logs, config?.show_inbox, tab]);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      try {
        const [cfg, rows, funnel, pixels] = await Promise.all([
          fetchConversionsConfig(user.id),
          fetchConversionsFiltered(user.id, user.id, undefined, initialDateRangeRef.current ?? undefined),
          fetchFunnelContactsFiltered(user.id, user.id, initialDateRangeRef.current ?? undefined),
          fetchPixelConfigs(user.id),
        ]);
        setConfig(cfg);
        setConversions(rows);
        setFunnelContacts(funnel);
        setPixelConfigs(pixels);

        const { data: profile } = await supabase
          .from("profiles").select("nombre").eq("id", user.id).maybeSingle();
        setClientName(profile?.nombre ?? "");

        const { data: gerencias } = await supabase
          .from("gerencias")
          .select("id,nombre,gerencia_id")
          .eq("user_id", user.id);
        const gerenciasList = gerencias ?? [];
        const gerenciasById = new Map<number, string>();
        for (const g of gerenciasList) {
          const id = Number(g.id);
          if (!Number.isFinite(id)) continue;
          const extId = Number(g.gerencia_id);
          gerenciasById.set(id, `${String(g.nombre ?? "").trim()} (ID ${Number.isFinite(extId) ? extId : id})`);
        }
        if (gerenciasById.size > 0) {
          const ids = Array.from(gerenciasById.keys());
          const { data: phones } = await supabase
            .from("gerencia_phones")
            .select("gerencia_id,phone")
            .in("gerencia_id", ids);
          const byPhone: Record<string, string[]> = {};
          for (const row of phones ?? []) {
            const phone = normalizePhone(String(row.phone ?? ""));
            if (!phone) continue;
            const label = gerenciasById.get(Number(row.gerencia_id));
            if (!label) continue;
            byPhone[phone] = byPhone[phone] ?? [];
            if (!byPhone[phone].includes(label)) byPhone[phone].push(label);
          }
          setGerenciaByPhone(byPhone);
        } else {
          setGerenciaByPhone({});
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    void init();
  }, []);

  useEffect(() => {
    const loadDeferredTabData = async () => {
      if (!userId) return;
      try {
        if (tab === "logs" && logs.length === 0) {
          const logRows = await fetchConversionLogsFiltered(userId, userId, 200);
          setLogs(logRows);
        }
        if (tab === "inbox" && inboxRows.length === 0) {
          const inbox = await fetchConversionInbox(userId, 400);
          setInboxRows(inbox);
        }
      } catch (e) {
        console.error(e);
      }
    };
    void loadDeferredTabData();
  }, [tab, userId, logs.length, inboxRows.length]);

  const handleSave = async () => {
    if (!config || !userId) return;
    setSaving(true); setSaveMsg(null);
    try {
      await upsertConversionsConfig({ ...config, user_id: userId });
      const pixel = String(config.pixel_id ?? "").replace(/\D/g, "");
      const token = String(config.meta_access_token ?? "").trim();
      const currency = String(config.meta_currency ?? "ARS").trim() || "ARS";
      if (pixel && token) {
        const existing = pixelConfigs.find((p) => p.pixel_id === pixel);
        await upsertPixelConfig({
          user_id: userId,
          pixel_id: pixel,
          meta_access_token: token,
          meta_currency: currency,
          meta_api_version: config.meta_api_version || "v25.0",
          send_contact_capi: !!config.send_contact_capi,
          geo_use_ipapi: !!config.geo_use_ipapi,
          geo_fill_only_when_missing: !!config.geo_fill_only_when_missing,
          is_default: existing ? existing.is_default : pixelConfigs.length === 0,
        });
        const pixels = await fetchPixelConfigs(userId);
        setPixelConfigs(pixels);
        const current = pixels.find((p) => p.pixel_id === pixel);
        if (current) setEditingPixelId(current.id);
      }
      setSaveMsg("Configuracion guardada.");
    } catch (e) {
      setSaveMsg(e instanceof Error ? e.message : "Error al guardar");
    } finally { setSaving(false); }
  };

  const handlePixelEdit = useCallback((px: PixelConfig) => {
    setPixelEditDraft({
      id: px.id,
      pixel_id: px.pixel_id,
      meta_access_token: px.meta_access_token,
      meta_currency: px.meta_currency || "ARS",
      meta_api_version: px.meta_api_version || "v25.0",
      send_contact_capi: !!px.send_contact_capi,
      geo_use_ipapi: !!px.geo_use_ipapi,
      geo_fill_only_when_missing: !!px.geo_fill_only_when_missing,
      is_default: !!px.is_default,
    });
    setPixelEditOpen(true);
    setEditingPixelId(px.id);
    setEditPixelId(false);
    setEditAccessToken(false);
  }, []);

  const handlePixelModalSave = useCallback(async () => {
    if (!userId || !pixelEditDraft) return;
    const pixel = pixelEditDraft.pixel_id.replace(/\D/g, "").trim();
    const token = pixelEditDraft.meta_access_token.trim();
    if (!pixel) {
      setSaveMsg("Error: Pixel ID es obligatorio.");
      return;
    }
    if (!token) {
      setSaveMsg("Error: Token es obligatorio.");
      return;
    }

    setSaving(true);
    setSaveMsg(null);
    try {
      await upsertPixelConfig({
        user_id: userId,
        pixel_id: pixel,
        meta_access_token: token,
        meta_currency: pixelEditDraft.meta_currency || "ARS",
        meta_api_version: pixelEditDraft.meta_api_version || "v25.0",
        send_contact_capi: !!pixelEditDraft.send_contact_capi,
        geo_use_ipapi: !!pixelEditDraft.geo_use_ipapi,
        geo_fill_only_when_missing: !!pixelEditDraft.geo_fill_only_when_missing,
        is_default: !!pixelEditDraft.is_default,
      });
      const pixels = await fetchPixelConfigs(userId);
      setPixelConfigs(pixels);
      const current = pixels.find((p) => p.id === pixelEditDraft.id) || pixels.find((p) => p.pixel_id === pixel);
      if (current) {
        setConfig((prev) => prev ? {
          ...prev,
          pixel_id: current.pixel_id,
          meta_access_token: current.meta_access_token,
          meta_currency: current.meta_currency || prev.meta_currency,
          meta_api_version: current.meta_api_version || prev.meta_api_version,
          send_contact_capi: !!current.send_contact_capi,
          geo_use_ipapi: !!current.geo_use_ipapi,
          geo_fill_only_when_missing: !!current.geo_fill_only_when_missing,
        } : prev);
      }
      setPixelEditOpen(false);
      setPixelEditDraft(null);
      setSaveMsg("Pixel actualizado.");
    } catch (e) {
      setSaveMsg(e instanceof Error ? `Error: ${e.message}` : "Error al guardar pixel");
    } finally {
      setSaving(false);
    }
  }, [userId, pixelEditDraft]);

  const handlePixelDelete = useCallback(async (px: PixelConfig) => {
    if (!userId || !config) return;
    const ok = window.confirm(`Eliminar pixel ${px.pixel_id}?\n\nSe eliminara de tu configuracion.`);
    if (!ok) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const { data: affectedRows, error: affectedError } = await supabase
        .from("landings")
        .select("id,name")
        .eq("user_id", userId)
        .eq("pixel_id", px.pixel_id);
      if (affectedError) throw affectedError;
      const affectedLandings = (affectedRows ?? []) as Array<{ id: string; name: string }>;

      await deletePixelConfig(userId, px.pixel_id);
      let pixels = await fetchPixelConfigs(userId);
      if (pixels.length > 0 && !pixels.some((p) => p.is_default)) {
        const first = pixels[0];
        await upsertPixelConfig({
          user_id: userId,
          pixel_id: first.pixel_id,
          meta_access_token: first.meta_access_token,
          meta_currency: first.meta_currency || "ARS",
          meta_api_version: first.meta_api_version || "v25.0",
          send_contact_capi: !!first.send_contact_capi,
          geo_use_ipapi: !!first.geo_use_ipapi,
          geo_fill_only_when_missing: !!first.geo_fill_only_when_missing,
          is_default: true,
        });
        pixels = await fetchPixelConfigs(userId);
      }
      setPixelConfigs(pixels);

      if (config.pixel_id === px.pixel_id) {
        const next = pixels[0];
        if (next) {
          setConfig((prev) => prev ? {
            ...prev,
            pixel_id: next.pixel_id,
            meta_access_token: next.meta_access_token,
            meta_currency: next.meta_currency || prev.meta_currency,
            meta_api_version: next.meta_api_version || prev.meta_api_version,
            send_contact_capi: !!next.send_contact_capi,
            geo_use_ipapi: !!next.geo_use_ipapi,
            geo_fill_only_when_missing: !!next.geo_fill_only_when_missing,
          } : prev);
          setEditingPixelId(next.id);
        } else {
          setConfig((prev) => prev ? {
            ...prev,
            pixel_id: "",
            meta_access_token: "",
          } : prev);
          setEditingPixelId(null);
        }
      }
      setSaveMsg("Pixel eliminado.");
      if (affectedLandings.length > 0) {
        setPixelDeleteWarn({ pixelId: px.pixel_id, landings: affectedLandings });
      }
    } catch (e) {
      setSaveMsg(e instanceof Error ? e.message : "Error al eliminar pixel");
    } finally {
      setSaving(false);
    }
  }, [userId, config]);

  const copyToClipboard = useCallback(async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedUrl(text);
    setTimeout(() => setCopiedUrl(null), 2000);
  }, []);

  const openStatsFilterModal = useCallback(() => {
    setDraftLandingFilter(statsLandingFilter);
    setDraftPixelFilter(statsPixelFilter);
    setDraftGerenciaFilter(statsGerenciaFilter);
    setDraftTelefonoFilter(statsTelefonoFilter);
    setDraftFromMetaAdsFilter(statsFromMetaAdsFilter);
    setDraftSourcePlatformFilter(statsSourcePlatformFilter);
    setDraftSexoFilter(statsSexoFilter);
    setDraftCampaignFilter([...statsCampaignFilter]);
    setDraftDeviceFilter(statsDeviceFilter);
    setStatsFilterModalOpen(true);
  }, [statsLandingFilter, statsPixelFilter, statsGerenciaFilter, statsTelefonoFilter, statsFromMetaAdsFilter, statsSourcePlatformFilter, statsSexoFilter, statsCampaignFilter, statsDeviceFilter]);

  const applyStatsFilters = useCallback(() => {
    setStatsLandingFilter(draftLandingFilter);
    setStatsPixelFilter(draftPixelFilter);
    setStatsGerenciaFilter(draftGerenciaFilter);
    setStatsTelefonoFilter(draftTelefonoFilter);
    setStatsFromMetaAdsFilter(draftFromMetaAdsFilter);
    setStatsSourcePlatformFilter(draftSourcePlatformFilter);
    setStatsSexoFilter(draftSexoFilter);
    setStatsCampaignFilter([...draftCampaignFilter]);
    setStatsDeviceFilter(draftDeviceFilter);
    setStatsFilterModalOpen(false);
  }, [draftLandingFilter, draftPixelFilter, draftGerenciaFilter, draftTelefonoFilter, draftFromMetaAdsFilter, draftSourcePlatformFilter, draftSexoFilter, draftCampaignFilter, draftDeviceFilter]);
  const clearAllStatsFilters = useCallback(() => {
    setStatsLandingFilter("__all__");
    setStatsPixelFilter("__all__");
    setStatsGerenciaFilter("__all__");
    setStatsTelefonoFilter("__all__");
    setStatsFromMetaAdsFilter("__all__");
    setStatsSourcePlatformFilter("__all__");
    setStatsSexoFilter("__all__");
    setStatsCampaignFilter([]);
    setStatsDeviceFilter("__all__");
    setDraftLandingFilter("__all__");
    setDraftPixelFilter("__all__");
    setDraftGerenciaFilter("__all__");
    setDraftTelefonoFilter("__all__");
    setDraftFromMetaAdsFilter("__all__");
    setDraftSourcePlatformFilter("__all__");
    setDraftSexoFilter("__all__");
    setDraftCampaignFilter([]);
    setDraftDeviceFilter("__all__");
  }, []);

  const refreshTable = useCallback(async () => {
    if (!userId) return;
    setRefreshingTable(true);
    try {
      if (tab === "logs") {
        const logRows = await fetchConversionLogsFiltered(userId, userId, 200);
        setLogs(logRows);
      } else if (tab === "inbox") {
        const inbox = await fetchConversionInbox(userId, 400);
        setInboxRows(inbox);
      } else {
        const [rows, funnel] = await Promise.all([
          fetchConversionsFiltered(userId, userId, undefined, dateRange ?? undefined),
          fetchFunnelContactsFiltered(userId, userId, dateRange ?? undefined),
        ]);
        setConversions(rows);
        setFunnelContacts(funnel);
      }
    } catch (e) { console.error(e); }
    finally { setRefreshingTable(false); }
  }, [userId, tab, dateRange]);

  useEffect(() => {
    if (!userId) return;
    if (!hasSyncedDateRangeOnceRef.current) {
      hasSyncedDateRangeOnceRef.current = true;
      return;
    }
    void refreshTable();
  }, [dateRange, userId, refreshTable]);

  const clearGlobalDisplay = useCallback(async () => {
    if (!userId) return;
    if (activeConversions.length === 0 && activeLogs.length === 0) return;
    const ok = window.confirm(
      "Vas a limpiar la vista de Conversiones.\n\nSe ocultaran los registros que ves ahora en Funnel, Tabla, Estadisticas y Logs.\n\nEsta accion NO borra datos de la base.\nSolo deja de mostrarlos en esta vista.\n\nQueres continuar?",
    );
    if (!ok) return;
    setHidingTable(true);
    setHidingFunnel(true);
    setHidingStats(true);
    setHidingLogs(true);
    setClearMsg(null);
    try {
      if (activeConversions.length > 0) {
        await hideConversions(activeConversions.map((c) => c.id), userId);
      }
      if (activeLogs.length > 0) {
        await hideConversionLogs(activeLogs.map((l) => Number(l.id)), userId);
      }
      await refreshTable();
      setClearMsg("Vista limpiada.");
      setTimeout(() => setClearMsg(null), 4000);
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : String(e);
      setClearMsg(`Error al limpiar: ${msg}`);
    } finally {
      setHidingTable(false);
      setHidingFunnel(false);
      setHidingStats(false);
      setHidingLogs(false);
    }
  }, [userId, activeConversions, activeLogs, refreshTable]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-zinc-400">Cargando...</p>
      </div>
    );
  }

  const endpointBase = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ?? "";

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">CONVERSIONES</h1>
          <p className="mt-1 text-sm text-zinc-400">Tu pipeline de leads, cargas y estadsticas.</p>
        </div>
      </div>

      {saveMsg && (
        <p className={`rounded-lg px-3 py-2 text-sm ${saveMsg.includes("Error") ? "bg-red-950/50 text-red-300" : "bg-emerald-950/50 text-emerald-300"}`} role="alert">
          {saveMsg}
        </p>
      )}
      {clearMsg && (
        <p className={`rounded-lg px-3 py-2 text-sm ${clearMsg.includes("Error") ? "bg-red-950/50 text-red-300" : "bg-emerald-950/50 text-emerald-300"}`} role="alert">
          {clearMsg}
        </p>
      )}

      {pixelEditOpen && pixelEditDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-2xl rounded-xl border border-zinc-700 bg-zinc-950 p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-zinc-100">Editar pixel</h3>
              <button
                type="button"
                onClick={() => { setPixelEditOpen(false); setPixelEditDraft(null); }}
                className="cursor-pointer rounded-lg border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
              >
                Cerrar
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-400">Pixel ID</label>
                <input
                  type="text"
                  value={pixelEditDraft.pixel_id}
                  onChange={(e) => setPixelEditDraft((p) => p ? { ...p, pixel_id: e.target.value.replace(/\D/g, "") } : p)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-400">Access Token</label>
                <input
                  type="text"
                  value={pixelEditDraft.meta_access_token}
                  onChange={(e) => setPixelEditDraft((p) => p ? { ...p, meta_access_token: e.target.value } : p)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-400">Moneda</label>
                  <select
                    value={pixelEditDraft.meta_currency}
                    onChange={(e) => setPixelEditDraft((p) => p ? { ...p, meta_currency: e.target.value } : p)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2 text-sm text-zinc-100"
                  >
                    {["ARS","USD","EUR","BRL","CLP","MXN","COP"].map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-400">API Version</label>
                  <select
                    value={pixelEditDraft.meta_api_version}
                    onChange={(e) => setPixelEditDraft((p) => p ? { ...p, meta_api_version: e.target.value } : p)}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2 text-sm text-zinc-100"
                  >
                    <option value="v25.0">v25.0</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
                <label className="flex items-center gap-2 text-xs text-zinc-300">
                  <input
                    type="checkbox"
                    checked={pixelEditDraft.send_contact_capi}
                    onChange={(e) => setPixelEditDraft((p) => p ? { ...p, send_contact_capi: e.target.checked } : p)}
                    className="h-4 w-4 rounded border-zinc-600 bg-zinc-900 accent-emerald-500"
                  />
                  Enviar evento Contact por CAPI
                </label>
                <label className="flex items-center gap-2 text-xs text-zinc-300">
                  <input
                    type="checkbox"
                    checked={pixelEditDraft.geo_use_ipapi}
                    onChange={(e) => setPixelEditDraft((p) => p ? { ...p, geo_use_ipapi: e.target.checked } : p)}
                    className="h-4 w-4 rounded border-zinc-600 bg-zinc-900 accent-emerald-500"
                  />
                  Enviar geo
                </label>
                {pixelEditDraft.geo_use_ipapi && (
                  <label className="ml-6 flex items-center gap-2 text-xs text-zinc-300">
                    <input
                      type="checkbox"
                      checked={pixelEditDraft.geo_fill_only_when_missing}
                      onChange={(e) => setPixelEditDraft((p) => p ? { ...p, geo_fill_only_when_missing: e.target.checked } : p)}
                      className="h-4 w-4 rounded border-zinc-600 bg-zinc-900 accent-emerald-500"
                    />
                    Solo completar geo faltante (no pisar datos del payload)
                  </label>
                )}
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setPixelEditOpen(false); setPixelEditDraft(null); }}
                className="cursor-pointer rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handlePixelModalSave()}
                disabled={saving}
                className="cursor-pointer rounded-lg bg-lime-400 px-3 py-2 text-xs font-semibold text-black transition hover:bg-lime-300 disabled:opacity-60"
              >
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {pixelDeleteWarn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-xl rounded-xl border border-zinc-700 bg-zinc-950 p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <h3 className="text-sm font-semibold text-zinc-100">Advertencia de pixel eliminado</h3>
              <button
                type="button"
                onClick={() => setPixelDeleteWarn(null)}
                className="cursor-pointer rounded-lg border border-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-800"
              >
                Cerrar
              </button>
            </div>
            <p className="text-sm text-zinc-300">
              Eliminaste el pixel <span className="font-mono text-zinc-100">{pixelDeleteWarn.pixelId}</span>, y hay landing(s) que lo estaban usando.
            </p>
            <p className="mt-2 text-xs text-zinc-400">
              Ve a cada landing afectada, selecciona un nuevo pixel y guarda para publicar la configuracion actualizada.
            </p>
            <div className="mt-3 max-h-44 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-900/60 p-2">
              <ul className="space-y-1.5 text-xs text-zinc-200">
                {pixelDeleteWarn.landings.map((l) => (
                  <li key={l.id} className="rounded border border-zinc-800 bg-zinc-900 px-2 py-1.5">
                    {l.name}
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <a
                href="/dashboard/landings"
                className="cursor-pointer rounded-lg bg-lime-400 px-3 py-2 text-xs font-semibold text-black transition hover:bg-lime-300"
              >
                Ir a landings
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center justify-between gap-4 flex-wrap border-b border-zinc-800/60 pb-1">
        <div className="flex gap-4">
          {tabOrder.filter((t) => t !== "configuracion" && t !== "logs" && t !== "inbox").map((t) => {
            const active = tab === t;
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`relative cursor-pointer pb-2 text-xs font-medium transition-colors whitespace-nowrap ${
                  active ? "text-zinc-100" : "text-zinc-500 hover:text-zinc-200"
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  {t === "funnel" ? <FunnelTabIcon /> : t === "seguimiento" ? <TrackingTabIcon /> : t === "tabla" ? <TableTabIcon /> : t === "estadisticas" ? <StatsTabIcon /> : null}
                  {TAB_LABELS[t]}
                </span>
                <span
                  className={`pointer-events-none absolute inset-x-0 -bottom-[1px] h-0.5 rounded-full transition-opacity ${
                    active ? "bg-zinc-100 opacity-100" : "bg-zinc-600 opacity-0"
                  }`}
                />
              </button>
            );
          })}
        </div>
        <div className="ml-auto flex items-center gap-4">
          {tabOrder.filter((t) => t === "configuracion" || t === "inbox" || t === "logs").map((t) => {
            const active = tab === t;
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`relative cursor-pointer pb-2 text-xs font-medium transition-colors whitespace-nowrap ${
                  active ? "text-zinc-100" : "text-zinc-500 hover:text-zinc-200"
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  {t === "configuracion" ? <GearTabIcon /> : t === "inbox" ? <InboxTabIcon /> : <LogsTabIcon />}
                  {TAB_LABELS[t]}
                </span>
                <span
                  className={`pointer-events-none absolute inset-x-0 -bottom-[1px] h-0.5 rounded-full transition-opacity ${
                    active ? "bg-zinc-100 opacity-100" : "bg-zinc-600 opacity-0"
                  }`}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* Date filter + global actions */}
      {(tab === "funnel" || tab === "seguimiento" || tab === "tabla" || tab === "estadisticas" || tab === "inbox" || tab === "logs") && (
        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-2">
            {(tab === "funnel" || tab === "tabla" || tab === "estadisticas" || tab === "inbox" || tab === "logs") && (
              <>
                <button
                  type="button"
                  onClick={refreshTable}
                  disabled={refreshingTable}
                  className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800/80 px-2 text-[11px] font-medium text-zinc-300 transition hover:bg-zinc-700 hover:text-zinc-100 disabled:opacity-60"
                  title="Actualizar datos"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  {refreshingTable ? "Actualizando..." : "Actualizar"}
                </button>
                <button
                  type="button"
                  onClick={clearGlobalDisplay}
                  disabled={
                    hidingFunnel ||
                    hidingTable ||
                    hidingStats ||
                    hidingLogs ||
                    refreshingTable ||
                    (activeConversions.length === 0 && activeLogs.length === 0)
                  }
                  className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-red-900/60 bg-red-950/30 px-2 text-[11px] font-medium text-red-300 transition hover:bg-red-950/50 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Ocultar registros de la vista (persistente, no borra de la base)"
                >
                  {(hidingFunnel || hidingTable || hidingStats || hidingLogs) ? "Ocultando..." : "Limpiar vista"}
                </button>
              </>
            )}
            {(tab === "funnel" || tab === "tabla" || tab === "estadisticas") && (
              <button
                type="button"
                onClick={openStatsFilterModal}
                className={`inline-flex h-7 items-center gap-1.5 rounded-lg border px-2 text-[11px] font-medium transition ${
                  hasStatsFiltersApplied
                    ? "border-emerald-700 bg-emerald-950/40 text-emerald-300"
                    : "border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
                }`}
                title="Abrir multifiltro global"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M7 12h10M10 18h4" />
                </svg>
                Aplicar filtros
                {hasStatsFiltersApplied && (
                  <>
                    <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                      {statsFiltersCount}
                    </span>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); clearAllStatsFilters(); }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.stopPropagation();
                          clearAllStatsFilters();
                        }
                      }}
                      className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-red-500/70 bg-red-950/70 text-[10px] font-bold leading-none text-red-200 hover:bg-red-900/80"
                      title="Quitar todos los filtros"
                      aria-label="Quitar todos los filtros"
                    >
                      ×
                    </span>
                  </>
                )}
              </button>
            )}
          </div>
          <DateRangeFilter onChange={setDateRange} initialPreset="hoy" />
        </div>
      )}

      {statsFilterModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-xl rounded-xl border border-zinc-700 bg-zinc-950 p-4">
            <h3 className="mb-3 text-sm font-semibold text-zinc-100">Filtros de estadisticas</h3>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="mb-1 block text-xs text-zinc-400">Landing</label>
                <select value={draftLandingFilter} onChange={(e) => setDraftLandingFilter(e.target.value)} className="h-9 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-xs text-zinc-100">
                  <option value="__all__">Todas las landings</option>
                  {statsLandingOptions.map((name) => <option key={name} value={name}>{name}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-400">Pixel</label>
                <select value={draftPixelFilter} onChange={(e) => setDraftPixelFilter(e.target.value)} className="h-9 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-xs text-zinc-100">
                  <option value="__all__">Todos los pixeles</option>
                  {statsPixelOptions.map((px) => <option key={px} value={px}>{px}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-400">Gerencia (ID)</label>
                <select value={draftGerenciaFilter} onChange={(e) => setDraftGerenciaFilter(e.target.value)} className="h-9 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-xs text-zinc-100">
                  <option value="__all__">Todas las gerencias</option>
                  {statsGerenciaOptions.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-400">Telefono asignado</label>
                <select value={draftTelefonoFilter} onChange={(e) => setDraftTelefonoFilter(e.target.value)} className="h-9 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-xs text-zinc-100">
                  <option value="__all__">Todos los telefonos</option>
                  {statsTelefonoOptions.map((phone) => {
                    const labels = gerenciaByPhone[phone] ?? [];
                    const extra = labels.length > 0 ? ` [${labels.join(" | ")}]` : "";
                    return <option key={phone} value={phone}>{`${phone}${extra}`}</option>;
                  })}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-400">Origen Meta Ads</label>
                <select value={draftFromMetaAdsFilter} onChange={(e) => setDraftFromMetaAdsFilter(e.target.value)} className="h-9 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-xs text-zinc-100">
                  <option value="__all__">Todos</option>
                  <option value="true">Si</option>
                  <option value="false">No</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-400">Plataforma de origen</label>
                <select value={draftSourcePlatformFilter} onChange={(e) => setDraftSourcePlatformFilter(e.target.value)} className="h-9 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-xs text-zinc-100">
                  <option value="__all__">Todas</option>
                  {statsSourcePlatformOptions.map((source) => <option key={source} value={source}>{source}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-400">Sexo</label>
                <select value={draftSexoFilter} onChange={(e) => setDraftSexoFilter(e.target.value)} className="h-9 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-xs text-zinc-100">
                  <option value="__all__">Todos</option>
                  {statsSexoOptions.map((sex) => <option key={sex} value={sex}>{sexLabel(sex)}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-400">Campaña</label>
                <details className="group relative">
                  <summary className="flex h-9 w-full cursor-pointer list-none items-center justify-between rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-xs text-zinc-100 marker:hidden">
                    <span className="truncate">
                      {draftCampaignFilter.length === 0
                        ? "Todas"
                        : draftCampaignFilter.length === 1
                          ? draftCampaignFilter[0]
                          : `${draftCampaignFilter.length} campañas seleccionadas`}
                    </span>
                    <span className="ml-2 text-zinc-500 transition group-open:rotate-180">v</span>
                  </summary>
                  <div className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-100 shadow-xl">
                    <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 hover:bg-zinc-800/70">
                      <input
                        type="checkbox"
                        checked={draftCampaignFilter.length === 0}
                        onChange={() => setDraftCampaignFilter([])}
                        className="h-3.5 w-3.5 rounded border-zinc-600 bg-zinc-900 accent-emerald-500"
                      />
                      Todas
                    </label>
                    {statsCampaignOptions.map((campaign) => {
                      const checked = draftCampaignFilter.includes(campaign);
                      return (
                        <label key={campaign} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 hover:bg-zinc-800/70">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              setDraftCampaignFilter((prev) => (
                                e.target.checked
                                  ? [...prev, campaign]
                                  : prev.filter((item) => item !== campaign)
                              ));
                            }}
                            className="h-3.5 w-3.5 rounded border-zinc-600 bg-zinc-900 accent-emerald-500"
                          />
                          <span className="truncate">{campaign}</span>
                        </label>
                      );
                    })}
                  </div>
                </details>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setStatsFilterModalOpen(false)} className="cursor-pointer rounded-md border border-zinc-600 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800">
                Cerrar
              </button>
              <button type="button" onClick={applyStatsFilters} className="cursor-pointer rounded-md border border-emerald-700 bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-emerald-500">
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB: CONFIGURACIN */}
      {tab === "configuracion" && (
        <div className="space-y-4">
          {/* Endpoint */}
          <section className="rounded-xl border border-zinc-800 bg-zinc-900/50">
            <button type="button" onClick={() => setEndpointOpen((v) => !v)} className="flex w-full cursor-pointer items-center gap-2 p-4">
              <ChevronIcon open={endpointOpen} />
              <h3 className="text-sm font-semibold text-zinc-200">Endpoint de conversiones</h3>
            </button>
            {endpointOpen && (
              <div className="space-y-3 border-t border-zinc-800 p-4">
                <p className="text-xs text-zinc-400">Tus landings y sistemas externos deben enviar POST a esta URL.</p>
                {(() => {
                  const url = clientName ? `${endpointBase}/functions/v1/conversions?name=${encodeURIComponent(clientName)}` : "";
                  return clientName ? (
                    <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2">
                      <code className="flex-1 text-[11px] text-emerald-400 break-all">{url}</code>
                      <button type="button" onClick={() => copyToClipboard(url)} className="shrink-0 cursor-pointer rounded p-1 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300" title="Copiar URL">
                        {copiedUrl === url ? <span className="text-[10px] text-emerald-400">OK</span> : <CopyIcon />}
                      </button>
                    </div>
                  ) : (
                    <p className="text-[11px] text-amber-400">Tu URL an no fue configurada. Contact al administrador.</p>
                  );
                })()}
              </div>
            )}
          </section>

          {/* Funnel Configuration */}
          <section className="rounded-xl border border-zinc-800 bg-zinc-900/50">
            <button type="button" onClick={() => setFunnelConfigOpen((v) => !v)} className="flex w-full cursor-pointer items-center gap-2 p-4">
              <ChevronIcon open={funnelConfigOpen} />
              <h3 className="text-sm font-semibold text-zinc-200">Personalizacin del funnel</h3>
            </button>
            {funnelConfigOpen && (
              <div className="space-y-4 border-t border-zinc-800 p-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Monto mnimo para Jugador Premium</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatIntegerWithThousands(config?.funnel_premium_threshold ?? 50000)}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^\d]/g, "");
                      const parsed = raw ? Number.parseInt(raw, 10) : 0;
                      setConfig((p) => (p ? { ...p, funnel_premium_threshold: parsed } : p));
                    }}
                    className="w-full max-w-xs rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                    placeholder="50.000"
                  />
                  <p className="mt-1 text-[11px] text-zinc-500">Contactos cuya sumatoria total de cargas sea igual o mayor a este monto se clasifican como Jugador Premium.</p>
                </div>
              </div>
            )}
          </section>
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="cursor-pointer rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 transition hover:bg-zinc-200 active:scale-95 disabled:opacity-60"
            >
              {saving ? "Guardando..." : "Guardar configuracin"}
            </button>
          </div>
        </div>
      )}

      {/* TAB: TABLA */}
      {tab === "tabla" && (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="sticky top-0 z-30 mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg py-2">
            <h3 className="text-sm font-semibold text-zinc-200">
              Tabla de conversiones <span className="font-normal text-zinc-500">({filteredConversions.length})</span>
            </h3>
            <div className="flex items-center gap-2">
              <input
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                placeholder="Buscar por phone, email, promo, utm..."
                className="h-8 w-64 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-xs text-zinc-100 placeholder:text-zinc-500"
              />
            </div>
          </div>
          <div className="overflow-x-auto rounded-lg border border-zinc-700">
            <table className="w-full text-left text-[11px]">
              <thead className="sticky top-0 z-20 bg-zinc-800/95">
                <tr>
                  <th className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap cursor-help" title={COLUMN_NOTES.id}>ID</th>
                  <th className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap cursor-help" title={COLUMN_NOTES.timestamp}>timestamp</th>
                  {displayedColsWithoutTimestamp.map((col) => (
                    <th
                      key={col}
                      className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap cursor-help"
                      title={COLUMN_NOTES[col] ?? col}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {displayedColsWithoutTimestamp.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-2 py-6 text-center text-zinc-500">
                      Tu administrador todavia no definio columnas visibles para esta tabla.
                    </td>
                  </tr>
                ) : filteredConversions.length === 0 ? (
                  <tr>
                    <td colSpan={displayedColsWithoutTimestamp.length + 2} className="px-2 py-6 text-center text-zinc-500">
                      Aun no hay conversiones registradas.
                    </td>
                  </tr>
                ) : pagedConversions.map((c, idx) => {
                  const isRepeat = c.estado === "purchase" && c.observaciones?.includes("REPEAT");
                  const rowColor =
                    c.estado === "lead"
                      ? "bg-amber-950/18"
                      : c.estado === "purchase" && isRepeat
                        ? "bg-violet-950/20"
                        : c.estado === "purchase"
                          ? "bg-rose-950/18"
                          : "bg-zinc-950/40";
                  return (
                    <tr
                      key={c.id}
                      className={rowColor}
                    >
                      <td className="px-2 py-1.5 whitespace-nowrap text-zinc-500 font-mono">{c.internal_id ?? ((tablePage - 1) * tablePageSize + idx + 1)}</td>
                      {cellValue(c, "timestamp")}
                      {displayedColsWithoutTimestamp.map((col) =>
                        col === "email" ? (
                          <EditableEmailCell key={col} row={c} onSaved={(id, email) => setConversions((prev) => prev.map((r) => (r.id === id ? { ...r, email } : r)))} />
                        ) : cellValue(c, col)
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filteredConversions.length > tablePageSize && (
            <div className="mt-3 flex items-center justify-between text-xs text-zinc-400">
              <span>
                Mostrando {(tablePage - 1) * tablePageSize + 1}-{Math.min(tablePage * tablePageSize, filteredConversions.length)} de {filteredConversions.length}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={tablePage <= 1}
                  onClick={() => setTablePage((p) => Math.max(1, p - 1))}
                  className="rounded border border-zinc-700 px-2 py-1 text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
                >
                  Anterior
                </button>
                <span>
                  {tablePage}/{totalTablePages}
                </span>
                <button
                  type="button"
                  disabled={tablePage >= totalTablePages}
                  onClick={() => setTablePage((p) => Math.min(totalTablePages, p + 1))}
                  className="rounded border border-zinc-700 px-2 py-1 text-zinc-300 hover:bg-zinc-800 disabled:opacity-40"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* TAB: FUNNEL */}
      {tab === "funnel" && (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          {activeFunnelFiltered.length === 0 ? (
            <p className="py-12 text-center text-sm text-zinc-500">An no hay contactos en el funnel.</p>
          ) : (
            <FunnelBoard
              contacts={activeFunnelFiltered}
              premiumThreshold={config?.funnel_premium_threshold ?? 50000}
              rankingConfig={config?.tracking_ranking_config ?? null}
              headerSlot={
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="mr-2 text-sm font-semibold text-zinc-200">Funnel</h3>
                </div>
              }
            />
          )}
        </section>
      )}

      {/* TAB: SEGUIMIENTO */}
      {tab === "seguimiento" && (
        <TrackingBoard
          conversions={activeConversions.filter((r) => !String(r.test_event_code ?? "").trim())}
          onRefresh={refreshTable}
          refreshing={refreshingTable}
        />
      )}

      {/* TAB: ESTADSTICAS */}
      {tab === "estadisticas" && (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-zinc-200">Estadisticas</h3>
          </div>
          {activeFunnelFiltered.length === 0 && statsConversionsFiltered.length === 0 ? (
            <p className="py-12 text-center text-sm text-zinc-500">An no hay datos para estadsticas.</p>
          ) : (
            <StatsPanel
              funnelContacts={activeFunnelFiltered}
              conversions={statsConversionsFiltered}
              allConversions={statsAllConversionsFiltered}
              premiumThreshold={config?.funnel_premium_threshold ?? 50000}
              dateRange={dateRange}
              compactTooltips
              showAssistant={config?.show_ai_assistant === true}
            />
          )}
        </section>
      )}

      {/* TAB: INBOX */}
      {tab === "inbox" && (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-zinc-200">
              Inbox de eventos (LEAD/PURCHASE){" "}
              <span className="font-normal text-zinc-500">({filteredInbox.length})</span>
            </h3>
            <div className="flex items-center gap-2">
              <select
                value={inboxActionFilter}
                onChange={(e) => setInboxActionFilter(e.target.value as "all" | "CONTACT" | "LEAD" | "PURCHASE")}
                className="h-8 rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-xs text-zinc-100"
                title="Filtrar por tipo de evento"
              >
                <option value="all">Todos</option>
                <option value="CONTACT">Contact</option>
                <option value="LEAD">Lead</option>
                <option value="PURCHASE">Purchase</option>
              </select>
              <input
                value={inboxSearch}
                onChange={(e) => setInboxSearch(e.target.value)}
                placeholder="Buscar por phone, promo_code, status..."
                className="h-8 w-72 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-xs text-zinc-100 placeholder:text-zinc-500"
              />
            </div>
          </div>
          {filteredInbox.length === 0 ? (
            <p className="text-sm text-zinc-500">No hay eventos en inbox para el filtro actual.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-zinc-700">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-zinc-800/80">
                  <tr>
                    <th className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap">Fila</th>
                    <th className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap">Fecha</th>
                    <th className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap">Action</th>
                    <th className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap">Status</th>
                    <th className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap">Phone</th>
                    <th className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap">Promo code</th>
                    <th className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap">HTTP</th>
                    <th className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap">Respuesta</th>
                    <th className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap">Payload</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {filteredInbox.map((row) => (
                    <tr
                      key={row.id}
                      className={
                        (() => {
                          const action = String(row.action ?? "").toUpperCase();
                          const isLead = action === "LEAD";
                          const isPurchase = action === "PURCHASE";
                          const isProcessed = String(row.status ?? "").toLowerCase() === "processed";
                          const resp = String(row.response_body ?? "").toLowerCase();
                          const promo = String(row.promo_code ?? "").trim();
                          const hasValidPromo = /^[A-Za-z0-9]+-[A-Za-z0-9]+$/.test(promo);
                          if (isPurchase && isProcessed) {
                            const purchaseSuccess =
                              (resp.includes("match_mode:") && !resp.includes("error al enviar")) ||
                              (resp.includes("compra enviada") || resp.includes("recompra enviada")) ||
                              (resp.includes("purchase procesada") && !resp.includes("no procesado") && !resp.includes("error al enviar"));
                            if (purchaseSuccess) return "bg-emerald-950/30";
                            return "bg-zinc-950/40";
                          }
                          if (!isLead || !isProcessed) return "bg-zinc-950/40";
                          if (resp.includes("match_mode:promo_code")) return "bg-emerald-950/30";
                          if (resp.includes("match_mode:bot_phone+datetime")) {
                            return "bg-cyan-950/30 [background-image:repeating-linear-gradient(135deg,rgba(6,182,212,0.14)_0,rgba(6,182,212,0.14)_6px,transparent_6px,transparent_12px)]";
                          }
                          if (hasValidPromo && !resp.includes("match_mode:created_new") && !resp.includes("sin match por promo_code")) {
                            return "bg-emerald-950/30";
                          }
                          return "bg-zinc-950/40";
                        })()
                      }
                    >
                      <td className="px-2 py-1.5 text-zinc-300 whitespace-nowrap">
                        {row.conversion_id ? (internalIdByConversionId.get(row.conversion_id) ?? "-") : "-"}
                      </td>
                      <td className="px-2 py-1.5 text-zinc-400 whitespace-nowrap">
                        {new Date(row.created_at).toLocaleString("es-AR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
                      </td>
                      <td className="px-2 py-1.5 text-zinc-200 whitespace-nowrap">{row.action || "-"}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap">
                        <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                          row.status === "processed"
                            ? "bg-emerald-500/15 text-emerald-300"
                            : row.status === "error"
                              ? "bg-rose-500/15 text-rose-300"
                              : "bg-amber-500/15 text-amber-300"
                        }`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 text-zinc-300 font-mono whitespace-nowrap">{row.phone || "-"}</td>
                      <td className="px-2 py-1.5 text-zinc-300 whitespace-nowrap">{row.promo_code || "-"}</td>
                      <td className="px-2 py-1.5 text-zinc-400 whitespace-nowrap">{row.http_status ?? "-"}</td>
                      <td className="px-2 py-1.5 text-zinc-500 max-w-[280px] truncate" title={row.response_body || "-"}>
                        {truncateText(row.response_body || "-", 80)}
                      </td>
                      <td className="px-2 py-1.5 text-zinc-500 max-w-[320px] truncate" title={row.payload_raw || "-"}>
                        {truncateText(row.payload_raw || "-", 90)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* TAB: LOGS */}
      {tab === "logs" && (
        <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-zinc-200">
              Logs de conversiones{" "}
              <span className="font-normal text-zinc-500">({activeLogs.length})</span>
            </h3>
          </div>
          {activeLogs.length === 0 ? (
            <p className="text-sm text-zinc-500">Aun no hay logs registrados.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-zinc-700">
              <table className="w-full text-left text-[11px]">
                <thead className="bg-zinc-800/80">
                  <tr>
                    <th className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap">ID</th>
                    <th className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap">Fecha</th>
                    <th className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap">Nivel</th>
                    <th className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap">Mensaje</th>
                    <th className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap">Funcion</th>
                    <th className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap">Payload Recibido</th>
                    <th className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap">Resultado</th>
                    <th className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap">Payload Meta</th>
                    <th className="px-2 py-2 font-medium text-zinc-300 whitespace-nowrap">Respuesta de Meta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {activeLogs.map((log, idx) => (
                    <tr
                      key={log.id}
                      className={(() => {
                        const meta = logGroupMetaByIndex[idx] ?? { base: "bg-zinc-950/40", isStart: false, isEnd: false };
                        const blockBorders = `${meta.isStart ? " border-t-4 border-t-black/90" : ""}${meta.isEnd ? " border-b-4 border-b-black/90" : ""}`;
                        const isMetaResponse = log.function_name === "sendToMetaCAPI" && log.message === "Meta CAPI respuesta";
                        if (!isMetaResponse || !log.response_meta) return `${meta.base}${blockBorders}`;
                        try {
                          const parsed = JSON.parse(log.response_meta) as { error?: unknown; events_received?: number | string };
                          const eventsReceived = typeof parsed.events_received === "number"
                            ? parsed.events_received
                            : Number(parsed.events_received ?? 0);
                          return `${meta.base}${blockBorders}`;
                        } catch {
                          return `${meta.base}${blockBorders}`;
                        }
                      })()}
                    >
                      <td className="px-2 py-1.5 text-zinc-500 font-mono whitespace-nowrap">
                        {log.conversion_id ? (internalIdByConversionId.get(log.conversion_id) ?? "-") : "-"}
                      </td>
                      <td className="px-2 py-1.5 text-zinc-400 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString("es-AR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
                      </td>
                      <td className="px-2 py-1.5">{levelBadge(log.level, log.function_name, log.message)}</td>
                      <td className={`px-2 py-1.5 ${
                        (() => {
                          const isMetaResponse = log.function_name === "sendToMetaCAPI" && log.message === "Meta CAPI respuesta";
                          if (!isMetaResponse || !log.response_meta) return "text-zinc-200";
                          try {
                            const parsed = JSON.parse(log.response_meta) as { error?: unknown; events_received?: number | string };
                            const eventsReceived = typeof parsed.events_received === "number"
                              ? parsed.events_received
                              : Number(parsed.events_received ?? 0);
                            const ok = !parsed.error && Number.isFinite(eventsReceived) && eventsReceived > 0;
                            return ok ? "text-emerald-300 font-semibold" : "text-zinc-200";
                          } catch {
                            return "text-zinc-200";
                          }
                        })()
                      }`}>{log.message}</td>
                      <td className="px-2 py-1.5 text-zinc-300 font-mono whitespace-nowrap">{log.function_name}</td>
                      <td className="px-2 py-1.5 text-zinc-500">
                        {(log.payload_received && log.payload_received.trim()) ? (
                          <button type="button" onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)} className="cursor-pointer text-zinc-400 underline hover:text-zinc-200">
                            {expandedLog === log.id ? "ocultar" : "ver"}
                          </button>
                        ) : "-"}
                        {expandedLog === log.id && log.payload_received && (
                          <pre className="mt-1 max-w-[500px] overflow-x-auto rounded bg-zinc-900 p-2 text-[10px] text-zinc-400">
                            {(() => { try { return JSON.stringify(JSON.parse(log.payload_received), null, 2); } catch { return log.payload_received; } })()}
                          </pre>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-zinc-500">
                        {((log.result && log.result.trim()) || (log.detail && log.detail.trim())) ? (
                          <button type="button" onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)} className="cursor-pointer text-zinc-400 underline hover:text-zinc-200">
                            {expandedLog === log.id ? "ocultar" : "ver"}
                          </button>
                        ) : "-"}
                        {expandedLog === log.id && ((log.result && log.result.trim()) || (log.detail && log.detail.trim())) && (
                          <pre className="mt-1 max-w-[500px] overflow-x-auto rounded bg-zinc-900 p-2 text-[10px] text-zinc-400">
                            {(() => {
                              const raw = (log.result && log.result.trim()) ? log.result : (log.detail ?? "");
                              try { return JSON.stringify(JSON.parse(raw), null, 2); } catch { return raw; }
                            })()}
                          </pre>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-zinc-500">
                        {log.payload_meta ? (
                          <button type="button" onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)} className="cursor-pointer text-zinc-400 underline hover:text-zinc-200">
                            {expandedLog === log.id ? "ocultar" : "ver"}
                          </button>
                        ) : "-"}
                        {expandedLog === log.id && log.payload_meta && (
                          <pre className="mt-1 max-w-[500px] overflow-x-auto rounded bg-zinc-900 p-2 text-[10px] text-zinc-400">
                            {(() => { try { return JSON.stringify(JSON.parse(log.payload_meta), null, 2); } catch { return log.payload_meta; } })()}
                          </pre>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-zinc-500">
                        {log.response_meta ? (
                          <button type="button" onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)} className="cursor-pointer text-zinc-400 underline hover:text-zinc-200">
                            {expandedLog === log.id ? "ocultar" : "ver"}
                          </button>
                        ) : "-"}
                        {expandedLog === log.id && log.response_meta && (
                          <pre className="mt-1 max-w-[500px] overflow-x-auto rounded bg-zinc-900 p-2 text-[10px] text-zinc-400">
                            {(() => { try { return JSON.stringify(JSON.parse(log.response_meta), null, 2); } catch { return log.response_meta; } })()}
                          </pre>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}


