import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { loadProductPaths } from "./product-worktrees.mjs";

const product = loadProductPaths();
const require = createRequire(product("landing-builder", "frontend/package.json"));
const { build } = require("esbuild");
export const targets = [
  { repo: "landing-autologuin", code: "rey_de_ases", appId: "reydeases_gateway", platform: 5, rewrite: "rewriteReyHtml" },
  { repo: "ases-gateway", code: "ases_del_norte", appId: "ases_del_norte_gateway", platform: 1, rewrite: "rewriteAsesHtml" },
  { repo: "ganamos-gateway", code: "ganamos_net", appId: "ganamos_net_gateway", platform: 2, rewrite: "rewriteGanamosHtml" },
  { repo: "multi-skin-gateway", code: "multi_skin", appId: "multi_skin_gateway", platform: 7, rewrite: "rewriteMultiSkinHtml" },
];

export async function loadSource(root, contents) {
  const r = await build({
    absWorkingDir: root,
    tsconfig: path.join(root, "tsconfig.json"),
    stdin: { contents, resolveDir: root, loader: "ts" },
    bundle: true,
    platform: "node",
    format: "cjs",
    write: false,
    external: ["react", "react/jsx-runtime", "react-dom/server", "next/*", "@supabase/*"],
    plugins: [
      {
        name: "server-rendering",
        setup(builder) {
          builder.onResolve({ filter: /^server-only$/ }, () => ({ path: "server-only", namespace: "server" }));
          builder.onLoad({ filter: /.*/, namespace: "server" }, () => ({ contents: "" }));
        },
      },
    ],
  });
  const mod = { exports: {} };
  new Function("module", "exports", "require", r.outputFiles[0].text)(
    mod,
    mod.exports,
    createRequire(path.join(root, "package.json")),
  );
  return mod.exports;
}
export async function compileWidget(chat) {
  const chatRequire = createRequire(path.join(chat, "package.json"));
  const widget = await build({
    absWorkingDir: chat,
    tsconfig: path.join(chat, "tsconfig.json"),
    stdin: {
      resolveDir: chat,
      loader: "tsx",
      contents: [
        "import React from 'react';import {createRoot} from 'react-dom/client';",
        "import {ClientChatShell} from './src/components/client-chat-shell';",
        "createRoot(document.getElementById('root')).render(<ClientChatShell {...window.fixtureProps}/>);",
      ].join("\n"),
    },
    bundle: true,
    platform: "browser",
    format: "iife",
    jsx: "automatic",
    write: false,
    outdir: "memory",
    define: { "process.env": "{}", "process.env.NODE_ENV": '"production"' },
  });
  const embedCssPath = path.join(chat, "src/app/embed/embed.css");
  const embedCss = (
    await chatRequire("postcss")([chatRequire("@tailwindcss/postcss")({ base: chat })]).process(
      await readFile(embedCssPath, "utf8"),
      { from: embedCssPath },
    )
  ).css;
  return {
    js: widget.outputFiles.find((f) => f.path.endsWith(".js")).text,
    css: embedCss + (widget.outputFiles.find((f) => f.path.endsWith(".css"))?.text || ""),
  };
}

export async function loadGateway(target) {
  const root = product(target.repo);
  const configExport =
    target.code === "rey_de_ases"
      ? 'export function getProviderConfig(){return {displayName:"Rey de Ases",homePath:"/casino/list/home",backgroundColor:"#071b2c"}}'
      : target.code === "multi_skin"
        ? "import {getSkinConfig} from './src/lib/skin-registry'; export function getProviderConfig(){return getSkinConfig('ganamos_plus')}"
        : "export {getProviderConfig} from './src/lib/skin-registry';";
  const host = await loadSource(
    root,
    [
      configExport,
      "export {renderPreparationPage} from './src/lib/preparation-page';",
      "export {gatewayPreparationTheme} from './src/lib/gateway-entry-transition';",
      "export {renderGatewayEntryShell} from './src/lib/gateway-entry-shell';",
      "export {addGatewayEntryWaitToHandoff,readGatewayEntryPresentation} from './src/lib/gateway-entry-settings';",
      "export {GET as resumeLanding} from './src/app/resume/route';",
      "export {createChatEmbedUrl} from './src/lib/chat-embed-token';",
      "export {createGatewayAgencyHandlers} from './src/lib/gateway-agency';",
      "export {rememberAgency} from './src/lib/agency-memory';",
      "export {recoverAgencySession} from './src/lib/gateway-agency-recovery';",
      "export {confirmEntrySession,issueEntryIdentity,withGatewayEntryIdentity} from './src/lib/entry-identity';",
      "export {" + target.rewrite + " as rewrite} from './src/lib/html-rewriter';",
    ].join("\n"),
  );
  const provider = host.getProviderConfig();
  function casinoHtml(chatEmbedUrl) {
    const shell = host.renderGatewayEntryShell(provider.homePath, provider.backgroundColor, provider.displayName);
    const cfg = {
      appId: target.appId,
      displayName: provider.displayName,
      chatEmbedUrl,
      initialChatOpen: true,
      initialChatAction: "wallet",
      streamingEntry: true,
    };
    if (target.code === "rey_de_ases") return host.rewrite(shell, { gatewayClient: cfg }).html;
    if (target.code === "multi_skin")
      return host.rewrite(shell, { ...cfg, skin: provider, accessToken: "fixture", user: { username: "fixture" } });
    return host.rewrite(shell, { ...cfg, provider });
  }
  return { ...target, root, host, provider, casinoHtml };
}
