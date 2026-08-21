"use client";

import Link from "next/link";
import { PageHeader, SurfaceCard } from "@/components/ui/PanelPrimitives";

type Props = {
  mode: "admin" | "dashboard";
};

function HubIcon({ variant }: { variant: "settings" | "inbox" | "contacts" }) {
  if (variant === "settings") {
    return (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z" />
        <path d="M19.4 15a1.8 1.8 0 0 0 .36 1.98l.06.06a2.1 2.1 0 0 1-2.97 2.97l-.06-.06a1.8 1.8 0 0 0-1.98-.36 1.8 1.8 0 0 0-1.09 1.65v.17a2.1 2.1 0 0 1-4.2 0v-.09a1.8 1.8 0 0 0-1.18-1.69 1.8 1.8 0 0 0-1.98.36l-.06.06a2.1 2.1 0 1 1-2.97-2.97l.06-.06A1.8 1.8 0 0 0 3.8 15a1.8 1.8 0 0 0-1.65-1.09H2a2.1 2.1 0 0 1 0-4.2h.09A1.8 1.8 0 0 0 3.78 8.5a1.8 1.8 0 0 0-.36-1.98l-.06-.06a2.1 2.1 0 0 1 2.97-2.97l.06.06a1.8 1.8 0 0 0 1.98.36h.08A1.8 1.8 0 0 0 9.5 2.25V2.1a2.1 2.1 0 0 1 4.2 0v.09a1.8 1.8 0 0 0 1.09 1.65 1.8 1.8 0 0 0 1.98-.36l.06-.06a2.1 2.1 0 1 1 2.97 2.97l-.06.06a1.8 1.8 0 0 0-.36 1.98v.08a1.8 1.8 0 0 0 1.65 1.09h.17a2.1 2.1 0 0 1 0 4.2h-.09A1.8 1.8 0 0 0 19.4 15Z" />
      </svg>
    );
  }

  if (variant === "inbox") {
    return (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H9l-5 4v-14.5Z" />
        <path d="M8 8h8" />
        <path d="M8 11.5h5" />
      </svg>
    );
  }

  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
      <circle cx="9.5" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function HubCard({
  href,
  icon,
  title,
  description,
  meta,
}: {
  href: string;
  icon: "settings" | "inbox" | "contacts";
  title: string;
  description: string;
  meta: string;
}) {
  return (
    <Link href={href} className="group block">
      <SurfaceCard interactive className="h-full p-5">
        <div className="flex h-full flex-col gap-5">
          <div className="flex items-start justify-between gap-4">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--color-primary-soft-border)] bg-[var(--color-primary-soft-bg)] text-[var(--color-primary)]">
              <HubIcon variant={icon} />
            </span>
            <span className="ui-badge">{meta}</span>
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-[var(--color-text-strong)]">{title}</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--color-text-muted)]">{description}</p>
          </div>
        </div>
      </SurfaceCard>
    </Link>
  );
}

export default function WhatsAppCloudApiHubContent({ mode }: Props) {
  const basePath = mode === "admin" ? "/admin/whatsapp-cloud-api" : "/dashboard/whatsapp-cloud-api";

  return (
    <div className="space-y-6">
      <PageHeader
        title="WhatsApp Cloud API"
        description="Gestiona la configuracion del canal oficial y las conversaciones recibidas."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <HubCard
          href={`${basePath}/configuracion`}
          icon="settings"
          title="Configuracion"
          description="Credenciales de Meta, webhook, tracking, respuesta automatica y reglas de redireccion."
          meta="Setup"
        />
        <HubCard
          href={`${basePath}/inbox`}
          icon="inbox"
          title="Inbox"
          description="Bandeja separada para revisar conversaciones, mensajes entrantes, respuestas y derivaciones."
          meta="Operativo"
        />
        <HubCard
          href={`${basePath}/contactos`}
          icon="contacts"
          title="Contactos"
          description="Listado paginado de contactos recibidos, telefono visible y estado comercial."
          meta="CRM"
        />
      </div>

      <Link href={`${basePath}/logs`} className="group block">
        <SurfaceCard interactive className="p-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--color-text-strong)]">Diagnostico</p>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-[var(--color-text-muted)]">
              Revisa webhooks, worker, respuestas enviadas y errores de integracion.
            </p>
          </div>
        </SurfaceCard>
      </Link>
    </div>
  );
}
