/* eslint-disable @typescript-eslint/no-explicit-any -- Runtime ports loaded from separate repositories. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

export type Row = Record<string, any>;
export const ids = {
  advisor: "a0000000-0000-4000-8000-000000000001", admin: "a0000000-0000-4000-8000-000000000002",
  player: "a0000000-0000-4000-8000-000000000003", account: "a0000000-0000-4000-8000-000000000004",
  conversation: "a0000000-0000-4000-8000-000000000005", otherConversation: "a0000000-0000-4000-8000-000000000006",
  otherAdvisor: "a0000000-0000-4000-8000-000000000007", otherPlayer: "a0000000-0000-4000-8000-000000000008",
};

/** A strict PostgREST port with actual filters, uniqueness and fault injection.
 * It is not evidence of Postgres/RLS behavior; no remote database is opened. */
export class FixtureDb {
  tables = new Map<string, Row[]>();
  failMessageInsert = 0;
  failDeliveryInsert = 0;
  from(table: string) {
    assert.ok(this.tables.has(table), "Unexpected fixture table: " + table);
    return new FixtureQuery(this, table);
  }
  async rpc(name: string, args: Row) {
    if(name === "prepare_confirmed_purchase_payload") {
      const delivery=this.tables.get("integration_event_deliveries")!.find(row=>row.id===args.p_delivery_id && row.delivery_claim_token===args.p_claim_token);
      return delivery ? {data:{ready:true,payload:delivery.payload},error:null} : {data:null,error:{code:"42501"}};
    }
    if(name === "consume_external_api_rate_limit") return {data:[{allowed:true,remaining:100}],error:null};
    if(name === "claim_confirmed_purchase_deliveries") {
      const rows=this.tables.get("integration_event_deliveries")!.filter(row=>
        row.idempotency_key?.startsWith("pbadmin-purchase:") && row.status!=="sent" && !row.delivery_claim_token &&
        (!args.p_advisor_id || row.advisor_id===args.p_advisor_id) &&
        (!args.p_operation_key || row.idempotency_key==="pbadmin-purchase:"+args.p_operation_key));
      rows.forEach(row=>{row.delivery_claim_token=args.p_claim_token;row.attempts=(row.attempts??0)+1;});
      return {data:structuredClone(rows),error:null};
    }
    if(name === "record_pbadmin_confirmed_load") {
      const rows=this.tables.get("pbadmin_confirmed_loads")!;
      const existing=rows.find(row=>row.operation_key===args.p_operation_key);
      if(existing && (existing.amount!==args.p_amount || existing.account_id!==args.p_account_id)) return {data:null,error:{code:"23505"}};
      const recorded=existing??{id:randomUUID(),operation_key:args.p_operation_key,amount:args.p_amount,account_id:args.p_account_id};
      if(!existing) {
        rows.push(recorded);
        const conversation=this.tables.get("conversations")!.find(row=>row.id===args.p_conversation_id)!;
        this.tables.get("integration_event_deliveries")!.push({id:randomUUID(),advisor_id:args.p_advisor_id,
          player_id:conversation.player_id,status:"pending",action:"PURCHASE",idempotency_key:"pbadmin-purchase:"+args.p_operation_key,
          payload:{...args.p_payload,receipt_file_url:undefined,action:"PURCHASE",amount:args.p_amount,
            pbadmin_transaction_id:"pbadmin:"+args.p_operation_key,
            action_event_id:"pbadmin-purchase:"+args.p_operation_key}});
      }
      return {data:recorded,error:null};
    }
    assert.equal(name, "insert_external_api_message");
    const conversation = this.tables.get("conversations")!.find(row => row.id === args.p_conversation_id && row.advisor_id === args.p_advisor_id);
    if (!conversation) return { data: [{ status: "conversation_not_found" }], error: null };
    const deliveries = this.tables.get("integration_event_deliveries")!;
    const existing = deliveries.find(row => row.idempotency_key === args.p_idempotency_key);
    if (existing) return { data: [{ status: "duplicate", message_id: existing.message_id, conversation_id: conversation.id, player_id: conversation.player_id }], error: null };
    // The existing production RPC performs both inserts in one transaction.
    if (this.failMessageInsert-- > 0) return { data: null, error: { code: "fixture_write_failure" } };
    const message = { id: randomUUID(), conversation_id: conversation.id, sender: "asesor", type: args.p_message_type, content: args.p_content, metadata: args.p_metadata };
    this.tables.get("messages")!.push(message);
    deliveries.push({ id: randomUUID(), integration_key: "external_request", idempotency_key: args.p_idempotency_key, status: "sent", message_id: message.id, conversation_id: conversation.id, payload: args.p_payload });
    return { data: [{ status: "created", message_id: message.id, conversation_id: conversation.id, player_id: conversation.player_id }], error: null };
  }
}

