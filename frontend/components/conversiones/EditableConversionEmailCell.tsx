"use client";

import { useRef, useState } from "react";
import { useActionFeedback } from "@/components/ui/ActionNotice";
import {
  updateConversionEmail,
  type ConversionRow,
} from "@/lib/conversionsDb";

type EditableConversionEmailCellProps = {
  row: ConversionRow;
  onSaved: (id: string, email: string) => void;
};

export default function EditableConversionEmailCell({
  row,
  onSaved,
}: EditableConversionEmailCellProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(row.email);
  const [saving, setSaving] = useState(false);
  const notify = useActionFeedback();
  const savingRef = useRef(false);
  const cancelled = useRef(false);

  const save = async () => {
    if (savingRef.current || cancelled.current) return;
    const trimmed = value.trim();
    if (trimmed === row.email) {
      setEditing(false);
      return;
    }

    savingRef.current = true;
    setSaving(true);
    try {
      await updateConversionEmail(row.id, trimmed);
      onSaved(row.id, trimmed);
      notify("Email guardado.");
    } catch (error) {
      setValue(row.email);
      notify(error instanceof Error ? error.message : "No se pudo guardar el email.", "error");
    } finally {
      savingRef.current = false;
      setSaving(false);
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <td className="px-1 py-0.5">
        <input
          autoFocus
          type="email"
          value={value}
          aria-label={`Email de ${row.phone || "la conversión"}`}
          onChange={(event) => setValue(event.target.value)}
          onBlur={save}
          onKeyDown={(event) => {
            if (event.key === "Enter") void save();
            if (event.key === "Escape") {
              cancelled.current = true;
              setValue(row.email);
              setEditing(false);
            }
          }}
          disabled={saving}
          className="w-full min-w-[140px] rounded border border-zinc-600 bg-zinc-900 px-1.5 py-0.5 text-[11px] text-zinc-100 outline-none focus:border-zinc-400"
        />
      </td>
    );
  }

  return (
    <td className="px-2 py-1.5 whitespace-nowrap text-zinc-400">
      <button
        type="button"
        onClick={() => {
          cancelled.current = false;
          setValue(row.email);
          setEditing(true);
        }}
        title="Editar email"
        aria-label={`${row.email ? "Editar" : "Agregar"} email de ${row.phone || "la conversión"}`}
        className="group w-full cursor-pointer text-left hover:text-zinc-200 focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring-primary)]"
      >
        {row.email || <span className="text-zinc-600 group-hover:text-zinc-400">+ email</span>}
      </button>
    </td>
  );
}
