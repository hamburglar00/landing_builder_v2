export type WhatsappUsage = "acquisition" | "follow_up";
type Metadata = { managerId: number; usage: WhatsappUsage };

/** Undefined = old API2: preserve Builder's manual classification during rollout. */
export function parseMktWhatsappUsage(
  raw: unknown,
  publishedPhones: string[],
  normalize: (phone: string) => string | null,
) {
  const result = new Map<string, Metadata>();
  if (raw === undefined) return result;
  if (!Array.isArray(raw)) throw Error("INVALID_MKT_WHATSAPP_USAGE");
  const published = new Set(publishedPhones.map(normalize).filter(Boolean));
  for (const item of raw) {
    if (
      !item || typeof item.phone !== "string" ||
      !Number.isSafeInteger(item.manager_id) || item.manager_id <= 0 ||
      !["acquisition", "follow_up"].includes(item.usage)
    ) throw Error("INVALID_MKT_WHATSAPP_USAGE");
    const phone = normalize(item.phone);
    if (!phone) continue; // A different currency/workspace remains outside this sync.
    if (!published.has(phone)) throw Error("UNPUBLISHED_MKT_WHATSAPP_USAGE");
    const previous = result.get(phone);
    if (
      previous &&
      (previous.managerId !== item.manager_id || previous.usage !== item.usage)
    ) {
      throw Error("CONFLICTING_MKT_WHATSAPP_USAGE");
    }
    result.set(phone, { managerId: item.manager_id, usage: item.usage });
  }
  if (result.size !== published.size) {
    throw Error("INCOMPLETE_MKT_WHATSAPP_USAGE");
  }
  return result;
}

export function resolvePhoneUsage(
  kind: string,
  metadata: Metadata | undefined,
  existing?: { assignmentRole: WhatsappUsage; managerId: number | null },
) {
  return {
    assignment_role: kind === "mkt" && metadata
      ? metadata.usage
      : existing?.assignmentRole ?? "acquisition",
    pbadmin_manager_id: kind === "mkt"
      ? metadata?.managerId ?? existing?.managerId ?? null
      : null,
  };
}

/** Separate upsert shapes: omitted fields must stay omitted, never null/default a legacy sale. */
export function phoneUsageBatches<
  T extends {
    kind: string;
    phone: string;
    assignment_role: WhatsappUsage;
    pbadmin_manager_id: number | null;
  },
>(rows: T[], metadata: Map<string, Metadata>) {
  const managed = rows.filter((row) =>
    row.kind === "mkt" && metadata.has(row.phone)
  );
  const legacy = rows.filter((row) =>
    row.kind === "mkt" && !metadata.has(row.phone)
  )
    .map(({ assignment_role: _role, pbadmin_manager_id: _manager, ...row }) =>
      row
    );
  const other = rows.filter((row) => row.kind !== "mkt")
    .map(({ assignment_role: _role, ...row }) => row);
  return [managed, legacy, other].filter((batch) => batch.length);
}
