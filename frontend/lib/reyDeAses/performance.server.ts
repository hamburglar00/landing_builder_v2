export async function timedServerStage<T>(
  flow: string,
  stage: string,
  task: () => Promise<T>,
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
