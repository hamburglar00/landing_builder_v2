"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedOption = useMemo(
    () => options.find((option) => option.value === value),
    [options, value],
  );

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cx("relative", className)}>
      {label ? (
        <label
          htmlFor={id}
          className={cx("mb-1 block text-xs text-zinc-400", labelClassName)}
        >
          {label}
        </label>
      ) : null}
      <button
        id={id}
        type="button"
        title={title}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={cx(
          "flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-left text-xs text-zinc-100 outline-none transition hover:border-zinc-600 hover:bg-zinc-800/80 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/15 disabled:cursor-not-allowed disabled:border-zinc-800 disabled:bg-zinc-950 disabled:text-zinc-500",
          buttonClassName,
        )}
      >
        <span className="min-w-0 truncate">{selectedOption?.label ?? placeholder}</span>
        <span
          aria-hidden
          className={cx(
            "shrink-0 text-zinc-500 transition",
            open && "rotate-180 text-emerald-300",
          )}
        >
          v
        </span>
      </button>
      {open && !disabled ? (
        <div
          role="listbox"
          aria-labelledby={id}
          className={cx(
            "absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-950 p-1 text-xs text-zinc-100 shadow-2xl",
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
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={cx(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition hover:bg-zinc-800/80 disabled:cursor-not-allowed disabled:opacity-50",
                  selected ? "bg-emerald-500/10 text-emerald-300" : "text-zinc-200",
                  optionClassName,
                )}
              >
                <span
                  aria-hidden
                  className={cx(
                    "h-1.5 w-1.5 shrink-0 rounded-full",
                    selected ? "bg-emerald-400" : "bg-transparent",
                  )}
                />
                <span className="min-w-0 truncate">{option.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
