export type ConversionLogDirectionFilter = "all" | "received" | "meta";
export type ConversionLogEventFilter = "all" | "CONTACT" | "LEAD" | "PURCHASE";

const META_EVENT_NAMES: Record<
  Exclude<ConversionLogEventFilter, "all">,
  string
> = {
  CONTACT: "Contact",
  LEAD: "Lead",
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
