export type ConversionLogDirectionFilter = "all" | "received" | "meta";
export type ConversionLogEventFilter = "all" | "CONTACT" | "LEAD" | "COMPLETEREGISTRATION" | "PURCHASE";

const META_EVENT_NAMES: Record<
  Exclude<ConversionLogEventFilter, "all">,
  string
> = {
  CONTACT: "Contact",
  LEAD: "Lead",
  COMPLETEREGISTRATION: "CompleteRegistration",
  PURCHASE: "Purchase",
};

export type ConversionLogQueryFilter = {
  requireReceivedPayload: boolean;
  requireMetaPayload: boolean;
  orExpression: string;
};

export function buildConversionLogQueryFilter(
  direction: ConversionLogDirectionFilter = "all",
  eventType: ConversionLogEventFilter = "all",
): ConversionLogQueryFilter {
  const requireReceivedPayload = direction === "received";
  const requireMetaPayload = direction === "meta";
  if (eventType === "all") {
    return {
      requireReceivedPayload,
      requireMetaPayload,
      orExpression: "",
    };
  }

  const eventName = META_EVENT_NAMES[eventType];
  const receivedTerms = [
    `payload_received.ilike.%\"event_name\":\"${eventName}\"%`,
    `payload_received.ilike.%\"action\":\"${eventType}\"%`,
  ];
  if (eventType === "COMPLETEREGISTRATION") {
    receivedTerms.push(
      `payload_received.ilike.%\"action\":\"COMPLETATIONREGISTRATION\"%`,
      `payload_received.ilike.%\"action\":\"COMPLETE_REGISTRATION\"%`,
      `payload_received.ilike.%\"action\":\"CompleteRegistration\"%`,
      `payload_received.ilike.%\"event_name\":\"COMPLETEREGISTRATION\"%`,
    );
  }
  const metaTerms = [
    `payload_meta.ilike.%\"event_name\":\"${eventName}\"%`,
  ];
  const terms = direction === "received"
    ? receivedTerms
    : direction === "meta"
      ? metaTerms
      : [...receivedTerms, ...metaTerms];

  return {
    requireReceivedPayload,
    requireMetaPayload,
    orExpression: terms.join(","),
  };
}
