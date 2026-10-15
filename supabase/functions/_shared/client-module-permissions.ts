export const CLIENT_MODULE_KEYS = [
  "show_followups", "show_whatsapp_api", "show_atrio", "show_kommo", "show_chatrace",
] as const;
export type ClientModulePermissions = Record<(typeof CLIENT_MODULE_KEYS)[number], boolean>;

export function parseModuleVisibility(value: unknown): Partial<ClientModulePermissions> | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("moduleVisibility debe ser un objeto de permisos booleanos.");
  }
  const permissions: Partial<ClientModulePermissions> = {};
  for (const [key, enabled] of Object.entries(value)) {
    if (!(CLIENT_MODULE_KEYS as readonly string[]).includes(key) || typeof enabled !== "boolean") {
      throw new Error(`Permiso de módulo inválido: ${key}.`);
    }
    permissions[key as keyof ClientModulePermissions] = enabled;
  }
  return permissions;
}
