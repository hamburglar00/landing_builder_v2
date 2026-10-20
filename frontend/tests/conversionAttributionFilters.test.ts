import assert from "node:assert/strict";
import test from "node:test";
import {
  conversionAttributionOptions,
  journeyStartAttribution,
  matchesConversionAttributionFilters,
} from "../components/conversiones/attributionFilters";

test("campaign options include both columns, without blanks or duplicates", () => {
  assert.deepEqual(conversionAttributionOptions([
    { campana: " Actual ", utm_campaign: "Anterior", conjunto: " Grupo 1 ", anuncio: " Video " },
    { campana: "Anterior", utm_campaign: " Actual ", conjunto: "Grupo 1", anuncio: "Imagen" },
    { campana: null, utm_campaign: "  ", conjunto: "", anuncio: null },
    {},
  ]), {
    campaigns: ["Actual", "Anterior"],
    adSets: ["Grupo 1"],
    ads: ["Imagen", "Video"],
  });
});

test("campaign matches campana or legacy utm_campaign, even when both differ", () => {
  const rows = [
    { campana: "Octubre", utm_campaign: "Anterior" },
    { campana: "", utm_campaign: " Octubre " },
    { campana: " Octubre ", utm_campaign: "" },
    { campana: "Noviembre", utm_campaign: "Otra" },
  ];
  assert.deepEqual(rows.map((row) => matchesConversionAttributionFilters(row, ["Octubre"], [], [])), [true, true, true, false]);
  assert.equal(matchesConversionAttributionFilters(rows[0], ["Anterior"], [], []), true);
});

test("multiple values in one filter are alternatives and matching is exact", () => {
  const row = { campana: "Octubre", conjunto: "Grupo 1", anuncio: "Video 1" };
  assert.equal(matchesConversionAttributionFilters(row, ["Otra", "Octubre"], ["Grupo 2", "Grupo 1"], ["Video 2", "Video 1"]), true);
  assert.equal(matchesConversionAttributionFilters(row, ["Oct"], [], []), false);
  assert.equal(matchesConversionAttributionFilters(row, [], ["Grupo"], []), false);
  assert.equal(matchesConversionAttributionFilters(row, [], [], ["Video"]), false);
});

test("ad set and ad work independently and combine with campaign using AND", () => {
  const rows = [
    { campana: "Octubre", conjunto: " Grupo 1 ", anuncio: " Video " },
    { utm_campaign: "Octubre", conjunto: "Grupo 2", anuncio: "Video" },
    { campana: "Octubre", conjunto: "Grupo 1", anuncio: "Imagen" },
    { campana: "Otra", conjunto: "Grupo 1", anuncio: "Video" },
  ];
  const matchingIndexes = (campaigns: string[], adSets: string[], ads: string[]) => rows.flatMap(
    (row, index) => matchesConversionAttributionFilters(row, campaigns, adSets, ads) ? [index] : [],
  );
  assert.deepEqual(matchingIndexes([], ["Grupo 1"], []), [0, 2, 3]);
  assert.deepEqual(matchingIndexes([], [], ["Video"]), [0, 1, 3]);
  assert.deepEqual(matchingIndexes(["Octubre"], ["Grupo 1"], ["Video"]), [0]);
  assert.deepEqual(matchingIndexes(["Inexistente"], ["Grupo 1"], ["Video"]), []);
});

test("empty filters include legacy rows; missing attribution fails an active filter", () => {
  assert.equal(matchesConversionAttributionFilters({}, [], [], []), true);
  assert.equal(matchesConversionAttributionFilters({}, ["Octubre"], [], []), false);
  assert.equal(matchesConversionAttributionFilters({ utm_campaign: "Octubre" }, ["Octubre"], [], []), true);
  assert.equal(matchesConversionAttributionFilters({ utm_campaign: "Octubre" }, [], ["Grupo 1"], []), false);
  assert.equal(matchesConversionAttributionFilters({ utm_campaign: "Octubre" }, [], [], ["Video"]), false);
});

test("journey starts retain link attribution for the same global filters", () => {
  const row = journeyStartAttribution({
    utm_campaign: "Anterior",
    event_source_url: "https://landing.example/l/demo?campana=Octubre&conjunto=Grupo+1&anuncio=Video%20%C3%BAnico&utm_campaign=Otra",
  });
  assert.deepEqual(row, { campana: "Octubre", utm_campaign: "Anterior", conjunto: "Grupo 1", anuncio: "Video único" });
  assert.equal(matchesConversionAttributionFilters(row, ["Octubre"], ["Grupo 1"], ["Video único"]), true);
  assert.equal(matchesConversionAttributionFilters(row, ["Anterior"], [], []), true);
});

test("invalid or missing journey URL does not break legacy UTM filtering", () => {
  for (const event_source_url of [undefined, null, "", "not a URL"]) {
    const row = journeyStartAttribution({ utm_campaign: " Anterior ", event_source_url });
    assert.equal(matchesConversionAttributionFilters(row, ["Anterior"], [], []), true);
    assert.equal(matchesConversionAttributionFilters(row, [], ["Grupo 1"], []), false);
  }
});
