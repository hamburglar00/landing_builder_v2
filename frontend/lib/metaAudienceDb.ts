import type { DateRange } from "@/components/conversiones/DateRangeFilter";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  mapMetaAudienceBuyerPayload,
  type MetaAudiencePerson,
} from "@/lib/metaAudienceExport";
import { supabase } from "@/lib/supabaseClient";

export type MetaAudienceCurrency = "ARS" | "PYG";

export type MetaAudienceBuyersRequest = {
  currency: MetaAudienceCurrency;
  range: DateRange;
};

export type MetaAudienceRpcParams = {
  p_currency: MetaAudienceCurrency;
  p_as_of: string;
  p_period_start_at: string;
  p_period_end_at: string;
};

export function buildMetaAudienceRpcParams(
  { currency, range }: MetaAudienceBuyersRequest,
  now = new Date(),
): MetaAudienceRpcParams {
  const asOf = new Date(now.getTime());
  const periodStart = new Date(range.start.getTime());
  const periodEnd = new Date(Math.min(range.end.getTime(), asOf.getTime()));
  if (
    !Number.isFinite(asOf.getTime())
    || !Number.isFinite(periodStart.getTime())
    || !Number.isFinite(periodEnd.getTime())
    || periodStart > periodEnd
  ) {
    throw new Error("El período seleccionado no es válido.");
  }
  return {
    p_currency: currency,
    p_as_of: asOf.toISOString(),
    p_period_start_at: periodStart.toISOString(),
    p_period_end_at: periodEnd.toISOString(),
  };
}

export async function fetchMetaAudienceBuyers(
  request: MetaAudienceBuyersRequest,
): Promise<MetaAudiencePerson[]> {
  return fetchMetaAudienceBuyersWithClient(supabase, request);
}

export async function fetchMetaAudienceBuyersWithClient(
  client: Pick<SupabaseClient, "rpc">,
  request: MetaAudienceBuyersRequest,
): Promise<MetaAudiencePerson[]> {
  const params = buildMetaAudienceRpcParams(request);
  const { data, error } = await client.rpc("get_meta_audience_buyers_v2_payload", params);
  if (error) throw error;
  const people = mapMetaAudienceBuyerPayload(data);
  if (new Set(people.map((person) => person.key)).size !== people.length) {
    throw new Error("La respuesta de Audiencias Meta contiene compradores duplicados.");
  }
  return people;
}
