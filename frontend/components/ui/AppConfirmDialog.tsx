"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ConfirmDialog, ModalShell } from "@/components/ui/PanelPrimitives";

type ConfirmOptions = {
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

type ConfirmRequest = ConfirmOptions & {
  resolve: (confirmed: boolean) => void;
};

type PromptOptions = {
  title: string;
  description?: ReactNode;
  label: string;
  placeholder?: string;
  initialValue?: string;
  confirmLabel?: string;
};

type PromptRequest = PromptOptions & {
  resolve: (value: string | null) => void;
};

const AppConfirmContext = createContext<
  ((options: ConfirmOptions) => Promise<boolean>) | null
>(null);
const AppPromptContext = createContext<
  ((options: PromptOptions) => Promise<string | null>) | null
>(null);

export function AppConfirmProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const [promptRequest, setPromptRequest] = useState<PromptRequest | null>(null);
  const [promptValue, setPromptValue] = useState("");
  const activeRequest = useRef<ConfirmRequest | null>(null);
  const activePromptRequest = useRef<PromptRequest | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    if (activeRequest.current) {
      activeRequest.current.resolve(false);
    }

    return new Promise<boolean>((resolve) => {
      const next = { ...options, resolve };
      activeRequest.current = next;
      setRequest(next);
    });
  }, []);

  const settle = useCallback((confirmed: boolean) => {
    const current = activeRequest.current;
    activeRequest.current = null;
    setRequest(null);
    current?.resolve(confirmed);
  }, []);

  const prompt = useCallback((options: PromptOptions) => {
    if (activePromptRequest.current) {
      activePromptRequest.current.resolve(null);
    }

    return new Promise<string | null>((resolve) => {
      const next = { ...options, resolve };
      activePromptRequest.current = next;
      setPromptValue(options.initialValue ?? "");
      setPromptRequest(next);
    });
  }, []);

  const settlePrompt = useCallback((value: string | null) => {
    const current = activePromptRequest.current;
    activePromptRequest.current = null;
    setPromptRequest(null);
    current?.resolve(value);
  }, []);

  return (
    <AppConfirmContext.Provider value={confirm}>
      <AppPromptContext.Provider value={prompt}>
        {children}
        <ConfirmDialog
          open={request !== null}
          title={request?.title ?? "Confirmar acción"}
          description={request?.description}
          confirmLabel={request?.confirmLabel}
          cancelLabel={request?.cancelLabel}
          danger={request?.danger}
          onConfirm={() => settle(true)}
          onClose={() => settle(false)}
        />
        <ModalShell
          open={promptRequest !== null}
          title={promptRequest?.title ?? "Completar dato"}
          description={promptRequest?.description}
          onClose={() => settlePrompt(null)}
          width="sm"
          footer={
            <>
              <button type="button" onClick={() => settlePrompt(null)} className="ui-button ui-button-secondary">
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => settlePrompt(promptValue)}
                disabled={!promptValue.trim()}
                className="ui-button ui-button-primary"
              >
                {promptRequest?.confirmLabel ?? "Continuar"}
              </button>
            </>
          }
        >
          <label className="block space-y-2">
            <span className="text-xs font-medium text-[var(--color-text)]">{promptRequest?.label}</span>
            <input
              autoFocus
              value={promptValue}
              onChange={(event) => setPromptValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && promptValue.trim()) settlePrompt(promptValue);
              }}
              placeholder={promptRequest?.placeholder}
              className="h-11 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-2)] px-3.5 text-sm text-[var(--color-text-strong)] outline-none"
            />
          </label>
        </ModalShell>
      </AppPromptContext.Provider>
    </AppConfirmContext.Provider>
  );
}

export function useAppConfirm() {
  const confirm = useContext(AppConfirmContext);
  if (!confirm) {
    throw new Error("useAppConfirm debe usarse dentro de AppConfirmProvider");
  }
  return confirm;
}

export function useAppPrompt() {
  const prompt = useContext(AppPromptContext);
  if (!prompt) {
    throw new Error("useAppPrompt debe usarse dentro de AppConfirmProvider");
  }
  return prompt;
}
