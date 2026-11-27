export const assignableWhatsappMetaEvents = ["Lead", "CompleteRegistration", "InitiateCheckout"] as const;
export const whatsappMetaEvents = ["off", ...assignableWhatsappMetaEvents] as const;
export type WhatsappMetaEvent = typeof whatsappMetaEvents[number];
export type AssignableWhatsappMetaEvent = typeof assignableWhatsappMetaEvents[number];

export const whatsappMilestones = [
  { key: "first_message", label: "Primer mensaje de la conversación" },
  { key: "username_requested", label: "Solicitud de usuario" },
  { key: "username_sent", label: "Entrega de cuenta nueva" },
] as const;

export type WhatsappMilestone = typeof whatsappMilestones[number]["key"];
export type WhatsappMetaMapping = Record<WhatsappMilestone, WhatsappMetaEvent>;
// An absent event is off. Null means the event is on and still needs a milestone.
export type WhatsappMetaAssignments = Partial<Record<AssignableWhatsappMetaEvent, WhatsappMilestone | null>>;

export function toWhatsappMetaAssignments(mapping: WhatsappMetaMapping): WhatsappMetaAssignments {
  const assignments: WhatsappMetaAssignments = {};
  for (const { key } of whatsappMilestones) {
    const event = mapping[key];
    if (event !== "off") assignments[event] = key;
  }
  return assignments;
}

export function toWhatsappMetaMapping(assignments: WhatsappMetaAssignments): WhatsappMetaMapping | null {
  const mapping: WhatsappMetaMapping = {
    first_message: "off",
    username_requested: "off",
    username_sent: "off",
  };
  for (const event of assignableWhatsappMetaEvents) {
    const milestone = assignments[event];
    if (milestone === undefined) continue;
    if (milestone === null || mapping[milestone] !== "off") return null;
    mapping[milestone] = event;
  }
  return mapping;
}

export function validWhatsappMetaMapping(mapping: WhatsappMetaMapping): boolean {
  const values = whatsappMilestones.map(({ key }) => mapping[key]);
  return values.every((value) => whatsappMetaEvents.includes(value)) &&
    new Set(values.filter((value) => value !== "off")).size === values.filter((value) => value !== "off").length;
}
