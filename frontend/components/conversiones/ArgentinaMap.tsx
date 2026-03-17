"use client";

import { useState, useMemo, useEffect } from "react";
import { geoMercator, geoPath, type GeoPermissibleObjects } from "d3-geo";
import type { FunnelContact, ConversionRow } from "@/lib/conversionsDb";
import { classifyContact } from "@/lib/conversionsDb";

/* ═══════════════════════════════════════════════════════════════════════════
   METRIC DEFINITIONS
   ═══════════════════════════════════════════════════════════════════════════ */

type MapMetric =
  | "contactos"
  | "leads"
  | "primeras_cargas"
  | "recargas"
  | "cargas_totales"
  | "pct_inicio"
  | "pct_carga"
  | "carga_promedio"
  | "total_cargado"
  | "roas_primera"
  | "roas_total"
  | "jugadores_recurrentes"
  | "jugadores_premium";

const METRIC_LABELS: Record<MapMetric, string> = {
  contactos: "Contactos",
  leads: "Leads",
  primeras_cargas: "Primeras cargas",
  recargas: "Recargas",
  cargas_totales: "Cargas totales",
  pct_inicio: "% inicio conversaciones",
  pct_carga: "% de carga",
  carga_promedio: "Carga promedio",
  total_cargado: "Total cargado",
  roas_primera: "ROAS primera carga",
  roas_total: "ROAS total",
  jugadores_recurrentes: "Jugadores recurrentes",
  jugadores_premium: "Jugadores premium",
};

const PCT_METRICS = new Set<MapMetric>(["pct_inicio", "pct_carga"]);
const CURRENCY_METRICS = new Set<MapMetric>(["total_cargado", "carga_promedio"]);
const ROAS_METRICS = new Set<MapMetric>(["roas_primera", "roas_total"]);

/* ═══════════════════════════════════════════════════════════════════════════
   PROVINCE NORMALIZATION
   Maps GeoJSON nombre → canonical key, and geo_region → canonical key
   ═══════════════════════════════════════════════════════════════════════════ */

function normalizeKey(raw: string): string {
  return raw
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/,.*$/, "")
    .trim()
    .replace(/\s+/g, "_");
}

const GEO_REGION_ALIASES: Record<string, string> = {
  buenos_aires: "buenos_aires",
  provincia_de_buenos_aires: "buenos_aires",
  bsas: "buenos_aires",
  pba: "buenos_aires",
  caba: "ciudad_autonoma_de_buenos_aires",
  capital_federal: "ciudad_autonoma_de_buenos_aires",
  ciudad_autonoma_de_buenos_aires: "ciudad_autonoma_de_buenos_aires",
  autonomous_city_of_buenos_aires: "ciudad_autonoma_de_buenos_aires",
  catamarca: "catamarca",
  chaco: "chaco",
  chubut: "chubut",
  cordoba: "cordoba",
  corrientes: "corrientes",
  entre_rios: "entre_rios",
  formosa: "formosa",
  jujuy: "jujuy",
  la_pampa: "la_pampa",
  la_rioja: "la_rioja",
  mendoza: "mendoza",
  misiones: "misiones",
  neuquen: "neuquen",
  rio_negro: "rio_negro",
  salta: "salta",
  san_juan: "san_juan",
  san_luis: "san_luis",
  santa_cruz: "santa_cruz",
  santa_fe: "santa_fe",
  santiago_del_estero: "santiago_del_estero",
  tierra_del_fuego: "tierra_del_fuego",
  tierra_del_fuego_antartida_e_islas_del_atlantico_sur: "tierra_del_fuego",
  tucuman: "tucuman",
};

function normalizeProvince(raw: string | null): string | null {
  if (!raw) return null;
  const key = normalizeKey(raw);
  return GEO_REGION_ALIASES[key] ?? null;
}

/* ═══════════════════════════════════════════════════════════════════════════
   DISPLAY NAMES (keyed by normalizeKey of GeoJSON nombre)
   ═══════════════════════════════════════════════════════════════════════════ */

const DISPLAY_NAMES: Record<string, string> = {
  buenos_aires: "Buenos Aires",
  ciudad_autonoma_de_buenos_aires: "CABA",
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
  santiago_del_estero: "Sgo. del Estero",
  tierra_del_fuego: "Tierra del Fuego",
  tucuman: "Tucumán",
};

/* ═══════════════════════════════════════════════════════════════════════════
   COLOR SCALE
   ═══════════════════════════════════════════════════════════════════════════ */

