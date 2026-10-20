import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire, isBuiltin } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import { build, type Plugin } from "esbuild";

export async function compile(root: string, source: string, plugins: Plugin[] = [], esm = false) {
  const requireFromRoot = createRequire(path.join(root, "package.json"));
  if (esm) plugins.push({ name: "resolve-external-packages", setup(plugin) {
    plugin.onResolve({ filter: /^[^./]/ }, args => {
      if (isBuiltin(args.path)) return { path: args.path, external: true };
      // Resolve from the checkout, not from the temporary bundle directory.
      if (!args.path.startsWith("#")) return { path: pathToFileURL(requireFromRoot.resolve(args.path)).href, external: true };
    });
  } });
  const result = await build({ absWorkingDir: root, tsconfig: path.join(root, "tsconfig.json"),
    stdin: { contents: source, resolveDir: root, loader: "ts" }, bundle: true, write: false,
    platform: "node", format: esm ? "esm" : "cjs", packages: "external", plugins });
  if (esm) {
    const directory = await mkdtemp(path.join(tmpdir(), "template7-local-flow-"));
    try {
      const file = path.join(directory, "api2.mjs");
      await writeFile(file, result.outputFiles[0].text);
      return await import(pathToFileURL(file).href);
    } finally {
      assert.equal(path.dirname(path.resolve(directory)), path.resolve(tmpdir()));
      assert.ok(path.basename(directory).startsWith("template7-local-flow-"));
      await rm(directory, { recursive: true, force: true });
    }
  }
  const loaded = { exports: {} as unknown };
  new Function("module", "exports", "require", result.outputFiles[0].text)(loaded, loaded.exports, requireFromRoot);
  return loaded.exports;
}

export async function loadGateway(root: string) {
  return compile(root, `
    export { NextRequest } from "next/server";
    export { POST as handoff } from "./src/app/api/handoffs/route";
    export { GET as prepare } from "./src/app/prepare/route";
    export { GET as resume } from "./src/app/resume/route";
    export { GET as start } from "./src/app/start/route";
    export { POST as complete } from "./src/app/api/preparations/complete/route";
    export { POST as finalize } from "./src/app/api/preparations/finalize/route";
    export { proxyToRey } from "./src/lib/proxy";
  `, [{ name: "local-storage-only", setup(plugin) {
    plugin.onLoad({ filter: /[\\/]lib[\\/]database\.ts$/ }, () => ({
      contents: 'export function getDatabase() { return globalThis.__TEMPLATE7_LOCAL_FLOW__.gateway.sql; }', loader: "ts",
    }));
    plugin.onLoad({ filter: /[\\/]lib[\\/]after-response\.ts$/ }, () => ({
      contents: 'export function scheduleAfterResponse(label, task) { globalThis.__TEMPLATE7_LOCAL_FLOW__.background.push(task); }', loader: "ts",
    }));
  } }]);
}

export async function loadAtrio(root: string) {
  return compile(root, `
    export { createPlayerResolveHandler, resolvePlayerIdentity } from "./src/lib/player-resolve";
    export { createProviderAccountLinkHandler, ProviderAccountLinkFailure } from "./src/lib/provider-account-link";
    export { verifyGatewayEmbedToken } from "./src/lib/gateway-contract";
  `);
}

/** For an explicitly authorized live probe. Settings are supplied in memory;
 * importing the actual client must not boot Adonis or open a production pool. */
export async function loadReyProvider(root: string) {
  return compile(root, 'export { ReyDeAsesClient } from "./app/clients/rey_de_ases.client";', [{
    name: "explicit-provider-settings", setup(plugin) {
      plugin.onLoad({ filter: /[\\/]general_setting\.service\.ts$/ }, () => ({
        contents: 'export class GeneralSettingService { async findFirst() { return globalThis.__ATRIO_PROVIDER_PROBE_SETTINGS__; } }', loader: "ts",
      }));
      plugin.onLoad({ filter: /[\\/](?:start|models|repositories)[\\/].*\.ts$/ }, () => {
        throw new Error("Application bootstrap is forbidden in the provider probe");
      });
    },
  }], true);
}

export async function loadReyLogin(root: string) {
  return compile(root, 'export { loginPlayer, verifyPlayerSession } from "./src/lib/rey-client";');
}

/** Keep API2's actual creation method, validators, capabilities and serializer.
 * Exclude its unrelated constructor/clients: booting Adonis would also start
 * crons and access environment files outside this isolated test. */
