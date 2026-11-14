/** Optional per-landing presentation. Absence preserves the legacy global policy. */
export type GatewayEntry = { mode: "direct" | "credentials"; seconds: number };
export type GatewayEntryWait = { enabled: boolean; seconds: number; continueButtonEnabled: boolean };

export function normalizeGatewayEntry(value: unknown): GatewayEntry | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some(key => key !== "mode" && key !== "seconds") ||
      (input.mode !== "direct" && input.mode !== "credentials") ||
      !Number.isInteger(input.seconds) || Number(input.seconds) < 1 || Number(input.seconds) > 60) return undefined;
  return { mode: input.mode, seconds: Number(input.seconds) };
}

/** Call only with the policy read from the authorized, saved landing configuration. */
export function gatewayEntryWait(value: unknown): GatewayEntryWait | undefined {
  const policy = normalizeGatewayEntry(value);
  if (!policy) return undefined;
  return { enabled: policy.mode === "credentials", seconds: policy.seconds,
    continueButtonEnabled: policy.mode === "credentials" };
}
