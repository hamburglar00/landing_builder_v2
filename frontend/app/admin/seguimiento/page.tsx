import { redirect } from "next/navigation";

export default function AdminSeguimientoPage() {
  redirect("/admin/conversiones?view=seguimiento");
}

