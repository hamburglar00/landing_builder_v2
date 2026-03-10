"use client";

import { TelefonosPageContent } from "@/components/telefonos/TelefonosPageContent";

export default function DashboardTelefonosPage() {
  return (
    <TelefonosPageContent
      backLink="/dashboard"
      backLabel="Mis Landings"
      title="Teléfonos"
    />
  );
}
