import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import { compile } from "../template7-local-flow/source-loader";

/** Execute the production actions and webhooks. Only authentication, storage
 * and the conversational engine's side effects are replaced with fixtures. */
export async function loadAtrioInbox(root: string) {
  return compile(root, `
    export { getPlayerBalanceAction, performPlayerOperationAction } from "./src/app/dashboard/player-operations-actions";
    export { handleClientMessageIntegrations } from "./src/lib/integration-events";
    export { dispatchConfirmedPurchases } from "./src/lib/confirmed-loads";
    export { POST as receiveConfirmedLoad } from "./src/app/api/external/pbadmin/loads/route";
    export { POST as receiveReply } from "./src/app/api/external/advisors/[advisorSlug]/messages/route";
    export { encryptExternalSecret } from "./src/lib/external-request";
    export { NextRequest } from "next/server";
  `, [{ name: "synthetic-atrio-session-and-storage", setup(plugin) {
    plugin.onLoad({filter:/[\\/]player-operations-actions\.ts$/},async args=>({
      contents:(await readFile(args.path,"utf8")).replace('import { after } from "next/server";',
        'function after(task) { globalThis.__ATRIO_INBOX_LOCAL__.background.push(task); }'),loader:"ts"
    }));
    plugin.onLoad({filter:/[\\/]external[\\/]pbadmin[\\/]loads[\\/]route\.ts$/},async args=>({
      contents:(await readFile(args.path,"utf8")).replace('import { after, NextRequest }','import { NextRequest }')+
        '\nfunction after(task) { globalThis.__ATRIO_INBOX_LOCAL__.background.push(task); }',loader:"ts"
    }));
    plugin.onResolve({ filter: /^server-only$/ }, () => ({ path: "empty", namespace: "fixture" }));
    plugin.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: "", loader: "js" }));
    plugin.onLoad({ filter: /[\\/]lib[\\/]auth\.ts$/ }, () => ({
      contents: "export async function getCurrentSession() { return globalThis.__ATRIO_INBOX_LOCAL__.session; }", loader: "ts",
    }));
    plugin.onLoad({ filter: /[\\/]supabase[\\/]server\.ts$/ }, () => ({
      contents: "export async function createServerSupabaseClient() { return globalThis.__ATRIO_INBOX_LOCAL__.db; }", loader: "ts",
    }));
    plugin.onLoad({ filter: /[\\/]supabase[\\/]admin\.ts$/ }, () => ({
      contents: "export function createAdminSupabaseClient() { return globalThis.__ATRIO_INBOX_LOCAL__.db; }", loader: "ts",
    }));
    plugin.onLoad({ filter: /[\\/]lib[\\/]env\.ts$/ }, () => ({ contents: `
      export function getSupabasePublicEnv() { return { supabaseUrl: "https://push.local.test", supabasePublishableKey: "local-only" }; }
      export function getSupabaseServiceRoleKey() { return "local-only-fixture-key"; }
    `, loader: "ts" }));
  } }]);
}

export async function loadApi2Inbox(root: string) {
  return compile(root, `
    export { default as Controller } from "./app/controllers/atrio_player_operations.controller";
    export { AtrioPlayerOperationService as Service } from "./app/services/atrio_player_operation.service";
    export { DirectPlayerPlatformService } from "./app/services/direct_player_platform.service";
    export { AtrioWebhookController } from "./app/controllers/atrio_webhook.controller";
    export { AtrioClient } from "./app/clients/atrio.client";
    export { AtrioManagerConnectionService } from "./app/services/atrio_manager_connection.service";
    export { AtrioResponseDeliveryService } from "./app/services/atrio_response_delivery.service";
    export { AtrioConfirmedLoadDeliveryService } from "./app/services/atrio_confirmed_load_delivery.service";
    export { ManagerRole, ChatPlatformType, ChannelType, PlatformType } from "./app/types/manager.types";
  `, [{ name: "forbid-adonis-boot-and-provider-network", setup(plugin) {
    plugin.onLoad({filter:/[\\/]models[\\/]manager\.ts$/},()=>({
      contents:"export default class Manager { static async find(id) { const fixture=globalThis.__ATRIO_INBOX_LOCAL__; return id===fixture.manager.id?fixture.manager:null; } }",loader:"ts"
    }));
    for (const [name, symbol, member] of [
      ["manager", "ManagerService", "managerService"],
      ["player", "PlayerService", "playerService"],
      ["credential", "CredentialService", "credentialService"],
    ]) plugin.onLoad({ filter: new RegExp(`[\\\\/]${name}\\.service\\.ts$`) }, () => ({
      contents: `export class ${symbol} { constructor() { return globalThis.__ATRIO_INBOX_LOCAL__.${member}; } }`, loader: "ts",
    }));
    plugin.onLoad({ filter: /[\\/]atrio_player_operation\.repository\.ts$/ }, () => ({
      contents: "export class AtrioPlayerOperationRepository { constructor() { return globalThis.__ATRIO_INBOX_LOCAL__.operations; } }", loader: "ts",
    }));
    plugin.onLoad({ filter: /[\\/]atrio_confirmed_load_notification\.repository\.ts$/ }, () => ({
      contents: "export class AtrioConfirmedLoadNotificationRepository { constructor() { return globalThis.__ATRIO_INBOX_LOCAL__.notifications ?? {}; } }",loader:"ts"
    }));
    plugin.onLoad({ filter: /[\\/]builder_bot_webhook\.service\.ts$/ }, () => ({ contents: `
      export class BuilderBotWebhookV2Service { static getInstance() { return globalThis.__ATRIO_INBOX_LOCAL__.engine; } }
    `, loader: "ts" }));
    plugin.onLoad({ filter: /[\\/]general_setting\.service\.ts$/ }, () => ({ contents: `
      export class GeneralSettingService { async findFirst() { return { atrioBaseUrl: "https://atrio.local.test" }; } }
    `, loader: "ts" }));
    plugin.onLoad({ filter: /[\\/]atrio_operational_agency\.service\.ts$/ }, async args => {
      const source = await readFile(args.path, "utf8");
      const ast = ts.createSourceFile(args.path, source, ts.ScriptTarget.Latest, true);
      const error = ast.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === "AtrioOperationalAgencyError");
      assert.ok(error);
      return { contents: error.getText(ast), loader: "ts" };
    });
    plugin.onLoad({ filter: /[\\/]clients[\\/](ases|caipiria|ganamos|juga_y_gana|rey_de_ases)\.client\.ts$/ }, args => {
      const symbols: Record<string, string> = { ases: "AsesClient", caipiria: "CaipiriaClient", ganamos: "GanamosClient", juga_y_gana: "JugaYGanaClient", rey_de_ases: "ReyDeAsesClient" };
      const name = args.path.match(/([^/\\]+)\.client\.ts$/)![1];
      return { contents: `export class ${symbols[name]} {}`, loader: "ts" };
    });
    plugin.onLoad({ filter: /[\\/](?:start|models|repositories|clients)[\\/].*\.ts$/ }, args => {
      // The real Atrio HTTP client is required to verify response delivery.
      if (/[\\/]atrio\.client\.ts$/.test(args.path)) return undefined;
      throw new Error("Forbidden API2 bootstrap dependency: " + args.path.split(/[\\/]/).pop());
    });
  } }], true);
}
