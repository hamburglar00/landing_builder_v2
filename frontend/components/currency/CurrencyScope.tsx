"use client";

import {
  useCallback,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
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
  isSwitchingWorkspace: boolean;
};

const CurrencyScopeContext = createContext<CurrencyScopeContextValue | null>(null);

type WorkspaceTransitionState = {
  active: boolean;
  fading: boolean;
  target: CurrencyScope | null;
};

function isCurrencyScope(value: unknown): value is CurrencyScope {
  return REPORTING_CURRENCIES.includes(value as "ARS" | "PYG");
}

export function CurrencyScopeProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const transitionTimersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const [currencyScope, setCurrencyScopeState] = useState<CurrencyScope>(() => {
    if (typeof window === "undefined") return "ARS";
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isCurrencyScope(stored) ? stored : "ARS";
  });
  const [transition, setTransition] = useState<WorkspaceTransitionState>({
    active: false,
    fading: false,
    target: null,
  });

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!isCurrencyScope(stored)) {
      window.localStorage.setItem(STORAGE_KEY, "ARS");
    }
  }, []);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      if (isCurrencyScope(event.newValue)) {
        setCurrencyScopeState(event.newValue);
        return;
      }
      if (event.newValue === CURRENCY_ALL) {
        setCurrencyScopeState("ARS");
        window.localStorage.setItem(STORAGE_KEY, "ARS");
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    return () => {
      transitionTimersRef.current.forEach((timerId) => clearTimeout(timerId));
      transitionTimersRef.current = [];
    };
  }, []);

  const clearTransitionTimers = useCallback(() => {
    transitionTimersRef.current.forEach((timerId) => clearTimeout(timerId));
    transitionTimersRef.current = [];
  }, []);

  const getWorkspaceHomePath = useCallback(() => {
    if (pathname?.startsWith("/admin")) return "/admin/inicio";
    return "/dashboard/inicio";
  }, [pathname]);

  const setCurrencyScope = useCallback(
    (scope: CurrencyScope) => {
      if (scope === currencyScope && !transition.active) return;

      clearTransitionTimers();
      setTransition({ active: true, fading: false, target: scope });

      const applyTimer = setTimeout(() => {
        setCurrencyScopeState(scope);
        window.localStorage.setItem(STORAGE_KEY, scope);
        window.dispatchEvent(
          new StorageEvent("storage", { key: STORAGE_KEY, newValue: scope }),
        );
        router.replace(getWorkspaceHomePath());
      }, 280);

      const fadeTimer = setTimeout(() => {
        setTransition((current) =>
          current.active ? { ...current, fading: true } : current,
        );
      }, 900);

      const doneTimer = setTimeout(() => {
        setTransition({ active: false, fading: false, target: null });
      }, 1900);

      transitionTimersRef.current = [applyTimer, fadeTimer, doneTimer];
    },
    [
      clearTransitionTimers,
      currencyScope,
      getWorkspaceHomePath,
      router,
      transition.active,
    ],
  );

  const value = useMemo(
    () => ({
      currencyScope,
      setCurrencyScope,
      isAllCurrencies: currencyScope === CURRENCY_ALL,
      isSwitchingWorkspace: transition.active,
    }),
    [currencyScope, setCurrencyScope, transition.active],
  );

  return (
    <CurrencyScopeContext.Provider value={value}>
      {children}
      <WorkspaceSwitchOverlay transition={transition} />
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
  const { currencyScope, setCurrencyScope, isSwitchingWorkspace } = useCurrencyScope();

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
      <span className="hidden sm:inline">Workspace</span>
      <select
        aria-label="Workspace activo"
        value={currencyScope}
        disabled={isSwitchingWorkspace}
        onChange={(event) => setCurrencyScope(event.target.value as CurrencyScope)}
        className="h-7 min-w-16 rounded-lg border-0 bg-transparent px-1.5 text-xs font-semibold text-[var(--color-text-strong)] outline-none disabled:cursor-wait disabled:opacity-70"
        title="Define el workspace activo del panel."
      >
        <option value="ARS">ARS</option>
        <option value="PYG">PYG</option>
      </select>
    </label>
  );
}

function WorkspaceSwitchOverlay({
  transition,
}: {
  transition: WorkspaceTransitionState;
}) {
  if (!transition.active) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-[rgba(2,6,10,0.92)] px-6 backdrop-blur-md transition-opacity duration-[1200ms] ease-out ${
        transition.fading ? "opacity-0" : "opacity-100"
      }`}
      role="status"
      aria-live="polite"
      aria-label="Cambiando de workspace"
    >
      <div
        className={`flex flex-col items-center text-center transition-all duration-[1200ms] ease-out ${
          transition.fading ? "translate-y-2 scale-95 opacity-0" : "translate-y-0 scale-100 opacity-100"
        }`}
      >
        <div className="panel-brand-mark flex h-16 w-16 items-center justify-center rounded-2xl text-xl font-black shadow-[0_0_34px_rgba(163,230,53,0.18)]">
          PB
        </div>
        <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--color-primary)]">
          Panel Bot Admin
        </p>
        <h2 className="mt-2 text-2xl font-black text-[var(--color-text-strong)]">
          Cambiando de workspace
        </h2>
        {transition.target ? (
          <p className="mt-2 text-sm font-medium text-[var(--color-text-muted)]">
            Preparando inicio {transition.target}
          </p>
        ) : null}
      </div>
    </div>
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
        Para evitar sumar ARS y PYG como si fueran equivalentes, esta vista requiere elegir un workspace especifico en el selector superior.
      </p>
    </div>
  );
}
