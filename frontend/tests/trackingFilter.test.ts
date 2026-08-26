import assert from "node:assert/strict";
import test from "node:test";

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
