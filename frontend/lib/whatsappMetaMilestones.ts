export const whatsappMetaEvents = ["off", "Lead", "CompleteRegistration", "InitiateCheckout"] as const;
export type WhatsappMetaEvent = typeof whatsappMetaEvents[number];

export const whatsappMilestones = [
  { key: "first_message", label: "Primer mensaje de la conversación" },
  { key: "username_requested", label: "Solicitud de usuario" },
  { key: "username_sent", label: "Entrega de cuenta nueva" },
] as const;

export type WhatsappMilestone = typeof whatsappMilestones[number]["key"];
export type WhatsappMetaMapping = Record<WhatsappMilestone, WhatsappMetaEvent>;

export function validWhatsappMetaMapping(mapping: WhatsappMetaMapping): boolean {
  const values = whatsappMilestones.map(({ key }) => mapping[key]);
  return values.every((value) => whatsappMetaEvents.includes(value)) &&
    new Set(values.filter((value) => value !== "off")).size === values.filter((value) => value !== "off").length;
}
