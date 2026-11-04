import assert from "node:assert/strict";
import test from "node:test";
import { groupBots, botSearchText } from "../lib/bots/workspace";
import {
  savedBotInventory,
  parseImportDirectory,
  visibleImportDirectory,
  importDirectory,
  type ImportDirectory,
  type DirectoryBot,
} from "../lib/bots/directory";
import type { AtrioClient } from "../lib/atrio/atrioDb";
import type {
  AdvisorDirectory,
  ManagerDestination,
} from "../lib/atrio/managerDestinations";
const advisorId = "92000000-0000-4000-8000-000000000001";
const client = (owner = "client-a"): AtrioClient => ({
  id: owner,
  atrio_id: advisorId,
  user_id: owner,
  workspace_currency: "ARS",
  slug: "gera",
  usage_count: 4,
});
const connection = (
  patch: Partial<ManagerDestination> = {},
): ManagerDestination => ({
  connection_id: "connection-a",
  advisor_id: advisorId,
  advisor_slug: "gera",
  advisor_name: "Gera",
  manager_id: 1045,
  agency_id: 10,
  agency_name: "Test",
  target_provider: "multi_skin",
  manager_type: "full_carga",
  active: true,
  verified_at: null,
  usage_count: 2,
  chats_started: 3,
  messages_received: 3,
  ...patch,
});
const bot = (patch: Partial<DirectoryBot> = {}): DirectoryBot => ({
  manager_id: 1,
  name: "WhatsApp",
  agency_id: 10,
  owner_id: 2,
  channel: "whatsapp",
  role: "mkt",
  active: false,
  phone: null,
  advisor_id: null,
  advisor_slug: null,
  ...patch,
});
const inventory = (): ImportDirectory => ({
  scope: { kind: "owner", id: 2 },
  agencies: [
    {
      agency_id: 10,
      name: "Test",
      platform: 7,
      bots: [
        bot(),
        bot({
          manager_id: 1045,
          channel: "atrio",
          advisor_id: advisorId,
          advisor_slug: "gera",
        }),
      ],
    },
  ],
  unassigned: [],
  advisors: [{ id: advisorId, name: "Gera", slug: "gera" }],
});
test("one agency groups phones and Atrio without losing original metadata", () => {
  const groups = groupBots(
    [
      {
        id: 10,
        nombre: "Edited locally",
        gerencia_id: 10,
        source_type: "pbadmin",
        fair_criterion: "messages_received",
      },
    ],
    [client()],
    [
      {
        id: advisorId,
        slug: "gera",
        name: "Gera",
        connections: [connection()],
      },
    ],
    "client-a",
  );
  assert.equal(groups.length, 1);
  assert.equal(groups[0].nombre, "Edited locally");
  assert.equal(groups[0].fair_criterion, "messages_received");
  assert.equal(groups[0].atrioBots[0].connection?.manager_id, 1045);
  assert.match(botSearchText(groups[0]), /1045/);
  assert.match(botSearchText(groups[0]), /gera/);
});
test("same agency on different clients and synthetic manual IDs never mix", () => {
  const groups = groupBots(
    [
      { id: 10, nombre: "Other client", gerencia_id: 10, user_id: "client-b" },
      {
        id: 20,
        nombre: "Manual",
        gerencia_id: 20,
        source_type: "manual",
        user_id: "client-a",
      },
    ],
    [client()],
    [
      {
        id: advisorId,
        slug: "gera",
        name: "Gera",
        connections: [
          connection(),
          connection({ connection_id: "c2", agency_id: 20 }),
        ],
      },
    ],
    "admin",
  );
  assert.equal(groups.length, 4);
  assert.ok(groups[0]);
  assert.equal(
    groups.find((g) => g.nombre === "Other client")?.atrioBots.length,
    0,
  );
  assert.equal(groups.find((g) => g.nombre === "Manual")?.atrioBots.length, 0);
  assert.equal(groups.filter((g) => g.virtual).length, 2);
});
test("existing advisors without bots remain visible; duplicate connections do not duplicate rows", () => {
  let groups = groupBots([], [client()], [], "client-a");
  assert.equal(groups.length, 1);
  assert.equal(groups[0].atrioBots[0].connection, null);
  const entry: AdvisorDirectory = {
    id: advisorId,
    slug: "gera",
    name: "Gera",
    connections: [connection(), connection()],
  };
  groups = groupBots([], [client()], [entry], "client-a");
  assert.equal(groups[0].atrioBots.length, 1);
});
test("inventory validation rejects wrong scope, duplicate bots and mismatched agency", () => {
  const data = inventory();
  assert.equal(parseImportDirectory(data, data.scope), data);
  assert.throws(() => parseImportDirectory(data, { kind: "agency", id: 2 }));
  for (const mutate of [
    (d: ImportDirectory) => d.agencies[0].bots.push(bot()),
    (d: ImportDirectory) => {
      d.agencies[0].bots[0].agency_id = 99;
    },
    (d: ImportDirectory) => {
      d.advisors[0].slug = "../../bad";
    },
  ]) {
    const copy = inventory();
    mutate(copy);
    assert.throws(() => parseImportDirectory(copy, copy.scope));
  }
});
test("disabled Atrio visibility also filters import previews and references", () => {
  const data = visibleImportDirectory(inventory(), false);
  assert.equal(data.advisors.length, 0);
  assert.deepEqual(
    data.agencies[0].bots.map((b) => b.channel),
    ["whatsapp"],
  );
});
test("import retries are idempotent and do not duplicate or overwrite saved configuration", async () => {
  const groups = new Set<number>(),
    advisors = new Set<string>();
  const writer = {
    async agency(group: { agency_id: number }) {
      if (groups.has(group.agency_id)) return "existing" as const;
      groups.add(group.agency_id);
      return "created" as const;
    },
    async advisor(advisor: { id: string }) {
      if (advisors.has(advisor.id)) return "existing" as const;
      advisors.add(advisor.id);
      return "created" as const;
    },
  };
  assert.deepEqual(await importDirectory(inventory(), writer), {
    gerencias: 1,
    asesores: 1,
    existentes: 0,
    warnings: [],
  });
  assert.deepEqual(await importDirectory(inventory(), writer), {
    gerencias: 0,
    asesores: 0,
    existentes: 2,
    warnings: [],
  });
});
test("Atrio-only import does not enroll agencies in WhatsApp cron and reports incomplete imports", async () => {
  const data = inventory();
  data.agencies[0].bots = data.agencies[0].bots.filter(
    (b) => b.channel === "atrio",
  );
  const result = await importDirectory(data, {
    agency: async () => {
      throw Error("must not run");
    },
    advisor: async () => {
      throw Error("already linked elsewhere");
    },
  });
  assert.equal(result.gerencias, 0);
  assert.equal(result.asesores, 0);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /gera/);
});
test("saved display snapshots tolerate malformed historical values", () => {
  assert.deepEqual(savedBotInventory({}), []);
  assert.deepEqual(
    savedBotInventory([null, {}, bot(), bot({ channel: "atrio" })]),
    [bot()],
  );
});

