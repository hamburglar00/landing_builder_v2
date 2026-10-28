// Shared client/advisor message component. Fixture-only UI; no accounts or business requests.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../../", import.meta.url));
const atrio = path.join(root, "internal-chat");
const require = createRequire(new URL("../frontend/package.json", import.meta.url));
const appRequire = createRequire(path.join(atrio, "package.json"));
const { build } = require("esbuild");
const { chromium, webkit } = require(path.join(process.env.APPDATA, "npm/node_modules/playwright"));
const output = new URL("../.vercel/validation-chat-formatting/", import.meta.url);
await mkdir(output, { recursive: true });
const cssPath = path.join(atrio, "src/app/globals.css");
const css = (await appRequire("postcss")([appRequire("@tailwindcss/postcss")({ base: atrio })])
  .process(await readFile(cssPath, "utf8"), { from: cssPath })).css;
const samples = [
  "🔑 *Credenciales para ingresar:*\n👤 *Usuario:* jugador123\n🔐 *Clave:* prueba123\n🌐 *Link:* ganamosnet.club",
  "*_Importante_*: ~anterior~ y *nuevo*. _Escribinos_ a *wa.me/5491100000000*",
  "Pasos:\n- *Ingresá* a la plataforma\n- Enviá tu comprobante para que revisemos la carga\n\n3. _Otra opción_\n4. Último paso\n> Una cita\n> con *dos líneas*",
  "Literal: `*sin negrita*`\n```  espacios\n- *literal*\nhttps://example.com```",
  `*Sitio:* https://example.com/${"long-address".repeat(55)}?a_b=c_d`,
  "*<img src=x onerror=alert(1)>*\nUsuario: nombre_con_guion\nClave: clave_a_b"
];
const bundle = await build({ absWorkingDir: atrio, stdin: { resolveDir: atrio, loader: "tsx", contents: `
import React,{useState} from "react";import{createRoot}from"react-dom/client";
import{ChatTextMessageBubble}from"./src/components/chat-text-message-bubble";
import{widgetThemeCssVariables}from"./src/lib/widget-theme";
const page={code:"fixture",colors:{primary:"#9637c4",primaryHover:"#a748d5",accent:"#e8b6ff",background:"#11001f",surface:"#270538",surfaceAlt:"#31074d",bubble:"#270538",avatar:"#31074d",text:"#ffffff",mutedText:"#d0b4db",border:"#9637c4",success:"#4ade80",danger:"#ef4444"}};
function App(){const[short,setShort]=useState("*Hola*");window.updateShort=setShort;return <main style={{...widgetThemeCssVariables(window.theme,page),background:"var(--bg)",padding:12,minHeight:"100vh"}}>
{["incoming","outgoing"].map(side=><section key={side} aria-label={side}>{[short,...window.samples].map((text,i)=><div key={i} data-chat-message-row data-example={side+"-"+i} style={{display:"flex",justifyContent:side==="outgoing"?"flex-end":"flex-start",marginBottom:6}}><ChatTextMessageBubble text={text} meta={<small data-meta style={{fontSize:10}}>15:24 ✓✓</small>} bubbleClassName={"max-w-[88%] rounded-[14px] px-3 py-2 text-[13.5px] leading-5 "+(side==="incoming"?"bg-[var(--widget-incoming-bg)] text-[var(--widget-incoming-text)]":"bg-[var(--widget-outgoing-bg)] text-[var(--widget-outgoing-text)]")}/></div>)}</section>)}
</main>};createRoot(document.getElementById("root")).render(<App/>);` }, bundle: true, write: false,
  platform: "browser", format: "iife", jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' } });
const checks = [];
for (const [engine, type] of [["Chromium", chromium], ["WebKit", webkit]]) {
  const browser = await type.launch({ headless: true });
  try {
    for (const theme of ["atrio", "whatsapp", "page"]) for (const width of [360, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body><div id="root"></div></body></html>`);
      await page.evaluate(({ theme, samples }) => { window.theme = theme; window.samples = samples; }, { theme, samples });
      await page.addScriptTag({ content: bundle.outputFiles[0].text });
      await page.locator('[data-example="incoming-1"] strong').first().waitFor();
      for (const side of ["incoming", "outgoing"]) {
        const credentials = page.locator(`[data-example="${side}-1"]`);
        assert.equal(await credentials.locator("strong").count(), 4);
        assert.equal(await credentials.locator("a").getAttribute("href"), "https://ganamosnet.club/");
        assert.ok(!(await credentials.innerText()).includes("*"));
        const copied = await credentials.evaluate(el => {
          const range = document.createRange();
          range.selectNodeContents(el.querySelector(".chat-message-copyable > span"));
          return range.toString();
        });
        assert.ok(copied.includes("Usuario: jugador123") && copied.includes("Clave: prueba123"));
        const styles = await credentials.locator("strong").first().evaluate(el => ({
          bold: Number(getComputedStyle(el).fontWeight), normal: Number(getComputedStyle(el.parentElement).fontWeight)
        }));
        assert.ok(styles.bold > styles.normal, "Bold must be visible in every theme");
        const combined = page.locator(`[data-example="${side}-2"]`);
        assert.equal(await combined.locator("strong em").count(), 1);
        assert.equal(await combined.locator("em").first().evaluate(el => getComputedStyle(el).fontStyle), "italic");
        assert.ok((await combined.locator("s").evaluate(el => getComputedStyle(el).textDecorationLine)).includes("line-through"));
        const blocks = page.locator(`[data-example="${side}-3"]`);
        assert.equal(await blocks.getByRole("listitem").count(), 4);
        assert.equal(await blocks.locator(".chat-message-quote").count(), 1);
        const code = page.locator(`[data-example="${side}-4"] code`);
        assert.equal(await code.count(), 2);
        assert.equal(await code.locator("strong,a").count(), 0);
        assert.ok((await code.last().innerText()).includes("  espacios\n- *literal*"));
        assert.equal(await page.locator(`[data-example="${side}-6"] img`).count(), 0);
      }
      await page.waitForTimeout(100);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.equal(await page.locator("[data-chat-message-row] > div").evaluateAll(elements => elements.some(el => el.scrollWidth > el.clientWidth + 1)), false);
      await page.evaluate(() => window.updateShort("*Hola, otra vez*"));
      await page.waitForTimeout(100);
      for (const side of ["incoming", "outgoing"]) {
        const short = page.locator(`[data-example="${side}-0"]`);
        assert.equal(await short.locator("strong").innerText(), "Hola, otra vez");
        const [text, meta] = await Promise.all([short.locator("strong").boundingBox(), short.locator("[data-meta]").boundingBox()]);
        assert.ok(text.x + text.width < meta.x || text.y + text.height <= meta.y + 2, "Timestamp must not overlap formatted text");
      }
      if (width === 360) await page.screenshot({ path: fileURLToPath(new URL(`${engine}-${theme}.png`, output)), fullPage: true });
      assert.deepEqual(errors, []);
      checks.push({ engine, theme, width, bothSides: true, formatting: true, links: true, copy: true, noOverflow: true, timestamp: true });
      await page.close();
    }
  } finally { await browser.close(); }
  console.log(JSON.stringify({ engine, passed: checks.filter(row => row.engine === engine).length }));
}
await writeFile(new URL("report.json", output), JSON.stringify({ checks, fixtureOnly: true }, null, 2));
console.log(JSON.stringify({ passed: checks.length, messagesSent: 0 }));
