"use client";

import { useState } from "react";
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

  const save = async () => {
    const trimmed = value.trim();
    if (trimmed === row.email) {
      setEditing(false);
      return;
    }

    setSaving(true);
    try {
      await updateConversionEmail(row.id, trimmed);
      onSaved(row.id, trimmed);
    } catch {
      setValue(row.email);
    } finally {
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
