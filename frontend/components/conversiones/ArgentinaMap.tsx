"use client";

import { useState, useMemo } from "react";
import type { FunnelContact } from "@/lib/conversionsDb";
import { classifyContact } from "@/lib/conversionsDb";

/* ═══════════════════════════════════════════════════════════════════════════
   METRIC DEFINITIONS
   ═══════════════════════════════════════════════════════════════════════════ */

type MapMetric =
  | "contactos"
  | "reached_lead"
  | "reached_purchase"
  | "reached_repeat"
  | "pct_lead"
  | "pct_purchase"
  | "pct_repeat"
  | "total_cargado"
  | "ticket_promedio"
  | "premium";

const METRIC_LABELS: Record<MapMetric, string> = {
  contactos: "Contactos",
  reached_lead: "Reached Lead",
  reached_purchase: "Reached Purchase",
  reached_repeat: "Reached Repeat",
  pct_lead: "% inicio conversaciones",
  pct_purchase: "% de carga",
  pct_repeat: "% de repeat",
  total_cargado: "Total cargado",
  ticket_promedio: "Ticket promedio",
  premium: "Jugadores premium",
};

const PCT_METRICS = new Set<MapMetric>(["pct_lead", "pct_purchase", "pct_repeat"]);
const CURRENCY_METRICS = new Set<MapMetric>(["total_cargado", "ticket_promedio"]);

/* ═══════════════════════════════════════════════════════════════════════════
   PROVINCE NORMALIZATION
   Maps common geo_region strings → canonical province key
   ═══════════════════════════════════════════════════════════════════════════ */

const PROVINCE_ALIASES: Record<string, string> = {
  "buenos aires": "buenos_aires",
  "provincia de buenos aires": "buenos_aires",
  "bsas": "buenos_aires",
  "pba": "buenos_aires",
  "caba": "caba",
  "capital federal": "caba",
  "ciudad autónoma de buenos aires": "caba",
  "ciudad autonoma de buenos aires": "caba",
  "autonomous city of buenos aires": "caba",
  "catamarca": "catamarca",
  "chaco": "chaco",
  "chubut": "chubut",
  "córdoba": "cordoba",
  "cordoba": "cordoba",
  "corrientes": "corrientes",
  "entre ríos": "entre_rios",
  "entre rios": "entre_rios",
  "formosa": "formosa",
  "jujuy": "jujuy",
  "la pampa": "la_pampa",
  "la rioja": "la_rioja",
  "mendoza": "mendoza",
  "misiones": "misiones",
  "neuquén": "neuquen",
  "neuquen": "neuquen",
  "río negro": "rio_negro",
  "rio negro": "rio_negro",
  "salta": "salta",
  "san juan": "san_juan",
  "san luis": "san_luis",
  "santa cruz": "santa_cruz",
  "santa fe": "santa_fe",
  "santiago del estero": "santiago_del_estero",
  "tierra del fuego": "tierra_del_fuego",
  "tierra del fuego, antártida e islas del atlántico sur": "tierra_del_fuego",
  "tucumán": "tucuman",
  "tucuman": "tucuman",
};

function normalizeProvince(raw: string | null): string | null {
  if (!raw) return null;
  const key = raw.trim().toLowerCase();
  return PROVINCE_ALIASES[key] ?? null;
}

/* ═══════════════════════════════════════════════════════════════════════════
   PROVINCE DISPLAY NAMES
   ═══════════════════════════════════════════════════════════════════════════ */

const PROVINCE_NAMES: Record<string, string> = {
  buenos_aires: "Buenos Aires",
  caba: "CABA",
  catamarca: "Catamarca",
  chaco: "Chaco",
  chubut: "Chubut",
  cordoba: "Córdoba",
  corrientes: "Corrientes",
  entre_rios: "Entre Ríos",
  formosa: "Formosa",
  jujuy: "Jujuy",
  la_pampa: "La Pampa",
  la_rioja: "La Rioja",
  mendoza: "Mendoza",
  misiones: "Misiones",
  neuquen: "Neuquén",
  rio_negro: "Río Negro",
  salta: "Salta",
  san_juan: "San Juan",
  san_luis: "San Luis",
  santa_cruz: "Santa Cruz",
  santa_fe: "Santa Fe",
  santiago_del_estero: "Santiago del Estero",
  tierra_del_fuego: "Tierra del Fuego",
  tucuman: "Tucumán",
};

