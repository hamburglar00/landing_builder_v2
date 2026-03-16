"use client";

import { useState } from "react";
import {
  type FunnelContact,
  type FunnelStage,
  classifyContact,
} from "@/lib/conversionsDb";

type SortKey = "date" | "amount";

const STAGE_META: Record<
  FunnelStage,
  { label: string; color: string; bg: string; border: string }
> = {
  leads: {
    label: "Leads",
    color: "text-amber-300",
    bg: "bg-amber-950/30",
    border: "border-amber-800/50",
  },
  primera_carga: {
    label: "Primera Carga",
    color: "text-sky-300",
    bg: "bg-sky-950/30",
    border: "border-sky-800/50",
  },
  recurrente: {
    label: "Jugador Recurrente",
    color: "text-violet-300",
    bg: "bg-violet-950/30",
    border: "border-violet-800/50",
  },
  premium: {
    label: "Jugador Premium",
    color: "text-emerald-300",
    bg: "bg-emerald-950/30",
    border: "border-emerald-800/50",
  },
};

const STAGES: FunnelStage[] = [
  "leads",
  "primera_carga",
  "recurrente",
  "premium",
];

function waLink(phone: string) {
  return `https://wa.me/${phone.replace(/\D/g, "")}`;
}

function formatCurrency(n: number) {
  return n.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function ContactCard({ c }: { c: FunnelContact }) {
  const name = [c.fn, c.ln].filter(Boolean).join(" ");
  return (
    <div className="rounded-lg border border-zinc-700/60 bg-zinc-900/80 p-3 space-y-1.5">
      <p className="text-sm font-semibold text-zinc-100 font-mono tracking-tight">
        {c.phone}
      </p>
      {name && (
        <p className="text-xs text-zinc-300 truncate">{name}</p>
      )}
      {c.email && (
        <p className="text-[11px] text-zinc-400 truncate">{c.email}</p>
      )}

      {c.purchase_count > 0 && (
        <div className="flex items-baseline gap-2 pt-1">
          <span className="text-sm font-semibold text-emerald-400">
            {formatCurrency(c.total_valor)}
          </span>
          <span className="text-[10px] text-zinc-500">
            {c.purchase_count} carga{c.purchase_count !== 1 ? "s" : ""}
          </span>
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        <a
          href={waLink(c.phone)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded bg-emerald-900/60 px-2 py-0.5 text-[10px] font-medium text-emerald-300 hover:bg-emerald-800/60 transition"
        >
          <svg viewBox="0 0 24 24" className="h-3 w-3 fill-current">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
            <path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.611.611l4.458-1.495A11.935 11.935 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22a9.94 9.94 0 01-5.39-1.585l-.386-.234-2.647.887.887-2.647-.234-.386A9.94 9.94 0 012 12C2 6.486 6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z" />
          </svg>
          WhatsApp
        </a>
        <span className="text-[10px] text-zinc-600">
          {new Date(c.last_activity).toLocaleDateString("es-AR")}
        </span>
      </div>
    </div>
  );
}

export default function FunnelBoard({
  contacts,
  premiumThreshold,
}: {
  contacts: FunnelContact[];
  premiumThreshold: number;
}) {
  const [sort, setSort] = useState<SortKey>("date");

  const grouped: Record<FunnelStage, FunnelContact[]> = {
    leads: [],
    primera_carga: [],
    recurrente: [],
    premium: [],
  };

  for (const c of contacts) {
    grouped[classifyContact(c, premiumThreshold)].push(c);
  }

  const sortFn = (a: FunnelContact, b: FunnelContact) =>
    sort === "amount"
      ? b.total_valor - a.total_valor
      : new Date(b.last_activity).getTime() -
        new Date(a.last_activity).getTime();

  for (const stage of STAGES) grouped[stage].sort(sortFn);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-xs text-zinc-400">Ordenar por:</span>
        {(["date", "amount"] as SortKey[]).map((k) => (
          <button
            key={k}
            onClick={() => setSort(k)}
            className={`cursor-pointer rounded-md px-3 py-1 text-xs font-medium transition ${
              sort === k
                ? "bg-zinc-700 text-zinc-100"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {k === "date" ? "Fecha" : "Monto"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {STAGES.map((stage) => {
          const meta = STAGE_META[stage];
          const list = grouped[stage];
          return (
            <div
              key={stage}
              className={`rounded-xl border ${meta.border} ${meta.bg} flex flex-col`}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/50">
                <h4 className={`text-xs font-semibold ${meta.color}`}>
                  {meta.label}
                </h4>
                <span className={`text-[11px] font-medium ${meta.color}`}>
                  {list.length}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-[65vh]">
                {list.length === 0 ? (
                  <p className="text-[11px] text-zinc-600 text-center py-4">
                    Sin contactos
                  </p>
                ) : (
                  list.map((c) => (
                    <ContactCard key={c.phone} c={c} />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
