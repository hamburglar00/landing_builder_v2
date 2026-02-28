"use client";

import type { ColorOption } from "@/lib/landing/types";
import { COLOR_MAP, COLOR_OPTIONS } from "@/lib/landing/constants";

const LABELS: Record<ColorOption, string> = {
  white: "Blanco",
  black: "Negro",
  gold: "Oro",
  yellow: "Amarillo",
  red: "Rojo",
  green: "Verde",
  whatsapp_green: "Verde WhatsApp",
  blue: "Azul",
  cyan: "Cian",
  orange: "Naranja",
  pink: "Rosa",
  purple: "Púrpura",
  gray_light: "Gris claro",
  gray_dark: "Gris oscuro",
};

interface ColorSelectProps {
  value: ColorOption;
  onChange: (color: ColorOption) => void;
  label?: string;
  id?: string;
}

/**
 * Selector de color con lista cerrada: nombre visible + mini muestra del color.
 * No usa color picker libre ni input hex manual.
 */
export function ColorSelect({ value, onChange, label, id }: ColorSelectProps) {
  return (
    <div className="space-y-2">
      {label && (
        <label
          htmlFor={id}
          className="block text-xs font-medium text-zinc-200"
        >
          {label}
        </label>
      )}
      <div
        id={id}
        className="flex flex-wrap gap-2"
        role="listbox"
        aria-label={label}
      >
        {COLOR_OPTIONS.map((option) => {
          const hex = COLOR_MAP[option];
          const isSelected = value === option;
          return (
            <button
              key={option}
              type="button"
              role="option"
              aria-selected={isSelected}
              onClick={() => onChange(option)}
              className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs transition ${
                isSelected
                  ? "border-zinc-400 bg-zinc-800 text-zinc-50"
                  : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-600"
              }`}
            >
              <span
                className="h-4 w-4 shrink-0 rounded border border-zinc-600"
                style={{ backgroundColor: hex }}
                aria-hidden
              />
              <span>{LABELS[option]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
