export const CLIENT_MODULES = [
  { key: "show_followups", label: "Seguimientos", path: "/dashboard/seguimiento" },
  { key: "show_whatsapp_api", label: "WhatsApp API", path: "/dashboard/whatsapp-cloud-api" },
  { key: "show_atrio", label: "Atrio", path: "/dashboard/atrio" },
  { key: "show_kommo", label: "Integraciones: Kommo", path: null },
  { key: "show_chatrace", label: "Integraciones: Chatrace", path: null },
] as const;

export type ClientModuleKey = (typeof CLIENT_MODULES)[number]["key"];
export type ClientModulePermissions = Record<ClientModuleKey, boolean>;

// Missing rows retain the visibility that existed before module permissions.
export const DEFAULT_CLIENT_MODULE_PERMISSIONS: ClientModulePermissions = {
  show_followups: true,
  show_whatsapp_api: true,
  show_atrio: true,
  show_kommo: true,
  show_chatrace: true,
};

export function normalizeClientModulePermissions(
  row?: Partial<ClientModulePermissions> | null,
): ClientModulePermissions {
  return Object.fromEntries(CLIENT_MODULES.map(({ key }) => [key, row?.[key] !== false])) as ClientModulePermissions;
}

export function canViewClientRoute(pathname: string, permissions: ClientModulePermissions): boolean {
  return CLIENT_MODULES.every(({ key, path }) =>
    !path || (pathname !== path && !pathname.startsWith(`${path}/`)) || permissions[key],
  );
}

export function canViewClientIntegration(section: string, permissions: ClientModulePermissions): boolean {
  if (section === "kommo") return permissions.show_kommo;
  if (section === "chatrace") return permissions.show_chatrace;
  return true;
}
