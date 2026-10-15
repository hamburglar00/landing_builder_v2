/** Public origins only; Ganamos+ must not replace the origin of other skins. */
export function gatewayOriginFor(
  provider: string | null | undefined,
  skinCode: string | null | undefined,
  env: Record<string, string | undefined> = process.env,
): string | undefined {
  if (provider === "multi_skin") {
    return skinCode === "ganamos_plus" && env.GANAMOS_PLUS_GATEWAY_ORIGIN
      ? env.GANAMOS_PLUS_GATEWAY_ORIGIN
      : env.MULTI_SKIN_GATEWAY_ORIGIN;
  }
  if (provider === "ases_del_norte") return env.ASES_DEL_NORTE_GATEWAY_ORIGIN;
  if (provider === "ganamos_net") return env.GANAMOS_NET_GATEWAY_ORIGIN;
  return env.REY_GATEWAY_ORIGIN;
}
