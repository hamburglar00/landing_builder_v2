"use client";

import { createContext, useContext } from "react";
import {
  CLIENT_MODULES,
  DEFAULT_CLIENT_MODULE_PERMISSIONS,
  type ClientModulePermissions,
} from "@/lib/clientModules";

export const ClientModulePermissionsContext = createContext<ClientModulePermissions>(DEFAULT_CLIENT_MODULE_PERMISSIONS);
export const useClientModulePermissions = () => useContext(ClientModulePermissionsContext);

export function ClientModulePermissionsFields({ value, onChange }: {
  value: ClientModulePermissions;
  onChange: (permissions: ClientModulePermissions) => void;
}) {
  return (
    <fieldset className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
      <legend className="px-1 text-xs font-semibold text-zinc-200">Módulos visibles para el cliente</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {CLIENT_MODULES.map(({ key, label }) => (
          <label key={key} className="inline-flex items-center gap-2 text-xs text-zinc-200">
            <input
              type="checkbox"
              checked={value[key]}
              onChange={(event) => onChange({ ...value, [key]: event.target.checked })}
              className="h-4 w-4 rounded border-zinc-700 bg-zinc-900"
            />
            {label}
          </label>
        ))}
      </div>
      <p className="text-[11px] text-zinc-400">
        Al desmarcar un módulo se ocultan sus accesos y pantallas para este cliente.
        Las integraciones configuradas continúan funcionando.
      </p>
    </fieldset>
  );
}
