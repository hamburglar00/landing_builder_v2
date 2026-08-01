#!/usr/bin/env node

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createClient } = require("../frontend/node_modules/@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const shouldApply = process.argv.includes("--apply");
const onlyInternalIdArg = process.argv.find((arg) => arg.startsWith("--internal-id="));
const onlyInternalId = onlyInternalIdArg ? Number(onlyInternalIdArg.split("=")[1]) : null;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

const norm = (value) => String(value ?? "").trim();
const sanitizePhone = (value) => norm(value).replace(/\D/g, "");
const playerUsernameFromPayload = (payload) =>
  norm(payload.player_username ?? payload.playerUsername ?? payload.username);

function parsePayload(raw) {
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function gerenciaLabel(row) {
  if (!row) return "";
  const labelId = Number.isFinite(Number(row.gerencia_id))
    ? Number(row.gerencia_id)
    : Number(row.id);
  return `${row.nombre || "Gerencia"} (ID ${labelId})`;
}

async function fetchAll(table, select, decorateQuery) {
  const rows = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    let query = supabase.from(table).select(select).range(from, from + pageSize - 1);
    if (decorateQuery) query = decorateQuery(query);
    const { data, error } = await query;
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

async function fetchConversionRows(select) {
  if (onlyInternalId) {
    return fetchAll("conversions", select, (query) => query.eq("internal_id", onlyInternalId));
  }

  const [{ data: minRows, error: minError }, { data: maxRows, error: maxError }] = await Promise.all([
    supabase.from("conversions").select("internal_id").order("internal_id", { ascending: true }).limit(1),
    supabase.from("conversions").select("internal_id").order("internal_id", { ascending: false }).limit(1),
  ]);
  if (minError) throw new Error(`conversions min: ${minError.message}`);
  if (maxError) throw new Error(`conversions max: ${maxError.message}`);

  const minId = Number(minRows?.[0]?.internal_id ?? 0);
  const maxId = Number(maxRows?.[0]?.internal_id ?? 0);
  const rows = [];
  const windowSize = 1000;
  for (let start = minId; start <= maxId; start += windowSize) {
    const end = start + windowSize - 1;
    const chunk = await fetchAll("conversions", select, (query) =>
      query
        .gte("internal_id", start)
        .lte("internal_id", end)
        .order("internal_id", { ascending: true })
    );
    rows.push(...chunk);
  }
  return rows;
}

function shouldPersistPlayerUsername(playerUsername, rowPhone) {
  if (!playerUsername) return false;
  return sanitizePhone(playerUsername) !== sanitizePhone(rowPhone);
}

function buildStagePatch(stage, payload, gerencia, row) {
  const agencyId = norm(payload.agency_id);
  const botPhone = sanitizePhone(payload.bot_phone);
  const playerUsername = playerUsernameFromPayload(payload);
  const patch = {};

  if (stage === "lead" && shouldPersistPlayerUsername(playerUsername, row.phone)) {
    patch.lead_player_username = playerUsername;
  }
  if (stage === "purchase" && shouldPersistPlayerUsername(playerUsername, row.phone)) {
    patch.purchase_player_username = playerUsername;
  }

  if (agencyId) patch[`${stage}_agency_id`] = agencyId;
  if (botPhone) patch[`${stage}_bot_phone`] = botPhone;
  if (gerencia) {
    patch[`${stage}_gerencia_id`] = gerencia.id;
    patch[`${stage}_gerencia_external_id`] = Number.isFinite(Number(gerencia.gerencia_id))
      ? Number(gerencia.gerencia_id)
      : null;
    patch[`${stage}_gerencia_name`] = gerencia.nombre || "";
    patch[`${stage}_gerencia_label`] = gerenciaLabel(gerencia);
  }

  return patch;
}

function diffPatch(row, patch) {
  const diff = {};
  for (const [key, nextValue] of Object.entries(patch)) {
    const current = row[key];
    const normalizedCurrent = typeof nextValue === "number"
      ? Number(current)
      : norm(current);
    const normalizedNext = typeof nextValue === "number"
      ? Number(nextValue)
      : norm(nextValue);
    if (normalizedCurrent !== normalizedNext) diff[key] = nextValue;
  }
  return diff;
}

function summarizeExample(row, diff, payload, gerencia, stage) {
  return {
    internal_id: row.internal_id,
    landing_name: row.landing_name,
    promo_code: row.promo_code,
    stage,
    agency_id: norm(payload.agency_id),
    bot_phone: sanitizePhone(payload.bot_phone),
    player_username: playerUsernameFromPayload(payload) ? "<present>" : "",
    current_gerencia_label: row[`${stage}_gerencia_label`] || "",
    next_gerencia_label: gerenciaLabel(gerencia),
    fields_to_update: Object.keys(diff),
  };
}

async function main() {
  const gerencias = await fetchAll("gerencias", "id,user_id,nombre,gerencia_id");
  const gerenciaByUserAndAgency = new Map();
  for (const gerencia of gerencias) {
    gerenciaByUserAndAgency.set(`${gerencia.user_id}|${norm(gerencia.gerencia_id)}`, gerencia);
  }

  const baseSelect = [
    "id",
    "internal_id",
    "user_id",
    "phone",
    "landing_name",
    "promo_code",
    "telefono_asignado",
    "assigned_gerencia_id",
    "assigned_gerencia_label",
    "lead_payload_raw",
    "lead_agency_id",
    "lead_bot_phone",
    "lead_gerencia_id",
    "lead_gerencia_external_id",
    "lead_gerencia_name",
    "lead_gerencia_label",
    "lead_player_username",
    "purchase_payload_raw",
    "purchase_agency_id",
    "purchase_bot_phone",
    "purchase_gerencia_id",
    "purchase_gerencia_external_id",
    "purchase_gerencia_name",
    "purchase_gerencia_label",
    "purchase_player_username",
  ].join(",");

  const rows = await fetchConversionRows(baseSelect);

  const candidates = [];
  let purchaseAssignedDiffers = 0;
  let purchasePayloadsWithGerencia = 0;
  let leadPayloadsWithGerencia = 0;
  const examples = [];

  for (const row of rows) {
    for (const stage of ["lead", "purchase"]) {
      const raw = row[`${stage}_payload_raw`];
      if (!raw) continue;
      const payload = parsePayload(raw);
      const agencyId = norm(payload.agency_id);
      const botPhone = sanitizePhone(payload.bot_phone);
      const playerUsername = playerUsernameFromPayload(payload);
      if (!agencyId && !botPhone && !playerUsername) continue;

      const gerencia = agencyId
        ? gerenciaByUserAndAgency.get(`${row.user_id}|${agencyId}`)
        : null;
      if (stage === "purchase" && gerencia) {
        purchasePayloadsWithGerencia += 1;
        if (
          row.assigned_gerencia_id &&
          Number(row.assigned_gerencia_id) !== Number(gerencia.id)
        ) {
          purchaseAssignedDiffers += 1;
        }
      }
      if (stage === "lead" && gerencia) leadPayloadsWithGerencia += 1;

      const patch = buildStagePatch(stage, payload, gerencia, row);
      const diff = diffPatch(row, patch);
      if (Object.keys(diff).length === 0) continue;

      candidates.push({ row, stage, diff, payload, gerencia });
      if (examples.length < 12) {
        examples.push(summarizeExample(row, diff, payload, gerencia, stage));
      }
    }
  }

  const byStage = candidates.reduce((acc, item) => {
    acc[item.stage] = (acc[item.stage] ?? 0) + 1;
    return acc;
  }, {});
  const byField = candidates.reduce((acc, item) => {
    for (const field of Object.keys(item.diff)) {
      acc[field] = (acc[field] ?? 0) + 1;
    }
    return acc;
  }, {});
  const gerenciaOrReceiverFields = new Set([
    "lead_agency_id",
    "lead_bot_phone",
    "lead_gerencia_id",
    "lead_gerencia_external_id",
    "lead_gerencia_name",
    "lead_gerencia_label",
    "purchase_agency_id",
    "purchase_bot_phone",
    "purchase_gerencia_id",
    "purchase_gerencia_external_id",
    "purchase_gerencia_name",
    "purchase_gerencia_label",
  ]);
  const gerenciaCandidates = candidates.filter((item) =>
    Object.keys(item.diff).some((field) => gerenciaOrReceiverFields.has(field))
  );
  const playerOnlyCandidates = candidates.filter((item) =>
    Object.keys(item.diff).every((field) =>
      field === "lead_player_username" || field === "purchase_player_username"
    )
  );

  console.log(JSON.stringify({
    mode: shouldApply ? "apply" : "dry-run",
    scoped_internal_id: onlyInternalId || null,
    rows_scanned: rows.length,
    gerencias_loaded: gerencias.length,
    candidates_total: candidates.length,
    candidates_by_stage: byStage,
    candidates_by_field: byField,
    candidates_with_gerencia_or_receiver_updates: gerenciaCandidates.length,
    candidates_player_username_only: playerOnlyCandidates.length,
    lead_payloads_with_resolved_gerencia: leadPayloadsWithGerencia,
    purchase_payloads_with_resolved_gerencia: purchasePayloadsWithGerencia,
    purchase_rows_where_contact_assigned_differs_from_purchase_gerencia: purchaseAssignedDiffers,
    examples,
  }, null, 2));

  if (!shouldApply) return;

  let updated = 0;
  for (const item of candidates) {
    const { error } = await supabase
      .from("conversions")
      .update(item.diff)
      .eq("id", item.row.id);
    if (error) throw new Error(`update ${item.row.internal_id}: ${error.message}`);
    updated += 1;
  }
  console.log(JSON.stringify({ applied_updates: updated }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
