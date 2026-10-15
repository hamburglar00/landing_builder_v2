import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  CLIENT_MODULES, DEFAULT_CLIENT_MODULE_PERMISSIONS, normalizeClientModulePermissions,
  canViewClientRoute, canViewClientIntegration,
} from "../lib/clientModules";
import { IntegrationMenu } from "../components/integraciones/IntegrationMenu";
import { ClientModulePermissionsFields } from "../components/clients/ClientModulePermissions";
import { CLIENT_MODULE_KEYS, parseModuleVisibility } from "../../supabase/functions/_shared/client-module-permissions";

test("existing clients retain visibility; each switch blocks only its module and nested pages", () => {
  assert.deepEqual(normalizeClientModulePermissions(null), DEFAULT_CLIENT_MODULE_PERMISSIONS);
  assert.deepEqual(CLIENT_MODULES.map(m => m.key), [...CLIENT_MODULE_KEYS]);
  for (const module of CLIENT_MODULES) {
    const permissions = normalizeClientModulePermissions({ [module.key]: false });
    for (const candidate of CLIENT_MODULES.filter(m => m.path)) {
      for (const suffix of ["", "/", "/configuracion", "/inbox", "/logs", "/contactos"]) {
        assert.equal(canViewClientRoute(candidate.path + suffix, permissions), candidate.key !== module.key);
      }
    }
    for (const path of ["/dashboard/inicio", "/dashboard/conversiones", "/dashboard/integraciones", "/dashboard/landings"]) {
      assert.equal(canViewClientRoute(path, permissions), true);
    }
    assert.equal(canViewClientIntegration("kommo", permissions), module.key !== "show_kommo");
    assert.equal(canViewClientIntegration("chatrace", permissions), module.key !== "show_chatrace");
  }
});

test("integration menu independently hides Kommo and Chatrace while preserving Meta and endpoint", () => {
  for (const show_kommo of [true, false]) for (const show_chatrace of [true, false]) {
    const permissions = normalizeClientModulePermissions({ show_kommo, show_chatrace });
    const html = renderToStaticMarkup(createElement(IntegrationMenu, {
      permissions, onSelect: () => {}, constructorLogo: null,
    }));
    assert.equal(html.includes("CRM Kommo"), show_kommo);
    assert.equal(html.includes("con Chatrace"), show_chatrace);
    assert.ok(html.includes("Meta CAPI"));
    assert.ok(html.includes("Endpoint de Conversiones"));
    assert.equal(canViewClientIntegration("meta", permissions), true);
    assert.equal(canViewClientIntegration("constructor", permissions), true);
  }
});

test("admin form shows the five saved visibility choices", () => {
  const html = renderToStaticMarkup(createElement(ClientModulePermissionsFields, {
    value: normalizeClientModulePermissions({ show_atrio: false, show_kommo: false }),
    onChange: () => {},
  }));
  assert.equal((html.match(/type="checkbox"/g) ?? []).length, 5);
  assert.equal((html.match(/checked=""/g) ?? []).length, 3);
  for (const { label } of CLIENT_MODULES) assert.ok(html.includes(label));
});

test("admin API accepts explicit false and partial updates; rejects malformed or unknown permissions", () => {
  assert.equal(parseModuleVisibility(undefined), undefined);
  assert.deepEqual(parseModuleVisibility({ show_atrio: false }), { show_atrio: false });
  assert.deepEqual(parseModuleVisibility(DEFAULT_CLIENT_MODULE_PERMISSIONS), DEFAULT_CLIENT_MODULE_PERMISSIONS);
  for (const payload of [null, [], true, "false", { show_atrio: "false" }, { show_kommo: null }, { user_id: "other" }, { show_atrio: 0 }]) {
    assert.throws(() => parseModuleVisibility(payload));
  }
});

test("permission reads distinguish absent rows from failures and always scope to the current user", async t => {
  process.env.NEXT_PUBLIC_SUPABASE_URL ||= "http://127.0.0.1:54321";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= "synthetic-anon";
  const { supabase } = await import("../lib/supabaseClient");
  const { fetchClientModulePermissions } = await import("../lib/clientModulesDb");
  let result: { data: unknown; error: unknown } = { data: null, error: null };
  t.mock.method(supabase, "from", (table: string) => {
    assert.equal(table, "client_module_permissions");
    return { select: () => ({ eq: (key: string, value: string) => {
      assert.equal(key, "user_id"); assert.equal(value, "test-client");
      return { maybeSingle: async () => result };
    } }) } as never;
  });
  assert.deepEqual(await fetchClientModulePermissions("test-client"), DEFAULT_CLIENT_MODULE_PERMISSIONS);
  result = { data: { show_chatrace: false }, error: null };
  assert.equal((await fetchClientModulePermissions("test-client")).show_chatrace, false);
  result = { data: null, error: { message: "unavailable" } };
  await assert.rejects(fetchClientModulePermissions("test-client"));
});
