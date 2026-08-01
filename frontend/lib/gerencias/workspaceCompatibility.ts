import { normalizeCurrency, type ReportingCurrency } from "@/lib/currency";

export type GerenciaWorkspaceSnapshot = {
  gerenciaId: number;
  gerenciaName: string;
  gerenciaExternalId: number | null;
  workspaceCurrency: unknown;
};

export type GerenciaWorkspaceConflict = {
  gerenciaId: number;
  gerenciaName: string;
  gerenciaExternalId: number | null;
  gerenciaWorkspaceCurrency: ReportingCurrency;
};

export function workspaceCurrencyLabel(currency: ReportingCurrency): string {
  return currency;
}

export function findGerenciaWorkspaceConflicts(input: {
  targetWorkspaceCurrency: unknown;
  gerencias: GerenciaWorkspaceSnapshot[];
}): GerenciaWorkspaceConflict[] {
  const targetWorkspace = normalizeCurrency(input.targetWorkspaceCurrency);
  const conflicts: GerenciaWorkspaceConflict[] = [];

  for (const gerencia of input.gerencias) {
    const gerenciaWorkspace = normalizeCurrency(gerencia.workspaceCurrency);
    if (gerenciaWorkspace === targetWorkspace) continue;

    conflicts.push({
      gerenciaId: Number(gerencia.gerenciaId),
      gerenciaName: gerencia.gerenciaName,
      gerenciaExternalId: gerencia.gerenciaExternalId,
      gerenciaWorkspaceCurrency: gerenciaWorkspace,
    });
  }

  return conflicts;
}
