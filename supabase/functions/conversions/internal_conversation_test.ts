import {
  internalConversationConflict,
  recordInternalConversation,
  verifyInternalConversationSignature,
} from "./internal_conversation.ts";
function assert(v: unknown, msg = "assertion failed"): asserts v {
  if (!v) throw Error(msg);
}
const secret = "local-test-only-dedicated-secret";
async function signed(body: string, timestamp = 1794672000) {
  const e = new TextEncoder(),
    key = await crypto.subtle.importKey(
      "raw",
      e.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
  const sig = Array.from(
    new Uint8Array(
      await crypto.subtle.sign("HMAC", key, e.encode(`${timestamp}.${body}`)),
    ),
  ).map((b) => b.toString(16).padStart(2, "0")).join("");
  return new Headers({
    "x-atrio-internal-timestamp": String(timestamp),
    "x-atrio-internal-signature": sig,
  });
}
Deno.test("internal message HMAC binds the exact body and timestamp; expired, altered and unconfigured requests fail", async () => {
  const body = JSON.stringify({ action: "INTERNAL_CONVERSATION_STARTED" }),
    headers = await signed(body);
  assert(
    await verifyInternalConversationSignature(
      body,
      headers,
      secret,
      1794672001,
    ),
  );
  assert(
    !await verifyInternalConversationSignature(
      body + " ",
      headers,
      secret,
      1794672001,
    ),
  );
  assert(
    !await verifyInternalConversationSignature(
      body,
      headers,
      secret,
      1794672600,
    ),
  );
  assert(
    !await verifyInternalConversationSignature(body, headers, "", 1794672001),
  );
  assert(
    !await verifyInternalConversationSignature(
      body,
      headers,
      "other",
      1794672001,
    ),
  );
});
Deno.test("internal linkage preserves known phone, agency, advisor and player boundaries", () => {
  const row = {
      phone: "123",
      assigned_gerencia_id: 1,
      atrio_id: "advisor",
      atrio_players_id: "player",
    },
    p = { phone: "123", atrio_id: "advisor", players_id: "player" };
  assert(!internalConversationConflict(row, p, 1));
  for (
    const mismatch of [{ phone: "999" }, { atrio_id: "other" }, {
      players_id: "other",
    }]
  ) assert(internalConversationConflict(row, { ...p, ...mismatch }, 1));
  assert(internalConversationConflict(row, p, 2));
});
Deno.test("invalid internal events fail before any database call or public delivery", async () => {
  const db = {
    from() {
      throw Error("must not query");
    },
  } as any;
  const response = await recordInternalConversation(db, "owner", {
    action_event_id: "fake",
    event_time: 1,
  });
  assert(response.status === 422);
});

type Row = Record<string, any>;
const advisorId = "19000000-0000-4000-8000-000000000004",
  playerId = "19000000-0000-4000-8000-000000000005";
const otherPlayer = "19000000-0000-4000-8000-000000000009";
function message(patch: Row = {}): Row {
  return {
    action: "INTERNAL_CONVERSATION_STARTED",
    internal_event_name: "conversation_started",
    source_platform: "atrio",
    action_event_id: "atrio-conversation:19000000-0000-4000-8000-000000000008",
    atrio_id: advisorId,
    players_id: playerId,
    conversation_id: "19000000-0000-4000-8000-000000000006",
    message_id: "19000000-0000-4000-8000-000000000007",
    promo_code: "SYNTHETIC-fixture",
    event_time: Math.floor(Date.now() / 1000) - 60,
    phone: "123",
    ...patch,
  };
}
function receipt(p: Row): Row {
  return {
    conversation_started_event_id: p.action_event_id,
    conversation_started_event_time: p.event_time,
    conversation_started_payload_raw: JSON.stringify(p),
    atrio_id: p.atrio_id,
    atrio_players_id: p.players_id,
    promo_code: p.promo_code,
    phone: p.phone,
  };
}
function fixture(rows: Row[] = []) {
  const state = {
    rows: structuredClone(rows),
    directory: [{
      user_id: "owner",
      atrio_id: advisorId,
      atrio_status: null,
    }] as Row[],
    directoryError: null as unknown,
    conversionReads: 0,
    beforeUpdate: null as null | (() => void),
    beforeInsert: null as null | (() => Row | null),
  };
  const db = {
    from(table: string) {
      const predicates: Array<(row: Row) => boolean> = [];
      let mode = "select", patch: Row = {}, single = false;
      const query: any = new Proxy({}, {
        get(_target, method: string) {
          if (method === "then") {
            return (
              resolve: (v: unknown) => void,
              reject: (e: unknown) => void,
            ) =>
              Promise.resolve().then(() => {
                if (table === "atrio_clients" && state.directoryError) {
                  return { data: null, error: state.directoryError };
                }
                if (table === "conversions") {
                  state.conversionReads++;
                }
                if (mode === "update" && state.beforeUpdate) {
                  const hook = state.beforeUpdate;
                  state.beforeUpdate = null;
                  hook();
                }
                if (mode === "insert" && state.beforeInsert) {
                  const hook = state.beforeInsert;
                  state.beforeInsert = null;
                  const error = hook();
                  if (error) return { data: null, error };
                }
                const source = table === "atrio_clients"
                  ? state.directory
                  : state.rows;
                let found = source.filter((row) =>
                  predicates.every((fn) => fn(row))
                );
                if (mode === "update") {
                  found.forEach((row) => Object.assign(row, patch));
                }
                if (mode === "insert") {
                  const row = { id: "new", ...patch };
                  state.rows.push(row);
                  found = [row];
                }
                return {
                  data: structuredClone(single ? found[0] ?? null : found),
                  error: null,
                };
              }).then(resolve, reject);
          }
          return (...args: any[]) => {
            if (method === "eq") {
              predicates.push((row) => row[args[0]] === args[1]);
            } else if (method === "is") {
              predicates.push((row) =>
                args[1] === null
                  ? row[args[0]] == null
                  : row[args[0]] === args[1]
              );
            } else if (method === "not") {
              predicates.push((row) => row[args[0]] != null);
            } else if (method === "update" || method === "insert") {
              mode = method;
              patch = args[0];
            } else if (
              method === "single" || method === "maybeSingle"
            ) single = true;
            else if (
              !["select", "order", "limit"].includes(method)
            ) throw Error("Unsupported fixture method " + method);
            return query;
          };
        },
      });
      return query;
    },
  };
  return { ...state, state, db: db as any };
}
function cta(patch: Row = {}): Row {
  return {
    id: "cta",
    user_id: "owner",
    promo_code: "SYNTHETIC-fixture",
    atrio_id: advisorId,
    atrio_players_id: null,
    phone: null,
    conversation_started_event_id: null,
    ...patch,
  };
}
Deno.test("organic internal messages require advisor ownership; missing directory retries and foreign ownership rejects", async () => {
  for (const kind of ["missing", "error", "foreign"]) {
    const f = fixture();
    if (kind === "missing") f.state.directory = [];
    if (kind === "error") f.state.directoryError = { message: "transient" };
    if (kind === "foreign") f.state.directory[0].user_id = "other-owner";
    const response = await recordInternalConversation(
      f.db,
      "owner",
      message({ promo_code: "" }),
    );
    assert(response.status === (kind === "foreign" ? 422 : 503), kind);
    assert(f.state.conversionReads === 0);
    assert(f.state.rows.length === 0);
  }
});
Deno.test("advisor availability never blocks its owned internal message and exact retries are idempotent", async () => {
  for (const availability of [null, "ausente", "disponible"]) {
    const f = fixture();
    f.state.directory[0].atrio_status = availability;
    const p = message({ promo_code: "" });
    assert((await recordInternalConversation(f.db, "owner", p)).status === 200);
    assert(
      (await (await recordInternalConversation(f.db, "owner", p)).json())
        .duplicate === true,
    );
    assert(f.state.rows.length === 1);
    assert(!f.state.rows[0].lead_event_id);
    assert(!f.state.rows[0].contact_event_id);
  }
});
Deno.test("exact receipt rejects changed message, conversation, time, player and provider context", async () => {
  const p = message({
      player_provider_account_id: "account-a",
      agency_id: "23",
    }),
    f = fixture([cta(receipt(p))]);
  for (
    const changed of [
      { message_id: "19000000-0000-4000-8000-000000000099" },
      { conversation_id: "19000000-0000-4000-8000-000000000098" },
      { event_time: p.event_time + 1 },
      { players_id: otherPlayer },
      { player_provider_account_id: "account-b" },
      { agency_id: "24" },
    ]
  ) {
    assert(
      (await recordInternalConversation(f.db, "owner", { ...p, ...changed }))
        .status === 422,
    );
  }
  assert(
    f.state.rows[0].conversation_started_payload_raw === JSON.stringify(p),
  );
});
Deno.test("a subsequent message can acknowledge only the already recorded journey, never another player", async () => {
  const p = message(), f = fixture([cta(receipt(p))]);
  const next = {
    ...p,
    action_event_id: "atrio-conversation:19000000-0000-4000-8000-000000000099",
    event_time: p.event_time + 1,
  };
  assert(
    (await (await recordInternalConversation(f.db, "owner", next)).json())
      .duplicate === true,
  );
  assert(
    (await recordInternalConversation(f.db, "owner", {
      ...next,
      players_id: otherPlayer,
    })).status === 422,
  );
  assert(f.state.rows[0].conversation_started_event_id === p.action_event_id);
});
Deno.test("losing a message race acknowledges the same receipt but rejects a winner belonging to another player", async () => {
  for (const foreign of [false, true]) {
    const p = message(), f = fixture([cta()]);
    f.state.beforeUpdate = () =>
      Object.assign(
        f.state.rows[0],
        receipt({ ...p, players_id: foreign ? otherPlayer : playerId }),
      );
    const response = await recordInternalConversation(f.db, "owner", p);
    assert(response.status === (foreign ? 422 : 200));
    assert(
      f.state.rows[0].atrio_players_id === (foreign ? otherPlayer : playerId),
    );
  }
});
Deno.test("a concurrent Purchase identity cannot be overwritten while the first-message slot is still empty", async () => {
  const p = message(), f = fixture([cta()]);
  f.state.beforeUpdate = () =>
    Object.assign(f.state.rows[0], {
      atrio_players_id: otherPlayer,
      phone: "999",
    });
  assert((await recordInternalConversation(f.db, "owner", p)).status === 422);
  assert(f.state.rows[0].atrio_players_id === otherPlayer);
  assert(f.state.rows[0].phone === "999");
  assert(!f.state.rows[0].conversation_started_event_id);
});
Deno.test("a compatible concurrent identity update retries safely and then records the message", async () => {
  const p = message(), f = fixture([cta()]);
  f.state.beforeUpdate = () => Object.assign(f.state.rows[0], { phone: "123" });
  assert((await recordInternalConversation(f.db, "owner", p)).status === 503);
  assert(!f.state.rows[0].conversation_started_event_id);
  assert((await recordInternalConversation(f.db, "owner", p)).status === 200);
  assert(f.state.rows[0].conversation_started_event_id === p.action_event_id);
});
Deno.test("unique-conflict recovery validates the complete durable receipt before acknowledging insertion", async () => {
  for (const foreign of [false, true]) {
    const p = message({ promo_code: "" }), f = fixture();
    f.state.beforeInsert = () => {
      f.state.rows.push(
        cta(receipt({ ...p, players_id: foreign ? otherPlayer : playerId })),
      );
      return { code: "23505" };
    };
    assert(
      (await recordInternalConversation(f.db, "owner", p)).status ===
        (foreign ? 422 : 200),
    );
    assert(f.state.rows.length === 1);
  }
});
