import "server-only";
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Private deployment snapshot: no raw phones, credentials or account identities. */
export async function exportMktUsage(db: SupabaseClient) {
  const entries: { agencyId: number; phoneHash: string; usage: string }[] = [];
  let lastId = 0;
  for (;;) {
    const { data, error } = await db
      .from("gerencia_phones")
      .select(
        "id,phone,assignment_role,gerencias!inner(gerencia_id,source_type)",
      )
      .eq("kind", "mkt")
      .eq("gerencias.source_type", "pbadmin")
      .gt("id", lastId)
      .order("id")
      .limit(500);
    if (error) throw Error("No se pudo exportar el uso de WhatsApp.");
    if (!data?.length) break;
    for (const row of data) {
      const agency = row.gerencias as unknown as { gerencia_id: number | null };
      const phone = String(row.phone ?? "").replace(/\D/g, "");
      if (
        !Number.isSafeInteger(agency.gerencia_id) ||
        Number(agency.gerencia_id) <= 0 ||
        !phone
      )
        throw Error("Hay un vínculo MKT incompleto; revisalo antes de migrar.");
      if (!["acquisition", "follow_up"].includes(row.assignment_role))
        throw Error("Hay un uso de WhatsApp no válido.");
      entries.push({
        agencyId: Number(agency.gerencia_id),
        phoneHash: createHash("sha256").update(phone).digest("hex"),
        usage: row.assignment_role,
      });
    }
    lastId = Number(data[data.length - 1].id);
  }
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    count: entries.length,
    entries,
  };
}
