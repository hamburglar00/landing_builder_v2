"use client";

import Link from "next/link";
import { PageHeader, SurfaceCard } from "@/components/ui/PanelPrimitives";

type Props = {
  mode: "admin" | "dashboard";
};

const LOG_GROUPS = [
  {
    title: "Webhooks recibidos",
    description: "Entrada cruda de Meta, firma, phone number id y estado de procesamiento.",
  },
  {
    title: "Worker",
    description: "Normalizacion del mensaje, asignacion de telefono, creacion de Contact y deduplicacion.",
  },
  {
    title: "Mensajes salientes",
    description: "Respuesta enviada a WhatsApp, meta_message_id, estados delivered/read/failed y errores de Graph API.",
  },
];

function LogsIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8 6h13" />
      <path d="M8 12h13" />
      <path d="M8 18h13" />
      <path d="M3 6h.01" />
      <path d="M3 12h.01" />
      <path d="M3 18h.01" />
    </svg>
  );
}

export default function WhatsAppCloudApiLogsPageContent({ mode }: Props) {
  const basePath = mode === "admin" ? "/admin/whatsapp-cloud-api" : "/dashboard/whatsapp-cloud-api";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Logs WhatsApp Cloud API"
        description="Diagnostico de webhooks, worker y respuestas enviadas por el canal oficial."
        actions={
          <Link href={basePath} className="ui-button ui-button-secondary">
            Volver
          </Link>
        }
      />

      <SurfaceCard className="p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--color-text-strong)]">Base de diagnostico</p>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-[var(--color-text-muted)]">
              Esta pantalla queda separada para consultar eventos de diagnostico sin mezclarlos con Conversiones ni con el Inbox operativo.
            </p>
          </div>
          <span className="ui-badge shrink-0">Preparado</span>
        </div>
      </SurfaceCard>

      <div className="grid gap-4 lg:grid-cols-3">
        {LOG_GROUPS.map((group) => (
          <SurfaceCard key={group.title} className="p-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--color-primary-soft-border)] bg-[var(--color-primary-soft-bg)] text-[var(--color-primary)]">
              <LogsIcon />
            </span>
            <h2 className="mt-4 text-sm font-semibold text-[var(--color-text-strong)]">{group.title}</h2>
            <p className="mt-2 text-xs leading-5 text-[var(--color-text-muted)]">{group.description}</p>
          </SurfaceCard>
        ))}
      </div>

      <SurfaceCard className="overflow-hidden">
        <div className="border-b border-[var(--color-border-subtle)] p-4">
          <p className="text-sm font-semibold text-[var(--color-text-strong)]">Eventos</p>
          <p className="mt-1 text-xs leading-5 text-[var(--color-text-muted)]">
            Aca se listaran los registros con filtros por estado, tipo, fecha, telefono y mensaje.
          </p>
        </div>
        <div className="flex min-h-72 items-center justify-center px-5 py-10 text-center">
          <div className="max-w-md rounded-xl border border-dashed border-[var(--color-border-strong)] bg-[rgba(255,255,255,0.02)] px-5 py-6">
            <p className="text-sm font-semibold text-[var(--color-text-strong)]">Logs listos para conectar</p>
            <p className="mt-2 text-xs leading-5 text-[var(--color-text-muted)]">
              El siguiente paso es normalizar/consultar los eventos guardados y mostrarlos aca con filtros de diagnostico.
            </p>
          </div>
        </div>
      </SurfaceCard>
    </div>
  );
}
