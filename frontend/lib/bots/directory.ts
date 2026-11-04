export type ImportScope = { kind: "agency" | "owner"; id: number };
export type DirectoryBot = {
  agency_name?: string | null;
  platform?: number | null;
  manager_id: number;
  name: string;
  agency_id: number | null;
  owner_id: number | null;
  channel: "whatsapp" | "atrio";
  role: string;
  active: boolean;
  phone: string | null;
  advisor_id: string | null;
  advisor_slug: string | null;
};
export type DirectoryAgency = {
  agency_id: number;
  name: string;
  platform: number | null;
  bots: DirectoryBot[];
};
export type ImportDirectory = {
  scope: ImportScope;
  agencies: DirectoryAgency[];
  unassigned: DirectoryBot[];
  advisors: { id: string; name: string; slug: string }[];
};
const positive = (value: unknown): value is number =>
  Number.isSafeInteger(value) && Number(value) > 0;
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function savedBotInventory(
  value: unknown,
  channel: "whatsapp" | "atrio" = "whatsapp",
): DirectoryBot[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (bot): bot is DirectoryBot =>
      !!bot &&
      typeof bot === "object" &&
      positive(bot.manager_id) &&
      bot.channel === channel &&
      typeof bot.name === "string" &&
      typeof bot.role === "string" &&
      typeof bot.active === "boolean" &&
      (bot.phone === null || typeof bot.phone === "string"),
  );
}
export function parseImportDirectory(
  value: unknown,
  scope: ImportScope,
): ImportDirectory {
  const data = value as ImportDirectory;
  if (
    !data ||
    data.scope?.kind !== scope.kind ||
    data.scope?.id !== scope.id ||
    !Array.isArray(data.agencies) ||
    !Array.isArray(data.unassigned) ||
    !Array.isArray(data.advisors)
  )
    throw Error("El directorio recibido no es válido.");
  const groups = new Set<number>(),
    bots = new Set<number>();
  for (const group of data.agencies) {
    if (
      !positive(group.agency_id) ||
      groups.has(group.agency_id) ||
      typeof group.name !== "string" ||
      !Array.isArray(group.bots)
    )
      throw Error("Gerencia no válida.");
    groups.add(group.agency_id);
  }
  for (const bot of [
    ...data.agencies.flatMap((g) => g.bots),
    ...data.unassigned,
  ]) {
    if (
      !positive(bot.manager_id) ||
      bots.has(bot.manager_id) ||
      !["whatsapp", "atrio"].includes(bot.channel) ||
      typeof bot.active !== "boolean" ||
      typeof bot.name !== "string" ||
      typeof bot.role !== "string" ||
      (bot.phone !== null &&
        (typeof bot.phone !== "string" || !/^\d{3,20}$/.test(bot.phone)))
    )
      throw Error("Bot no válido.");
    bots.add(bot.manager_id);
  }
  if (bots.size > 1000) throw Error("Importá este propietario por gerencia.");
  for (const group of data.agencies)
    if (group.bots.some((bot) => bot.agency_id !== group.agency_id))
      throw Error("El bot no coincide con su gerencia.");
  const advisors = new Set<string>();
  for (const advisor of data.advisors) {
    if (
      !uuid.test(advisor.id) ||
      advisors.has(advisor.id) ||
      typeof advisor.name !== "string" ||
      !/^[a-z0-9][a-z0-9_-]{0,80}$/.test(advisor.slug)
    )
      throw Error("Asesor no válido.");
    advisors.add(advisor.id);
  }
  return data;
}
export function visibleImportDirectory(
  data: ImportDirectory,
  canAtrio: boolean,
): ImportDirectory {
  if (canAtrio) return data;
  return {
    ...data,
    advisors: [],
    agencies: data.agencies
      .map((g) => ({
        ...g,
        bots: g.bots.filter((b) => b.channel === "whatsapp"),
      }))
      .filter((g) => g.bots.length),
    unassigned: data.unassigned.filter((b) => b.channel === "whatsapp"),
  };
}

export type ImportWriter = {
  agency(group: DirectoryAgency): Promise<"created" | "existing">;
  advisor(
    advisor: ImportDirectory["advisors"][number],
  ): Promise<"created" | "existing">;
};
export async function importDirectory(
  data: ImportDirectory,
  writer: ImportWriter,
) {
  if (data.agencies.length > 100 || data.advisors.length > 200)
    throw Error("Este propietario es demasiado grande. Importá por gerencia.");
  const result = {
    gerencias: 0,
    asesores: 0,
    existentes: 0,
    warnings: [] as string[],
  };
  // Atrio-only agencies are displayed from their existing connection. Do not
  // enroll them in the unrelated WhatsApp phone synchronization cron.
  for (const group of data.agencies.filter((group) =>
    group.bots.some((bot) => bot.channel === "whatsapp"),
  )) {
    try {
      if ((await writer.agency(group)) === "created") result.gerencias++;
      else result.existentes++;
    } catch {
      result.warnings.push(
        `No se pudo agregar ${group.name} (ID ${group.agency_id}). Revisá si ya está en otro workspace.`,
      );
    }
  }
  const referenced = new Set(
    [...data.agencies.flatMap((g) => g.bots), ...data.unassigned].map(
      (b) => b.advisor_id,
    ),
  );
  for (const advisor of data.advisors.filter((a) => referenced.has(a.id))) {
    try {
      if ((await writer.advisor(advisor)) === "created") result.asesores++;
      else result.existentes++;
    } catch {
      result.warnings.push(
        `No se pudo vincular al asesor ${advisor.slug}. Revisá si ya está en otro workspace.`,
      );
    }
  }
  const missing = new Set(
    [...data.agencies.flatMap((g) => g.bots), ...data.unassigned]
      .filter(
        (b) =>
          b.channel === "atrio" &&
          (!b.advisor_id || !data.advisors.some((a) => a.id === b.advisor_id)),
      )
      .map((b) => b.manager_id),
  );
  if (missing.size)
    result.warnings.push(
      `${missing.size} bot(s) de Atrio no tienen un asesor válido para importar.`,
    );
  if (data.unassigned.some((b) => b.channel === "whatsapp"))
    result.warnings.push(
      "Hay bots de WhatsApp sin gerencia que no se pudieron incorporar.",
    );
  return result;
}