function colorScale(value: number, max: number): string {
  if (max === 0 || value === 0) return "#18181b";
  const t = Math.min(value / max, 1);
  const r = Math.round(20 + t * 25);
  const g = Math.round(25 + t * 185);
  const b = Math.round(35 + t * 150);
  return `rgb(${r},${g},${b})`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   DATA BUILDER
   ═══════════════════════════════════════════════════════════════════════════ */

interface ProvinceData {
  contactos: number;
  reachedLead: number;
  reachedPurchase: number;
  reachedRepeat: number;
  primerasCargas: number;
  recurrentes: number;
  totalCargado: number;
  firstPurchaseRevenue: number;
  purchaseCount: number;
  premium: number;
}

function buildProvinceData(
  contacts: FunnelContact[],
  conversions: ConversionRow[],
  premiumThreshold: number,
): Map<string, ProvinceData> {
  const map = new Map<string, ProvinceData>();

  for (const c of contacts) {
    const prov = normalizeProvince(c.region);
    if (!prov) continue;
    const d = map.get(prov) ?? {
      contactos: 0, reachedLead: 0, reachedPurchase: 0, reachedRepeat: 0,
      primerasCargas: 0, recurrentes: 0, totalCargado: 0, firstPurchaseRevenue: 0,
      purchaseCount: 0, premium: 0,
    };
    d.contactos++;
    if (c.reached_lead) d.reachedLead++;
    if (c.reached_purchase) d.reachedPurchase++;
    if (c.reached_repeat) d.reachedRepeat++;
    if (c.reached_purchase && !c.reached_repeat) d.primerasCargas++;
    if (c.reached_repeat) d.recurrentes++;
    d.totalCargado += c.total_valor;
    d.purchaseCount += c.purchase_count;
    if (classifyContact(c, premiumThreshold) === "premium") d.premium++;
    map.set(prov, d);
  }

  for (const conv of conversions) {
    if (conv.estado !== "purchase" || conv.observaciones?.includes("REPEAT")) continue;
    const prov = normalizeProvince(conv.geo_region);
    if (!prov) continue;
    const d = map.get(prov);
    if (d) d.firstPurchaseRevenue += conv.valor;
  }

  return map;
}

function getMetricValue(
  d: ProvinceData | undefined,
  metric: MapMetric,
  adSpend: number,
  totalContacts: number,
): number {
  if (!d) return 0;
  switch (metric) {
    case "contactos": return d.contactos;
    case "leads": return d.reachedLead;
    case "primeras_cargas": return d.primerasCargas;
    case "recargas": return d.reachedRepeat;
    case "cargas_totales": return d.purchaseCount;
    case "pct_inicio": return d.contactos > 0 ? (d.reachedLead / d.contactos) * 100 : 0;
    case "pct_carga": return d.reachedLead > 0 ? (d.reachedPurchase / d.reachedLead) * 100 : 0;
    case "carga_promedio": return d.purchaseCount > 0 ? d.totalCargado / d.purchaseCount : 0;
    case "total_cargado": return d.totalCargado;
    case "roas_primera": {
      if (adSpend <= 0 || totalContacts === 0) return 0;
      const share = d.contactos / totalContacts;
      const attributedSpend = adSpend * share;
      return attributedSpend > 0 ? d.firstPurchaseRevenue / attributedSpend : 0;
    }
    case "roas_total": {
      if (adSpend <= 0 || totalContacts === 0) return 0;
      const share = d.contactos / totalContacts;
      const attributedSpend = adSpend * share;
      return attributedSpend > 0 ? d.totalCargado / attributedSpend : 0;
    }
    case "jugadores_recurrentes": return d.recurrentes;
    case "jugadores_premium": return d.premium;
  }
}

function formatMetricValue(value: number, metric: MapMetric): string {
  if (PCT_METRICS.has(metric)) return `${value.toFixed(1)}%`;
  if (ROAS_METRICS.has(metric)) return `${value.toFixed(2)}x`;
  if (CURRENCY_METRICS.has(metric)) {
    return value.toLocaleString("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }
  return value.toLocaleString("es-AR");
}

/* ═══════════════════════════════════════════════════════════════════════════
   GeoJSON types (minimal)
   ═══════════════════════════════════════════════════════════════════════════ */

interface GeoFeature {
  type: "Feature";
  properties: { nombre: string };
  geometry: GeoPermissibleObjects;
}

interface GeoCollection {
  type: "FeatureCollection";
  features: GeoFeature[];
}

/* ═══════════════════════════════════════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

const MAP_W = 400;
const MAP_H = 680;
const MAP_SCALE = 1.2;

export default function ArgentinaMap({
  contacts,
  conversions = [],
  premiumThreshold,
  adSpend = 0,
}: {
  contacts: FunnelContact[];
  conversions?: ConversionRow[];
  premiumThreshold: number;
  adSpend?: number;
}) {
  const [metric, setMetric] = useState<MapMetric>("contactos");
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    if (adSpend <= 0 && ROAS_METRICS.has(metric)) setMetric("contactos");
  }, [adSpend, metric]);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [geoData, setGeoData] = useState<GeoCollection | null>(null);

  useEffect(() => {
    fetch("/argentina-provinces.json")
      .then((r) => r.json())
      .then((d: GeoCollection) => setGeoData(d))
      .catch(() => {});
  }, []);

  const provinceData = useMemo(
    () => buildProvinceData(contacts, conversions, premiumThreshold),
    [contacts, conversions, premiumThreshold],
  );

  const totalContacts = contacts.length;

  const { provinces, viewW, viewH } = useMemo(() => {
    if (!geoData) return { provinces: [] as { key: string; path: string; name: string }[], viewW: MAP_W, viewH: MAP_H };

    const collection = geoData as GeoPermissibleObjects;
    const w = MAP_W / MAP_SCALE;
    const h = MAP_H / MAP_SCALE;
    const projection = geoMercator().fitSize([w, h], collection);
    const pathGen = geoPath(projection);

    const provs = geoData.features.map((f) => {
      const key = normalizeKey(f.properties.nombre);
      const canonKey = GEO_REGION_ALIASES[key] ?? key;
      const d = pathGen(f.geometry);
      return { key: canonKey, path: d ?? "", name: f.properties.nombre };
    });
    return { provinces: provs, viewW: w, viewH: h };
  }, [geoData]);

  const { values, max } = useMemo(() => {
    const vals = new Map<string, number>();
    let mx = 0;
    for (const p of provinces) {
      const v = getMetricValue(provinceData.get(p.key), metric, adSpend, totalContacts);
      vals.set(p.key, v);
      if (v > mx) mx = v;
    }
    return { values: vals, max: mx };
  }, [provinces, provinceData, metric, adSpend, totalContacts]);

  const ranking = useMemo(() => {
    return [...values.entries()]
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
  }, [values]);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const hoveredValue = hovered ? values.get(hovered) ?? 0 : 0;
  const hoveredData = hovered ? provinceData.get(hovered) : undefined;

  if (!geoData) {
    return (
      <div className="rounded-2xl border border-zinc-800/60 bg-[#0d0d11] p-5 flex items-center justify-center min-h-[300px]">
        <p className="text-sm text-zinc-500">Cargando mapa...</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-zinc-800/60 bg-[#0d0d11] p-5">
      <div className="flex flex-col gap-5 lg:flex-row">

        {/* Left: Map */}
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-zinc-200 mb-4">Mapa de Argentina</h4>

          {/* Metric selector */}
          <div className="flex flex-wrap gap-1.5 mb-5">
            {(Object.keys(METRIC_LABELS) as MapMetric[])
              .filter((m) => !ROAS_METRICS.has(m) || adSpend > 0)
              .map((m) => (
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
          <div className="relative">
            <svg
              viewBox={`0 0 ${viewW} ${viewH}`}
              className="w-full max-w-[400px] mx-auto"
              onMouseMove={handleMouseMove}
              style={{ filter: "drop-shadow(0 0 20px rgba(16,185,129,0.04))" }}
            >
              {provinces.map(({ key, path }) => {
                const val = values.get(key) ?? 0;
                const isHovered = hovered === key;
                return (
                  <path
                    key={key}
                    d={path}
                    fill={colorScale(val, max)}
                    stroke={isHovered ? "#6ee7b7" : "#27272a"}
                    strokeWidth={isHovered ? 1.5 : 0.5}
                    className="transition-colors duration-150 cursor-pointer"
                    style={isHovered ? { filter: "brightness(1.3)" } : undefined}
                    onMouseEnter={() => setHovered(key)}
                    onMouseLeave={() => setHovered(null)}
                  />
                );
              })}
            </svg>

            {/* Tooltip */}
            {hovered && (
              <div
                className="pointer-events-none absolute z-50 rounded-xl border border-zinc-700/60 bg-zinc-900/95 backdrop-blur-sm px-3.5 py-2.5 shadow-xl"
                style={{
                  left: Math.min(tooltipPos.x + 16, 300),
                  top: tooltipPos.y - 12,
                }}
              >
                <p className="text-[11px] font-semibold text-zinc-100 mb-1">
                  {DISPLAY_NAMES[hovered] ?? hovered}
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
                      {hoveredData.reachedPurchase} con carga{hoveredData.reachedPurchase !== 1 ? "s" : ""}
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
                    className={`rounded-lg px-3 py-2 transition-colors cursor-default ${
                      hovered === key ? "bg-zinc-800/70" : "bg-zinc-900/40"
                    }`}
                    onMouseEnter={() => setHovered(key)}
                    onMouseLeave={() => setHovered(null)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] text-zinc-300 font-medium">
                        <span className="text-zinc-600 mr-1.5">{i + 1}.</span>
                        {DISPLAY_NAMES[key] ?? key}
                      </span>
                      <span className="text-[11px] text-zinc-200 font-semibold tabular-nums">
                        {formatMetricValue(val, metric)}
                      </span>
                    </div>
                    <div className="h-1 rounded-full bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{ width: `${w}%`, backgroundColor: colorScale(val, max) }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

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
