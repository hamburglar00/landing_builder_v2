"use client";
import dynamic from "next/dynamic";
import { DashboardSkeleton } from "@/components/ui/DashboardSkeleton";
const Bots = dynamic(
  () =>
    import("@/components/telefonos/TelefonosPageContent").then(
      (module) => module.TelefonosPageContent,
    ),
  { loading: () => <DashboardSkeleton title="Cargando bots…" /> },
);
export default function DashboardBotsPage() {
  return <Bots title="BOTS" unifiedBots />;
}
