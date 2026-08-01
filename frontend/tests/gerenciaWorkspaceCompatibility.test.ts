import assert from "node:assert/strict";
import test from "node:test";
import {
  findGerenciaWorkspaceConflicts,
  workspaceCurrencyLabel,
} from "../lib/gerencias/workspaceCompatibility";

test("no reporta conflictos si todas las gerencias pertenecen al workspace destino", () => {
  const conflicts = findGerenciaWorkspaceConflicts({
    targetWorkspaceCurrency: "PYG",
    gerencias: [
      {
        gerenciaId: 1,
        gerenciaName: "Paraguay 1",
        gerenciaExternalId: 125,
        workspaceCurrency: "PYG",
      },
    ],
  });

  assert.deepEqual(conflicts, []);
});

test("reporta gerencias de otro workspace", () => {
  const conflicts = findGerenciaWorkspaceConflicts({
    targetWorkspaceCurrency: "PYG",
    gerencias: [
      {
        gerenciaId: 1,
        gerenciaName: "Argentina 1",
        gerenciaExternalId: 28,
        workspaceCurrency: "ARS",
      },
    ],
  });

  assert.deepEqual(conflicts, [
    {
      gerenciaId: 1,
      gerenciaName: "Argentina 1",
      gerenciaExternalId: 28,
      gerenciaWorkspaceCurrency: "ARS",
    },
  ]);
});

test("normaliza valores legacy a ARS", () => {
  assert.deepEqual(
    findGerenciaWorkspaceConflicts({
      targetWorkspaceCurrency: "ARS",
      gerencias: [
        {
          gerenciaId: 1,
          gerenciaName: "Legacy",
          gerenciaExternalId: null,
          workspaceCurrency: "",
        },
      ],
    }),
    [],
  );
});

test("mantiene labels concisos para errores de UI", () => {
  assert.equal(workspaceCurrencyLabel("ARS"), "ARS");
  assert.equal(workspaceCurrencyLabel("PYG"), "PYG");
});
