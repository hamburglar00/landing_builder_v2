type Payload = Record<string, unknown>;

/** Normalize seconds, milliseconds, and ISO timestamps without replacing old dates. */
export function originalEventTimeSeconds(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const raw = typeof value === "string" ? value.trim() : "";
  if (typeof value === "number" || /^\d+(?:\.\d+)?$/.test(raw)) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return null;
    const seconds = Math.floor(numeric >= 1_000_000_000_000 ? numeric / 1000 : numeric);
    return Number.isSafeInteger(seconds) && seconds > 0 && seconds <= 8_640_000_000_000
      ? seconds : null;
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})[Tt ](\d{2}):(\d{2}):(\d{2})(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/i.exec(raw);
  if (!iso) return null;
  const [, year, month, day, hour, minute, second, , zone] = iso;
  const daysInMonth = new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate();
  if (Number(month) < 1 || Number(month) > 12 || Number(day) < 1 || Number(day) > daysInMonth ||
    Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59) return null;
  // Legacy ISO dateTime without an offset uses the server's UTC convention;
  // never let the host's local timezone change a replay's instant.
  const milliseconds = Date.parse(raw.replace(" ", "T") + (zone ? "" : "Z"));
  return Number.isFinite(milliseconds) && milliseconds >= 1000
    ? Math.floor(milliseconds / 1000) : null;
}

/** Freeze the original occurrence time before inbox persistence and deferred retries. */
export function withOriginalEventTime(
  payload: Payload,
  receivedEventTime: number,
  canonicalAction: string,
): Payload & { event_time: number } {
  const next: Payload = { ...payload };
  const field = ({
    CONTACT: "contact_event_time",
    LEAD: "lead_event_time",
    COMPLETEREGISTRATION: "registration_event_time",
    PURCHASE: "purchase_event_time",
  } as Record<string, string>)[canonicalAction];
  const specificTime = field ? originalEventTimeSeconds(next[field]) : null;
  if (field && Object.hasOwn(next, field)) {
    // Handlers prefer their action-specific alias. An invalid truthy alias
    // must not hide the canonical original time and cause a Date.now fallback.
    if (specificTime === null) delete next[field];
    else next[field] = specificTime;
  }
  const candidates = [
    next.event_time,
    specificTime,
    ...(canonicalAction === "PURCHASE" ? [next.confirmed_at] : []),
    next.timestamp,
    next.dateTime,
    next.datetime,
  ];
  const original = candidates.map(originalEventTimeSeconds).find((value) => value !== null);
  next.event_time = original ?? Math.floor(receivedEventTime);
  // The handlers still select an action-specific alias first. Keep a supplied
  // valid alias coherent with the chosen canonical instant, including when an
  // explicit event_time takes precedence over a conflicting alias.
  if (field && specificTime !== null) next[field] = next.event_time;
  return next as Payload & { event_time: number };
}
