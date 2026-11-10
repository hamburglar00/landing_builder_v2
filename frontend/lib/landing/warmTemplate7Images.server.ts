import "server-only";
import { template7ImageWarmUrls } from "./template7Images";

type Row = { landing_config?: unknown; config?: unknown };
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

export function imageConfigFromLanding(row: Row) {
  const saved = record(row.landing_config);
  const raw = record(row.config);
  const active = { ...raw, ...record(record(raw.templateConfigs)[String(raw.template || "")]) };
  const template = Number(String(active.template || '').replace('template', '')) || Number(record(saved.layout).template || 0);
  const content = record(saved.content);
  const background = record(saved.background);
  const candidates = Array.isArray(background.images) ? background.images : Array.isArray(active.backgroundImages) ? active.backgroundImages : [];
  return {
    layout: { template },
    content: { logoUrl: String(content.logoUrl || active.logoUrl || ""),
      template4: { ...record(active.template4Chat), ...record(content.template4) },
      template5: { ...record(active.template5Live), ...record(content.template5) },
      template6: { ...record(active.template6Cover), ...record(content.template6) },
      template8: { ...record(active.template8Cover), ...record(content.template8) },
    },
    background: { images: candidates.filter((item): item is string => typeof item === "string") },
  };
}

/** Warm derivatives on publication, never in the visitor's HTML request. */
export async function warmTemplate7Images(row: Row, storageOrigin: string, fetcher: typeof fetch = fetch) {
  let origin: URL;
  try { origin = new URL(storageOrigin); } catch { return { total: 0, ready: 0 }; }
  const candidates = template7ImageWarmUrls(imageConfigFromLanding(row));
  const urls = [...new Set(candidates)].filter(value => {
    try { const url = new URL(value); return url.origin === origin.origin && url.pathname.startsWith("/storage/v1/render/image/public/landing-images/"); }
    catch { return false; }
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  let ready = 0;
  let cursor = 0;
  try {
    await Promise.all(Array.from({ length: Math.min(3, urls.length) }, async () => {
      while (cursor < urls.length && !controller.signal.aborted) {
        const url = urls[cursor++];
        try {
          const response = await fetcher(url, {
            method: "GET", redirect: "error", cache: "no-store",
            signal: controller.signal, headers: { Accept: "image/webp" },
          });
          if (!response.ok || !response.headers.get("content-type")?.startsWith("image/")) {
            await response.body?.cancel();
            continue;
          }
          const reader = response.body?.getReader();
          if (!reader) continue;
          let bytes = 0;
          while (true) {
            const part = await reader.read();
            if (part.done) { if (bytes > 0) ready++; break; }
            bytes += part.value.byteLength;
            if (bytes > 2 * 1024 * 1024) { await reader.cancel(); break; }
          }
        } catch { /* Rendering retains on-demand transforms and original fallback. */ }
      }
    }));
  } finally { clearTimeout(timeout); }
  return { total: urls.length, ready };
}
