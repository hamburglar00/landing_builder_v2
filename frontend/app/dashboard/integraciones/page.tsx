import { redirect } from "next/navigation";

export default function DashboardIntegracionesPage() {
  redirect("/dashboard/conversiones?tab=configuracion");
}

