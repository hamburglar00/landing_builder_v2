import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { buildPublicLandingRuntimeSource } from "../components/public-landing/PublicLandingRuntimeScript";
import { buildTemplate7FastRuntime } from "../components/public-landing/template7FastRuntime";
import type { PublicLandingConfig } from "../components/public-landing/types";

const originals = ["https://images.example/first.png", "https://images.example/second.png"];
const derivatives = ["https://images.example/first-small.webp", "https://images.example/second-small.webp"];
const variants = originals.map((original, index) => ({ original, srcSet: derivatives[index] + " 640w" }));
const config: PublicLandingConfig = { schemaVersion: 1, updatedAt: "", id: "fixture", name: "Fixture", comment: "",
  layout: { template: 7, ctaPosition: "bottom" }, tracking: { pixelId: "", postUrl: "", landingTag: "TEST" } };

// Execute the actual generated rotation program with controlled DOM/network
// outcomes. Other runtime concerns (Meta, account entry) are deliberately absent.
function rotationProgram(source: string) {
  const start = source.indexOf("function parseImages(value)"), end = source.indexOf("function renderSocialProof(", start);
  assert.ok(start >= 0 && end > start);
  return source.slice(start, end) + "\ninitRotatingBackgrounds();";
}

function fixture(program: string, options: { alreadyRecovered?: boolean; missingSecondFallback?: boolean; mobile?: boolean } = {}) {
  const attributes = new Map<string, string>([
    ["src", options.alreadyRecovered ? originals[0] : derivatives[0]], ["srcset", options.alreadyRecovered ? "" : variants[0].srcSet],
    ["data-image-fallback", originals[0]], ["data-public-landing-images", JSON.stringify(derivatives)],
    ["data-public-landing-rotate-hours", "1"],
    ["data-template7-background-variants", JSON.stringify(options.missingSecondFallback ? [variants[0]] : variants)],
  ]);
  const mobileAttributes = new Map([["srcset", derivatives[0]]]);
  const mobile = { setAttribute: (key: string, value: string) => mobileAttributes.set(key, value), removeAttribute: (key: string) => mobileAttributes.delete(key) };
  const writes: Array<[string, string]> = [], intervals: Array<() => void> = [];
  const image: { onerror: (() => void) | null; [key: string]: any } = {
    onerror: null,
    getAttribute: (key: string) => attributes.get(key) ?? null,
    setAttribute: (key: string, value: string) => { writes.push([key, value]); attributes.set(key, value); },
    removeAttribute: (key: string) => attributes.delete(key),
    parentElement: { querySelector: () => options.mobile ? mobile : null },
  };
  const context = { document: { querySelectorAll: (selector: string) => selector === "[data-public-landing-rotating-image]" ? [image] : [] },
    window: { setInterval: (callback: () => void) => { intervals.push(callback); return intervals.length; } }, Date: { now: () => 0 } };
  vm.runInNewContext(program, context);
  return { image, attributes, mobileAttributes, writes, rotate: () => intervals[0]() };
}

for (const [variant, source] of [
  ["T1–T6", buildPublicLandingRuntimeSource()],
  ["T7 constructor", buildTemplate7FastRuntime("fixture", config)],
  ["T7 classic", buildTemplate7FastRuntime("fixture", config, "function getOrCreateDeviceId(){return 'fixture';}")],
] as const) {
  const program = rotationProgram(source);
  test(variant + ": preserves original recovered before the runtime, then rearms each new index", () => {
    const f = fixture(program, { alreadyRecovered: true, mobile: true });
    assert.equal(f.attributes.get("src"), originals[0]);
    assert.equal(f.image.onerror, null);
    assert.ok(!f.writes.some(([key, value]) => key === "src" && value === derivatives[0]), "late runtime must not undo the inline recovery");
    assert.equal(f.attributes.has("srcset"), false);
    assert.equal(f.mobileAttributes.has("srcset"), false);
    f.rotate();
    assert.equal(f.attributes.get("src"), derivatives[1]);
    assert.equal(f.mobileAttributes.get("srcset"), derivatives[1]);
    assert.equal(typeof f.image.onerror, "function");
    f.image.onerror!();
    assert.equal(f.attributes.get("src"), originals[1]);
    assert.equal(f.image.onerror, null, "an unavailable original never starts an error loop");
    assert.equal(f.attributes.has("srcset"), false);
    assert.equal(f.mobileAttributes.has("srcset"), false);
    f.rotate();
    assert.equal(f.attributes.get("src"), originals[0]);
    f.rotate();
    assert.equal(f.attributes.get("src"), originals[1]);
    assert.equal(f.writes.filter(([key, value]) => key === "src" && value === derivatives[1]).length, 1,
      "this document remembers the failed derivative instead of downloading it at every rotation");
  });

  test(variant + ": successful sources never request originals; failure remains bounded to its own source", () => {
    const f = fixture(program);
    assert.equal(f.attributes.get("src"), derivatives[0]);
    f.rotate();
    assert.equal(f.attributes.get("src"), derivatives[1]);
    assert.ok(!f.writes.some(([key, value]) => key === "src" && originals.includes(value)));
    f.image.onerror!();
    assert.equal(f.attributes.get("src"), originals[1]);
    f.rotate();
    assert.equal(f.attributes.get("src"), derivatives[0], "another source's failure does not demote a successful derivative");
    assert.equal(typeof f.image.onerror, "function");
  });
}

