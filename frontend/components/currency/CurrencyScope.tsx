"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  CURRENCY_ALL,
  REPORTING_CURRENCIES,
  type CurrencyScope,
} from "@/lib/currency";

const STORAGE_KEY = "pbadmin:reporting-currency:v1";

type CurrencyScopeContextValue = {
  currencyScope: CurrencyScope;
  setCurrencyScope: (scope: CurrencyScope) => void;
  isAllCurrencies: boolean;
};

const CurrencyScopeContext = createContext<CurrencyScopeContextValue | null>(null);

function isCurrencyScope(value: unknown): value is CurrencyScope {
  return value === CURRENCY_ALL || REPORTING_CURRENCIES.includes(value as "ARS" | "PYG");
}

export function CurrencyScopeProvider({ children }: { children: ReactNode }) {
  const [currencyScope, setCurrencyScopeState] = useState<CurrencyScope>("ARS");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isCurrencyScope(stored)) setCurrencyScopeState(stored);

    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY && isCurrencyScope(event.newValue)) {
        setCurrencyScopeState(event.newValue);
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const setCurrencyScope = (scope: CurrencyScope) => {
    setCurrencyScopeState(scope);
    window.localStorage.setItem(STORAGE_KEY, scope);
  };

  const value = useMemo(
    () => ({
      currencyScope,
      setCurrencyScope,
      isAllCurrencies: currencyScope === CURRENCY_ALL,
    }),
    [currencyScope],
  );

  return (
    <CurrencyScopeContext.Provider value={value}>
      {children}
    </CurrencyScopeContext.Provider>
  );
}

export function useCurrencyScope(): CurrencyScopeContextValue {
  const value = useContext(CurrencyScopeContext);
  if (!value) {
    throw new Error("useCurrencyScope debe usarse dentro de CurrencyScopeProvider");
  }
  return value;
}

export function CurrencyScopeSelector() {
  const { currencyScope, setCurrencyScope } = useCurrencyScope();

  return (
    <label className="flex shrink-0 items-center gap-2 text-xs text-[var(--color-text-muted)]">
      <span className="hidden sm:inline">Moneda</span>
      <select
        aria-label="Moneda global de reportes"
        value={currencyScope}
        onChange={(event) => setCurrencyScope(event.target.value as CurrencyScope)}
        className="h-8 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-2)] px-2.5 text-xs font-semibold text-[var(--color-text-strong)] outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-ring-primary)]"
        title="Filtra de forma global las conversiones y reportes por moneda."
      >
        <option value="ARS">ARS</option>
        <option value="PYG">PYG</option>
        <option value={CURRENCY_ALL}>Todas</option>
      </select>
    </label>
  );
}

export function SingleCurrencyRequired({
  title = "Seleccioná una moneda",
}: {
  title?: string;
}) {
  return (
    <div className="rounded-xl border border-amber-800/40 bg-amber-950/20 px-5 py-8 text-center">
      <p className="text-sm font-semibold text-amber-200">{title}</p>
      <p className="mx-auto mt-2 max-w-xl text-xs leading-relaxed text-amber-200/70">
        Para evitar sumar ARS y PYG como si fueran equivalentes, esta vista requiere elegir una moneda específica en el selector superior. “Todas” queda disponible para listados y trazabilidad.
      </p>
    </div>
  );
}