/* ═══════════════════════════════════════════════════════════════════════════
   SVG PROVINCE PATHS — simplified outlines for each province
   viewBox: 0 0 400 700
   ═══════════════════════════════════════════════════════════════════════════ */

const PROVINCE_PATHS: Record<string, string> = {
  jujuy:
    "M120,8 L140,8 L145,20 L150,38 L142,50 L130,52 L118,44 L112,28 Z",
  salta:
    "M112,28 L118,44 L130,52 L142,50 L150,38 L160,50 L170,55 L180,68 L175,82 L165,95 L150,100 L135,110 L120,108 L108,95 L100,78 L95,60 L100,42 Z",
  formosa:
    "M180,68 L200,62 L225,60 L250,65 L260,75 L248,90 L230,95 L210,92 L190,95 L175,82 Z",
  misiones:
    "M260,75 L280,65 L295,72 L290,90 L275,100 L258,95 L248,90 Z",
  chaco:
    "M175,82 L190,95 L210,92 L230,95 L248,90 L258,95 L250,110 L240,125 L220,135 L200,132 L185,125 L170,115 L160,100 L165,95 Z",
  tucuman:
    "M120,108 L135,110 L145,120 L140,135 L128,140 L115,132 L110,118 Z",
  santiago_del_estero:
    "M145,120 L150,100 L160,100 L170,115 L185,125 L200,132 L195,150 L185,165 L170,170 L155,168 L140,160 L135,145 L140,135 Z",
  catamarca:
    "M95,120 L110,118 L115,132 L128,140 L135,145 L140,160 L132,175 L118,178 L105,168 L90,150 L88,135 Z",
  la_rioja:
    "M88,135 L90,150 L105,168 L118,178 L115,195 L105,210 L90,215 L78,200 L72,180 L75,155 Z",
  corrientes:
    "M220,135 L240,125 L250,110 L258,95 L275,100 L278,115 L270,130 L258,142 L242,148 L228,145 Z",
  santa_fe:
    "M200,132 L220,135 L228,145 L242,148 L248,165 L245,185 L238,200 L222,210 L208,205 L195,195 L188,180 L185,165 L195,150 Z",
  entre_rios:
    "M242,148 L258,142 L270,130 L278,152 L275,175 L265,195 L250,205 L238,200 L245,185 L248,165 Z",
  san_juan:
    "M60,200 L78,200 L90,215 L105,210 L115,225 L110,245 L95,258 L78,255 L62,240 L52,220 Z",
  cordoba:
    "M118,178 L132,175 L140,160 L155,168 L170,170 L185,165 L188,180 L195,195 L208,205 L205,225 L195,242 L178,250 L158,248 L140,240 L128,228 L120,212 L115,195 Z",
  san_luis:
    "M95,258 L110,245 L115,225 L120,212 L128,228 L140,240 L135,260 L122,275 L108,278 L95,270 Z",
  mendoza:
    "M52,220 L62,240 L78,255 L95,258 L95,270 L108,278 L105,298 L92,315 L75,320 L58,310 L42,290 L38,265 Z",
  buenos_aires:
    "M178,250 L195,242 L205,225 L222,210 L238,200 L250,205 L260,220 L268,245 L270,275 L262,305 L248,330 L230,345 L210,348 L192,340 L180,325 L172,305 L168,282 L170,262 Z",
  caba:
    "M237,212 L245,210 L248,218 L243,222 L237,218 Z",
  la_pampa:
    "M105,298 L122,275 L135,260 L140,240 L158,248 L178,250 L170,262 L168,282 L165,300 L158,318 L140,330 L120,332 L105,325 L95,315 L92,315 Z",
  neuquen:
    "M38,310 L58,310 L75,320 L92,315 L95,315 L105,325 L100,345 L88,360 L70,365 L52,358 L38,342 L32,325 Z",
  rio_negro:
    "M70,365 L88,360 L100,345 L105,325 L120,332 L140,330 L158,318 L165,300 L168,282 L172,305 L180,325 L175,350 L165,375 L148,395 L125,405 L100,402 L80,392 L65,380 Z",
  chubut:
    "M55,395 L65,380 L80,392 L100,402 L125,405 L148,395 L165,375 L175,380 L178,408 L172,438 L160,460 L138,472 L112,475 L88,468 L68,452 L55,432 L48,412 Z",
  santa_cruz:
    "M42,468 L55,452 L68,452 L88,468 L112,475 L138,472 L160,460 L172,470 L175,500 L170,535 L158,562 L138,578 L112,585 L88,580 L65,568 L48,548 L38,522 L35,495 Z",
  tierra_del_fuego:
    "M80,605 L105,598 L128,602 L145,615 L148,635 L138,655 L120,665 L100,662 L85,648 L78,630 L75,615 Z",
};