test("virtual agency keys survive adviser ordering changes", () => {
  const first = client(),
    second = {
      ...client(),
      id: "second",
      atrio_id: "92000000-0000-4000-8000-000000000002",
      slug: "other",
    };
  const directory: AdvisorDirectory[] = [
    {
      id: first.atrio_id,
      slug: "gera",
      name: "Gera",
      connections: [connection()],
    },
    {
      id: second.atrio_id,
      slug: "other",
      name: "Other",
      connections: [connection({ connection_id: "second", agency_id: 20 })],
    },
  ];
  const before = groupBots([], [first, second], directory, "client-a");
  const after = groupBots([], [second, first], directory, "client-a");
  assert.deepEqual(
    new Map(before.map((group) => [group.gerencia_id, group.uiKey])),
    new Map(after.map((group) => [group.gerencia_id, group.uiKey])),
  );
});

test("pending PBAdmin bots stay visible without becoming live chat connections", () => {
  const pending = bot({
    manager_id: 1999,
    channel: "atrio",
    agency_id: 30,
    agency_name: "Pending agency",
    platform: 6,
    advisor_id: advisorId,
  });
  const live = connection(),
    profile = {
      ...client(),
      pbadmin_bots: [
        bot({
          manager_id: live.manager_id,
          channel: "atrio",
          advisor_id: advisorId,
        }),
        pending,
      ],
    };
  const groups = groupBots(
    [],
    [profile],
    [{ id: advisorId, slug: "gera", name: "Gera", connections: [live] }],
    "client-a",
  );
  assert.equal(groups.length, 2);
  assert.equal(groups.find((g) => g.gerencia_id === 10)?.atrioBots.length, 1);
  const entry = groups.find((g) => g.gerencia_id === 30)?.atrioBots[0];
  assert.equal(entry?.inventory?.manager_id, 1999);
  assert.equal(entry?.connection, null);
  const changed = {
    ...profile,
    atrio_id: "92000000-0000-4000-8000-000000000099",
  };
  const afterEdit = groupBots([], [changed], [], "client-a");
  assert.equal(afterEdit.length, 1);
  assert.equal(
    afterEdit[0].atrioBots[0].inventory,
    undefined,
    "editing the advisor must not inherit another advisor inventory",
  );
  assert.match(
    botSearchText(groups.find((g) => g.gerencia_id === 30)!),
    /1999/,
  );
});

test("shared agency reads avoid downloading bot inventory outside the Bots screen", async (t) => {
  process.env.NEXT_PUBLIC_SUPABASE_URL ||= "https://fixture.invalid";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= "synthetic";
  const { supabase } = await import("../lib/supabaseClient"),
    { fetchGerencias } = await import("../lib/gerencias/gerenciasDb");
  const selections: string[] = [];
  t.mock.method(supabase, "from", () => {
    const query = {
      select(columns: string) {
        selections.push(columns);
        return query;
      },
      eq() {
        return query;
      },
      order() {
        return query;
      },
      overrideTypes() {
        return query;
      },
      then(resolve: (value: unknown) => unknown) {
        return Promise.resolve({ data: [], error: null }).then(resolve);
      },
    };
    return query as never;
  });
  await fetchGerencias("client-a", "ARS");
  await fetchGerencias("client-a", "ARS", true);
  assert.doesNotMatch(selections[0], /pbadmin_bots/);
  assert.match(selections[1], /pbadmin_bots/);
});
