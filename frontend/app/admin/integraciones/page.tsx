import { redirect } from "next/navigation";

export default function AdminIntegracionesPage() {
  redirect("/admin/conversiones?tab=configuracion");
}

