"use client";

import dynamic from "next/dynamic";
import { DashboardSkeleton } from "@/components/ui/DashboardSkeleton";

const TelefonosPageContent = dynamic(
  () => import("@/components/telefonos/TelefonosPageContent").then((mod) => mod.TelefonosPageContent),
  { loading: () => <DashboardSkeleton title="Cargando teléfonos..." /> },
);

export default function DashboardTelefonosPage() {
  return <TelefonosPageContent title="TELEFONOS" />;
}

