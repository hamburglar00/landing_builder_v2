"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";

export type CustomSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export default function CustomSelect({
  id,
  label,
  value,
  options,
  onChange,
  placeholder = "Seleccionar",
  disabled = false,
  className,
  buttonClassName,
  menuClassName,
  optionClassName,
  labelClassName,
  title,
  ariaLabel,
  portal = false,
}: {
  id?: string;
  label?: string;
  value: string;
  options: readonly CustomSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
  optionClassName?: string;
  labelClassName?: string;
  title?: string;
  ariaLabel?: string;
  portal?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<CSSProperties | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const selectedOption = useMemo(
    () => options.find((option) => option.value === value),
    [options, value],
  );

  useEffect(() => {
    if (!open || !portal) return;
    const positionMenu = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      const spaceBelow = window.innerHeight - rect.bottom - 8;
      const spaceAbove = rect.top - 8;
      const above = spaceBelow < 180 && spaceAbove > spaceBelow;
      const maxHeight = Math.min(256, Math.max(60, above ? spaceAbove : spaceBelow));
      setMenuPosition({
        position: "fixed",
        top: above ? Math.max(8, rect.top - maxHeight - 4) : rect.bottom + 4,
        left: Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8)),
        width: rect.width,
        maxHeight,
        zIndex: 9999,
      });
    };
    positionMenu();
    window.addEventListener("resize", positionMenu);
    window.addEventListener("scroll", positionMenu, true);
    return () => {
      window.removeEventListener("resize", positionMenu);
      window.removeEventListener("scroll", positionMenu, true);
    };
  }, [open, portal]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node) && !menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onFocusIn = (event: FocusEvent) => {
      if (!rootRef.current?.contains(event.target as Node) && !menuRef.current?.contains(event.target as Node)) setOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("focusin", onFocusIn);
    };
  }, [open]);

  useEffect(() => {
    if (!open || (portal && !menuPosition)) return;
    const selected = menuRef.current?.querySelector<HTMLButtonElement>('[role="option"][aria-selected="true"]:not(:disabled)');
    const first = menuRef.current?.querySelector<HTMLButtonElement>('[role="option"]:not(:disabled)');
    (selected ?? first)?.focus();
  }, [open, portal, menuPosition]);

  const menu = (
    <div
      ref={menuRef}
      role="listbox"
      aria-labelledby={id}
      aria-label={id ? undefined : ariaLabel}
      style={portal ? menuPosition ?? undefined : undefined}
      className={cx(
        "z-50 overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-950 p-1 text-xs text-zinc-100 shadow-2xl",
        portal ? "" : "absolute mt-1 max-h-64 w-full",
        menuClassName,
      )}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="option"
            aria-selected={selected}
            disabled={option.disabled}
            onKeyDown={(event) => {
              if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
              event.preventDefault();
              const enabled = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]:not(:disabled)') ?? []);
              const current = enabled.indexOf(event.currentTarget);
              const next = event.key === "Home" ? 0 : event.key === "End" ? enabled.length - 1
                : (current + (event.key === "ArrowDown" ? 1 : -1) + enabled.length) % enabled.length;
              enabled[next]?.focus();
            }}
            onClick={() => {
              onChange(option.value);
              setOpen(false);
              buttonRef.current?.focus();
            }}
            className={cx(
              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition hover:bg-zinc-800/80 disabled:cursor-not-allowed disabled:opacity-50",
              selected ? "bg-emerald-500/10 text-emerald-300" : "text-zinc-200",
              optionClassName,
            )}
          >
            <span
              aria-hidden
              className={cx("h-1.5 w-1.5 shrink-0 rounded-full", selected ? "bg-emerald-400" : "bg-transparent")}
            />
            <span className="min-w-0 truncate">{option.label}</span>
          </button>
        );
      })}
    </div>
  );

  return (
    <div ref={rootRef} className={cx("relative", className)}>
      {label ? (
        <label htmlFor={id} className={cx("mb-1 block text-xs text-zinc-400", labelClassName)}>
          {label}
        </label>
      ) : null}
      <button
        ref={buttonRef}
        id={id}
        type="button"
        title={title}
        aria-label={ariaLabel}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          if (!open && portal) setMenuPosition(null);
          setOpen((current) => !current);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className={cx(
          "flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-left text-xs text-zinc-100 outline-none transition hover:border-zinc-600 hover:bg-zinc-800/80 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/15 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:bg-zinc-950 disabled:text-zinc-500",
          buttonClassName,
        )}
      >
        <span className="min-w-0 truncate">{selectedOption?.label ?? placeholder}</span>
        <span aria-hidden className={cx("shrink-0 text-zinc-500 transition", open && "rotate-180 text-emerald-300")}>
          v
        </span>
      </button>
      {open && !disabled && (!portal || menuPosition)
        ? portal ? createPortal(menu, document.body) : menu
        : null}
    </div>
  );
}
