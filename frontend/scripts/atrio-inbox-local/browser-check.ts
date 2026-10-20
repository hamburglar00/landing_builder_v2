/* eslint-disable @typescript-eslint/no-explicit-any -- Chromium DevTools and cross-checkout runtime ports. */
import assert from "node:assert/strict";
import path from "node:path";
import { build } from "esbuild";
import { ids, type InboxFixture, type Row } from "./fixture";

export async function checkInboxButtons(options: {
  browser: any;
  atrioRoot: string;
  fixture: () => InboxFixture;
  actions: Row;
  loseResponse: () => void;
  check: (name: string, run: () => Promise<void>) => Promise<void>;
}) {
  const { outputFiles } = await build({ absWorkingDir: options.atrioRoot,
    tsconfig: path.join(options.atrioRoot, "tsconfig.json"), bundle: true, write: false, platform: "browser", format: "iife",
    stdin: { loader: "tsx", resolveDir: options.atrioRoot, contents: `
      import React from "react";
      import { createRoot } from "react-dom/client";
      import { PlayerProviderOperations } from "./src/components/player-provider-operations";
      const root = createRoot(document.getElementById("app"));
      let key = 0;
      window.mount = props => root.render(<PlayerProviderOperations key={++key} {...props} />);
    ` },
    plugins: [{ name: "server-action-transport-fixture", setup(plugin) {
      plugin.onLoad({ filter: /[\\/]player-operations-actions\.ts$/ }, () => ({ loader: "ts", contents: `
        async function invoke(name, input) {
          const response = await fetch("/action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, input }) });
          return response.json();
        }
        export const getPlayerBalanceAction = input => invoke("getPlayerBalanceAction", input);
        export const performPlayerOperationAction = input => invoke("performPlayerOperationAction", input);
      ` }));
    } }],
  });
  const html = '<!doctype html><meta charset="utf-8"><div id="app"></div><script>' + outputFiles[0].text.replace(/<\/script/gi, "<\\/script") + "</script>";
  const browser = options.browser;
  const exceptions: string[] = [];
  const pending = new Set<Promise<unknown>>();
  let actionCalls = 0;
  browser.on("Runtime.exceptionThrown", (event: any) => exceptions.push(event.exceptionDetails.text));
  browser.on("Fetch.requestPaused", (event: any) => {
    const work = (async () => {
      const url = new URL(event.request.url);
      assert.equal(url.origin, "https://inbox.local.test", "Browser must not access external services");
      let content = html, type = "text/html";
      if (url.pathname === "/action") {
        const body = JSON.parse(event.request.postData);
        assert.ok(["getPlayerBalanceAction", "performPlayerOperationAction"].includes(body.name));
        actionCalls++;
        content = JSON.stringify(await options.actions[body.name](body.input));
        type = "application/json";
      } else if (event.resourceType !== "Document") { content = ""; type = "text/plain"; }
      await browser.send("Fetch.fulfillRequest", { requestId: event.requestId, responseCode: 200,
        responseHeaders: [{ name: "Content-Type", value: type }], body: Buffer.from(content).toString("base64") });
    })().catch((error: Error) => exceptions.push(error.message));
    pending.add(work); void work.finally(() => pending.delete(work));
  });
  const wait = async (expression: string) => {
    for (let i = 0; i < 150; i++) {
      if (await browser.evaluate(expression)) return;
      await new Promise(resolve => setTimeout(resolve, 30));
    }
    throw new Error("Inbox browser timed out: " + expression);
  };
  const click = (label: string) => browser.evaluate(`Array.from(document.querySelectorAll('button')).find(button => button.textContent.trim() === ${JSON.stringify(label)}).click()`);
  const amount = async (value: string) => {
    await browser.evaluate(`var field = document.querySelector('input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(field, ${JSON.stringify(value)}); field.dispatchEvent(new Event('input', { bubbles: true }));`);
    const digits = value.replace(/\D/g, "").slice(0, 9);
    const displayed = digits ? new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(Number(digits)) : "";
    await wait("!!document.querySelector('input') && document.querySelector('input').value === " + JSON.stringify(displayed));
    await new Promise(resolve => setTimeout(resolve, 40));
  };
  const mount = async (enabled = true, linked = true) => {
    await Promise.all([...pending]); actionCalls = 0; exceptions.length = 0;
    await browser.evaluate("window.mount(" + JSON.stringify({ conversationId: ids.conversation, enabled, hasExternalAccount: linked }) + ")");
    await wait(enabled ? "document.getElementById('app').textContent.includes('Operaciones')" : "document.getElementById('app').textContent === ''");
  };
  const done = async () => { await Promise.all([...pending]); assert.deepEqual(exceptions, []); };
  try {
    await browser.send("Page.enable"); await browser.send("Runtime.enable");
    await browser.send("Fetch.enable", { patterns: [{ urlPattern: "*" }] });
    await browser.send("Page.navigate", { url: "https://inbox.local.test/" });
    await wait("typeof window.mount === 'function'");
    await options.check("Chromium: consultar y actualizar saldo desde el boton real", async () => {
      await mount(); await click("Consultar saldo"); await wait("document.body.textContent.includes('Saldo $1.000')");
      options.fixture().balance = 1500;
      await click("Actualizar saldo"); await wait("document.body.textContent.includes('Saldo $1.500')");
      assert.equal(actionCalls, 2); await done();
    });
    await options.check("Chromium: confirmar carga con doble clic acredita una sola vez", async () => {
      await mount(); await click("Cargar"); await wait("!!document.querySelector('input')"); await amount("200");
      await browser.evaluate("var confirm = Array.from(document.querySelectorAll('button')).find(button => button.textContent.trim() === 'Confirmar cargar'); confirm.click(); confirm.click();");
      await wait("document.body.textContent.includes('Cargar de $200 completada')");
      assert.equal(options.fixture().balance, 1200); assert.equal(options.fixture().providerCalls.load, 1); await done();
    });
    await options.check("Chromium: confirmar retiro debita y muestra el exito", async () => {
      await mount(); await click("Retirar"); await wait("!!document.querySelector('input')"); await amount("200");
      await click("Confirmar retirar"); await wait("document.body.textContent.includes('Retirar de $200 completada')");
      assert.equal(options.fixture().balance, 800); assert.equal(options.fixture().providerCalls.withdraw, 1); await done();
    });
    await options.check("Chromium: miles visibles en carga y retiro conservan el monto entero enviado", async () => {
      options.fixture().balance = 50_000;
      await mount(); await click("Cargar"); await wait("!!document.querySelector('input')"); await amount("10000");
      assert.equal(await browser.evaluate("document.querySelector('input').value"), "10.000");
      await click("Confirmar cargar"); await wait("document.body.textContent.includes('Cargar de $10.000 completada')");
      assert.equal(options.fixture().balance, 60_000);
      await click("Retirar"); await wait("!!document.querySelector('input')"); await amount("1.234");
      assert.equal(await browser.evaluate("document.querySelector('input').value"), "1.234");
      await click("Confirmar retirar"); await wait("document.body.textContent.includes('Retirar de $1.234 completada')");
      assert.equal(options.fixture().balance, 58_766);
      assert.equal(options.fixture().providerCalls.load, 1); assert.equal(options.fixture().providerCalls.withdraw, 1);
      await done();
    });
    await options.check("Chromium: reintentar tras perder respuesta recupera la misma carga", async () => {
      await mount(); await click("Consultar saldo"); await wait("document.body.textContent.includes('Saldo $1.000')");
      await click("Cargar"); await wait("!!document.querySelector('input')"); await amount("200");
      options.loseResponse(); await click("Confirmar cargar"); await wait("document.body.textContent.includes('no pudo confirmar el resultado')");
      await wait("!document.body.textContent.includes('Saldo $1.000')");
      assert.equal(await browser.evaluate("document.body.textContent.includes('usa este mismo formulario')"), true);
      await click("Consultar saldo"); await wait("document.body.textContent.includes('Saldo $1.200')");
      await click("Confirmar cargar"); await wait("document.body.textContent.includes('solicitud recuperada')");
      assert.equal(options.fixture().balance, 1200); assert.equal(options.fixture().providerCalls.load, 1); await done();
    });
    await options.check("Chromium: un monto cero no llama a la accion del servidor", async () => {
      await mount(); await click("Cargar"); await wait("!!document.querySelector('input')"); await amount("0");
      await click("Confirmar cargar"); await wait("document.body.textContent.includes('monto entero mayor que cero')");
      assert.equal(actionCalls, 0); await done();
    });
    await options.check("Chromium: saldo 10.000 contra retiro 100.000 muestra el error sin enviar el retiro", async () => {
      options.fixture().balance = 10_000;
      await mount(); await click("Retirar"); await wait("!!document.querySelector('input')"); await amount("100000");
      await click("Confirmar retirar");
      await wait("document.body.textContent.includes('Saldo insuficiente: disponibles 10.000, solicitado 100.000')");
      assert.equal(actionCalls, 1); assert.equal(options.fixture().records.size, 0);
      assert.equal(options.fixture().providerCalls.withdraw, 0); assert.equal(options.fixture().balance, 10_000);
      options.fixture().balance = 9999.5;
      await amount("10000"); await click("Confirmar retirar");
      await wait("document.body.textContent.includes('Saldo insuficiente: disponibles 9.999,5, solicitado 10.000')");
      assert.equal(await browser.evaluate("document.body.textContent.includes('Saldo $9.999,5')"), true);
      assert.equal(options.fixture().records.size, 0);
      // Correcting an amount rejected before submission keeps the usable form.
      options.fixture().balance = 10_000;
      await amount("5000"); await click("Confirmar retirar");
      await wait("document.body.textContent.includes('Retirar de $5.000 completada')");
      assert.equal(options.fixture().balance, 5000); assert.equal(options.fixture().providerCalls.withdraw, 1);
      await done();
    });
    await options.check("Chromium: cambiar saldo entre consulta y envio devuelve el detalle nuevo de API2", async () => {
      const fixture = options.fixture(); fixture.balance = 10_000;
      const read = fixture.platformService.getBalance.bind(fixture.platformService); let first = true;
      fixture.platformService.getBalance = async (...args: unknown[]) => {
        const result = await read(...args); if (first) { first = false; fixture.balance = 1000; } return result;
      };
      await mount(); await click("Retirar"); await wait("!!document.querySelector('input')"); await amount("8000");
      await click("Confirmar retirar");
      await wait("document.body.textContent.includes('Saldo insuficiente: disponibles 1.000, solicitado 8.000')");
      assert.equal(fixture.providerCalls.withdraw, 0); assert.equal(fixture.balance, 1000); await done();
    });
    await options.check("Chromium: reintentar un retiro ya debitado recupera exito con la misma solicitud", async () => {
      options.fixture().balance = 10_000;
      await mount(); await click("Retirar"); await wait("!!document.querySelector('input')"); await amount("8000");
      options.loseResponse(); await click("Confirmar retirar");
      await wait("document.body.textContent.includes('no pudo confirmar el resultado')");
      assert.equal(options.fixture().balance, 2000);
      await click("Confirmar retirar"); await wait("document.body.textContent.includes('solicitud recuperada')");
      assert.equal(options.fixture().providerCalls.withdraw, 1); assert.equal(options.fixture().providerCalls.balance, 2);
      await done();
    });
    await options.check("Chromium: doble clic en retirar conserva una sola solicitud en curso", async () => {
      await mount(); await click("Retirar"); await wait("!!document.querySelector('input')"); await amount("200");
      await browser.evaluate("var button=Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Confirmar retirar');button.click();button.click();");
      await wait("document.body.textContent.includes('Retirar de $200 completada')");
      assert.equal(options.fixture().providerCalls.withdraw, 1); assert.equal(options.fixture().balance, 800); await done();
    });
    await options.check("Chromium: un rechazo muestra error y conserva el saldo", async () => {
      options.fixture().providerReject = true;
      await mount(); await click("Retirar"); await wait("!!document.querySelector('input')"); await amount("200");
      await click("Confirmar retirar"); await wait("document.body.textContent.includes('no pudo completar la operacion')");
      assert.equal(options.fixture().balance, 1000); assert.equal(options.fixture().providerCalls.withdraw, 1); await done();
    });
    await options.check("Chromium: sin cuenta vinculada o con bandera apagada no hay botones operativos", async () => {
      await mount(true, false); assert.equal(await browser.evaluate("document.querySelectorAll('button').length"), 0);
      await mount(false); assert.equal(await browser.evaluate("document.querySelectorAll('button').length"), 0);
      assert.equal(actionCalls, 0); await done();
    });
  } finally { await Promise.all([...pending]); }
}
