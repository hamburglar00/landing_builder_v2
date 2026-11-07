import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as crypto from "node:crypto";
import ts from "../frontend/node_modules/typescript/lib/typescript.js";

test("Nexo directory imports only its signed advisor and bot scope and preserves status/name/slug", async () => {
  const accountId = crypto.randomUUID(),
    client = crypto.randomUUID(),
    id = crypto.randomUUID();
  const identity = {
    active: true,
    ownerId: 37,
    userId: 42,
    builderId: client,
    advisorId: id,
    connections: [{ platform: 5, agencyId: 71, managerId: 82 }],
  };
  const advisor = {
    id,
    name: "Fixture",
    slug: "fixture",
    status: "ausente",
    revision: new Date().toISOString(),
  };
  const imports = [],
    updates = [];
  let blocked = false;
  const db = {
    rpc: async (name) => ({
      data: name === "is_client_access_blocked" ? blocked : null,
      error: null,
    }),
    from(table) {
      assert.equal(table, "atrio_clients");
      const scope = {};
      const q = {
        update(value) {
          updates.push({ value, scope });
          return q;
        },
        eq(k, v) {
          scope[k] = v;
          return q;
        },
        or() {
          return { error: null };
        },
      };
      return q;
    },
  };
  const mocks = {
    "server-only": {},
    "next/cache": {},
    "../pbadmin/provider.server": { adminDb: () => db },
    "../bots/persist-import.server": {
      persistImport: async (_db, user, currency, action, data) => {
        imports.push({ user, currency, action, data });
        return { warnings: [] };
      },
    },
    "./protocol.server": {
      NexoBridgeError: class extends Error {},
      uuid: (value) => typeof value === "string" && value.length === 36,
    },
    "../landing/mocks": {},
    "../landing/template9": {},
    "../landing/buildLandingConfig": {},
    "../landing/publicUrls": {},
    "../multi-skin-catalog": {},
  };
  const code = ts.transpileModule(
    readFileSync(
      new URL("../frontend/lib/nexobet/marketing.server.ts", import.meta.url),
      "utf8",
    ),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", "fetch", code)(
    (name) => {
      if (!mocks[name]) throw Error(name);
      return mocks[name];
    },
    module,
    module.exports,
    () => {
      throw Error("No relay allowed");
    },
  );
  for (const operation of ["initialize", "directory_changed"]) {
    const result = await module.exports.marketingOperation(
      operation,
      { accountId, advisor },
      identity,
    );
    assert.equal(result.synced, true);
  }
  assert.equal(imports.length, 2);
  assert.equal(imports[0].user, client);
  assert.equal(imports[0].data.advisors[0].id, id);
  assert.equal(imports[0].data.unassigned[0].manager_id, 82);
  assert.equal(imports[0].data.unassigned[0].agency_id, 71);
  assert.deepEqual(updates[0].scope, {
    user_id: client,
    atrio_id: id,
    workspace_currency: "ARS",
  });
  assert.equal(updates[0].value.atrio_status, "ausente");
  assert.equal(updates[0].value.display_name, "Fixture");
  await assert.rejects(
    module.exports.marketingOperation(
      "initialize",
      { accountId, advisor: { ...advisor, id: crypto.randomUUID() } },
      identity,
    ),
  );
  blocked = true;
  await assert.rejects(
    module.exports.marketingOperation(
      "initialize",
      { accountId, advisor },
      identity,
    ),
  );
  assert.equal(imports.length, 2);
});

test("signed Builder scope is checked locally; no round trip to API2 or Atrio and no legacy account takeover", async () => {
  const pair = crypto.generateKeyPairSync("ed25519"),
    publicKey = pair.publicKey
      .export({ type: "spki", format: "der" })
      .toString("base64");
  const accountId = crypto.randomUUID(),
    builderId = crypto.randomUUID(),
    advisorId = crypto.randomUUID();
  const scope = {
    active: true,
    ownerId: 37,
    userId: 42,
    builderId,
    advisorId,
    connections: [{ platform: 5, agencyId: 71, managerId: 82 }],
  };
  let legacy = false,
    ready = true;
  const seen = new Set();
  const db = {
    from(table) {
      const filters = {};
      const q = {
        select() {
          return q;
        },
        eq(k, v) {
          filters[k] = v;
          return q;
        },
        delete() {
          return q;
        },
        lt() {
          return { error: null };
        },
        insert(row) {
          if (seen.has(row.nonce)) return { error: { code: "duplicate" } };
          seen.add(row.nonce);
          return { error: null };
        },
        maybeSingle() {
          return {
            data:
              filters.owner_id === 37 && filters.account_id === builderId
                ? { account_id: builderId, legacy, ready }
                : null,
            error: null,
          };
        },
      };
      return q;
    },
  };
  const source = readFileSync(
    new URL("../frontend/lib/nexobet/protocol.server.ts", import.meta.url),
    "utf8",
  ).replace(
    "MCowBQYDK2VwAyEASZAAAAmUfY6tzFJf3y2MHiFM6VGVQc5IcoVtEOdpis0=",
    publicKey,
  );
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", "fetch", output)(
    (name) => {
      if (name === "server-only") return {};
      if (name === "node:crypto") return crypto;
      if (name === "../pbadmin/provider.server") return { adminDb: () => db };
      throw Error(name);
    },
    module,
    module.exports,
    () => {
      throw Error("No external callback allowed");
    },
  );
  const { readNexoRequest, nexoIdentity } = module.exports;
  const request = (payload, nonce = crypto.randomUUID()) => {
    const raw = JSON.stringify({ operation: "overview", payload }),
      timestamp = String(Date.now());
    return new Request("https://builder.invalid", {
      method: "POST",
      body: raw,
      headers: {
        "content-type": "application/json",
        "x-nexobet-key-id": "nexobet-v1",
        "x-nexobet-timestamp": timestamp,
        "x-nexobet-nonce": nonce,
        "x-nexobet-signature": crypto
          .sign(
            null,
            Buffer.from(`${timestamp}.${nonce}.${raw}`),
            pair.privateKey,
          )
          .toString("base64url"),
      },
    });
  };
  const nonce = crypto.randomUUID(),
    data = await readNexoRequest(request({ accountId, scope }, nonce));
  assert.deepEqual(await nexoIdentity(data.payload), scope);
  await assert.rejects(
    readNexoRequest(request({ accountId, scope }, nonce)),
    (e) => e.code === "request_replayed",
  );
  await assert.rejects(
    readNexoRequest(
      new Request("https://builder.invalid", { method: "POST", body: "{}" }),
    ),
  );
  for (const patch of [
    { active: false },
    { ownerId: 99 },
    { builderId: crypto.randomUUID() },
    { advisorId: "invalid" },
    { connections: [...scope.connections, ...scope.connections] },
    { connections: [{ platform: 5, agencyId: -1, managerId: 82 }] },
  ])
    await assert.rejects(nexoIdentity({ scope: { ...scope, ...patch } }));
  legacy = true;
  await assert.rejects(nexoIdentity({ scope }));
  legacy = false;
  ready = false;
  await assert.rejects(nexoIdentity({ scope }));
});
