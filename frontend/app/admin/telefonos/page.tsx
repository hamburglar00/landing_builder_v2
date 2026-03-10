"use client";

import { TelefonosPageContent } from "@/components/telefonos/TelefonosPageContent";

export default function AdminTelefonosPage() {
  return (
    <TelefonosPageContent
      backLink="/admin/landings"
      backLabel="Listado"
      title="Teléfonos"
      isAdmin
    />
  );
}
