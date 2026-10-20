import { randomUUID } from "node:crypto";
import { GatewayStorage } from "./gateway-storage";

export const ids = {
  landing: "11111111-1111-4111-8111-111111111111", client: "22222222-2222-4222-8222-222222222222",
  advisor: "33333333-3333-4333-8333-333333333333", owner: "44444444-4444-4444-8444-444444444444",
};
export const origins = { builder: "https://builder-flow.test", atrio: "https://atrio-flow.test", api2: "https://api2-flow.test",
  gateway: "https://gateway-flow.test", provider: "https://casino-flow.test" };
export const secrets = { preparation: "local-only-preparation-key-" + "x".repeat(32), token: "local-only-token-key-" + "y".repeat(32),
  resolve: "local-only-resolver-key-" + "z".repeat(32), handoff: "local-only-handoff-key-" + "h".repeat(32),
  chat: "local-only-chat-key-" + "c".repeat(32), session: Buffer.alloc(32, 0xab).toString("base64url"), apiKey: "local-only-api-key", apiSecret: "local-only-api-secret" };

type Row = Record<string, unknown>;
export type FaultPoint = "atrio-response" | "api2-response" | "link-response" | "handoff-response" | "login" | "player-write" | "credential-write";

export class FlowFixture {
  gateway = new GatewayStorage();
  players = new Map<string, Row>();
  providerAccounts = new Map<string, Row>();
  apiPlayers = new Map<string, Row>();
  credentials = new Map<string, Row>();
  provisions = new Map<string, Row>();
  casinoAccounts = new Map<string, { username: string; password: string }>();
  casinoSessions = new Map<string, string>();
  background: (() => Promise<void>)[] = [];
  trace: { component: string; path: string; status: number }[] = [];
  faults = new Map<FaultPoint, number>();
  api2Settings = { apikey: secrets.apiKey, apisecret: secrets.apiSecret };
  providerCreations = 0;
  loginCalls = 0;
  apiCalls = 0;
  errors: string[] = [];
  private playerReadGate?: { remaining: number; promise: Promise<void>; release(): void };

  synchronizePlayerReads(count: number) {
    let release = () => {};
    const promise = new Promise<void>(resolve => { release = resolve; });
    this.playerReadGate = { remaining: count, promise, release };
  }

  fault(point: FaultPoint) {
    const count = this.faults.get(point) ?? 0;
    if (count === 0) return false;
    this.faults.set(point, count - 1);
    return true;
  }

  readonly manager = { id: 1035, active: true, role: 3, chatPlatform: 7, channelType: 3,
    agencyId: null, operationalAgencyId: 17, atrioToken: "local-only-advisor-token", atrioAdvisorId: ids.advisor };
  readonly managerService = {
    findById: async (id: number) => id === this.manager.id ? this.manager : null,
    findByAtrioAdvisorId: async (id: string) => id === ids.advisor ? this.manager : null,
    getAtrioOperationalContext: async () => ({ agency: { id: 17, platform: 5 },
      credentials: { username: "local-agency", password: "local-agency-password", platform: 5 } }),
  };

