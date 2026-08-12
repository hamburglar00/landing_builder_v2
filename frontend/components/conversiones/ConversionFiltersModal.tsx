"use client";

import { useMemo, useState } from "react";
import ModalPortal from "@/components/ui/ModalPortal";
import { sexLabel } from "@/components/conversiones/conversionPageShared";

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
  phoneGerenciaLabels: Readonly<Record<string, string[]>>;
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
    <div>
      <label htmlFor={id} className="mb-1 block text-xs text-zinc-400">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={selectClassName}
      >
        <option value="__all__">{allLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function SearchableCheckboxField({
  id,
  label,
  values,
  allLabel,
  options,
  onChange,
}: {
  id: string;
  label: string;
  values: string[];
  allLabel: string;
  options: readonly ConversionFilterOption[];
  onChange: (value: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selectedLabel = values.length === 0
    ? allLabel
    : values.length === 1
      ? options.find((option) => option.value === values[0])?.label || values[0]
      : `${values.length} gerencias seleccionadas`;
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

  return (
    <div className="relative">
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
            <label
              className={`flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-zinc-800/70 ${
                values.length === 0 ? "bg-emerald-500/10 text-emerald-300" : "text-zinc-200"
              }`}
            >
              <input
                type="checkbox"
                checked={values.length === 0}
                onChange={() => onChange([])}
                className="h-3.5 w-3.5 rounded border-zinc-600 bg-zinc-900 accent-emerald-500"
              />
              {allLabel}
            </label>
            {filteredOptions.length === 0 ? (
              <div className="px-2 py-3 text-center text-zinc-500">
                Sin resultados
              </div>
            ) : (
              filteredOptions.map((option) => (
                <label
                  key={option.value}
                  className={`flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-zinc-800/70 ${
                    values.includes(option.value) ? "bg-emerald-500/10 text-emerald-300" : "text-zinc-200"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={values.includes(option.value)}
                    onChange={(event) => toggleValue(option.value, event.target.checked)}
                    className="h-3.5 w-3.5 rounded border-zinc-600 bg-zinc-900 accent-emerald-500"
                  />
                  <span className="block truncate">{option.label}</span>
                </label>
              ))
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

export default function ConversionFiltersModal({
  title,
  draft,
  options,
  phoneGerenciaLabels,
  onChange,
  onClose,
  onApply,
}: ConversionFiltersModalProps) {
  const titleId = "conversion-filters-title";

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-hidden bg-black/70 p-3 sm:p-4">
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950 shadow-2xl"
        >
          <div className="shrink-0 border-b border-zinc-800 px-4 py-3">
            <h3 id={titleId} className="text-sm font-semibold text-zinc-100">
              {title}
            </h3>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            <div className="grid grid-cols-1 gap-3">
              <FilterField
                id="conversion-filter-landing"
                label="Landing"
                value={draft.landing}
                allLabel="Todas las landings"
                options={stringOptions(options.landings)}
                onChange={onChange.landing}
              />
              <FilterField
                id="conversion-filter-pixel"
                label="Pixel"
                value={draft.pixel}
                allLabel="Todos los pixeles"
                options={stringOptions(options.pixels)}
                onChange={onChange.pixel}
              />
              <SearchableCheckboxField
                id="conversion-filter-gerencia"
                label="Gerencia (ID)"
                values={draft.gerencia}
                allLabel="Todas las gerencias"
                options={options.gerencias}
                onChange={onChange.gerencia}
              />
              <FilterField
                id="conversion-filter-phone"
                label="Telefono asignado"
                value={draft.phone}
                allLabel="Todos los telefonos"
                options={options.phones.map((phone) => {
                  const labels = phoneGerenciaLabels[phone] ?? [];
                  const extra = labels.length > 0 ? ` [${labels.join(" | ")}]` : "";
                  return { value: phone, label: `${phone}${extra}` };
                })}
                onChange={onChange.phone}
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
                id="conversion-filter-platform"
                label="Plataforma de origen"
                value={draft.sourcePlatform}
                allLabel="Todas"
                options={stringOptions(options.sourcePlatforms)}
                onChange={onChange.sourcePlatform}
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
              <div>
                <span className="mb-1 block text-xs text-zinc-400">Campaña</span>
                <details className="group relative">
                  <summary className="flex h-9 w-full cursor-pointer list-none items-center justify-between rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-xs text-zinc-100 marker:hidden">
                    <span className="truncate">
                      {draft.campaigns.length === 0
                        ? "Todas"
                        : draft.campaigns.length === 1
                          ? draft.campaigns[0]
                          : `${draft.campaigns.length} campañas seleccionadas`}
                    </span>
                    <span className="ml-2 text-zinc-500 transition group-open:rotate-180">v</span>
                  </summary>
                  <div className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-100 shadow-xl">
                    <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 hover:bg-zinc-800/70">
                      <input
                        type="checkbox"
                        checked={draft.campaigns.length === 0}
                        onChange={() => onChange.campaigns([])}
                        className="h-3.5 w-3.5 rounded border-zinc-600 bg-zinc-900 accent-emerald-500"
                      />
                      Todas
                    </label>
                    {options.campaigns.map((campaign) => {
                      const checked = draft.campaigns.includes(campaign);
                      return (
                        <label
                          key={campaign}
                          className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 hover:bg-zinc-800/70"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) => {
                              onChange.campaigns(
                                event.target.checked
                                  ? [...draft.campaigns, campaign]
                                  : draft.campaigns.filter((item) => item !== campaign),
                              );
                            }}
                            className="h-3.5 w-3.5 rounded border-zinc-600 bg-zinc-900 accent-emerald-500"
                          />
                          <span className="truncate">{campaign}</span>
                        </label>
                      );
                    })}
                  </div>
                </details>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 justify-end gap-2 border-t border-zinc-800 px-4 py-3">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-md border border-zinc-600 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={onApply}
              className="cursor-pointer rounded-md border border-emerald-700 bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-emerald-500"
            >
              Guardar
            </button>
          </div>
        </section>
      </div>
    </ModalPortal>
  );
}
