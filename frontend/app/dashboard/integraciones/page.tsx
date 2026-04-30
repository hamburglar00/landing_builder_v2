import dynamic from "next/dynamic";
import { DashboardSkeleton } from "@/components/ui/DashboardSkeleton";

const IntegracionesMetaCapi = dynamic(() => import("@/components/integraciones/IntegracionesMetaCapi"), {
  loading: () => <DashboardSkeleton title="Cargando integraciones..." />,
});

export default function DashboardIntegracionesPage() {
  return <IntegracionesMetaCapi />;
}
