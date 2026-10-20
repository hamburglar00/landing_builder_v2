export type Template7StageTimings = Partial<Record<"context" | "identity" | "link" | "handoff" | "finalize" | "total", number>>;

export function template7ServerTiming(accountMs: number, created: boolean, stages: Template7StageTimings): string {
  const parts = [`t7-account;dur=${Math.max(0, Math.round(accountMs))};desc="${created ? "created" : "recovered"}"`];
  for (const key of ["context", "identity", "link", "handoff", "finalize", "total"] as const) {
    const value = stages[key];
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) parts.push(`t7-${key};dur=${Math.round(value)}`);
  }
  return parts.join(", ");
}

export async function timedServerStage<T>(
  flow: string,
  stage: string,
  task: () => Promise<T>,
  recordDuration?: (durationMs: number) => void,
): Promise<T> {
  const startedAt = performance.now();
  try {
    const result = await task();
    console.info(JSON.stringify({
      source: "landing_builder.performance",
      flow,
      stage,
      duration_ms: Math.round(performance.now() - startedAt),
      result: "ok",
    }));
    return result;
  } catch (error) {
    console.info(JSON.stringify({
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

export function logServerFlowTotal(flow: string, startedAt: number): void {
  console.info(JSON.stringify({
    source: "landing_builder.performance",
    flow,
    stage: "total",
    duration_ms: Math.round(performance.now() - startedAt),
  }));
}
