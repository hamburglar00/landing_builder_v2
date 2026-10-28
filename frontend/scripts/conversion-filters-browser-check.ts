import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import postcss from "postcss";
import tailwindcss from "@tailwindcss/postcss";

// Exercise the real modal, filter state and matching in an isolated browser fixture.
// No application session or database access is needed.
async function main() {
  const root = process.cwd();
  const bundle = await build({
    absWorkingDir: root,
    tsconfig: path.join(root, "tsconfig.json"),
    jsx: "automatic",
    stdin: {
      resolveDir: root,
      loader: "tsx",
      contents: `
        import { createRoot } from "react-dom/client";
        import ConversionFiltersModal from "./components/conversiones/ConversionFiltersModal";
        import { useConversionStatsFilters } from "./components/conversiones/useConversionStatsFilters";
        import { conversionAttributionOptions, matchesConversionAttributionFilters } from "./components/conversiones/attributionFilters";
        const rows = [
          { id: 1, from_meta_ads: true, facebook: "Cuenta A", campana: "Octubre", utm_campaign: "Anterior", conjunto: "Grupo 1", anuncio: "Video" },
          { id: 2, from_meta_ads: true, facebook: "Cuenta B", utm_campaign: "Octubre", conjunto: "Grupo 2", anuncio: "Video" },
          { id: 3, from_meta_ads: true, facebook: "Cuenta B", campana: "Octubre", conjunto: "Grupo 1", anuncio: "Imagen" },
          { id: 4, from_meta_ads: true, facebook: "Cuenta A", campana: "Otra", conjunto: "Grupo 1", anuncio: "Video" },
          { id: 5, from_meta_ads: false },
        ];
        const attributionOptions = conversionAttributionOptions(rows);
        function Fixture() {
          const f = useConversionStatsFilters();
          return <>
            <button id="open" onClick={f.openStatsFilterModal}>Aplicar filtros</button>
            <button id="clear" onClick={f.clearAllStatsFilters}>Limpiar filtros</button>
            <output id="results">{JSON.stringify({
              ids: rows.filter(row => (f.statsFromMetaAdsFilter === "__all__" || row.from_meta_ads === (f.statsFromMetaAdsFilter === "true")) && matchesConversionAttributionFilters(row, f.statsCampaignFilter, f.statsAdSetFilter, f.statsAdFilter, f.statsFacebookFilter)).map(row => row.id),
              count: f.statsFiltersCount, applied: f.hasStatsFiltersApplied,
            })}</output>
            {f.statsFilterModalOpen && <ConversionFiltersModal title="Filtros" draft={{
              landing: f.draftLandingFilter, pixel: f.draftPixelFilter, gerencia: f.draftGerenciaFilter,
              phone: f.draftTelefonoFilter, fromMetaAds: f.draftFromMetaAdsFilter,
              sourcePlatform: f.draftSourcePlatformFilter, sex: f.draftSexoFilter,
              facebook: f.draftFacebookFilter,
              campaigns: f.draftCampaignFilter, adSets: f.draftAdSetFilter, ads: f.draftAdFilter,
            }} options={{
              landings: [], pixels: [], gerencias: [], phones: [], sourcePlatforms: [], sexes: [], ...attributionOptions,
            }} onChange={{
              landing: f.setDraftLandingFilter, pixel: f.setDraftPixelFilter, gerencia: f.setDraftGerenciaFilter,
              phone: f.setDraftTelefonoFilter, fromMetaAds: f.setDraftFromMetaAdsFilter,
              sourcePlatform: f.setDraftSourcePlatformFilter, sex: f.setDraftSexoFilter,
              facebook: f.setDraftFacebookFilter,
              campaigns: f.setDraftCampaignFilter, adSets: f.setDraftAdSetFilter, ads: f.setDraftAdFilter,
            }} onClose={() => f.setStatsFilterModalOpen(false)} onApply={f.applyStatsFilters} />}
          </>;
        }
        createRoot(document.getElementById("root")).render(<Fixture />);
      `,
    },
    bundle: true, write: false, platform: "browser", format: "iife",
    define: { "process.env.NODE_ENV": '"production"' },
  });
  const cssPath = path.join(root, "app/globals.css");
  const css = await postcss([tailwindcss()]).process(await readFile(cssPath, "utf8"), { from: cssPath });
  const html = `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css.css}</style><div id="root"></div><script>${bundle.outputFiles[0].text.replaceAll("</script", "<\\/script")}</script>`;
  const { chromium } = await import(pathToFileURL(path.resolve(root, "../scripts/phase0/browser-runtime.mjs")).href);
  const browser = await chromium();
  const errors: string[] = [];
  browser.on("Runtime.exceptionThrown", (event: { exceptionDetails: { text: string; exception?: { description?: string } } }) => {
    errors.push(event.exceptionDetails.exception?.description || event.exceptionDetails.text);
  });
  await browser.send("Runtime.enable");
  await browser.send("Fetch.enable", { patterns: [{ urlPattern: "*" }] });
  browser.on("Fetch.requestPaused", (event: { requestId: string; resourceType: string }) => {
    void browser.send("Fetch.fulfillRequest", {
      requestId: event.requestId, responseCode: 200,
      responseHeaders: [{ name: "Content-Type", value: "text/html" }],
      body: Buffer.from(event.resourceType === "Document" ? html : "").toString("base64"),
    });
  });
  const evaluate = async (expression: string) => {
    const response = await browser.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (response.exceptionDetails) {
      throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
    }
    return response.result.value;
  };
  const pause = () => new Promise((resolve) => setTimeout(resolve, 40));
  const click = async (selector: string) => {
    const point = await evaluate(`(() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      if (!element) throw new Error("Missing element: " + ${JSON.stringify(selector)});
      element.scrollIntoView({ block: "center" });
      const rect = element.getBoundingClientRect();
      const x = rect.x + rect.width / 2, y = rect.y + rect.height / 2;
      if (!element.contains(document.elementFromPoint(x, y))) throw new Error("Element is obscured: " + ${JSON.stringify(selector)});
      return { x, y };
    })()`);
    await browser.send("Input.dispatchMouseEvent", { type: "mousePressed", ...point, button: "left", clickCount: 1 });
    await browser.send("Input.dispatchMouseEvent", { type: "mouseReleased", ...point, button: "left", clickCount: 1 });
    await pause();
  };
  const select = async (id: string, label: string) => {
    await click(`#${id}`);
    await evaluate(`(() => {
      const field = document.getElementById(${JSON.stringify(id)}).parentElement;
      const options = [...field.querySelectorAll("button[aria-pressed]")];
      const option = options.find(element => element.textContent.trim() === ${JSON.stringify(label)});
      if (!option) throw new Error("Missing option");
      option.id = "fixture-option";
    })()`);
    await click("#fixture-option");
    await click(`#${id}`);
  };
  const result = () => evaluate('JSON.parse(document.getElementById("results").textContent)');
  const selectMetaOrigin = async (label: string) => {
    await click("#conversion-filter-meta-origin");
    await evaluate(`(() => {
      const option = [...document.querySelectorAll('[role="option"]')].find(element => element.textContent.trim() === ${JSON.stringify(label)});
      if (!option) throw new Error("Missing Meta origin option");
      option.id = "fixture-meta-origin";
    })()`);
    await click("#fixture-meta-origin");
  };
  const visibleAdFilters = () => evaluate(`['facebook','campaign','ad-set','ad'].filter(key => document.getElementById('conversion-filter-' + key))`);
  try {
    for (const [width, height] of [[1365, 900], [390, 844], [844, 390]]) {
      await browser.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 900 });
      await browser.send("Page.navigate", { url: `https://conversion-filters.test/${width}` });
      for (let attempt = 0; attempt < 100; attempt++) {
        if (await evaluate('!!document.getElementById("open")')) break;
        assert.deepEqual(errors, []);
        await pause();
      }
      assert.deepEqual(await result(), { ids: [1, 2, 3, 4, 5], count: 0, applied: false });
      await click("#open");
      assert.deepEqual(await visibleAdFilters(), []);
      await selectMetaOrigin("Si");
      assert.deepEqual(await visibleAdFilters(), ["facebook", "campaign", "ad-set", "ad"]);
      assert.deepEqual(await evaluate(`Array.from(document.querySelectorAll('label[for^="conversion-filter-"]')).map(label => label.htmlFor).slice(-5)`), ["conversion-filter-facebook", "conversion-filter-campaign", "conversion-filter-ad-set", "conversion-filter-ad", "conversion-filter-sex"]);
      await select("conversion-filter-facebook", "Cuenta A");
      await select("conversion-filter-campaign", "Octubre");
      await select("conversion-filter-ad-set", "Grupo 1");
      await select("conversion-filter-ad", "Video");
      assert.equal((await result()).count, 0, "Draft edits must wait for Guardar");
      await click("footer .ui-button-primary");
      assert.deepEqual(await result(), { ids: [1], count: 5, applied: true });
      await click("#open");
      assert.match(await evaluate('document.getElementById("conversion-filter-ad-set").textContent'), /Grupo 1/);
      assert.match(await evaluate('document.getElementById("conversion-filter-ad").textContent'), /Video/);
      await select("conversion-filter-ad", "Imagen");
      await selectMetaOrigin("No");
      assert.deepEqual(await visibleAdFilters(), []);
      await click("footer .ui-button-secondary");
      assert.deepEqual(await result(), { ids: [1], count: 5, applied: true }, "Closing discards draft edits, including hidden ad filters");
      await click("#open");
      assert.match(await evaluate('document.getElementById("conversion-filter-ad").textContent'), /Video/);
      assert.match(await evaluate('document.getElementById("conversion-filter-facebook").textContent'), /Cuenta A/);
      await selectMetaOrigin("No");
      await click("footer .ui-button-primary");
      assert.deepEqual(await result(), { ids: [5], count: 1, applied: true }, "No must remove every hidden ad filter");
      await click("#open");
      assert.deepEqual(await visibleAdFilters(), []);
      await selectMetaOrigin("Si");
      assert.match(await evaluate('document.getElementById("conversion-filter-facebook").textContent'), /Todos/);
      assert.match(await evaluate('document.getElementById("conversion-filter-campaign").textContent'), /Todas/);
      await select("conversion-filter-facebook", "Cuenta B");
      await click("footer .ui-button-primary");
      assert.deepEqual(await result(), { ids: [2, 3], count: 2, applied: true }, "Facebook independently filters conversion rows");
      await click("#open");
      await selectMetaOrigin("Todos");
      assert.deepEqual(await visibleAdFilters(), []);
      await click("footer .ui-button-primary");
      assert.deepEqual(await result(), { ids: [1, 2, 3, 4, 5], count: 0, applied: false }, "Todos must remove hidden ad filters");
      await click("#open");
      await selectMetaOrigin("Si");
      await select("conversion-filter-facebook", "Cuenta A");
      await click("footer .ui-button-primary");
      await click("#clear");
      assert.deepEqual(await result(), { ids: [1, 2, 3, 4, 5], count: 0, applied: false });
      await click("#open");
      assert.deepEqual(await visibleAdFilters(), []);
      await selectMetaOrigin("Si");
      await select("conversion-filter-campaign", "Anterior");
      await click("footer .ui-button-primary");
      assert.deepEqual(await result(), { ids: [1], count: 2, applied: true }, "Legacy campaign remains selectable alongside campana");
      console.log(`PASS ${width}x${height}: conditional ad filters, Facebook, order, draft, apply, reopen, cancel, No/Todos cleanup, clear, legacy campaign`);
    }
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
