import type { LandingCtaDestination, TemplateOption } from "./types";

export const ATRIO_TEMPLATES: readonly TemplateOption[] = ["template7", "template8", "template9"];
export function templateChannel(template: TemplateOption): LandingCtaDestination {
  return ATRIO_TEMPLATES.includes(template) ? "atrio" : "whatsapp";
}
export function templatesForChannel<T extends { value: TemplateOption }>(options: readonly T[], channel: LandingCtaDestination, allowAtrio: boolean): T[] {
  return options.filter(option => templateChannel(option.value) === channel && (channel !== "atrio" || allowAtrio));
}
