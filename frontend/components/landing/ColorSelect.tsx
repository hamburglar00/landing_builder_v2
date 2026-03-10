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
      <div className="inline-flex items-center gap-2">
        <span
          className="h-4 w-4 shrink-0 rounded border border-zinc-600"
          style={{ backgroundColor: COLOR_MAP[value] }}
          aria-hidden
        />
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value as ColorOption)}
          className="min-w-[8rem] rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-100"
        >
          {COLOR_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {LABELS[option]}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
