"use client";

import { canViewClientIntegration, type ClientModulePermissions } from "@/lib/clientModules";

export type IntegrationSection = "meta" | "chatrace" | "kommo" | "constructor";

const INTEGRATIONS = [
  { section: "meta", label: "Integración con Meta CAPI", icon: "/meta-logo.png" },
  { section: "chatrace", label: "Integración con Chatrace", icon: "/chatrace-logo.jpeg" },
  { section: "kommo", label: "Integración con CRM Kommo", icon: "/kommo-logo.jpeg" },
  { section: "constructor", label: "Endpoint de Conversiones del constructor", icon: null },
] as const;

export function IntegrationMenu({ permissions, onSelect, constructorLogo }: {
  permissions: ClientModulePermissions;
  onSelect: (section: IntegrationSection) => void;
  constructorLogo: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      {INTEGRATIONS.filter(({ section }) => canViewClientIntegration(section, permissions)).map(({ section, label, icon }) => (
        <button
          key={section}
          type="button"
          onClick={() => onSelect(section)}
          className="ui-card ui-card-interactive w-full px-4 py-4 text-left active:scale-[0.995]"
        >
          <span className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-3 text-sm font-semibold text-zinc-200">
              {icon ? <img src={icon} alt="" aria-hidden="true" className="h-8 w-8 shrink-0 rounded-sm object-contain" /> : constructorLogo}
              {label}
            </span>
            <span className="text-xs text-zinc-400">Entrar</span>
          </span>
        </button>
      ))}
    </div>
  );
}
