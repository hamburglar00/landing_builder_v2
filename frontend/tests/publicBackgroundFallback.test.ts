import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { renderClassicPublicLandingHtml, renderPublicLandingHtml } from "../components/public-landing/renderPublicLandingHtml";
import { publicImageOriginalUrl, template7ImageUrl } from "../lib/landing/template7Images";
import type { PublicLandingConfig } from "../components/public-landing/types";

const original = "https://fixture.supabase.co/storage/v1/object/public/landing-images/background.png";
function render(template: 4 | 5, source: string, classic = false) {
  const config: PublicLandingConfig = {
    id: "b453a8c5-a91a-4511-ac22-28bcfa4ea97c", schemaVersion: 1, updatedAt: "", name: "Fixture", comment: "",
    tracking: { pixelId: "", postUrl: "", landingTag: "TEST" }, layout: { template, ctaPosition: "bottom" },
    content: { logoUrl: "", title: [], subtitle: [], ctaText: "Continuar",
      [template === 4 ? "template4" : "template5"]: { backgroundImageUrl: source } },
  };
  const params = { slug: "fixture", config };
  return classic ? renderClassicPublicLandingHtml(params, "") : renderPublicLandingHtml(params);
}
const decode = (text: string) => text.replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
function probe(html: string) {
  const element = html.match(/<img\b[^>]*\bdata-background-original="[^"]*"[^>]*>/)?.[0];
  assert.ok(element, "a transformed CSS background has an independent error probe");
  const attribute = (name: string) => {
    const value = element.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`))?.[1];
    assert.notEqual(value, undefined, name);
    return decode(value!);
  };
  return { element, attribute };
}

test("T4/T5 in both engines share the derivative URL and only use the original on failure", () => {
  for (const template of [4, 5] as const) for (const classic of [false, true]) {
    const html = render(template, original, classic), result = probe(html);
    const derivative = template7ImageUrl(original, 1024);
    const property = template === 4 ? "--template4-chat-background-image" : "--template5-background-image";
    assert.equal(result.attribute("src"), derivative);
    assert.equal(result.attribute("data-background-original"), original);
    assert.match(result.element, /\bhidden\b/);
    assert.equal(result.attribute("style"), "display:none");
    assert.ok(decode(html).includes(property + ':url("' + derivative + '")'), "CSS and probe consume the same cached response");
    const requested = [...html.matchAll(/(?:^|\s)(?:src|href)="([^"]*)"/g)].map(match => decode(match[1]));
    assert.equal(requested.filter(url => url === original).length, 0, "success never requests an original as a second image");
    assert.equal(requested.filter(url => url === derivative).length, 2, "preload and hidden probe share one exact resource URL");
    const changes: Array<[string, string]> = [];
    const image = { onerror: () => {}, parentElement: { style: { setProperty: (key: string, value: string) => changes.push([key, value]) } },
      dataset: { backgroundOriginal: result.attribute("data-background-original") } };
    assert.equal(changes.length, 0);
    vm.runInNewContext(`(function(){${result.attribute("onerror")}}).call(image)`, { image });
    assert.deepEqual(changes, [[property, `url(${JSON.stringify(original)})`]]);
    assert.equal(image.onerror, null, "a failed fallback cannot trigger a retry loop");
  }
});

test("untransformed external and signed URLs retain their original CSS without an extra probe", () => {
  for (const source of ["https://images.example.com/background.png", original + "?token=private", "/background.png"]) {
    for (const template of [4, 5] as const) {
      const html = render(template, source);
      assert.doesNotMatch(html, /data-background-original=/);
      assert.ok(decode(html).includes(`url("${source}")`));
    }
  }
});

test("background URL data never becomes executable JavaScript or a second CSS declaration", () => {
  const source = "https://fixture.supabase.co/storage/v1/object/public/landing-images/a');globalThis.pwned=true;('b.png";
  const result = probe(render(4, source));
  assert.doesNotMatch(result.attribute("onerror"), /pwned|supabase|background\.png/);
  const changes: Array<[string, string]> = [];
  const context = { pwned: false, image: { onerror: () => {}, dataset: { backgroundOriginal: result.attribute("data-background-original") },
    parentElement: { style: { setProperty: (key: string, value: string) => changes.push([key, value]) } } } };
  vm.runInNewContext(`(function(){${result.attribute("onerror")}}).call(image)`, context);
  assert.equal(context.pwned, false);
  assert.deepEqual(changes, [["--template4-chat-background-image", `url(${JSON.stringify(publicImageOriginalUrl(source))})`]]);
});
