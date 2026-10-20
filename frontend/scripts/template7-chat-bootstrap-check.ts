/* eslint-disable @typescript-eslint/no-explicit-any -- Run the real Atrio resolver with isolated storage and after hooks. */
import assert from "node:assert/strict";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { compile } from "./template7-local-flow/source-loader";

const ids = {
  advisor: randomUUID(),
  other: randomUUID(),
  player: randomUUID(),
  account: randomUUID(),
  conversation: randomUUID(),
  device: randomUUID(),
};
type Row = Record<string, any>;
let fixture: any;
class Query {
  filters: Array<(r: Row) => boolean> = [];
  mode = "select";
  values: Row = {};
  head = false;
  constructor(public table: string) {}
  select(_columns?: string, options?: Row) {
    this.head = options?.head === true;
    return this;
  }
  eq(k: string, v: unknown) {
    this.filters.push((r) => r[k] === v);
    return this;
  }
  is(k: string, v: unknown) {
    return this.eq(k, v);
  }
  order() {
    return this;
  }
  limit() {
    return this;
  }
  update(v: Row) {
    this.mode = "update";
    this.values = v;
    return this;
  }
  insert(v: Row) {
    this.mode = "insert";
    this.values = v;
    return this;
  }
  async execute(single = false) {
    fixture.calls.push({ table: this.table, mode: this.mode });
    if (
      fixture.gate &&
      this.mode === "select" &&
      ["profiles", "players", "player_provider_accounts"].includes(this.table)
    ) {
      fixture.started.add(this.table);
      if (fixture.started.size === 3) fixture.release();
      await fixture.gate;
    }
    const rows: Row[] = fixture.tables[this.table];
    assert.ok(rows, this.table);
    if (this.mode === "insert") {
      if (
        this.table === "conversations" &&
        rows.some(
          (r) =>
            r.player_id === this.values.player_id &&
            r.player_provider_account_id ===
              this.values.player_provider_account_id,
        )
      )
        return { data: null, error: { code: "23505" } };
      const row = { id: randomUUID(), ...this.values };
      rows.push(row);
      return { data: single ? row : [row], error: null };
    }
    const matches = rows.filter((r) => this.filters.every((f) => f(r)));
    if (this.mode === "update")
      matches.forEach((r) => Object.assign(r, this.values));
    return {
      data: this.head ? null : single ? (matches[0] ?? null) : matches,
      count: this.head ? matches.length : null,
      error: null,
    };
  }
  maybeSingle() {
    return this.execute(true);
  }
  then(resolve: any, reject: any) {
    return this.execute().then(resolve, reject);
  }
}
function reset() {
  fixture = {
    deferred: [],
    calls: [],
    started: new Set(),
    gate: null,
    tables: {
      profiles: [
        {
          id: ids.advisor,
          slug: "gera",
          role: "advisor",
          full_name: "Advisor",
          widget_template: "atrio",
        },
      ],
      players: [
        {
          id: ids.player,
          advisor_id: ids.advisor,
          device_id: ids.device,
          display_name: "Client",
        },
      ],
      player_provider_accounts: [
        {
          id: ids.account,
          player_id: ids.player,
          target_provider: "rey_de_ases",
        },
      ],
      conversations: [
        {
          id: ids.conversation,
          player_id: ids.player,
          advisor_id: ids.advisor,
          player_provider_account_id: ids.account,
          provider_skin_code: null,
        },
      ],
      messages: [],
      quick_starters: [
        {
          id: randomUUID(),
          advisor_id: ids.advisor,
          is_active: true,
          label: "Help",
          message: "Hello",
          behavior: "message",
          message_options: [],
        },
      ],
      advisor_wallets: [
        { id: randomUUID(), advisor_id: ids.advisor, is_active: true },
      ],
      analytics_events: [],
      quick_replies: [
        {
          id: randomUUID(),
          advisor_id: ids.advisor,
          type: "bienvenida",
          is_enabled: true,
          text: "Welcome",
        },
      ],
    },
    from: (table: string) => new Query(table),
  };
  (globalThis as any).__CHAT_PERFORMANCE_FIXTURE__ = fixture;
}
async function main() {
  process.env.INTERNAL_CHAT_GATEWAY_SECRET =
    "local-chat-bootstrap-test-only-0000000000000000000000";
  const atrio: any = await compile(
    path.resolve(process.cwd(), "../../internal-chat"),
    `export { resolveGatewayChatSession } from "./src/lib/gateway-chat-session";`,
    [
      {
        name: "isolated-chat-session-storage",
        setup(plugin) {
          plugin.onLoad({ filter: /[\\/]supabase[\\/]admin\.ts$/ }, () => ({
            contents:
              "export function createAdminSupabaseClient(){return globalThis.__CHAT_PERFORMANCE_FIXTURE__;}",
            loader: "ts",
          }));
          plugin.onResolve({ filter: /^next\/server$/ }, () => ({
            path: "after",
            namespace: "chat-fixture",
          }));
          plugin.onLoad({ filter: /.*/, namespace: "chat-fixture" }, () => ({
            contents:
              "export function after(fn){globalThis.__CHAT_PERFORMANCE_FIXTURE__.deferred.push(fn);}",
            loader: "js",
          }));
        },
      },
    ],
  );
  const token = () => ({
    version: 1,
    appId: "reydeases_gateway",
    advisorSlug: "gera",
    playerId: ids.player,
    playerProviderAccountId: ids.account,
    targetProvider: "rey_de_ases",
    parentOrigin: "https://gateway.example",
  });
  const resolve = () =>
    atrio.resolveGatewayChatSession(token(), "gera", "desktop");
  const checks: string[] = [];
  async function check(name: string, test: () => Promise<void>) {
    reset();
    await test();
    checks.push(name);
  }
  await check(
    "independent identity reads execute concurrently and return the correct chat",
    async () => {
      fixture.gate = new Promise((r) => {
        fixture.release = r;
      });
      const session = await Promise.race([
        resolve(),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Identity queries were serialized")),
            2000,
          ),
        ),
      ]);
      assert.equal(session.session.player_id, ids.player);
      assert.equal(session.session.conversation_id, ids.conversation);
      assert.equal(session.hasActiveWallet, true);
      assert.equal(session.quickStarters.length, 1);
      assert.equal(
        fixture.calls.filter((r: Row) => r.mode !== "select").length,
        0,
      );
      assert.equal(fixture.deferred.length, 1);
      await fixture.deferred[0]();
      assert.equal(fixture.tables.analytics_events.length, 1);
      assert.equal(fixture.tables.players[0].platform, "desktop");
    },
  );
  await check(
    "a player from another advisor cannot open the chat or write activity",
    async () => {
      fixture.tables.players[0].advisor_id = ids.other;
      assert.equal(await resolve(), null);
      assert.equal(fixture.deferred.length, 0);
      assert.ok(!fixture.calls.some((r: Row) => r.table === "conversations"));
    },
  );
  await check(
    "a provider account owned by another player is rejected",
    async () => {
      fixture.tables.player_provider_accounts[0].player_id = ids.other;
      assert.equal(await resolve(), null);
      assert.equal(fixture.deferred.length, 0);
    },
  );
  await check(
    "a different provider cannot reuse the bound account",
    async () => {
      fixture.tables.player_provider_accounts[0].target_provider = "multi_skin";
      assert.equal(await resolve(), null);
    },
  );
  await check("a mismatched advisor slug does not query storage", async () => {
    assert.equal(
      await atrio.resolveGatewayChatSession(
        { ...token(), advisorSlug: "other" },
        "gera",
        "desktop",
      ),
      null,
    );
    assert.equal(fixture.calls.length, 0);
  });
  await check(
    "an existing conversation with inconsistent ownership is rejected before activity",
    async () => {
      fixture.tables.conversations[0].advisor_id = ids.other;
      assert.equal(await resolve(), null);
      assert.equal(fixture.deferred.length, 0);
    },
  );
  await check(
    "concurrent first entries share one conversation and one welcome message",
    async () => {
      fixture.tables.conversations = [];
      const sessions = await Promise.all([resolve(), resolve()]);
      assert.equal(fixture.tables.conversations.length, 1);
      assert.equal(fixture.tables.messages.length, 1);
      assert.equal(
        sessions[0].session.conversation_id,
        sessions[1].session.conversation_id,
      );
    },
  );
  console.log(
    JSON.stringify(
      {
        chatBootstrapChecks: checks.length,
        checks,
        externalNetwork: 0,
        productionWrites: 0,
      },
      null,
      2,
    ),
  );
  delete (globalThis as any).__CHAT_PERFORMANCE_FIXTURE__;
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
