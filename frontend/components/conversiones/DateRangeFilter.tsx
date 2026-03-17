"use client";

import { useState, useRef, useEffect } from "react";

export interface DateRange {
  start: Date;
  end: Date;
}

type Preset = "hoy" | "ayer" | "semana" | "mes" | "mes_pasado" | "maximo" | "personalizado";

const PRESET_LABELS: Record<Preset, string> = {
  hoy: "Hoy",
  ayer: "Ayer",
  semana: "Esta semana",
  mes: "Este mes",
  mes_pasado: "Mes pasado",
  maximo: "Máximo",
  personalizado: "Personalizado",
};

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function endOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function rangeForPreset(preset: Preset): DateRange | null {
  const now = new Date();
  switch (preset) {
    case "hoy":
      return { start: startOfDay(now), end: endOfDay(now) };
    case "ayer": {
      const y = new Date(now); y.setDate(y.getDate() - 1);
      return { start: startOfDay(y), end: endOfDay(y) };
    }
    case "semana": {
      const day = now.getDay();
      const diff = day === 0 ? 6 : day - 1;
      const mon = new Date(now); mon.setDate(mon.getDate() - diff);
      return { start: startOfDay(mon), end: endOfDay(now) };
    }
    case "mes":
      return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: endOfDay(now) };
    case "mes_pasado": {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start: first, end: endOfDay(last) };
    }
    case "maximo":
      return null;
    case "personalizado":
      return null;
  }
}

function fmtDate(d: Date) {
  return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getFullYear()}`;
}

function toInputVal(d: Date) {
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`;
}

export default function DateRangeFilter({
  onChange,
}: {
  onChange: (range: DateRange | null) => void;
}) {
  const [preset, setPreset] = useState<Preset>("maximo");
  const [showCustom, setShowCustom] = useState(false);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setShowCustom(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handlePreset = (p: Preset) => {
    if (p === "personalizado") {
      setPreset(p);
      setShowCustom(true);
      return;
    }
    setPreset(p);
    setShowCustom(false);
    onChange(rangeForPreset(p));
  };

  const handleCustomApply = () => {
    if (!customStart || !customEnd) return;
    const s = new Date(customStart + "T00:00:00");
    const e = new Date(customEnd + "T23:59:59.999");
    if (isNaN(s.getTime()) || isNaN(e.getTime()) || s > e) return;
    setPreset("personalizado");
    setShowCustom(false);
    onChange({ start: s, end: e });
  };

  const activeLabel = preset === "personalizado" && customStart && customEnd
    ? `${fmtDate(new Date(customStart + "T00:00:00"))} – ${fmtDate(new Date(customEnd + "T00:00:00"))}`
    : PRESET_LABELS[preset];

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center gap-1 rounded-lg border border-zinc-800/50 bg-[#0d0d11] p-0.5">
        {(Object.keys(PRESET_LABELS) as Preset[]).map((p) => (
          <button
            key={p}
            onClick={() => handlePreset(p)}
            className={`cursor-pointer rounded-md px-2.5 py-1 text-[10px] font-medium transition-all whitespace-nowrap ${
              preset === p
                ? "bg-zinc-800 text-zinc-200 shadow-sm"
                : "text-zinc-600 hover:text-zinc-300"
            }`}
          >
            {p === "personalizado" && preset === "personalizado" && customStart ? activeLabel : PRESET_LABELS[p]}
          </button>
        ))}
      </div>

      {showCustom && (
        <div className="absolute right-0 top-full mt-2 z-50 rounded-xl border border-zinc-700/60 bg-zinc-900/95 backdrop-blur-sm p-4 shadow-xl min-w-[280px]">
          <p className="text-[11px] text-zinc-400 mb-3 font-medium">Rango personalizado</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-zinc-500 mb-1 block">Desde</label>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-[11px] text-zinc-200 outline-none focus:border-zinc-500"
              />
            </div>
            <div>
              <label className="text-[10px] text-zinc-500 mb-1 block">Hasta</label>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-[11px] text-zinc-200 outline-none focus:border-zinc-500"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={handleCustomApply}
            disabled={!customStart || !customEnd}
            className="mt-3 w-full cursor-pointer rounded-lg bg-zinc-100 px-3 py-1.5 text-[11px] font-medium text-zinc-900 transition hover:bg-zinc-200 disabled:opacity-40"
          >
            Aplicar
          </button>
        </div>
      )}
    </div>
  );
}

/** Utility to filter conversions by date range */
export function filterByDateRange<T extends { created_at: string }>(
  rows: T[],
  range: DateRange | null,
): T[] {
  if (!range) return rows;
  const start = range.start.getTime();
  const end = range.end.getTime();
  return rows.filter((r) => {
    const t = new Date(r.created_at).getTime();
    return t >= start && t <= end;
  });
}

/** Utility to filter funnel contacts by date range (overlapping activity) */
export function filterFunnelByDateRange<T extends { first_contact: string; last_activity: string }>(
  rows: T[],
  range: DateRange | null,
): T[] {
  if (!range) return rows;
  const start = range.start.getTime();
  const end = range.end.getTime();
  return rows.filter((r) => {
    const first = new Date(r.first_contact).getTime();
    const last = new Date(r.last_activity).getTime();
    return last >= start && first <= end;
  });
}
