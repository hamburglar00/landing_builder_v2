export type LandingFbcConfig = {
  landingId: string; slug: string; workspaceCurrency: string; pixelId: string;
};
export type LandingAttribution = {
  version: 2; landing_id: string; workspace_currency: string; pixel_id: string;
  entry_source: "url" | "referrer" | "sdk_fresh" | "direct";
  fbc_source: "url" | "referrer" | "sdk_fresh" | "persisted" | "none";
  captured_at: number | null; legacy_fbc_quarantined: boolean;
};
type ClickSource = "url" | "referrer" | "sdk_fresh";
type RecordValue = { version: 2; scope: string; fbc: string; source: ClickSource; captured_at: number };
type Collector = {
  collect: () => { fbc: string; landing_attribution: LandingAttribution };
  collectNative: (source: string) => Promise<void>;
};

/** Self-contained for the public runtime and classic React. Never imports a global FBC. */
export function getLandingFbc(config: LandingFbcConfig): Collector {
  const browser = window as Window & {
    __LANDING_FBC_V2__?: Record<string, Collector>;
    __LANDING_FBC_NATIVE_CONTEXT__?: string;
    __ATRIO_META_COLLECT_CLICK_ID__?: () => Promise<string | null>;
  };
  const landing = String(config.landingId || "");
  const currency = String(config.workspaceCurrency || "ARS").trim().toUpperCase();
  const pixel = String(config.pixelId || "").replace(/\D/g, "");
  const scope = [landing, currency, pixel || "no-pixel"].join(":");
  const key = "landing-fbc:v2:" + scope;
  function pageContext() {
    const url = new URL(location.href);
    // Card selection and removal of personal query fields do not change the
    // destination. Only the effective landing and current click affect EBP.
    return url.origin + url.pathname.replace(/\/$/, "") + JSON.stringify([
      url.searchParams.getAll("landing"), url.searchParams.getAll("fbclid"),
    ]);
  }
  const entryUrl = pageContext();
  const context = key + "|" + entryUrl;
  const cache = browser.__LANDING_FBC_V2__ ||= {};
  if (cache[context]) return cache[context];
  const validScope = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(landing) && /^[A-Z]{3}$/.test(currency);
  const maxAge = 90 * 86400000, futureTolerance = 300000;
  let record: RecordValue | null = null;
  let entrySource: LandingAttribution["entry_source"] = "direct";
  let currentSource: LandingAttribution["fbc_source"] = "persisted";
  let nativePromise: Promise<void> | null = null;

  function clickId(value: unknown) {
    return typeof value === "string" && /^[A-Za-z0-9_-]{1,450}$/.test(value) ? value : "";
  }
  function parse(raw: unknown) {
    if (typeof raw !== "string" || raw.length > 500) return null;
    const match = /^fb\.1\.(\d+)\.([A-Za-z0-9_-]+)(?:\.([A-Za-z0-9_-]+))?$/.exec(raw);
    if (!match) return null;
    const numeric = Number(match[1]), at = numeric < 1000000000000 ? numeric * 1000 : numeric;
    if (!Number.isSafeInteger(at) || at <= 0) return null;
    return { at, click: match[2], fbc: "fb.1." + at + "." + match[2] + (match[3] ? "." + match[3] : "") };
  }
  function fresh(value: ReturnType<typeof parse>) {
    const now = Date.now();
    return !!value && value.at <= now + futureTolerance && now - value.at <= maxAge;
  }
  function globalCookie() {
    try {
      const value = document.cookie.split(";").find(part => part.trim().startsWith("_fbc="));
      return value ? decodeURIComponent(value.trim().slice(5)) : "";
    } catch { return ""; }
  }
  try {
    const saved = JSON.parse(localStorage.getItem(key) || "null") as RecordValue | null;
    const parsed = parse(saved?.fbc);
    if (validScope && saved?.version === 2 && saved.scope === scope && parsed &&
      ["url", "referrer", "sdk_fresh"].includes(saved.source) && Number.isSafeInteger(saved.captured_at) &&
      saved.captured_at === parsed.at && saved.captured_at <= Date.now() + futureTolerance) record = { ...saved, fbc: parsed.fbc };
  } catch { /* Storage can be unavailable; the current page still collects safely. */ }

  function accept(value: unknown, source: ClickSource) {
    const click = clickId(value);
    if (!validScope || !click) return;
    if (source === "sdk_fresh" && (entrySource === "url" || entrySource === "referrer")) return;
    const previous = parse(record?.fbc);
    // A replay of the same click never refreshes its original creation time,
    // including an expired click whose URL is opened again.
    if (previous?.click !== click) {
      const now = Date.now();
      record = { version: 2, scope, fbc: "fb.1." + now + "." + click, source, captured_at: now };
      try { localStorage.setItem(key, JSON.stringify(record)); } catch { /* Keep the in-memory record. */ }
    }
    entrySource = source; currentSource = source;
  }
  function fromUrl(url: URL) {
    const values = url.searchParams.getAll("fbclid");
    return values.length === 1 ? clickId(values[0]) : "";
  }
  try {
    const current = new URL(location.href), direct = fromUrl(current);
    if (direct) accept(direct, "url");
    else if (!current.searchParams.has("fbclid") && document.referrer) {
      const referrer = new URL(document.referrer);
      const host = referrer.hostname.toLowerCase();
      const metaHost = ["facebook.com", "instagram.com", "fb.com"].some(domain => host === domain || host.endsWith("." + domain));
      const selections = referrer.searchParams.getAll("landing");
      const sameLanding = referrer.origin === current.origin &&
        (selections.length === 1 ? selections[0] === config.slug : !selections.length && ["/" + config.slug, "/l/" + config.slug].includes(referrer.pathname.replace(/\/$/, "")));
      if (referrer.protocol === "https:" && (metaHost || sameLanding)) accept(fromUrl(referrer), "referrer");
    }
  } catch { /* An invalid URL never becomes attribution. */ }

  function collect() {
    const parsed = validScope ? parse(record?.fbc) : null;
    const fbc = fresh(parsed) ? parsed!.fbc : "";
    const global = parse(globalCookie());
    return { fbc, landing_attribution: {
      version: 2 as const, landing_id: landing, workspace_currency: currency, pixel_id: pixel,
      entry_source: entrySource, fbc_source: fbc ? currentSource : "none" as const,
      captured_at: fbc ? record!.captured_at : null,
      legacy_fbc_quarantined: !!globalCookie() && (!fbc || global?.click !== parsed?.click),
    } };
  }
  function collectNative(source: string) {
    if (nativePromise) return nativePromise;
    // The official bridge memoizes once per document. A SPA must not assign that
    // same result to another landing or to a later navigation in this document.
    if (browser.__LANDING_FBC_NATIVE_CONTEXT__ && browser.__LANDING_FBC_NATIVE_CONTEXT__ !== context) return Promise.resolve();
    browser.__LANDING_FBC_NATIVE_CONTEXT__ = context;
    nativePromise = new Promise<void>(resolve => {
      let settled = false;
      const finish = () => { if (settled) return; settled = true; clearTimeout(timer); resolve(); };
      // Includes asset download and the official bridge's own 800 ms deadline.
      const timer = setTimeout(finish, 2200);
      const run = () => {
        const fn = browser.__ATRIO_META_COLLECT_CLICK_ID__;
        if (!fn) { finish(); return; }
        try { Promise.resolve(fn()).then(value => {
          if (!settled && pageContext() === entryUrl) accept(value, "sdk_fresh");
        }).catch(() => {}).finally(finish); }
        catch { finish(); }
      };
      if (browser.__ATRIO_META_COLLECT_CLICK_ID__) { run(); return; }
      if (!/^\/vendor\/atrio-meta-click\/v1\/collect-click-id\.[a-f0-9]+\.js$/.test(source)) { finish(); return; }
      let script = document.querySelector<HTMLScriptElement>('script[data-atrio-meta-click="v1"]');
      let created = false;
      if (!script) {
        script = document.createElement("script"); script.src = source; script.async = true;
        script.setAttribute("data-atrio-meta-click", "v1"); created = true;
      }
      script.addEventListener("load", run, { once: true }); script.addEventListener("error", finish, { once: true });
      if (created) document.head.appendChild(script);
    });
    return nativePromise;
  }
  return cache[context] = { collect, collectNative };
}

export function buildLandingFbcFactoryScript() {
  return "(function(){var __name=function(fn){return fn;};return (" + getLandingFbc.toString() + ");})()";
}
