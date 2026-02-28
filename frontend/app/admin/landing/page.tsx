"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Redirige al listado de landings del admin (mismo flujo que clientes). */
export default function AdminLandingPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin/landings");
  }, [router]);
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <p className="text-sm text-zinc-400">Redirigiendo...</p>
    </div>
  );
}