class FixtureQuery {
  filters: ((row: Row) => boolean)[] = [];
  mode = "select";
  values: Row = {};
  maximum = Infinity;
  constructor(private db: FixtureDb, private table: string) {}
  select(columns?: string) { void columns; return this; }
  eq(key: string, value: unknown) { this.filters.push(row => row[key] === value); return this; }
  in(key: string, values: unknown[]) { this.filters.push(row => values.includes(row[key])); return this; }
  limit(maximum: number) { this.maximum = maximum; return this; }
  order() { return this; }
  upsert(values:Row) { return this.insert(values); }
  insert(values: Row) { this.mode = "insert"; this.values = structuredClone(values); return this; }
  update(values: Row) { this.mode = "update"; this.values = structuredClone(values); return this; }
  async execute(single = false): Promise<{ data: any; error: Row | null }> {
    const rows = this.db.tables.get(this.table)!;
    if (this.mode === "insert") {
      if ((this.table === "messages" && this.db.failMessageInsert-- > 0) ||
          (this.table === "integration_event_deliveries" && this.db.failDeliveryInsert-- > 0)) return { data: null, error: { code: "fixture_write_failure" } };
      if (this.table === "integration_event_deliveries" && this.values.idempotency_key && rows.some(row => row.idempotency_key === this.values.idempotency_key)) return { data: null, error: { code: "23505" } };
      const inserted = { id: randomUUID(), ...this.values };
      rows.push(inserted);
      return { data: single ? structuredClone(inserted) : [structuredClone(inserted)], error: null };
    }
    const matches = rows.filter(row => this.filters.every(filter => filter(row))).slice(0, this.maximum);
    if(single && this.mode==="select" && matches.length>1) return {data:null,error:{code:"PGRST116"}};
    if (this.mode === "update") matches.forEach(row => Object.assign(row, this.values));
    return { data: structuredClone(single ? matches[0] ?? null : matches), error: null };
  }
  maybeSingle() { return this.execute(true); }
  then(resolve: any, reject: any) { return this.execute().then(resolve, reject); }
}