/* ═══════════════════════════════════════════════════════════════════════════
   PROVINCE LABEL POSITIONS (approximate centroids)
   ═══════════════════════════════════════════════════════════════════════════ */

const PROVINCE_LABEL_POS: Record<string, [number, number]> = {
  jujuy: [130, 30],
  salta: [135, 75],
  formosa: [218, 78],
  misiones: [272, 82],
  chaco: [210, 112],
  tucuman: [125, 125],
  santiago_del_estero: [162, 145],
  catamarca: [108, 155],
  la_rioja: [90, 180],
  corrientes: [252, 130],
  santa_fe: [218, 175],
  entre_rios: [260, 172],
  san_juan: [80, 232],
  cordoba: [158, 210],
  san_luis: [112, 258],
  mendoza: [68, 280],
  buenos_aires: [218, 285],
  caba: [255, 215],
  la_pampa: [132, 305],
  neuquen: [68, 340],
  rio_negro: [122, 378],
  chubut: [115, 435],
  santa_cruz: [108, 525],
  tierra_del_fuego: [112, 632],
};

/* ═══════════════════════════════════════════════════════════════════════════
   COLOR SCALE — dark premium teal gradient
   ═══════════════════════════════════════════════════════════════════════════ */

function colorScale(value: number, max: number): string {
  if (max === 0 || value === 0) return "#1a1a22";
  const t = Math.min(value / max, 1);
  const r = Math.round(20 + t * 25);
  const g = Math.round(25 + t * 180);
  const b = Math.round(35 + t * 155);
  return `rgb(${r},${g},${b})`;
}

function borderColor(value: number, max: number): string {
  if (max === 0 || value === 0) return "#27272a";
  const t = Math.min(value / max, 1);
  if (t > 0.7) return "#34d399";
  if (t > 0.4) return "#2dd4bf50";
  return "#27272a80";
}

/* ═══════════════════════════════════════════════════════════════════════════
   DATA BUILDER
   ═══════════════════════════════════════════════════════════════════════════ */

interface ProvinceData {
  contactos: number;
  reachedLead: number;
  reachedPurchase: number;
  reachedRepeat: number;
  totalCargado: number;
  purchaseCount: number;
  premium: number;
}

function buildProvinceData(
  contacts: FunnelContact[],
  premiumThreshold: number,
): Map<string, ProvinceData> {
  const map = new Map<string, ProvinceData>();
  for (const c of contacts) {
    const prov = normalizeProvince(c.region);
    if (!prov) continue;
    const d = map.get(prov) ?? {
      contactos: 0, reachedLead: 0, reachedPurchase: 0, reachedRepeat: 0,
      totalCargado: 0, purchaseCount: 0, premium: 0,
    };
    d.contactos++;
    if (c.reached_lead) d.reachedLead++;
    if (c.reached_purchase) d.reachedPurchase++;
    if (c.reached_repeat) d.reachedRepeat++;
    d.totalCargado += c.total_valor;
    d.purchaseCount += c.purchase_count;
    const stage = classifyContact(c, premiumThreshold);
    if (stage === "premium") d.premium++;
    map.set(prov, d);
  }
  return map;
}

