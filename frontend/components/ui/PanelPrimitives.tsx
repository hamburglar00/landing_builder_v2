"use client";

import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
} from "react";
import ModalPortal from "@/components/ui/ModalPortal";

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cx("ui-page-header", className)}>
      <div className="min-w-0">
        {eyebrow ? <p className="ui-page-eyebrow">{eyebrow}</p> : null}
        <h1 className="ui-page-title">{title}</h1>
        {description ? <p className="ui-page-description">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function SurfaceCard({
  children,
  interactive = false,
  className,
}: {
  children: ReactNode;
  interactive?: boolean;
  className?: string;
}) {
  return (
    <div className={cx("ui-card", interactive && "ui-card-interactive", className)}>
      {children}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("ui-empty-state", className)}>
      {icon ? (
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--color-primary-soft-border)] bg-[var(--color-primary-soft-bg)] text-[var(--color-primary)]">
          {icon}
        </div>
      ) : null}
      <h2 className="text-sm font-semibold text-[var(--color-text-strong)]">{title}</h2>
      {description ? (
        <p className="mt-2 max-w-lg text-xs leading-5 text-[var(--color-text-muted)]">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

const modalWidths = {
  sm: "max-w-md",
  md: "max-w-xl",
  lg: "max-w-3xl",
  xl: "max-w-5xl",
} as const;

export function ModalShell({
  open,
  title,
  description,
  children,
  footer,
  onClose,
  closeDisabled = false,
  width = "md",
  eyebrow,
}: {
  open: boolean;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  closeDisabled?: boolean;
  width?: keyof typeof modalWidths;
  eyebrow?: string;
}) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !closeDisabled) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, closeDisabled, onClose]);

  if (!open) return null;

  return (
    <ModalPortal>
    <div
      className="ui-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !closeDisabled) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cx("ui-modal", modalWidths[width])}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-[var(--color-border-subtle)] bg-[rgba(11,15,21,0.92)] px-4 py-4 backdrop-blur-xl sm:px-5">
          <div className="min-w-0">
            {eyebrow ? <p className="ui-page-eyebrow">{eyebrow}</p> : null}
            <h2 id={titleId} className="text-base font-semibold tracking-[-0.015em] text-[var(--color-text-strong)]">
              {title}
            </h2>
            {description ? (
              <p className="mt-1 max-w-2xl text-xs leading-5 text-[var(--color-text-muted)]">
                {description}
              </p>
            ) : null}
          </div>
          <button
            ref={closeRef}
            type="button"
            disabled={closeDisabled}
            onClick={onClose}
            aria-label="Cerrar"
            className="ui-button ui-button-secondary h-8 min-h-8 w-8 shrink-0 p-0 text-base"
          >
            <span aria-hidden>×</span>
          </button>
        </div>
        <div className="px-4 py-4 sm:px-5">{children}</div>
        {footer ? (
          <footer className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-[var(--color-border-subtle)] bg-[rgba(11,15,21,0.94)] px-4 py-3 backdrop-blur-xl sm:flex-row sm:justify-end sm:px-5">
            {footer}
          </footer>
        ) : null}
      </section>
    </div>
    </ModalPortal>
  );
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  busy = false,
  danger = false,
  onConfirm,
  onClose,
  children,
}: {
  open: boolean;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  children?: ReactNode;
}) {
  return (
    <ModalShell
      open={open}
      title={title}
      description={description}
      onClose={onClose}
      closeDisabled={busy}
      width="sm"
      footer={
        <>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="ui-button ui-button-secondary"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={cx(
              "ui-button",
              danger ? "ui-button-danger" : "ui-button-primary",
            )}
          >
            {busy ? "Procesando…" : confirmLabel}
          </button>
        </>
      }
    >
      {children ?? null}
    </ModalShell>
  );
}