export class InboxFixture {
  background: Array<()=>Promise<unknown>>=[];
  db = new FixtureDb();
  advisor = { id: ids.advisor, admin_id: ids.admin, full_name: "Asesor local", slug: "asesor-local", role: "advisor" };
  contact = { id: ids.player, advisor_id: ids.advisor, display_name: "Jugador local", device_id: "device-local" };
  conversation = { id: ids.conversation, advisor_id: ids.advisor, player_id: ids.player, player_provider_account_id: ids.account };
  session: Row = { isAuthenticated: true, userId: ids.advisor, profile: this.advisor };
  manager: Row;
  balance = 1000;
  providerCalls = { balance: 0, load: 0, withdraw: 0 };
  providerReject = false;
  failCheckpoint = false;
  holdProvider: Promise<void> | null = null;
  records = new Map<string, Row>();
  events: Row[] = [];
  managerService: Row;
  playerService: Row;
  credentialService: Row;
  operations: Row;
  engine: Row;
  platformService: Row;
  constructor(api2: Row, encrypt: (text: string) => string) {
    this.manager = { id: 1035, active: true, role: api2.ManagerRole.mkt, agencyId: null, operationalAgencyId: 21,
      chatPlatform: api2.ChatPlatformType.atrio, channelType: api2.ChannelType.webChat,
      atrioAdvisorId: ids.advisor, atrioAdvisorSlug: this.advisor.slug, atrioToken: "atrio-fixture-token-only" };
    this.db.tables = new Map(Object.entries({
      profiles: [this.advisor, { id: ids.admin, full_name: "Admin local" }],
      players: [this.contact, { id: ids.otherPlayer, advisor_id: ids.otherAdvisor }],
      conversations: [this.conversation, { id: ids.otherConversation, advisor_id: ids.otherAdvisor, player_id: ids.otherPlayer }],
      player_provider_accounts: [{ id: ids.account, player_id: ids.player, target_provider: "rey_de_ases", provider_external_account_id: ids.player }],
      integration_permissions: [
        { profile_id: ids.admin, integration_key: "external_request", enabled: true, config: {} },
        { profile_id: ids.advisor, integration_key: "external_request", enabled: true, config: { encryptedAtrioToken: encrypt(this.manager.atrioToken) } },
      ],
      system_integrations: [{ integration_key: "pbadmin", base_url: "https://api2.local.test", encrypted_api_key: encrypt("local-key"), encrypted_api_secret: encrypt("local-secret") }],
      integration_event_deliveries: [], messages: [],pbadmin_confirmed_loads:[],
    }));
    const operationalContext = { agency: { id: 21 }, credentials: { username: "local-agency", password: "local-password", platformUrl: "https://provider.local.test", platform: api2.PlatformType.reyDeAses } };
    this.managerService = { findByAtrioAdvisorId: async (id: string) => id === ids.advisor ? this.manager : null,
      getAtrioOperationalContext: async () => operationalContext };
    this.playerService = { findByPlayerIdentifierAndAgency: async (id: string, agency: number) => id === ids.player && agency === 21 ? { id: 71, managerId: this.manager.id } : null };
    this.credentialService = { findByChannelIdentifierAndAgency: async (id: string, agency: number) => id === ids.player && agency === 21 ? { username: "local-player" } : null };
    this.operations = {
      claim: async (data: Row) => {
        const key = `${data.managerId}:${data.idempotencyKey}`;
        const existing = this.records.get(key);
        if (existing) return { created: false, operation: existing };
        const operation = { id: this.records.size + 1, ...data };
        this.records.set(key, operation);
        return { created: true, operation };
      },
      markSucceeded: async (operation: Row) => {
        if (this.failCheckpoint) { this.failCheckpoint = false; throw new Error("fixture_checkpoint_failure"); }
        operation.status = "succeeded"; return operation;
      },
      markFailed: async (operation: Row, errorCode: string, errorMessage: string, providerResponse: Row | null = null) => {
        Object.assign(operation, { status: "failed", errorCode, errorMessage, providerResponse }); return operation;
      },
    };
    this.engine = { handleMessageIncoming: async (event: Row) => { this.events.push({ kind: "text", event }); },
      handleMessageFile: async (event: Row) => { this.events.push({ kind: "file", event }); } };
    const mutate = async (kind: "load" | "withdraw", agent: string, player: string, amount: number) => {
      assert.equal(agent, "local-agency"); assert.equal(player, "local-player");
      this.providerCalls[kind]++;
      if (this.holdProvider) await this.holdProvider;
      if (this.providerReject || (kind === "withdraw" && amount > this.balance)) return { success: false };
      this.balance += kind === "load" ? amount : -amount;
      return { success: true };
    };
    this.platformService = new api2.DirectPlayerPlatformService({ reyDeAses: {
      getPlayerBalance: async (agent: string, player: string) => {
        assert.equal(agent, "local-agency"); assert.equal(player, "local-player");
        this.providerCalls.balance++; return { success: true, balance: this.balance };
      },
      deposit: (...args: [string, string, number]) => mutate("load", ...args),
      withdraw: (...args: [string, string, number]) => mutate("withdraw", ...args),
    } });
  }
}
