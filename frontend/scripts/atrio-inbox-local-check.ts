/* eslint-disable @typescript-eslint/no-explicit-any -- Exercise actual runtime modules from two separate checkouts. */
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadApi2Inbox, loadAtrioInbox } from "./atrio-inbox-local/source-loader";
import { InboxFixture, ids, type Row } from "./atrio-inbox-local/fixture";
import { LocalHttp } from "./template7-local-flow/local-http";
import { checkInboxButtons } from "./atrio-inbox-local/browser-check";

async function main() {
  const root = path.resolve(process.cwd(), "..");
  const api2Index = process.argv.indexOf("--api2-repo");
  assert.ok(api2Index !== -1 && process.argv[api2Index + 1], "Pass --api2-repo <local API2 checkout>");
  process.env.ATRIO_EXTERNAL_REQUEST_SECRET = "local-inbox-fixture-encryption-only";
  process.env.PBADMIN_PLAYER_OPERATIONS_ENABLED = "true";
  const api2: any = await loadApi2Inbox(path.resolve(process.argv[api2Index + 1]));
  const atrio: any = await loadAtrioInbox(path.resolve(root, "..", "internal-chat"));
  let fixture: InboxFixture;
  let controller: any;
  let apiRequests = 0;
  let pushes = 0;
  let loseMutationResponse = false;
  const http = new LocalHttp();
  const outcomes: { name: string; passed: boolean; error?: string }[] = [];
  function reset() {
    fixture = new InboxFixture(api2, atrio.encryptExternalSecret);
    (globalThis as Row).__ATRIO_INBOX_LOCAL__ = fixture;
    controller = new api2.Controller();
    controller.operationService = new api2.Service({ playerService: fixture.playerService,
      credentialService: fixture.credentialService, managerService: fixture.managerService,
      operationRepository: fixture.operations, platformService: fixture.platformService });
    apiRequests = 0; pushes = 0; loseMutationResponse = false;
    return fixture;
  }
  async function check(name: string, run: () => Promise<void>) {
    reset();
    try { await run(); outcomes.push({ name, passed: true }); }
    catch (error) { outcomes.push({ name, passed: false, error: error instanceof Error ? error.message : "failed" }); }
    await http.idle();
    await new Promise(resolve => setImmediate(resolve));
  }
  function input(operation = "load", key = "local-operation-0001", amount = 200) {
    return { conversationId: ids.conversation, operation, amount, idempotencyKey: key };
  }
  const perform = (operation = "load", key = "local-operation-0001", amount = 200) => atrio.performPlayerOperationAction(input(operation, key, amount));
  function message(type = "texto", id = randomUUID()) {
    return { id, conversation_id: ids.conversation, sender: "cliente", type,
      content: type === "texto" ? "Hola desde el chat local" : "https://files.local.test/comprobante.pdf",
      metadata: { file_name: "comprobante.pdf", mime_type: "application/pdf" } };
  }
  const outbound = (msg: Row) => atrio.handleClientMessageIntegrations({ supabase: fixture.db, advisor: fixture.advisor,
    contact: fixture.contact, conversation: fixture.conversation, message: msg, intent: null });
  const reply = (key: string, data: Row) => fetch("https://atrio.local.test/api/external/advisors/asesor-local/messages", {
    method: "POST", headers: { Authorization: "Bearer atrio-fixture-token-only", "Content-Type": "application/json", "Idempotency-Key": key },
    body: JSON.stringify({ eventName: "message.reply", data: { to: ids.player, conversationId: ids.conversation, body: "Respuesta local", ...data } }),
  });
  reset();
  const { chromium } = await import(pathToFileURL(path.join(root, "scripts/phase0/browser-runtime.mjs")).href);
  // Start DevTools before the application's fetch is restricted to fixtures.
  const browser = await chromium();
  try {
    await http.serve("https://api2.local.test", async request => {
      apiRequests++;
      assert.equal(request.headers.get("apikey"), "local-key");
      assert.equal(request.headers.get("apisecret"), "local-secret");
      const url = new URL(request.url);
      let status = 0, body: unknown;
      const recorder: Row = { status: (code: number) => { status = code; return recorder; },
        send: (data: unknown) => { body = data; return recorder; }, json: (data: unknown) => { body = data; return recorder; } };
      const payload = request.method === "POST" ? await request.json() : {};
      const segments = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
      const params = url.pathname.startsWith("/api/v2/atrio/webhooks/")
        ? { atrio_advisor_id: segments.at(-1) }
        : { atrio_advisor_id: segments[5], external_user_id: segments[7] };
      const ctx = { request: { param: (key: string) => (params as Row)[key], all: () => payload }, response: recorder };
      try {
        if (url.pathname.startsWith("/api/v2/atrio/webhooks/")) await new api2.AtrioWebhookController().handle(ctx);
        else if (url.pathname.endsWith("/balance")) await controller.balanceByAdvisor(ctx);
        else if (url.pathname.endsWith("/load")) await controller.loadByAdvisor(ctx);
        else if (url.pathname.endsWith("/withdraw")) await controller.withdrawByAdvisor(ctx);
        else throw new Error("Unknown fixture API2 route");
      } catch (error: any) {
        status = error.messages ? 422 : 500; body = { code: "fixture_request_failed" };
      }
      if (loseMutationResponse && request.method === "POST") {
        loseMutationResponse = false;
        return Response.json({ code: "fixture_response_lost" }, { status: 503 });
      }
      return Response.json(body, { status });
    });
    await http.serve("https://atrio.local.test", request => atrio.receiveReply(new atrio.NextRequest(request), { params: Promise.resolve({ advisorSlug: "asesor-local" }) }));
    await http.serve("https://push.local.test", async () => { pushes++; return Response.json({ ok: true }); });
    http.install();

    await check("saldo del jugador en la gerencia operativa MKT sin referencia", async () => {
      assert.deepEqual(await atrio.getPlayerBalanceAction(ids.conversation), { ok: true, kind: "balance", balance: 1000, platform: api2.PlatformType.reyDeAses });
      assert.equal(fixture.providerCalls.balance, 1);
    });
    await check("cargar devuelve exito al inbox con el serializador real de API2", async () => {
      assert.deepEqual(await perform(), { ok: true, kind: "operation", operation: "load", amount: 200, replayed: false });
      assert.equal(fixture.balance, 1200);
    });
    await check("retirar devuelve exito al inbox con el serializador real de API2", async () => {
      assert.deepEqual(await perform("withdraw"), { ok: true, kind: "operation", operation: "withdraw", amount: 200, replayed: false });
      assert.equal(fixture.balance, 800);
    });
    await check("un reintento de carga conserva una unica acreditacion", async () => {
      await perform(); const result = await perform();
      assert.equal(result.ok, true); assert.equal(result.replayed, true);
      assert.equal(fixture.providerCalls.load, 1); assert.equal(fixture.balance, 1200);
    });
    await check("un reintento de retiro conserva un unico debito", async () => {
      await perform("withdraw"); const result = await perform("withdraw");
      assert.equal(result.ok, true); assert.equal(result.replayed, true);
      assert.equal(fixture.providerCalls.withdraw, 1); assert.equal(fixture.balance, 800);
    });
    await check("diez solicitudes simultaneas comparten la misma operacion", async () => {
      const results = await Promise.all(Array.from({ length: 10 }, () => perform()));
      assert.ok(results.some(result => result.ok));
      assert.equal(fixture.providerCalls.load, 1); assert.equal(fixture.balance, 1200);
    });
    await check("perder la respuesta despues del exito permite recuperar sin repetir", async () => {
      loseMutationResponse = true; assert.equal((await perform()).ok, false);
      const result = await perform(); assert.equal(result.ok, true); assert.equal(result.replayed, true);
      assert.equal(fixture.providerCalls.load, 1);
    });
    await check("si falla el checkpoint posterior al proveedor no se vuelve a cargar", async () => {
      fixture.failCheckpoint = true; assert.equal((await perform()).ok, false);
      const result = await perform(); assert.equal(result.code, "operation_in_progress");
      assert.equal(fixture.providerCalls.load, 1);
    });
    await check("la clave no puede reutilizarse con otro monto o tipo de operacion", async () => {
      await perform();
      assert.equal((await perform("load", "local-operation-0001", 300)).code, "idempotency_key_conflict");
      assert.equal((await perform("withdraw")).code, "idempotency_key_conflict");
      assert.equal(fixture.providerCalls.load, 1); assert.equal(fixture.providerCalls.withdraw, 0);
    });
    await check("rechazo del proveedor no se reejecuta con la misma clave", async () => {
      fixture.providerReject = true;
      assert.equal((await perform()).code, "provider_operation_failed");
      assert.equal((await perform()).code, "provider_operation_failed");
      assert.equal(fixture.providerCalls.load, 1); assert.equal(fixture.balance, 1000);
    });
    await check("retiro sin saldo no confirma exito ni altera el saldo", async () => {
      const result = await perform("withdraw", "withdraw-over-balance", 2000);
      assert.equal(result.ok, false); assert.equal(result.retryable, false); assert.equal(fixture.balance, 1000);
    });
    await check("API2 rechaza 100.000 con saldo 10.000 y Atrio muestra los importes exactos", async () => {
      fixture.balance = 10_000;
      const result = await perform("withdraw", "withdraw-insufficient", 100_000);
      assert.equal(result.code, "insufficient_balance");
      assert.equal(result.message, "Saldo insuficiente: disponibles 10.000, solicitado 100.000");
      assert.equal(result.retryable, false); assert.equal(fixture.balance, 10_000);
      assert.equal(fixture.providerCalls.withdraw, 0);
      assert.equal([...fixture.records.values()][0].status, "failed");
    });
    await check("el rechazo sin saldo conserva sus importes al repetir la clave aunque cambie el saldo", async () => {
      fixture.balance = 10_000;
      const first = await perform("withdraw", "insufficient-replay", 100_000);
      fixture.balance = 200_000;
      assert.deepEqual(await perform("withdraw", "insufficient-replay", 100_000), first);
      assert.equal(fixture.providerCalls.balance, 1); assert.equal(fixture.providerCalls.withdraw, 0);
    });
    await check("la ruta directa de API2 responde 422 con saldo disponible y monto solicitado", async () => {
      fixture.balance = 10_000;
      const response = await fetch(`https://api2.local.test/api/v1/bot/atrio/advisors/${ids.advisor}/players/${ids.player}/withdraw`, {
        method: "POST", headers: { "Content-Type": "application/json", apikey: "local-key", apisecret: "local-secret" },
        body: JSON.stringify({ amount: 100_000, idempotency_key: "direct-insufficient" }),
      });
      assert.equal(response.status, 422);
      const payload = await response.json(); assert.equal(payload.code, "insufficient_balance");
      assert.equal(payload.error.available_balance, 10_000); assert.equal(payload.error.requested_amount, 100_000);
      assert.equal(fixture.providerCalls.withdraw, 0);
    });
    await check("un retiro confirmado se recupera aunque el saldo actual ya no alcance", async () => {
      fixture.balance = 1000;
      loseMutationResponse = true;
      assert.equal((await perform("withdraw", "withdraw-response-lost", 800)).ok, false);
      assert.equal(fixture.balance, 200);
      const replay = await perform("withdraw", "withdraw-response-lost", 800);
      assert.equal(replay.ok, true); assert.equal(replay.replayed, true);
      assert.equal(fixture.providerCalls.balance, 1); assert.equal(fixture.providerCalls.withdraw, 1);
    });
    await check("retirar exactamente el saldo disponible permite la operacion", async () => {
      assert.equal((await perform("withdraw", "withdraw-full-balance", 1000)).ok, true);
      assert.equal(fixture.balance, 0); assert.equal(fixture.providerCalls.withdraw, 1);
    });
    await check("si no se puede consultar el saldo no se ejecuta el retiro", async () => {
      fixture.platformService.getBalance = async () => ({ success: false, errorCode: "provider_balance_failed" });
      assert.equal((await perform("withdraw")).code, "provider_balance_failed");
      assert.equal(fixture.providerCalls.withdraw, 0);
    });
    await check("un saldo ausente, negativo o invalido no se transforma en saldo insuficiente", async () => {
      for (const value of [undefined, NaN, Infinity, -1]) {
        fixture.platformService.getBalance = async () => ({ success: true, balance: value });
        const result = await perform("withdraw", "invalid-balance-" + String(value));
        assert.equal(result.code, "provider_balance_failed");
      }
      assert.equal(fixture.providerCalls.withdraw, 0);
    });
    await check("el mensaje de saldo insuficiente no redondea hacia arriba las fichas disponibles", async () => {
      fixture.balance = 9999.5;
      const result = await perform("withdraw", "withdraw-fractional-balance", 10_000);
      assert.equal(result.message, "Saldo insuficiente: disponibles 9.999,5, solicitado 10.000");
      assert.equal(fixture.providerCalls.withdraw, 0);
    });
    await check("sin sesion, con rol admin o con perfil inconsistente se bloquea", async () => {
      for (const session of [{ isAuthenticated: false }, { isAuthenticated: true, userId: ids.advisor, profile: { ...fixture.advisor, role: "admin" } },
        { isAuthenticated: true, userId: ids.otherAdvisor, profile: fixture.advisor }]) {
        fixture.session = session;
        assert.equal((await perform()).code, "unauthorized");
      }
      assert.equal(apiRequests, 0);
    });
    await check("un asesor no puede operar el chat de otro asesor", async () => {
      assert.equal((await atrio.performPlayerOperationAction({ ...input(), conversationId: ids.otherConversation })).ok, false);
      assert.equal(apiRequests, 0);
    });
    await check("no se acepta otra identidad enviada desde el navegador", async () => {
      assert.equal((await atrio.performPlayerOperationAction({ ...input(), advisorId: ids.otherAdvisor })).code, "invalid_request");
      assert.equal(apiRequests, 0);
    });
    await check("una cuenta vinculada a otro jugador no se puede operar", async () => {
      fixture.db.tables.get("player_provider_accounts")![0].player_id = ids.otherPlayer;
      assert.equal((await perform()).code, "external_user_id_missing"); assert.equal(apiRequests, 0);
    });
    await check("un jugador perteneciente a otro manager es rechazado por API2", async () => {
      fixture.playerService.findByPlayerIdentifierAndAgency = async () => ({ id: 71, managerId: 999 });
      assert.equal((await perform()).code, "player_manager_mismatch"); assert.equal(fixture.providerCalls.load, 0);
    });
    await check("montos invalidos se rechazan antes de contactar API2", async () => {
      for (const amount of [0, -1, 1.5, 1_000_000_000, "200"]) assert.equal((await atrio.performPlayerOperationAction({ ...input(), amount })).code, "invalid_request");
      assert.equal(apiRequests, 0);
    });
    await check("Full Carga admite saldo, carga y retiro manuales", async () => {
      fixture.manager.role = api2.ManagerRole.load; fixture.manager.agencyId = 21;
      assert.equal((await atrio.getPlayerBalanceAction(ids.conversation)).ok, true);
      assert.equal((await perform()).ok, true);
      assert.equal((await perform("withdraw", "full-carga-withdraw")).ok, true);
      assert.equal(fixture.balance, 1000);
    });
    await check("un manager inactivo no puede consultar ni mover saldo", async () => {
      fixture.manager.active = false;
      assert.equal((await perform()).code, "manager_inactive"); assert.equal(fixture.providerCalls.load, 0);
    });
    await check("la bandera deshabilitada bloquea las operaciones", async () => {
      process.env.PBADMIN_PLAYER_OPERATIONS_ENABLED = "false";
      try { assert.equal((await perform()).code, "feature_disabled"); assert.equal(apiRequests, 0); }
      finally { process.env.PBADMIN_PLAYER_OPERATIONS_ENABLED = "true"; }
    });
    for (const type of ["texto", "imagen", "archivo"]) await check(`Atrio envia ${type} por la integracion global a API2`, async () => {
      const msg = message(type); const result = await outbound(msg);
      assert.equal(result[0].status, "sent");
      await new Promise(resolve => setImmediate(resolve));
      assert.equal(fixture.events.length, 1);
      const event = fixture.events[0].event;
      assert.equal(event.data.from, ids.player); assert.equal(event.data.atrioConversationId, ids.conversation);
      assert.equal(event.key.id, msg.id);
      assert.equal(fixture.events[0].kind, type === "texto" ? "text" : "file");
      const audit = fixture.db.tables.get("integration_event_deliveries")![0];
      assert.ok(!JSON.stringify(audit).includes("atrio-fixture-token-only"), "Audit must redact advisor token");
    });
    await check("un evento enviado no se vuelve a enviar por repeticion secuencial", async () => {
      const msg = message(); await outbound(msg); await outbound(msg); assert.equal(apiRequests, 1);
    });
    await check("dos ejecuciones simultaneas no duplican el webhook saliente", async () => {
      const msg = message(); await Promise.all([outbound(msg), outbound(msg)]); assert.equal(apiRequests, 1);
    });
    await check("si no se puede persistir la entrega no se envia el webhook", async () => {
      fixture.db.failDeliveryInsert = 1; await outbound(message()); assert.equal(apiRequests, 0);
    });
    await check("la respuesta de API2 llega al mismo chat del jugador", async () => {
      const delivery = new api2.AtrioResponseDeliveryService(new api2.AtrioClient({ baseUrl: "https://atrio.local.test" }));
      const result = await delivery.deliverResponse({ manager: fixture.manager, userId: ids.player, conversationId: ids.conversation, message: "Respuesta desde API2" });
      assert.ok(result); const rows = fixture.db.tables.get("messages")!;
      assert.equal(rows.length, 1); assert.equal(rows[0].conversation_id, ids.conversation); assert.equal(rows[0].content, "Respuesta desde API2");
      assert.equal(apiRequests, 0, "An advisor reply must not loop back to API2"); assert.equal(pushes, 1);
    });
    await check("API2 puede devolver un archivo al chat correcto", async () => {
      const client = new api2.AtrioClient({ baseUrl: "https://atrio.local.test" });
      const result = await client.sendFile({ token: fixture.manager.atrioToken, advisorSlug: fixture.advisor.slug,
        playerId: ids.player, conversationId: ids.conversation, fileUrl: "https://files.local.test/respuesta.pdf", fileName: "respuesta.pdf", mimeType: "application/pdf" });
      assert.equal(result.ok, true); const row = fixture.db.tables.get("messages")![0];
      assert.equal(row.type, "archivo"); assert.equal(row.metadata.file_name, "respuesta.pdf"); assert.equal(row.conversation_id, ids.conversation);
    });
    await check("reintento de respuesta inserta un solo mensaje y un solo push", async () => {
      const client = new api2.AtrioClient({ baseUrl: "https://atrio.local.test" });
      const params = { token: fixture.manager.atrioToken, advisorSlug: fixture.advisor.slug, playerId: ids.player,
        conversationId: ids.conversation, message: "Respuesta unica", externalMessageId: "stable-response-key-local" };
      assert.equal((await client.sendMessage(params)).ok, true);
      const retry = await client.sendMessage(params); assert.equal(retry.ok, true); assert.equal(retry.data.duplicate, true);
      assert.equal(fixture.db.tables.get("messages")!.length, 1); assert.equal(pushes, 1);
    });
    await check("un fallo de escritura de mensaje se recupera sin perder la respuesta", async () => {
      fixture.db.failMessageInsert = 1;
      const client = new api2.AtrioClient({ baseUrl: "https://atrio.local.test" });
      const result = await client.sendMessage({ token: fixture.manager.atrioToken, advisorSlug: fixture.advisor.slug,
        playerId: ids.player, conversationId: ids.conversation, message: "Respuesta recuperada", externalMessageId: "recover-response-local" });
      assert.equal(result.ok, true); assert.equal(fixture.db.tables.get("messages")!.length, 1);
    });
    await check("conversationId ajeno explicito no se redirige silenciosamente a otro chat", async () => {
      const response = await reply("invalid-conversation-local", { conversationId: ids.otherConversation });
      assert.equal(response.status, 404); assert.equal(fixture.db.tables.get("messages")!.length, 0);
    });
    await check("no se permite usar otro jugador como destino del mismo chat", async () => {
      fixture.db.tables.get("players")!.push({ id: "a0000000-0000-4000-8000-000000000009", advisor_id: ids.advisor });
      const response = await reply("invalid-player-local", { to: "a0000000-0000-4000-8000-000000000009" });
      assert.equal(response.status, 409); assert.equal(fixture.db.tables.get("messages")!.length, 0);
    });
    await check("no se reemplaza un destino de otro asesor por el jugador de la conversacion", async () => {
      const response = await reply("other-advisor-player-local", { to: ids.otherPlayer });
      assert.equal(response.status, 404); assert.equal(fixture.db.tables.get("messages")!.length, 0);
    });
    await check("una misma clave de respuesta no puede reasignarse a otro chat", async () => {
      fixture.db.tables.get("conversations")!.push({ id: "a0000000-0000-4000-8000-000000000010", advisor_id: ids.advisor, player_id: ids.player });
      assert.equal((await reply("same-response-cross-chat", {})).status, 200);
      const response = await reply("same-response-cross-chat", { conversationId: "a0000000-0000-4000-8000-000000000010" });
      assert.equal(response.status, 409); assert.equal(fixture.db.tables.get("messages")!.length, 1);
    });
    await check("dos respuestas simultaneas con una clave insertan un solo mensaje", async () => {
      const responses = await Promise.all([reply("concurrent-replies-local", {}), reply("concurrent-replies-local", {})]);
      assert.ok(responses.every(response => response.status === 200));
      assert.equal(fixture.db.tables.get("messages")!.length, 1); assert.equal(pushes, 1);
    });
    await check("respuestas simultaneas a chats distintos no comparten confirmacion", async () => {
      fixture.db.tables.get("conversations")!.push({ id: "a0000000-0000-4000-8000-000000000010", advisor_id: ids.advisor, player_id: ids.player });
      const responses = await Promise.all([reply("concurrent-cross-chat", {}), reply("concurrent-cross-chat", { conversationId: "a0000000-0000-4000-8000-000000000010" })]);
      assert.deepEqual(responses.map(response => response.status).sort(), [200, 409]);
      assert.equal(fixture.db.tables.get("messages")!.length, 1);
    });
    await check("una entrega historica incompleta no se presenta como respuesta exitosa", async () => {
      const requestKey = "legacy-incomplete-local";
      fixture.db.tables.get("integration_event_deliveries")!.push({ id: randomUUID(), integration_key: "external_request", conversation_id: ids.conversation,
        idempotency_key: `inbound:${ids.advisor}:${createHash("sha256").update(requestKey).digest("hex")}`, status: "failed", message_id: null });
      assert.equal((await reply(requestKey, {})).status, 503); assert.equal(fixture.db.tables.get("messages")!.length, 0);
    });
    await check("el token de otro asesor no permite insertar una respuesta", async () => {
      const response = await fetch("https://atrio.local.test/api/external/advisors/asesor-local/messages", {
        method: "POST", headers: { Authorization: "Bearer wrong-fixture-token", "Content-Type": "application/json" },
        body: JSON.stringify({ eventName: "message.reply", data: { to: ids.player, body: "Prohibido" } }),
      });
      assert.equal(response.status, 401); assert.equal(fixture.db.tables.get("messages")!.length, 0);
    });
    await checkInboxButtons({ browser, atrioRoot: path.resolve(root, "..", "internal-chat"), fixture: () => fixture,
      actions: atrio, loseResponse: () => { loseMutationResponse = true; }, check });
    console.log(JSON.stringify({ passed: outcomes.filter(row => row.passed).length, total: outcomes.length,
      externalNetwork: 0, productionWrites: 0, realMoneyOperations: 0, results: outcomes }, null, 2));
    if (outcomes.some(row => !row.passed)) process.exitCode = 1;
  } finally { await http.close(); await browser.close(); }
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Local inbox check failed"); process.exitCode = 1; });
