type AttributionSource = {
  landing?: unknown; landing_name?: unknown; landing_resolution?: unknown; facebook?: unknown; portofolio?: unknown; cp?: unknown; campana?: unknown;
  conjunto?: unknown; anuncio?: unknown; event_source_url?: unknown;
};

function text(value: unknown, limit = 300): string | null {
  if (typeof value !== 'string') return null;
  return value.trim().replace(/[\x00-\x1f\x7f]/g, '').slice(0, limit) || null;
}

function landingResolution(value: unknown): string | null {
  return value === 'url_parameter' || value === 'path' || value === 'automatic' ? value : null;
}

/** Keep original journey attribution on downstream conversions. UTM stays independent. */
export function urlAttribution(payload: AttributionSource, original?: AttributionSource | null) {
  let params = new URLSearchParams();
  try { params = new URL(String(payload.event_source_url || '')).searchParams; } catch { /* Legacy source without a URL. */ }
  return {
    landing: text(original?.landing, 160) || text(payload.landing, 160) ||
      text(params.get('landing'), 160) || text(original?.landing_name, 160) || text(payload.landing_name, 160),
    landing_resolution: landingResolution(original?.landing_resolution) || landingResolution(payload.landing_resolution),
    facebook: text(original?.facebook) || text(payload.facebook) || text(params.get('facebook')),
    portofolio: text(original?.portofolio) || text(payload.portofolio) || text(params.get('portofolio')),
    cp: text(original?.cp) || text(payload.cp) || text(params.get('cp')),
    campana: text(original?.campana) || text(payload.campana) || text(params.get('campana')),
    conjunto: text(original?.conjunto) || text(payload.conjunto) || text(params.get('conjunto')),
    anuncio: text(original?.anuncio) || text(payload.anuncio) || text(params.get('anuncio')),
  };
}
