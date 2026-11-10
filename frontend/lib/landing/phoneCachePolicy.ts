/** Same freshness/selection guard as landing-phone; never select or reserve a number here. */
export function canUseCachedLandingPhone(data: Record<string, unknown> | null | undefined, now = Date.now()) {
  if (!data?.phone) return false;
  if (["fair", "weighted_quota"].includes(String(data.gerenciaSelectionMode ?? "").toLowerCase()) ||
      String(data.phoneMode ?? "").toLowerCase() === "fair") return false;
  const refreshedAt = data.cacheRefreshedAt ? Date.parse(String(data.cacheRefreshedAt)) : 0;
  return Boolean(refreshedAt && now - refreshedAt <= 90000);
}
