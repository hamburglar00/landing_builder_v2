import { entryLogTrace } from "../landing/entryFunnel.server";

export type Template7StageTimings = Partial<Record<"context" | "identity" | "link" | "handoff" | "finalize" | "total", number>>;

export function template7ServerTiming(accountMs: number, created: boolean, stages: Template7StageTimings, providerTimings?: string): string {
  const parts = [`t7-account;dur=${Math.max(0, Math.round(accountMs))};desc="${created ? "created" : "recovered"}"`];
  for (const key of ["context", "identity", "link", "handoff", "finalize", "total"] as const) {
    const value = stages[key];
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) parts.push(`t7-${key};dur=${Math.round(value)}`);
  }
  const provider = safeProvisionTiming(providerTimings);
  if (provider) parts.push(provider);
  return parts.join(", ");
}

export async function timedServerStage<T>(
  flow: string,
  stage: string,
  task: () => Promise<T>,
  recordDuration?: (durationMs: number) => void,
  trace?: unknown,
): Promise<T> {
  const startedAt = performance.now();
  try {
    const result = await task();
    console.info(JSON.stringify({
      ...entryLogTrace(trace),
      source: "landing_builder.performance",
      flow,
      stage,
      duration_ms: Math.round(performance.now() - startedAt),
      result: "ok",
    }));
    return result;
  } catch (error) {
    console.info(JSON.stringify({
      ...entryLogTrace(trace),
      source: "landing_builder.performance",
      flow,
      stage,
      duration_ms: Math.round(performance.now() - startedAt),
      result: "failure",
    }));
    throw error;
  } finally {
    recordDuration?.(Math.round(performance.now() - startedAt));
  }
}

export function logServerFlowTotal(flow: string, startedAt: number, trace?: unknown): void {
  console.info(JSON.stringify({
    ...entryLogTrace(trace),
    source: "landing_builder.performance",
    flow,
    stage: "total",
    duration_ms: Math.round(performance.now() - startedAt),
  }));
}

/** Forward only numeric, known API2 phases; never reflect arbitrary header descriptions. */
export function safeProvisionTiming(header?: string | null): string {
  if (!header || header.length > 1024) return "";
  return header.split(",").map(part => part.trim()).filter(part =>
    /^atrio_(?:database_lookup|provider_create|provider_verify|local_finalize);dur=[0-9]{1,8}$/.test(part) &&
    Number(part.split("=")[1]) <= 86400000).slice(0, 8).join(", ");
}
