"use client";

import { LandingBuilderLoading } from "@/components/brand/LandingBuilderLoading";

export function DashboardSkeleton({ title = "Cargando..." }: { title?: string }) {
  return <LandingBuilderLoading label={title} />;
}

export function PanelSkeleton({ title = "Preparando vista..." }: { title?: string }) {
  return (
    <div className="ui-card p-4">
      <LandingBuilderLoading variant="dots" size="panel" label={title} />
    </div>
  );
}
