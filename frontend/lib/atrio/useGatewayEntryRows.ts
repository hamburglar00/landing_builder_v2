"use client";

import { useEffect, useMemo, useState } from "react";
import type { DateRange } from "@/components/conversiones/DateRangeFilter";
import { isSameDateRange } from "@/components/conversiones/conversionPageShared";
import { filterConversionsByCurrency, type CurrencyScope } from "../currency";
import type { ConversionRow } from "../conversionsDb";
import { supabase } from "../supabaseClient";
import { attachGatewayEntries, fetchGatewayEntryBatch } from "./gatewayEntries";
import { isAtrioGatewayCta } from "./gatewayCta";

export type GatewayConversionRead = { viewerId: string; range: DateRange | null; rows: ConversionRow[] };
type Entry = Pick<ConversionRow, "gateway_entry_measured" | "gateway_entry_event_id" | "gateway_entry_event_time">;

/** Preserve local edits to a conversion while its independent chat evidence is loading. */
export function useGatewayEntryRows(
  rows: ConversionRow[],
  read: GatewayConversionRead | null,
  viewerId: string | null,
  range: DateRange | null,
  currency: CurrencyScope,
  enabled: boolean,
) {
  const [sessionViewer, setSessionViewer] = useState<string | null>(null);
  const [result, setResult] = useState<{ dataset: ConversionRow[]; entries: Map<string, Entry> } | null>(null);
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setSessionViewer(session?.user.id ?? null);
      if (event === "SIGNED_OUT") setResult(null);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  const current = read && read.viewerId === viewerId && isSameDateRange(read.range, range) ? read : null;
  // Each successful base read starts a new measurement, even for the same row IDs.
  // Changing tabs, editing an email or repainting the table can reuse that measurement.
  const dataset = useMemo(() => current ? filterConversionsByCurrency(current.rows, currency).filter(isAtrioGatewayCta) : null, [current, currency]);
  const completed = sessionViewer === viewerId && result?.dataset === dataset;
  useEffect(() => {
    if (!enabled || !dataset?.length || !viewerId || sessionViewer !== viewerId || completed) return;
    const controller = new AbortController();
    const batch = (ids: string[]) => fetchGatewayEntryBatch(ids, viewerId, controller.signal);
    void attachGatewayEntries(dataset, batch, controller.signal).then(enriched => {
      if (controller.signal.aborted) return;
      const entries = new Map<string, Entry>();
      for (const row of enriched) {
        if (row.gateway_entry_measured) entries.set(row.id, {
          gateway_entry_measured: true,
          gateway_entry_event_id: row.gateway_entry_event_id,
          gateway_entry_event_time: row.gateway_entry_event_time,
        });
      }
      setResult({ dataset, entries });
    });
    return () => controller.abort();
  }, [enabled, dataset, viewerId, sessionViewer, completed]);

  const visibleRows = useMemo(() => {
    if (!completed || !result?.entries.size) return rows;
    return rows.map(row => {
      const evidence = result.entries.get(row.id);
      return evidence ? { ...row, ...evidence } : row;
    });
  }, [rows, completed, result]);
  return { rows: visibleRows, pending: enabled && Boolean(dataset?.length) && !completed };
}
