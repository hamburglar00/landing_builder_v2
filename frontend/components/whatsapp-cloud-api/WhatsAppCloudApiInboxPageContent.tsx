"use client";

import Link from "next/link";
import { PageHeader, SurfaceCard } from "@/components/ui/PanelPrimitives";

type Props = {
  mode: "admin" | "dashboard";
};

function EmptyConversationIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H9l-5 4v-14.5Z" />
      <path d="M8 8h8" />
      <path d="M8 11.5h5" />
    </svg>
  );
}

export default function WhatsAppCloudApiInboxPageContent({ mode }: Props) {
  const basePath = mode === "admin" ? "/admin/whatsapp-cloud-api" : "/dashboard/whatsapp-cloud-api";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inbox WhatsApp Cloud API"
        description="Conversaciones recibidas desde el numero oficial conectado a Meta."
        actions={
          <Link href={basePath} className="ui-button ui-button-secondary">
            Volver
          </Link>
        }
      />

      <div className="grid min-h-[32rem] gap-4 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <SurfaceCard className="flex min-h-96 flex-col overflow-hidden">
          <div className="border-b border-[var(--color-border-subtle)] p-4">
            <p className="text-sm font-semibold text-[var(--color-text-strong)]">Conversaciones</p>
            <p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">
              La bandeja usara threads normalizados para mantener busqueda, estados y performance.
            </p>
          </div>
          <div className="flex flex-1 items-center justify-center px-5 py-10 text-center">
            <div className="max-w-xs">
              <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--color-primary-soft-border)] bg-[var(--color-primary-soft-bg)] text-[var(--color-primary)]">
                <EmptyConversationIcon />
              </span>
              <p className="mt-4 text-sm font-semibold text-[var(--color-text-strong)]">Sin conversaciones cargadas</p>
              <p className="mt-2 text-xs leading-5 text-[var(--color-text-muted)]">
                Esta pantalla queda separada para conectar el modelo de inbox sin mezclarlo con configuracion.
              </p>
            </div>
          </div>
        </SurfaceCard>

        <SurfaceCard className="flex min-h-96 flex-col overflow-hidden">
          <div className="border-b border-[var(--color-border-subtle)] p-4">
            <p className="text-sm font-semibold text-[var(--color-text-strong)]">Detalle</p>
            <p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">
              Mensajes entrantes, respuestas enviadas, telefono asignado y promo_code.
            </p>
          </div>
          <div className="flex flex-1 items-center justify-center px-5 py-10 text-center">
            <div className="max-w-md rounded-xl border border-dashed border-[var(--color-border-strong)] bg-[rgba(255,255,255,0.02)] px-5 py-6">
              <p className="text-sm font-semibold text-[var(--color-text-strong)]">Selecciona una conversacion</p>
              <p className="mt-2 text-xs leading-5 text-[var(--color-text-muted)]">
                El historial se renderizara en esta columna cuando conectemos las tablas normalizadas de conversaciones y mensajes.
              </p>
            </div>
          </div>
        </SurfaceCard>
      </div>
    </div>
  );
}
