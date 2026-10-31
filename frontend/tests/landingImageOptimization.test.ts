import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { optimizeLandingImage, MAX_LANDING_IMAGE_OUTPUT_BYTES } from "../lib/landing/optimizeImage.server";
import { handleLandingImageOptimization } from "../lib/landing/imageUploadRoute.server";
import { MAX_LANDING_IMAGE_INPUT_BYTES } from "../lib/landing/imageUploadPolicy";
import { uploadLandingImage } from "../lib/landing/upload";
import type { SupabaseClient } from "@supabase/supabase-js";

test("large transparent raster becomes a bounded WebP without cropping or flattening", async () => {
  const source = await sharp({ create: { width: 2400, height: 1200, channels: 4, background: { r: 230, g: 40, b: 10, alpha: 0.3 } } }).png().toBuffer();
  const result = await optimizeLandingImage(source);
  const meta = await sharp(result.body).metadata();
  assert.equal(result.contentType, "image/webp");
  assert.deepEqual([meta.width, meta.height, meta.hasAlpha], [1920, 960, true]);
  assert.ok(result.body.length < source.length);
  assert.ok(result.body.length <= MAX_LANDING_IMAGE_OUTPUT_BYTES);
  const rgba = await sharp(result.body).raw().toBuffer();
  assert.ok(rgba[3] > 70 && rgba[3] < 85);
});

test("orientation is applied and personal metadata removed", async () => {
  const source = await sharp({ create: { width: 200, height: 100, channels: 3, background: "red" } }).jpeg().withMetadata({ orientation: 6 }).toBuffer();
  const result = await optimizeLandingImage(source);
  const meta = await sharp(result.body).metadata();
  assert.deepEqual([meta.width, meta.height], [100, 200]);
  assert.equal(meta.orientation, undefined);
  assert.equal(meta.exif, undefined);
});

test("small WebP is preserved when recompressing would increase its size", async () => {
  const source = await sharp({ create: { width: 60, height: 60, channels: 3, background: "#563180" } }).webp({ quality: 30 }).toBuffer();
  const result = await optimizeLandingImage(source);
  assert.ok(result.body.length <= source.length);
});

test("AVIF produces a WebP compatible derivative and identifies the original format", async () => {
  const source = await sharp({ create: { width: 80, height: 80, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).avif().toBuffer();
  const result = await optimizeLandingImage(source);
  assert.equal(result.contentType, "image/webp");
  assert.equal(result.originalType, "image/avif");
  assert.equal((await sharp(result.body).metadata()).hasAlpha, true);
});

test("reject SVG, malformed bytes, oversized payloads, animated files and pixel bombs", async () => {
  for (const source of [Buffer.from('<svg width="20" height="20"></svg>'), Buffer.from("not an image"), Buffer.alloc(MAX_LANDING_IMAGE_INPUT_BYTES + 1)]) {
    await assert.rejects(() => optimizeLandingImage(source));
  }
  const large = await sharp({ create: { width: 5001, height: 5000, channels: 3, background: "red" } }).png().toBuffer();
  await assert.rejects(() => optimizeLandingImage(large), /25 megapíxeles/);
  const pixels = Buffer.alloc(4 * 8 * 4, 255);
  pixels.fill(0, pixels.length / 2);
  const animated = await sharp(pixels, { raw: { width: 4, height: 8, channels: 4, pageHeight: 4 } }).webp({ loop: 0, delay: [100, 100] }).toBuffer();
  assert.equal((await sharp(animated, { animated: true }).metadata()).pages, 2);
  await assert.rejects(() => optimizeLandingImage(animated), /animadas/);
});

test("authentication happens before image processing and responses cannot be cached", async () => {
  let decoded = false;
  const request = () => new Request("https://builder.test/api/landing-images/optimize", { method: "POST", headers: { authorization: "Bearer test" }, body: new Uint8Array([1, 2]) });
  const result = await handleLandingImageOptimization(request(), { authenticate: async () => false, optimize: async () => { decoded = true; throw Error("unexpected"); } });
  assert.equal(result.status, 401);
  assert.equal(decoded, false);
  assert.match(result.headers.get("cache-control")!, /no-store/);
  const oversized = new Request(request(), { headers: { authorization: "Bearer test", "content-length": String(MAX_LANDING_IMAGE_INPUT_BYTES + 1) } });
  assert.equal((await handleLandingImageOptimization(oversized, { authenticate: async () => true })).status, 413);
  const chunked = new Request("https://builder.test/api/landing-images/optimize", { method: "POST", headers: { authorization: "Bearer test" }, body: new Uint8Array(MAX_LANDING_IMAGE_INPUT_BYTES + 1) });
  assert.equal((await handleLandingImageOptimization(chunked, { authenticate: async () => true })).status, 413);
});

test("authenticated upload preserves original bytes and only returns the optimized public URL", async () => {
  const source = new File([new Uint8Array([1, 2, 3])], "source.png", { type: "image/png" });
  const uploads: Array<{ path: string; bytes: number[]; options: unknown }> = [];
  const client = { auth: { getSession: async () => ({ data: { session: { user: { id: "owner" }, access_token: "test" } } }) }, storage: { from: () => ({
    upload: async (path: string, blob: Blob, options: unknown) => { uploads.push({ path, bytes: [...new Uint8Array(await blob.arrayBuffer())], options }); return { error: null }; },
    getPublicUrl: (path: string) => ({ data: { publicUrl: `https://storage.test/${path}` } }),
  }) } } as unknown as SupabaseClient;
  const before = globalThis.fetch;
  globalThis.fetch = async () => new Response(new Uint8Array([4, 5]), { headers: { "Content-Type": "image/webp", "X-Image-Extension": "webp", "X-Original-Type": "image/png", "X-Original-Extension": "png" } });
  try {
    const url = await uploadLandingImage(client, "owner", source);
    assert.equal(uploads.length, 2);
    assert.match(uploads[0].path, /^owner\/originals\/.+\.png$/);
    assert.deepEqual(uploads[0].bytes, [1, 2, 3]);
    assert.deepEqual(uploads[1].bytes, [4, 5]);
    assert.equal(url, `https://storage.test/${uploads[1].path}`);
    await assert.rejects(() => uploadLandingImage(client, "another-owner", source), /sesión/);
    assert.equal(uploads.length, 2);
  } finally { globalThis.fetch = before; }
});
