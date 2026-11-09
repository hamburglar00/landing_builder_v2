export const CLIENT_MODULES = [
  { key: "show_followups", label: "Seguimientos", path: "/dashboard/seguimiento" },
  { key: "show_whatsapp_api", label: "WhatsApp API", path: "/dashboard/whatsapp-cloud-api" },
  { key: "show_notifications", label: "Notificaciones", path: "/dashboard/notificaciones" },
  { key: "show_atrio", label: "Atrio y sus plantillas", path: "/dashboard/atrio" },
  { key: "show_kommo", label: "Integraciones: Kommo", path: null },
  { key: "show_chatrace", label: "Integraciones: Chatrace", path: null },
] as const;

export type ClientModuleKey = (typeof CLIENT_MODULES)[number]["key"];
export type ClientModulePermissions = Record<ClientModuleKey, boolean>;

// Optional sections require an explicit administrator enablement.
export const DEFAULT_CLIENT_MODULE_PERMISSIONS: ClientModulePermissions = {
  show_followups: false,
  show_whatsapp_api: false,
  show_notifications: false,
  show_atrio: false,
  show_kommo: false,
  show_chatrace: false,
};

// Client visibility switches do not restrict the superadmin's own workspace.
export const ADMIN_CLIENT_MODULE_PERMISSIONS = Object.fromEntries(
  CLIENT_MODULES.map(({ key }) => [key, true]),
) as ClientModulePermissions;

export function normalizeClientModulePermissions(
  row?: Partial<ClientModulePermissions> | null,
): ClientModulePermissions {
  return Object.fromEntries(CLIENT_MODULES.map(({ key }) => [key, row?.[key] === true])) as ClientModulePermissions;
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
