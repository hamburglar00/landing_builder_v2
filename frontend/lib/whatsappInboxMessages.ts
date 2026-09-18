import type { WhatsappCloudApiInboxMessage } from "./whatsappCloudApiDb";

function messageTimestamp(message: WhatsappCloudApiInboxMessage): number {
  const time = new Date(message.created_at).getTime();
  return Number.isFinite(time) ? time : 0;
}

function isOptimisticMessage(message: WhatsappCloudApiInboxMessage): boolean {
  return message.meta_message_id.startsWith("manual:");
}

export function mergeMessages(
  current: WhatsappCloudApiInboxMessage[],
  nextMessage: WhatsappCloudApiInboxMessage,
  replaceMetaMessageId = "",
): WhatsappCloudApiInboxMessage[] {
  const next = current.filter(
    (message) => !replaceMetaMessageId || message.meta_message_id !== replaceMetaMessageId,
  );
  const metaId = nextMessage.meta_message_id.trim();
  let existingIndex = metaId
    ? next.findIndex((message) => message.meta_message_id === metaId)
    : -1;

  if (existingIndex < 0 && metaId && nextMessage.direction === "outbound") {
    const nextTime = messageTimestamp(nextMessage);
    existingIndex = next.findIndex((message) => {
      if (!isOptimisticMessage(message)) return false;
      if (message.direction !== "outbound") return false;
      if (message.body !== nextMessage.body) return false;
      return Math.abs(messageTimestamp(message) - nextTime) < 15_000;
    });
  }

  if (existingIndex >= 0) {
    const existing = next[existingIndex];
    next[existingIndex] = {
      ...existing,
      ...nextMessage,
      created_at: existing.created_at || nextMessage.created_at,
      body: nextMessage.body || existing.body,
      error: nextMessage.error || existing.error,
    };
  } else {
    next.push(nextMessage);
  }

  return next.sort((a, b) => messageTimestamp(a) - messageTimestamp(b));
}

// A summary preview is presentation data, never a complete history message.
export function mergeMessageWithPreview(
  current: WhatsappCloudApiInboxMessage[],
  nextMessage: WhatsappCloudApiInboxMessage,
  preview: WhatsappCloudApiInboxMessage | null,
  replaceMetaMessageId = "",
): { messages: WhatsappCloudApiInboxMessage[]; lastMessage: WhatsappCloudApiInboxMessage } {
  const messages = mergeMessages(current, nextMessage, replaceMetaMessageId);
  const latest = messages[messages.length - 1] ?? nextMessage;
  const previews = preview ? mergeMessages([preview], latest) : [latest];
  return { messages, lastMessage: previews[previews.length - 1] ?? latest };
}

// Preserve messages/statuses received while an asynchronous detail request was in flight.
export function reconcileLoadedMessages(
  loaded: WhatsappCloudApiInboxMessage[],
  atRequestStart: WhatsappCloudApiInboxMessage[],
  current: WhatsappCloudApiInboxMessage[],
): WhatsappCloudApiInboxMessage[] {
  const key = (m: WhatsappCloudApiInboxMessage) => m.meta_message_id || [m.direction,m.created_at,m.body].join("|");
  const before = new Map(atRequestStart.map(m => [key(m), JSON.stringify(m)]));
  return current.filter(m => before.get(key(m)) !== JSON.stringify(m) || isOptimisticMessage(m))
    .filter(m => !isOptimisticMessage(m) || !loaded.some(server =>
      server.direction === "outbound" && !isOptimisticMessage(server) && server.body === m.body &&
      Math.abs(messageTimestamp(server) - messageTimestamp(m)) < 15_000))
    .reduce((messages, message) => mergeMessages(messages, message), loaded);
}

export function inboundWindowAfterEvent(
  previous: string | null | undefined,
  message: WhatsappCloudApiInboxMessage,
): string | null {
  if (message.direction !== "inbound" || !Number.isFinite(new Date(message.created_at).getTime())) return previous ?? null;
  return !previous || messageTimestamp(message) > new Date(previous).getTime()
    ? message.created_at : previous;
}