export async function loadApi2(root: string) {
  const file = path.join(root, "app/controllers/players.controller.ts");
  const raw = await readFile(file, "utf8");
  const tree = ts.createSourceFile(file, raw, ts.ScriptTarget.Latest, true);
  const controller = tree.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === "PlayerController");
  assert.ok(controller && ts.isClassDeclaration(controller));
  const method = controller.members.find(node => ts.isMethodDeclaration(node) && node.name.getText(tree) === "apiExternalPlayerCreate");
  assert.ok(method);
  const createOnly = controller.members.find(node => ts.isMethodDeclaration(node) && node.name.getText(tree) === "apiExternalPlayerCreateOnly");
  assert.ok(createOnly);
  const authFile = path.join(root, "app/middleware/validate_bot_api_keys_middleware.ts");
  const authSource = await readFile(authFile, "utf8");
  const authTree = ts.createSourceFile(authFile, authSource, ts.ScriptTarget.Latest, true);
  const authClass = authTree.statements.find(node => ts.isClassDeclaration(node));
  assert.ok(authClass && ts.isClassDeclaration(authClass));
  const auth = authClass.members.find(node => ts.isMethodDeclaration(node) && node.name.getText(authTree) === "handle");
  assert.ok(auth);
  return compile(root, `
    import { PlayerCreateExternalValidator } from "./app/validators/player_create_external.validator";
    import { parseAtrioAdvisorIdParameter, parsePositiveIntegerParameter, validateAtrioPlayerManager } from "./app/helpers/atrio_player_endpoint.helper";
    import { AtrioPlayerCapability, hasAtrioPlayerCapability } from "./app/helpers/atrio_player_capabilities.helper";
    import { AtrioOperationalAgencyError } from "./app/services/atrio_operational_agency.service";
    import { createAtrioPlayerProvisionService } from "./app/services/atrio_player_provision.factory";
    import { AtrioPlayerProvisionError } from "./app/services/atrio_player_provision.service";
    import { PlatformType } from "./app/types/manager.types";
    import { usernameFromNameGenerator } from "./app/helpers/username_from_name_generator.helper";
    import { passwordGenerator } from "./app/helpers/password_generator.helper";
    import { apiRenderError, apiRenderSuccess, apiRenderUnauthorized } from "./app/helpers/response.helper";
    import SafeCompare from "./app/lib/safe_compare";
    const GeneralSetting = { first: async () => globalThis.__TEMPLATE7_LOCAL_FLOW__.api2Settings };
    const ManagerService = class { findById(id) { return globalThis.__TEMPLATE7_LOCAL_FLOW__.managerService.findById(id); } };
    export class LocalPlayerController { ${method.getText(tree)} ${createOnly.getText(tree)} }
    export class LocalApiKeyMiddleware { ${auth.getText(authTree)} }
    export { ManagerRole, ChatPlatformType, ChannelType, PlatformType } from "./app/types/manager.types";
  `, [{ name: "no-adonis-boot", setup(plugin) {
    plugin.onResolve({ filter: /^@adonisjs\/core\/services\/encryption$/ }, () => ({ path: "local-encryption", namespace: "local-encryption" }));
    plugin.onLoad({ filter: /.*/, namespace: "local-encryption" }, () => ({
      contents: 'import { Encryption } from "@adonisjs/core/encryption"; export default new Encryption({secret:"local-only-provision-encryption-" + "x".repeat(32)});',
      loader: "ts", resolveDir: root,
    }));
    plugin.onLoad({ filter: /[\\/]atrio_player_provision\.repository\.ts$/ }, () => ({
      contents: `export class AtrioPlayerProvisionRepository {
        find(...args) { return globalThis.__TEMPLATE7_LOCAL_FLOW__.provisionStore.find(...args); }
        reserve(...args) { return globalThis.__TEMPLATE7_LOCAL_FLOW__.provisionStore.reserve(...args); }
        transition(...args) { return globalThis.__TEMPLATE7_LOCAL_FLOW__.provisionStore.transition(...args); }
      }`, loader: "ts",
    }));
    plugin.onLoad({ filter: /[\\/]atrio_operational_agency\.service\.ts$/ }, async args => {
      const source = await readFile(args.path, "utf8");
      const ast = ts.createSourceFile(args.path, source, ts.ScriptTarget.Latest, true);
      const error = ast.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === "AtrioOperationalAgencyError");
      assert.ok(error);
      return { contents: error.getText(ast), loader: "ts" };
    });
    // A future import that starts the application must fail before it can
    // read .env/env.dev, open a real pool, schedule jobs or call a provider.
    plugin.onLoad({ filter: /[\\/](?:start|models|clients|repositories)[\\/].*\.ts$/ }, args => {
      throw new Error("Forbidden API2 boot dependency in local test: " + path.basename(args.path));
    });
  } }], true);
}