function getMetricValue(d: ProvinceData | undefined, metric: MapMetric): number {
  if (!d) return 0;
  switch (metric) {
    case "contactos": return d.contactos;
    case "reached_lead": return d.reachedLead;
    case "reached_purchase": return d.reachedPurchase;
    case "reached_repeat": return d.reachedRepeat;
    case "pct_lead": return d.contactos > 0 ? (d.reachedLead / d.contactos) * 100 : 0;
    case "pct_purchase": return d.reachedLead > 0 ? (d.reachedPurchase / d.reachedLead) * 100 : 0;
    case "pct_repeat": return d.reachedPurchase > 0 ? (d.reachedRepeat / d.reachedPurchase) * 100 : 0;
    case "total_cargado": return d.totalCargado;
    case "ticket_promedio": return d.purchaseCount > 0 ? d.totalCargado / d.purchaseCount : 0;
    case "premium": return d.premium;
  }
}

function formatMetricValue(value: number, metric: MapMetric): string {
  if (PCT_METRICS.has(metric)) return `${value.toFixed(1)}%`;
  if (CURRENCY_METRICS.has(metric)) {
    return value.toLocaleString("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }
  return value.toLocaleString("es-AR");
}

/* ═══════════════════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

export default function ArgentinaMap({
  contacts,
  premiumThreshold,
}: {
  contacts: FunnelContact[];
  premiumThreshold: number;
}) {
  const [metric, setMetric] = useState<MapMetric>("contactos");
  const [hovered, setHovered] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const provinceData = useMemo(
    () => buildProvinceData(contacts, premiumThreshold),
    [contacts, premiumThreshold],
  );

  const { values, max } = useMemo(() => {
    const vals = new Map<string, number>();
    let mx = 0;
    for (const provKey of Object.keys(PROVINCE_PATHS)) {
      const v = getMetricValue(provinceData.get(provKey), metric);
      vals.set(provKey, v);
      if (v > mx) mx = v;
    }
    return { values: vals, max: mx };
  }, [provinceData, metric]);

  const ranking = useMemo(() => {
    return [...values.entries()]
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
  }, [values]);

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const hoveredValue = hovered ? values.get(hovered) ?? 0 : 0;
  const hoveredData = hovered ? provinceData.get(hovered) : undefined;

  return (
    <div className="rounded-2xl border border-zinc-800/60 bg-[#0d0d11] p-5">
      <div className="flex flex-col gap-5 lg:flex-row">

        {/* Left: Map */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-semibold text-zinc-200">Mapa de Argentina</h4>
          </div>

          {/* Metric selector */}
          <div className="flex flex-wrap gap-1.5 mb-5">
            {(Object.keys(METRIC_LABELS) as MapMetric[]).map((m) => (
              <button
                key={m}
                onClick={() => setMetric(m)}
                className={`cursor-pointer rounded-lg px-2.5 py-1 text-[10px] font-medium transition-all ${
                  metric === m
                    ? "bg-emerald-950/60 text-emerald-300 border border-emerald-800/50"
                    : "bg-zinc-900/60 text-zinc-500 border border-zinc-800/40 hover:text-zinc-300 hover:border-zinc-700/50"
                }`}
              >
                {METRIC_LABELS[m]}
              </button>
            ))}
          </div>

          {/* SVG Map */}
          <div className="relative" onMouseMove={handleMouseMove}>
            <svg
              viewBox="0 0 320 690"
              className="w-full max-w-[380px] mx-auto"
              style={{ filter: "drop-shadow(0 0 20px rgba(16,185,129,0.05))" }}
            >
              {Object.entries(PROVINCE_PATHS).map(([key, path]) => {
                const val = values.get(key) ?? 0;
                const isHovered = hovered === key;
                return (
                  <path
                    key={key}
                    d={path}
                    fill={colorScale(val, max)}
                    stroke={isHovered ? "#6ee7b7" : borderColor(val, max)}
                    strokeWidth={isHovered ? 1.8 : 0.6}
                    className="transition-all duration-150 cursor-pointer"
                    style={isHovered ? { filter: "brightness(1.3)" } : undefined}
                    onMouseEnter={() => setHovered(key)}
                    onMouseLeave={() => setHovered(null)}
                  />
                );
              })}

              {/* Province labels — tiny, only for hovered or top provinces */}
              {Object.entries(PROVINCE_LABEL_POS).map(([key, [x, y]]) => {
                const val = values.get(key) ?? 0;
                const isTop = val > 0 && max > 0 && val / max > 0.25;
                if (!isTop && hovered !== key) return null;
                return (
                  <text
                    key={key}
                    x={x}
                    y={y}
                    textAnchor="middle"
                    className="pointer-events-none select-none"
                    fill={hovered === key ? "#e4e4e7" : "#71717a"}
                    fontSize={hovered === key ? 9 : 7}
                    fontWeight={hovered === key ? 600 : 400}
                  >
                    {PROVINCE_NAMES[key]?.split(" ")[0] ?? key}
                  </text>
                );
              })}
            </svg>

            {/* Tooltip */}
            {hovered && (
              <div
                className="pointer-events-none absolute z-50 rounded-xl border border-zinc-700/60 bg-zinc-900/95 backdrop-blur-sm px-3.5 py-2.5 shadow-xl"
                style={{
                  left: Math.min(tooltipPos.x + 16, 280),
                  top: tooltipPos.y - 12,
                }}
              >
                <p className="text-[11px] font-semibold text-zinc-100 mb-1">
                  {PROVINCE_NAMES[hovered] ?? hovered}
                </p>
                <p className="text-[13px] font-bold text-emerald-400 tabular-nums">
                  {formatMetricValue(hoveredValue, metric)}
                </p>
                <p className="text-[9px] text-zinc-500 mt-0.5">{METRIC_LABELS[metric]}</p>
                {hoveredData && (
                  <div className="mt-1.5 pt-1.5 border-t border-zinc-800/60 space-y-0.5">
                    <p className="text-[9px] text-zinc-500">
                      {hoveredData.contactos} contacto{hoveredData.contactos !== 1 ? "s" : ""}
                      {" · "}
                      {hoveredData.reachedPurchase} comprador{hoveredData.reachedPurchase !== 1 ? "es" : ""}
                    </p>
                    {hoveredData.totalCargado > 0 && (
                      <p className="text-[9px] text-zinc-500">
                        Total: {formatMetricValue(hoveredData.totalCargado, "total_cargado")}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Color legend */}
          <div className="flex items-center gap-2 mt-3 justify-center">
            <span className="text-[9px] text-zinc-600">Bajo</span>
            <div className="flex h-2 w-32 rounded-full overflow-hidden">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="flex-1" style={{ backgroundColor: colorScale(i + 1, 10) }} />
              ))}
            </div>
            <span className="text-[9px] text-zinc-600">Alto</span>
          </div>
        </div>

        {/* Right: Ranking sidebar */}
        <div className="lg:w-64 shrink-0">
          <h4 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wide mb-3">
            Top provincias — {METRIC_LABELS[metric]}
          </h4>
          {ranking.length === 0 ? (
            <p className="text-[11px] text-zinc-600">Sin datos con provincia</p>
          ) : (
            <div className="space-y-1.5">
              {ranking.map(([key, val], i) => {
                const w = max > 0 ? Math.round((val / max) * 100) : 0;
                return (
                  <div
                    key={key}
                    className={`rounded-lg px-3 py-2 transition-colors ${
                      hovered === key ? "bg-zinc-800/70" : "bg-zinc-900/40"
                    }`}
                    onMouseEnter={() => setHovered(key)}
                    onMouseLeave={() => setHovered(null)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] text-zinc-300 font-medium">
                        <span className="text-zinc-600 mr-1.5">{i + 1}.</span>
                        {PROVINCE_NAMES[key]}
                      </span>
                      <span className="text-[11px] text-zinc-200 font-semibold tabular-nums">
                        {formatMetricValue(val, metric)}
                      </span>
                    </div>
                    <div className="h-1 rounded-full bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${w}%`,
                          backgroundColor: colorScale(val, max),
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* "Sin provincia" note */}
          {(() => {
            const sinProv = contacts.filter((c) => !normalizeProvince(c.region)).length;
            if (sinProv === 0) return null;
            return (
              <p className="mt-4 text-[10px] text-zinc-600">
                {sinProv} contacto{sinProv !== 1 ? "s" : ""} sin provincia asignada
              </p>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
