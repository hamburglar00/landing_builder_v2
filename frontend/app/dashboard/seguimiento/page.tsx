import { redirect } from "next/navigation";

export default function DashboardSeguimientoPage() {
  redirect("/dashboard/conversiones?view=seguimiento");
}

