import { buildEntryFunnelFactoryScript } from "./entryFunnel.client";
import { entryFunnelProvenance, type EntryFunnelProvenance, type EntryFunnelTemplate } from "./entryFunnel";

/** Public, non-personal build metadata only. An absent SHA is deliberately unknown. */
export function publicEntryFunnelMetadata(engine: NonNullable<EntryFunnelProvenance["engine"]>): EntryFunnelProvenance {
  const release = process.env.VERCEL_GIT_COMMIT_SHA || process.env.ENTRY_FUNNEL_RELEASE;
  const environment = process.env.VERCEL_ENV || (process.env.NODE_ENV === "development" ? "development" : "unknown");
  return entryFunnelProvenance({ engine,
    ...(release && /^[0-9a-f]{7,40}$/.test(release) ? { release } : {}),
    environment: ["production", "preview", "development"].includes(environment) ? environment : "unknown",
    source: process.env.ENTRY_FUNNEL_SYNTHETIC === "1" ? "synthetic" : "unknown",
  })!;
}

/** Insert before the existing T7/T8/T9 runtime. Does not load or delay Meta. */
export function buildEntryFunnelMetadataScript(engine: NonNullable<EntryFunnelProvenance["engine"]>): string {
  return `window.__ENTRY_FUNNEL_METADATA__=${JSON.stringify(publicEntryFunnelMetadata(engine))};`;
}

/** Inline in the existing public runtime/document for T1–T6; no extra blocking request. */
export function buildLandingEntryFunnelScript(config: {
  landingId: string; template: EntryFunnelTemplate; engine: NonNullable<EntryFunnelProvenance["engine"]>;
}): string {
  const settings = JSON.stringify({ landingId: config.landingId, template: config.template,
    telemetry: publicEntryFunnelMetadata(config.engine) }).replace(/</g, "\\u003c");
  return `try{(${buildEntryFunnelFactoryScript()})(${settings});}catch(_){};`;
}
