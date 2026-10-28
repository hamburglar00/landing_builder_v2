type AttributionRow = {
  facebook?: string | null;
  campana?: string | null;
  utm_campaign?: string | null;
  conjunto?: string | null;
  anuncio?: string | null;
};

const normalizedValue = (value: string | null | undefined) => String(value ?? "").trim();

export function conversionAttributionOptions(rows: readonly AttributionRow[]) {
  const facebook = new Set<string>();
  const campaigns = new Set<string>();
  const adSets = new Set<string>();
  const ads = new Set<string>();
  for (const row of rows) {
    const account = normalizedValue(row.facebook);
    if (account) facebook.add(account);
    for (const value of [row.campana, row.utm_campaign]) {
      const campaign = normalizedValue(value);
      if (campaign) campaigns.add(campaign);
    }
    const adSet = normalizedValue(row.conjunto);
    const ad = normalizedValue(row.anuncio);
    if (adSet) adSets.add(adSet);
    if (ad) ads.add(ad);
  }
  const sorted = (values: Set<string>) => Array.from(values).sort((a, b) => a.localeCompare(b, "es"));
  return { facebook: sorted(facebook), campaigns: sorted(campaigns), adSets: sorted(adSets), ads: sorted(ads) };
}

export function matchesConversionAttributionFilters(
  row: AttributionRow,
  campaigns: readonly string[],
  adSets: readonly string[],
  ads: readonly string[],
  facebook: readonly string[] = [],
): boolean {
  const byFacebook = facebook.length === 0 || facebook.includes(normalizedValue(row.facebook));
  const byCampaign = campaigns.length === 0 ||
    [row.campana, row.utm_campaign].some((value) => campaigns.includes(normalizedValue(value)));
  const byAdSet = adSets.length === 0 || adSets.includes(normalizedValue(row.conjunto));
  const byAd = ads.length === 0 || ads.includes(normalizedValue(row.anuncio));
  return byFacebook && byCampaign && byAdSet && byAd;
}

// Journey starts keep these link parameters in event_source_url rather than columns.
export function journeyStartAttribution(row: AttributionRow & { event_source_url?: string | null }) {
  let params: URLSearchParams | undefined;
  try {
    params = new URL(row.event_source_url ?? "").searchParams;
  } catch {
    // Older starts may not have a valid source URL; their stored UTM still applies.
  }
  const value = (key: keyof AttributionRow) => normalizedValue(row[key]) || params?.get(key) || "";
  return {
    facebook: value("facebook"),
    campana: value("campana"),
    utm_campaign: value("utm_campaign"),
    conjunto: value("conjunto"),
    anuncio: value("anuncio"),
  };
}
