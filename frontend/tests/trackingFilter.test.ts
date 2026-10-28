import assert from "node:assert/strict";
import test from "node:test";
import { trackingFilterOptions } from "../components/conversiones/trackingFilter";

test("identifica píxeles por comentario sin cambiar el ID usado para filtrar", () => {
  const pixels = [
    { pixel_id: "123", comment: " Facebook de Diana " },
    { pixel_id: "456", comment: " " },
    { pixel_id: "789", comment: null },
  ];
  assert.deepEqual(trackingFilterOptions(["123", "456", "789"], "pixel", pixels), [
    { value: "123", label: "123 (Facebook de Diana)" },
    { value: "456", label: "456" },
    { value: "789", label: "789" },
  ]);
  assert.deepEqual(trackingFilterOptions(["123"], "dataset", pixels), [{ value: "123", label: "123" }]);
});

test("usa Dataset para WhatsApp Cloud API y Pixel para Landing", async () => {
  const {
    trackingFilterAllLabel,
    trackingFilterKindForSource,
    trackingFilterLabel,
    trackingFilterValue,
  } = await import("../components/conversiones/trackingFilter");

  const whatsappKind = trackingFilterKindForSource("whatsapp_cloud_api");
  const landingKind = trackingFilterKindForSource("landing");

  assert.equal(whatsappKind, "dataset");
  assert.equal(trackingFilterLabel(whatsappKind), "Dataset");
  assert.equal(trackingFilterAllLabel(whatsappKind), "Todos los datasets");
  assert.equal(
    trackingFilterValue({ meta_pixel_id: "123", pixel_id: "456", dataset_id: "789" }, whatsappKind),
    "789",
  );

  assert.equal(landingKind, "pixel");
  assert.equal(trackingFilterLabel(landingKind), "Pixel");
  assert.equal(trackingFilterAllLabel(landingKind), "Todos los pixeles");
  assert.equal(
    trackingFilterValue({ meta_pixel_id: "123", pixel_id: "456", dataset_id: "789" }, landingKind),
    "123",
  );
});
