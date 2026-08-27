"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import CustomSelect from "@/components/ui/CustomSelect";
import { ModalShell } from "@/components/ui/PanelPrimitives";
import { friendlySourcePlatform, sexLabel } from "@/components/conversiones/conversionPageShared";
import {
  trackingFilterAllLabel,
  trackingFilterKindForSource,
  trackingFilterLabel,
} from "@/components/conversiones/trackingFilter";

export type ConversionFilterOption = {
  value: string;
  label: string;
};

export type ConversionFilterDraft = {
  landing: string;
  pixel: string;
  gerencia: string[];
  phone: string;
  fromMetaAds: string;
  sourcePlatform: string;
  sex: string;
  campaigns: string[];
};

type ConversionFilterOptions = {
  landings: readonly string[];
  pixels: readonly string[];
  gerencias: readonly ConversionFilterOption[];
  phones: readonly string[];
  sourcePlatforms: readonly string[];
  sexes: readonly string[];
  campaigns: readonly string[];
};

type ConversionFilterChanges = {
  landing: (value: string) => void;
  pixel: (value: string) => void;
  gerencia: (value: string[]) => void;
  phone: (value: string) => void;
  fromMetaAds: (value: string) => void;
  sourcePlatform: (value: string) => void;
  sex: (value: string) => void;
  campaigns: (value: string[]) => void;
};

type ConversionFiltersModalProps = {
  title: string;
  draft: ConversionFilterDraft;
  options: ConversionFilterOptions;
  onChange: ConversionFilterChanges;
  onClose: () => void;
  onApply: () => void;
};

const selectClassName =
  "h-9 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-xs text-zinc-100";

function FilterField({
  id,
  label,
  value,
  allLabel,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  allLabel: string;
  options: readonly ConversionFilterOption[];
  onChange: (value: string) => void;
}) {
  return (
    <CustomSelect
      id={id}
      label={label}
      value={value}
      options={[
        { value: "__all__", label: allLabel },
        ...options,
      ]}
      onChange={onChange}
      placeholder={allLabel}
    />
  );
}

