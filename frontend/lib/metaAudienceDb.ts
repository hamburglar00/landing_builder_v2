import type { DateRange } from "@/components/conversiones/DateRangeFilter";
import {
  mapMetaAudienceBuyerRows,
  type MetaAudienceBuyerRpcRow,
  type MetaAudiencePerson,
  type MetaAudiencePurchaseScope,
  type MetaAudienceValueMetric,
} from "@/lib/metaAudienceExport";
import { supabase } from "@/lib/supabaseClient";

export type MetaAudienceCurrency = "ARS" | "PYG";

export type MetaAudienceBuyersRequest = {
  currency: MetaAudienceCurrency;
  range: DateRange;
  purchaseScope: MetaAudiencePurchaseScope;
  valueMetric: MetaAudienceValueMetric;
};

/**
 * The RPC derives the tenant from auth.uid() and RLS. No user id supplied by
 * the browser can widen the query to another tenant.
 */
export async function fetchMetaAudienceBuyers({
  currency,
  range,
  purchaseScope,
  valueMetric,
}: MetaAudienceBuyersRequest): Promise<MetaAudiencePerson[]> {
  const { data, error } = await supabase.rpc("get_meta_audience_buyers", {
    p_currency: currency,
    p_start_at: range.start.toISOString(),
    p_end_at: range.end.toISOString(),
    p_purchase_scope: purchaseScope,
    p_value_metric: valueMetric,
  });

  if (error) throw error;
  return mapMetaAudienceBuyerRows((data ?? []) as MetaAudienceBuyerRpcRow[]);
}