test("legacy variant metadata cannot reuse another image's fallback after changing index", () => {
  const f = fixture(rotationProgram(buildPublicLandingRuntimeSource()), { missingSecondFallback: true });
  f.rotate();
  assert.equal(f.attributes.get("data-image-fallback"), "");
  f.image.onerror!();
  assert.equal(f.attributes.get("src"), derivatives[1]);
  assert.equal(f.image.onerror, null);
});

test("browser: CSS and rotating backgrounds recover with bounded real image requests", {
  skip: process.env.RUN_PUBLIC_IMAGE_BROWSER !== "1", timeout: 60000,
}, async () => {
  const { createServer } = await import("node:http");
  const { chromium } = await import("playwright");
  const { renderClassicPublicLandingHtml, renderPublicLandingHtml } = await import("../components/public-landing/renderPublicLandingHtml");
  const imageBytes = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><rect width="2" height="2" fill="red"/></svg>');
  let html = "", failDerivative = false, failOriginal = false;
  const requests = new Map<string, number>();
  const server = createServer((req, res) => {
    const path = new URL(req.url || "/", "http://localhost").pathname;
    if (path === "/fixture") { res.writeHead(200, { "Content-Type": "text/html" }); res.end(html); return; }
    if (!path.startsWith("/storage/")) { res.writeHead(204); res.end(); return; }
    requests.set(path, (requests.get(path) || 0) + 1);
    const failed = path.includes("/render/") ? failDerivative : failOriginal;
    res.writeHead(failed ? 404 : 200, { "Content-Type": failed ? "text/plain" : "image/svg+xml", "Cache-Control": "public, max-age=3600" });
    res.end(failed ? "unavailable" : imageBytes);
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address(); assert.ok(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`;
  const browser = await chromium.launch({ headless: true });
  const scenarios = [
    { template: 4, classic: false, fail: false }, { template: 4, classic: true, fail: true },
    { template: 5, classic: true, fail: false }, { template: 5, classic: false, fail: true },
    { template: 1, classic: false, fail: true }, { template: 2, classic: true, fail: true },
    { template: 7, classic: false, fail: true }, { template: 1, classic: true, fail: true, originalFails: true },
  ];
  const results: Array<Record<string, unknown>> = [];
  try {
    for (const [index, scenario] of scenarios.entries()) {
      requests.clear(); failDerivative = scenario.fail; failOriginal = scenario.originalFails === true;
      const now = Date.now(), paths = [`case-${index}-first.gif`, `case-${index}-second.gif`];
      const urls = paths.map(path => "https://fixture.supabase.co/storage/v1/object/public/landing-images/" + path);
      const config: PublicLandingConfig = {
        schemaVersion: 1, updatedAt: "", id: "b453a8c5-a91a-4511-ac22-28bcfa4ea97c", name: "Fixture", comment: "",
        tracking: { pixelId: "", postUrl: "", landingTag: "TEST" }, layout: { template: scenario.template, ctaPosition: "bottom" },
        background: { mode: "rotating", images: urls, rotateEveryHours: 1 },
        content: { logoUrl: "", title: ["Fixture"], subtitle: [""], ctaText: "Continuar",
          template4: { backgroundImageUrl: urls[0] }, template5: { backgroundImageUrl: urls[0] } },
      };
      const params = { slug: "fixture", config };
      html = (scenario.classic ? renderClassicPublicLandingHtml(params, "function getOrCreateDeviceId(){return 'fixture';}") : renderPublicLandingHtml(params))
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<link\b[^>]*>/g, tag => /rel="preload" as="image"/.test(tag) ? tag : "")
        .replaceAll("https://fixture.supabase.co", origin)
        .replace("</head>", '<style>.template4__phone{background-image:var(--template4-chat-background-image)}.template5__phone{background-image:var(--template5-background-image)}</style></head>');
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
      try {
        await context.addInitScript(`Date.now=function(){return ${now}};`);
        const page = await context.newPage();
        await page.goto(origin + "/fixture", { waitUntil: "load" });
        if (scenario.template === 4 || scenario.template === 5) {
          const selector = `.template${scenario.template}__phone`;
          await page.waitForFunction(({ selector, failed }) => getComputedStyle(document.querySelector(selector)!).backgroundImage.includes(failed ? "/object/" : "/render/"),
            { selector, failed: scenario.fail }, { timeout: 3000 });
          const originalCount = [...requests].filter(([path]) => path.includes("/object/")).reduce((sum, [, count]) => sum + count, 0);
          assert.equal(originalCount, scenario.fail ? 1 : 0);
          if (!scenario.fail) assert.equal([...requests.values()].reduce((sum, count) => sum + count, 0), 1,
            "CSS, preload and hidden probe reuse one HTTP image response");
        } else {
          const imageSelector = "[data-public-landing-rotating-image]";
          await page.waitForFunction(selector => {
            const image = document.querySelector<HTMLImageElement>(selector);
            return image?.src.includes("/object/") && image.complete;
          }, imageSelector, { timeout: 3000 });
          const firstOriginal = await page.locator(imageSelector).getAttribute("src");
          const before = [...requests.values()].reduce((sum, count) => sum + count, 0);
          await page.evaluate(() => { window.setInterval = ((callback: () => void) => { (window as any).__imageRotation = callback; return 1; }) as typeof window.setInterval; });
          const source = scenario.template === 7 ? buildTemplate7FastRuntime("fixture", config) : buildPublicLandingRuntimeSource();
          await page.addScriptTag({ content: rotationProgram(source) });
          assert.equal(await page.locator(imageSelector).getAttribute("src"), firstOriginal);
          assert.equal([...requests.values()].reduce((sum, count) => sum + count, 0), before);
          await page.evaluate(() => (window as any).__imageRotation());
          await page.waitForFunction(({ selector, previous, originalFails }) => {
            const image = document.querySelector<HTMLImageElement>(selector);
            return image?.src.includes("/object/") && image.src !== previous && image.complete && (originalFails || image.naturalWidth > 0);
          }, { selector: imageSelector, previous: firstOriginal, originalFails: scenario.originalFails === true }, { timeout: 3000 }).catch(async error => {
            console.error(JSON.stringify({ scenario, requests: [...requests], image: await page.locator(imageSelector).evaluate(image => {
              const element = image as HTMLImageElement;
              return { src: element.src, currentSrc: element.currentSrc, srcset: element.srcset, complete: element.complete, width: element.naturalWidth, handler: typeof element.onerror };
            }) }));
            throw error;
          });
          if (!scenario.originalFails) assert.ok(await page.locator(imageSelector).evaluate(image => (image as HTMLImageElement).naturalWidth > 0),
            "the original is decoded; responsive density can scale its intrinsic dimensions");
          await page.evaluate(() => (window as any).__imageRotation());
          assert.equal(await page.locator(imageSelector).getAttribute("src"), firstOriginal);
          assert.ok([...requests.values()].every(count => count <= 3), "failed originals/derivatives cannot create a request loop");
        }
        results.push({ template: scenario.template, engine: scenario.classic ? "classic" : "constructor", failedDerivative: scenario.fail,
          failedOriginal: scenario.originalFails === true, imageRequests: [...requests.values()].reduce((sum, count) => sum + count, 0) });
      } finally { await context.close(); }
    }
    console.log(JSON.stringify({ publicImageBrowser: "passed", scenarios: results }));
  } finally {
    await browser.close();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
