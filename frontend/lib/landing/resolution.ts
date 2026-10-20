export type LandingResolution = "url_parameter" | "path" | "automatic";

/** Self-contained so both the inline runtime and classic React use this capture. */
export function captureLandingResolution(slug: string, allowAutomatic = false): LandingResolution | null {
  // Next folds `typeof window` in server bundles. Keep the browser guard
  // dynamic because this function is also serialized into the public runtime.
  if (!globalThis.window) return null;
  const browser = window as Window & {
    __LANDING_RESOLUTION__?: { slug: string; url: string; value: LandingResolution | null };
  };
  const saved = browser.__LANDING_RESOLUTION__;
  if (saved?.slug === slug && saved.url === window.location.href) return saved.value;

  const url = new URL(window.location.href);
  const selections = url.searchParams.getAll("landing");
  const automatic = url.searchParams.getAll("__landing_auto");
  let value: LandingResolution | null = null;
  let pathname = url.pathname.replace(/\/$/, "");
  try { pathname = decodeURIComponent(pathname); } catch { /* Invalid paths are not classified. */ }
  if (selections.length === 1 && selections[0].trim() === slug) {
    value = "url_parameter";
  } else if (!selections.length || selections.length === 1 && !selections[0].trim()) {
    const expectedPath = allowAutomatic ? `/${slug}` : `/l/${slug}`;
    if (pathname === expectedPath) {
      value = allowAutomatic && automatic.length === 1 && automatic[0] === slug ? "automatic" : "path";
    }
  }

  // This marker is issued by the classic root redirect. Consume it once so
  // copying/reloading the resulting direct link does not report a new selection.
  if (url.searchParams.has("__landing_auto")) {
    url.searchParams.delete("__landing_auto");
    try { window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash); } catch { /* Capture still works without History API. */ }
  }
  browser.__LANDING_RESOLUTION__ = { slug, url: window.location.href, value };
  return value;
}
