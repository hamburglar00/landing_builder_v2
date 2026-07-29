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
  const [currencyScope, setCurrencyScopeState] = useState<CurrencyScope>(() => {
    if (typeof window === "undefined") return "ARS";
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isCurrencyScope(stored) ? stored : "ARS";
  });

  useEffect(() => {
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
    <label className="flex h-9 shrink-0 items-center gap-2 rounded-xl border border-[var(--color-border-subtle)] bg-[rgba(255,255,255,0.025)] px-2 text-xs text-[var(--color-text-muted)] shadow-[inset_0_1px_0_rgba(255,255,255,0.025)]">
      <svg
        aria-hidden
        className="h-3.5 w-3.5 text-[var(--color-primary)]"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c2.3 2.5 3.5 5.5 3.5 9S14.3 18.5 12 21c-2.3-2.5-3.5-5.5-3.5-9S9.7 5.5 12 3Z" />
      </svg>
      <span className="hidden sm:inline">Vista</span>
      <select
        aria-label="Moneda global de reportes"
        value={currencyScope}
        onChange={(event) => setCurrencyScope(event.target.value as CurrencyScope)}
        className="h-7 min-w-16 rounded-lg border-0 bg-transparent px-1.5 text-xs font-semibold text-[var(--color-text-strong)] outline-none"
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
    <div className="ui-alert border-[rgba(251,191,36,0.24)] bg-[rgba(251,191,36,0.07)] px-5 py-8 text-center">
      <p className="text-sm font-semibold text-[var(--color-warning)]">{title}</p>
      <p className="mx-auto mt-2 max-w-xl text-xs leading-relaxed text-[var(--color-text-muted)]">
        Para evitar sumar ARS y PYG como si fueran equivalentes, esta vista requiere elegir una moneda específica en el selector superior. “Todas” queda disponible para listados y trazabilidad.
      </p>
    </div>
  );
}