  readonly playerRepository = {
    findAdvisor: async ({ advisorId, advisorSlug }: { advisorId: string; advisorSlug: string }) => ({
      data: advisorId === ids.advisor && advisorSlug === "local-e2e" ? { id: ids.advisor, slug: advisorSlug } : null, errorCode: null,
    }),
    findPlayer: async ({ advisorId, deviceId }: { advisorId: string; deviceId: string }) => ({
      data: structuredClone(this.players.get(`${advisorId}:${deviceId}`) ?? null), errorCode: null,
    }),
    insertPlayer: async (input: Row) => {
      const key = `${input.advisor_id}:${input.device_id}`;
      if (this.players.has(key)) return { data: null, errorCode: "23505" };
      const row = { id: randomUUID(), ...structuredClone(input) };
      this.players.set(key, row);
      return { data: structuredClone(row), errorCode: null };
    },
    updatePlayer: async ({ advisorId, playerId, patch }: { advisorId: string; playerId: string; patch: Row }) => {
      const row = [...this.players.values()].find(row => row.id === playerId && row.advisor_id === advisorId);
      if (!row) return { data: null, errorCode: null };
      Object.assign(row, structuredClone(patch));
      return { data: { id: playerId }, errorCode: null };
    },
    findProviderAccount: async ({ playerId, targetProvider }: { playerId: string; targetProvider: string }) => ({
      data: structuredClone(this.providerAccounts.get(`${playerId}:${targetProvider}`) ?? null), errorCode: null,
    }),
    insertProviderAccount: async (input: Row) => {
      const key = `${input.player_id}:${input.target_provider}`;
      if (this.providerAccounts.has(key)) return { data: null, errorCode: "23505" };
      const row = { id: randomUUID(), ...structuredClone(input) };
      this.providerAccounts.set(key, row);
      return { data: structuredClone(row), errorCode: null };
    },
  };

  readonly playerService = {
    findByPlayerIdentifierAndAgency: async (identifier: string, agency: number) => {
      const found = this.apiPlayers.get(`${agency}:${identifier}`) ?? null;
      const gate = this.playerReadGate;
      if (gate) {
        if (--gate.remaining === 0) { this.playerReadGate = undefined; gate.release(); }
        await gate.promise;
      }
      return found;
    },
    findByUsernameAndAgency: async () => null,
    create: async (input: Row) => {
      if (this.fault("player-write")) throw new Error("FixturePlayerWriteFailure");
      const key = `${input.agencyId}:${input.playerIdentifier}`;
      if (this.apiPlayers.has(key)) throw new Error("FixtureDuplicatePlayer");
      const row = { id: randomUUID(), ...input };
      this.apiPlayers.set(key, row);
      return row;
    },
  };
  readonly credentialService = {
    findByChannelIdentifierAndAgency: async (identifier: string, agency: number) => this.credentials.get(`${agency}:${identifier}`) ?? null,
    findByUsernameAndAgency: async (username: string, agency: number) => [...this.credentials.values()].find(row => row.username === username && row.agencyId === agency) ?? null,
    create: async (input: Row) => {
      if (this.fault("credential-write")) throw new Error("FixtureCredentialWriteFailure");
      const key = `${input.agencyId}:${input.channelIdentifier}`;
      if (this.credentials.has(key)) throw new Error("FixtureDuplicateCredential");
      this.credentials.set(key, { ...input });
      return input;
    },
  };

  readonly provisionStore = {
    find: async (agency: number, identifier: string) => structuredClone(this.provisions.get(`${agency}:${identifier}`) ?? null),
    reserve: async (record: Row) => {
      const key = `${record.agencyId}:${record.externalUserId}`;
      const existing = this.provisions.get(key);
      if (existing) return structuredClone(existing);
      if ([...this.provisions.values()].some(row => row.platform === record.platform && row.username === record.username)) return null;
      this.provisions.set(key, structuredClone(record));
      return structuredClone(record);
    },
    transition: async (id: string, from: string, to: string) => {
      const record = [...this.provisions.values()].find(row => row.id === id);
      if (!record || record.status !== from) return false;
      record.status = to;
      return true;
    },
  };

  async drainBackground() {
    while (this.background.length) {
      const jobs = this.background.splice(0);
      await Promise.all(jobs.map(job => job().catch(error => this.errors.push(error instanceof Error ? error.name : "BackgroundFailure"))));
    }
  }

  counts() {
    return { atrioPlayers: this.players.size, providerLinks: this.providerAccounts.size,
      api2Players: this.apiPlayers.size, credentials: this.credentials.size,
      casinoAccounts: this.casinoAccounts.size, providerCreations: this.providerCreations,
      gatewayBindings: this.gateway.bindings.size };
  }
}
