export type Template7TargetProvider =
  | "rey_de_ases"
  | "multi_skin"
  | "ases_del_norte"
  | "ganamos_net";

export function targetProviderForTemplate7(
  rawConfig: Record<string, unknown>,
): Template7TargetProvider {
  if (
    rawConfig.targetProvider === "multi_skin" ||
    rawConfig.targetProvider === "ases_del_norte" ||
    rawConfig.targetProvider === "ganamos_net"
  ) {
    return rawConfig.targetProvider;
  }

  return "rey_de_ases";
}
