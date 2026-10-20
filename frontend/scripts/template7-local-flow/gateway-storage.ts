import { randomUUID } from "node:crypto";

type Row = Record<string, unknown>;
const at = (value: unknown) => new Date(value as string | Date).getTime();

/** Test-only storage adapter. Production handoff/session code and encryption
 * execute unchanged; this is not a PostgreSQL/concurrency certification. */
export class GatewayStorage {
  bindings = new Map<string, Row>();
  handoffs = new Map<string, Row>();
  sessions = new Map<string, Row>();
  audit: Row[] = [];
  buckets = new Map<string, number>();
  queries = 0;
  failures: string[] = [];
  private transactionTail = Promise.resolve();

  readonly sql = Object.assign(
    (strings: TemplateStringsArray, ...values: unknown[]) => this.query(strings.join("?"), values),
    {
      json: (value: unknown) => value,
      begin: async (_mode: string, callback: (sql: GatewayStorage["sql"]) => Promise<unknown>) => {
        const previous = this.transactionTail;
        let release = () => {};
        this.transactionTail = new Promise<void>(resolve => { release = resolve; });
        await previous;
        const saved = structuredClone({ bindings: this.bindings, handoffs: this.handoffs, sessions: this.sessions, audit: this.audit });
        try { return await callback(this.sql); }
        catch (error) { this.failures.push(error instanceof Error ? error.message : "Transaction failure"); Object.assign(this, saved); throw error; }
        finally { release(); }
      },
    },
  );

  private async query(raw: string, v: unknown[]): Promise<Row[]> {
    this.queries++;
    const q = raw.replace(/\s+/g, " ").trim();
    if (q.startsWith("select pg_advisory_xact_lock")) return [];
    if (q.startsWith("insert into gateway_private.rate_limit_buckets")) {
      const count = (this.buckets.get(String(v[0])) ?? 0) + 1;
      this.buckets.set(String(v[0]), count);
      return [{ request_count: count }];
    }
    if (q.startsWith("delete from gateway_private.rate_limit_buckets")) return [];
    if (q.startsWith("insert into gateway_private.audit_events")) { this.audit.push({ query: q }); return []; }
    if (q.startsWith("select") && q.includes("from gateway_private.player_bindings")) {
      const rows = [...this.bindings.values()];
      const found = q.includes("where advisor_id =")
        ? rows.find(row => row.advisor_id === v[0] && row.platform === v[1] && row.external_user_id === v[2])
        : q.includes("where player_provider_account_id =")
          ? rows.find(row => row.player_provider_account_id === v[0])
          : rows.find(row => row.id === v[0]);
      return found ? [structuredClone(found)] : [];
    }
    if (q.startsWith("insert into gateway_private.player_bindings")) {
      const row = { id: randomUUID(), advisor_id: v[0], advisor_slug: v[1], device_id_hash: v[2], external_user_id: v[3],
        player_provider_account_id: v[4], landing_promo_code: v[5], platform: v[6], player_username: v[7],
        player_password_ciphertext: v[8], player_password_key_version: 1 };
      this.bindings.set(row.id, row);
      return [row];
    }
    if (q.startsWith("update gateway_private.player_bindings")) {
      const row = this.bindings.get(String(v[5]));
      if (!row) throw new Error("Fixture binding not found");
      Object.assign(row, { advisor_slug: v[0], device_id_hash: v[1], player_provider_account_id: row.player_provider_account_id ?? v[2], landing_promo_code: v[3], player_password_ciphertext: v[4] });
      return [];
    }
    if (q.startsWith("update gateway_private.handoffs")) {
      for (const row of this.handoffs.values()) if (row.player_binding_id === v[0] && !row.used_at) row.used_at = new Date();
      return [];
    }
    if (q.startsWith("insert into gateway_private.handoffs")) {
      const row = { id: randomUUID(), token_hash: v[0], player_binding_id: v[1], target_path: v[2], expires_at: v[3], used_at: null };
      this.handoffs.set(row.id, row);
      return [row];
    }
    if (q.startsWith("with consumed as")) {
      const row = [...this.handoffs.values()].find(row => row.token_hash === v[0] && !row.used_at && at(row.expires_at) > Date.now());
      if (!row) return [];
      const binding = this.bindings.get(String(row.player_binding_id));
      if (!binding) return [];
      row.used_at = new Date();
      return [{ ...binding, handoff_id: row.id, target_path: row.target_path }];
    }
    if (q.startsWith("insert into gateway_private.gateway_sessions")) {
      const row = { id: v[0], session_hash: v[1], player_binding_id: v[2], upstream_cookie_ciphertext: v[3],
        upstream_cookie_key_version: 1, upstream_expires_at: v[4], expires_at: v[5], last_seen_at: v[6], created_at: v[7], updated_at: v[8], revoked_at: null };
      this.sessions.set(String(row.id), row);
      return [];
    }
    if (q.startsWith("select") && q.includes("from gateway_private.gateway_sessions")) {
      const row = [...this.sessions.values()].find(row => row.session_hash === v[0] && !row.revoked_at && at(row.expires_at) > at(v[1]));
      return row ? [structuredClone(row)] : [];
    }
    if (q.startsWith("update gateway_private.gateway_sessions")) {
      if (q.includes("set revoked_at")) {
        if (q.includes("where player_binding_id")) {
          for (const row of this.sessions.values()) if (row.player_binding_id === v[1] && !row.revoked_at) row.revoked_at = v[0];
        } else {
          const row = this.sessions.get(String(v[0]));
          if (row) row.revoked_at = new Date();
        }
        return [];
      }
      if (q.includes("upstream_cookie_ciphertext")) {
        const row = this.sessions.get(String(v[3]));
        if (!row || row.revoked_at) return [];
        Object.assign(row, { upstream_cookie_ciphertext: v[0], upstream_expires_at: v[1], last_seen_at: v[2] });
        return [structuredClone(row)];
      }
      const row = this.sessions.get(String(v[2]));
      if (!row || row.revoked_at) return [];
      Object.assign(row, { last_seen_at: v[0], expires_at: new Date(Math.max(at(row.expires_at), at(v[1]))) });
      return [structuredClone(row)];
    }
    // No real database fallback is permitted, and no bound values are logged.
    throw new Error("Unsupported local fixture query: " + q);
  }
}
