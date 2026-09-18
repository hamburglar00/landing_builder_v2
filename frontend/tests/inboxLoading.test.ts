import assert from "node:assert/strict";
import test from "node:test";
import { inboundWindowAfterEvent, mergeMessageWithPreview, mergeMessages, reconcileLoadedMessages } from "../lib/whatsappInboxMessages";
import type { WhatsappCloudApiInboxMessage } from "../lib/whatsappCloudApiDb";

const message = (id: string, patch: Partial<WhatsappCloudApiInboxMessage> = {}): WhatsappCloudApiInboxMessage => ({
  created_at: "2026-09-18T17:00:00Z", direction: "inbound", body: "SYNTHETIC-INBOX",
  status: "processed", meta_message_id: id, message_type: "text", button_title: "", button_url: "", error: "", ...patch,
});

test("a late detail response preserves a realtime message received in flight", () => {
  const old = message("old"), incoming = message("new", { created_at: "2026-09-18T17:01:00Z" });
  assert.deepEqual(reconcileLoadedMessages([old], [old], [old, incoming]), [old, incoming]);
});

test("an unchanged cached status cannot overwrite the newer server status", () => {
  const cached = message("out", { direction: "outbound", status: "sent" });
  const server = { ...cached, status: "delivered" };
  assert.deepEqual(reconcileLoadedMessages([server], [cached], [cached]), [server]);
});

test("a realtime status received during a request survives its older response", () => {
  const cached = message("out", { direction: "outbound", status: "sent" });
  const realtime = { ...cached, status: "read" };
  assert.deepEqual(reconcileLoadedMessages([cached], [cached], [realtime]), [realtime]);
});

test("optimistic manual send is reconciled without a duplicate bubble", () => {
  const optimistic = message("manual:synthetic", { direction: "outbound", status: "pending" });
  const delivered = { ...optimistic, meta_message_id: "server-id", status: "sent" };
  assert.deepEqual(mergeMessages([optimistic], delivered), [delivered]);
  assert.deepEqual(reconcileLoadedMessages([delivered], [optimistic], [optimistic]), [delivered]);
});

test("message refresh preserves inbound/outbound bodies, CTA and errors", () => {
  const current = message("cta", { direction: "outbound", body: "SYNTHETIC CTA", button_title: "Abrir", button_url: "https://example.invalid/synthetic", error: "SYNTHETIC ERROR" });
  assert.deepEqual(reconcileLoadedMessages([current], [], []), [current]);
});

test("outbound realtime events do not erase the selected inbound service window", () => {
  const at = "2026-09-18T17:00:00Z";
  const outgoing = Array.from({ length: 60 }, (_, i) => message(`out-${i}`, { direction: "outbound" }));
  assert.equal(outgoing.reduce<string | null>((previous, next) => inboundWindowAfterEvent(previous, next), at), at);
  assert.equal(inboundWindowAfterEvent(at, message("older", { created_at: "2026-09-17T17:00:00Z" })), at);
});

test("a preview cannot overwrite CTA metadata when an older status arrives during detail loading", () => {
  const full = message("cta", { direction: "outbound", message_type: "interactive", button_title: "Abrir", button_url: "https://example.invalid/synthetic" });
  const preview = { ...full, message_type: "text", button_title: "", button_url: "" };
  const older = message("older", { direction: "outbound", created_at: "2026-09-17T17:00:00Z", status: "delivered" });
  const pending = mergeMessageWithPreview([], older, preview);
  assert.equal(pending.lastMessage.meta_message_id, full.meta_message_id);
  assert.deepEqual(pending.messages, [older]);
  const loaded = reconcileLoadedMessages([full], [], pending.messages);
  assert.deepEqual(loaded.find(m => m.meta_message_id === full.meta_message_id), full);
});

test("successive old status updates preserve the newer summary preview", () => {
  const preview = message("newest");
  const older = message("older", { created_at: "2026-09-17T17:00:00Z" });
  const first = mergeMessageWithPreview([], older, preview);
  const second = mergeMessageWithPreview(first.messages, { ...older, status: "read" }, first.lastMessage);
  assert.equal(second.lastMessage.meta_message_id, preview.meta_message_id);
  assert.equal(second.messages.length, 1);
  assert.equal(second.messages[0].status, "read");
});