function SearchableCheckboxField({
  id,
  label,
  values,
  allLabel,
  selectedPluralLabel = "opciones seleccionadas",
  options,
  onChange,
}: {
  id: string;
  label: string;
  values: string[];
  allLabel: string;
  selectedPluralLabel?: string;
  options: readonly ConversionFilterOption[];
  onChange: (value: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const selectedLabel = values.length === 0
    ? allLabel
    : values.length === 1
      ? options.find((option) => option.value === values[0])?.label || values[0]
      : `${values.length} ${selectedPluralLabel}`;
  const filteredOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return options;
    return options.filter((option) =>
      `${option.label} ${option.value}`.toLowerCase().includes(normalized),
    );
  }, [options, query]);
  const toggleValue = (nextValue: string, checked: boolean) => {
    onChange(
      checked
        ? [...values, nextValue]
        : values.filter((value) => value !== nextValue),
    );
  };

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
    <div ref={rootRef} className="relative">
      <label htmlFor={id} className="mb-1 block text-xs text-zinc-400">
        {label}
      </label>
      <button
        id={id}
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`${selectClassName} flex items-center justify-between text-left`}
      >
        <span className="truncate">{selectedLabel}</span>
        <span className={`ml-2 text-zinc-500 transition ${open ? "rotate-180" : ""}`}>v</span>
      </button>
      {open ? (
        <div className="absolute z-40 mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 p-2 text-xs text-zinc-100 shadow-xl">
          <div className="mb-2 flex h-8 items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
              Buscar
            </span>
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Nombre o ID..."
              className="min-w-0 flex-1 bg-transparent text-xs text-zinc-100 outline-none placeholder:text-zinc-600"
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            <button
              type="button"
              aria-pressed={values.length === 0}
              onClick={() => onChange([])}
              className={`flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-zinc-800/70 ${
                values.length === 0 ? "bg-emerald-500/10 text-emerald-300" : "text-zinc-200"
              }`}
            >
              <span
                aria-hidden
                className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border text-[9px] ${
                  values.length === 0
                    ? "border-emerald-400 bg-emerald-400 text-zinc-950"
                    : "border-zinc-600 bg-zinc-900 text-transparent"
                }`}
              />
              <span className="block truncate">{allLabel}</span>
            </button>
            {filteredOptions.length === 0 ? (
              <div className="px-2 py-3 text-center text-zinc-500">
                Sin resultados
              </div>
            ) : (
              filteredOptions.map((option) => {
                const checked = values.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={checked}
                    onClick={() => toggleValue(option.value, !checked)}
                    className={`flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-zinc-800/70 ${
                      checked ? "bg-emerald-500/10 text-emerald-300" : "text-zinc-200"
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border text-[9px] ${
                        checked
                          ? "border-emerald-400 bg-emerald-400 text-zinc-950"
                          : "border-zinc-600 bg-zinc-900 text-transparent"
                      }`}
                    />
                    <span className="block min-w-0 truncate">{option.label}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function stringOptions(values: readonly string[]): ConversionFilterOption[] {
  return values.map((value) => ({ value, label: value }));
}

function sourcePlatformOptions(values: readonly string[]): ConversionFilterOption[] {
  return values.map((value) => ({ value, label: friendlySourcePlatform(value) }));
}

export default function ConversionFiltersModal({
  title,
  draft,
  options,
  onChange,
  onClose,
  onApply,
}: ConversionFiltersModalProps) {
  const showLandingFilter = draft.sourcePlatform === "landing";
  const trackingKind = trackingFilterKindForSource(draft.sourcePlatform);
  const handleSourcePlatformChange = (value: string) => {
    onChange.sourcePlatform(value);
    if (value !== "landing") onChange.landing("__all__");
    onChange.pixel("__all__");
  };

  return (
    <ModalShell
      open
      title={title}
      onClose={onClose}
      width="md"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="ui-button ui-button-secondary"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={onApply}
            className="ui-button ui-button-primary"
          >
            Guardar
          </button>
        </>
      }
    >
            <div className="grid grid-cols-1 gap-3">
              <FilterField
                id="conversion-filter-platform"
                label="Plataforma de origen"
                value={draft.sourcePlatform}
                allLabel="Todas"
                options={sourcePlatformOptions(options.sourcePlatforms)}
                onChange={handleSourcePlatformChange}
              />
              {showLandingFilter ? (
                <FilterField
                  id="conversion-filter-landing"
                  label="Landing"
                  value={draft.landing}
                  allLabel="Todas las landings"
                  options={stringOptions(options.landings)}
                  onChange={onChange.landing}
                />
              ) : null}
              <FilterField
                id="conversion-filter-pixel"
                label={trackingFilterLabel(trackingKind)}
                value={draft.pixel}
                allLabel={trackingFilterAllLabel(trackingKind)}
                options={stringOptions(options.pixels)}
                onChange={onChange.pixel}
              />
              <SearchableCheckboxField
                id="conversion-filter-gerencia"
                label="Gerencia (ID)"
                values={draft.gerencia}
                allLabel="Todas las gerencias"
                selectedPluralLabel="gerencias seleccionadas"
                options={options.gerencias}
                onChange={onChange.gerencia}
              />
              <FilterField
                id="conversion-filter-meta-origin"
                label="Origen Meta Ads"
                value={draft.fromMetaAds}
                allLabel="Todos"
                options={[
                  { value: "true", label: "Si" },
                  { value: "false", label: "No" },
                ]}
                onChange={onChange.fromMetaAds}
              />
              <FilterField
                id="conversion-filter-sex"
                label="Sexo"
                value={draft.sex}
                allLabel="Todos"
                options={options.sexes.map((value) => ({
                  value,
                  label: sexLabel(value),
                }))}
                onChange={onChange.sex}
              />
              <SearchableCheckboxField
                id="conversion-filter-campaign"
                label="Campaña"
                values={draft.campaigns}
                allLabel="Todas"
                selectedPluralLabel="campañas seleccionadas"
                options={stringOptions(options.campaigns)}
                onChange={onChange.campaigns}
              />
            </div>
    </ModalShell>
  );
}
