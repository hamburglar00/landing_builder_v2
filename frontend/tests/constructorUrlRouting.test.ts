import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { proxy } from "../proxy";

const request = (path: string, host = "builder.example") =>
  new NextRequest(`https://${host}${path}`, { headers: { host } });

test("constructor query takes precedence on public entry points and retains all attribution", async () => {
  const query = "landing=bianca2&campana=A%20%26%20B&conjunto=%C3%91&anuncio=7&utm_campaign=legacy&fbclid=click&repeated=1&repeated=2";
  for (const path of ["/", "/l", "/l/", "/l/old", "/l/old/", "/l/bianca2"]) {
    const input = request(`${path}?${query}`);
    const response = await proxy(input);
    const destination = new URL(response.headers.get("x-middleware-rewrite")!);
    assert.equal(destination.origin, input.nextUrl.origin);
    assert.equal(destination.pathname.replace(/\/$/, ""), "/l/bianca2");
    assert.equal(destination.search, input.nextUrl.search);
    assert.equal(response.headers.get("location"), null);
  }
});

test("missing and blank selection preserve existing entry routes", async () => {
  for (const path of ["/", "/?landing=", "/l", "/l/direct", "/l/direct?landing=", "/l/direct?landing=%20"]) {
    const response = await proxy(request(path));
    assert.equal(response.headers.get("x-middleware-rewrite"), null);
    assert.equal(response.headers.get("x-middleware-next"), "1");
  }
});

test("selection cannot rewrite panel, API, assets, promotions or nested public routes", async () => {
  for (const path of ["/login", "/admin", "/dashboard", "/api/track", "/public-assets/landing-runtime-v3.js", "/_next/static/app.js", "/favicon.ico", "/promo/example", "/w/token", "/l/old/extra", "/privacy-policy"]) {
    const response = await proxy(request(`${path}?landing=bianca2`));
    assert.equal(response.headers.get("x-middleware-rewrite"), null, path);
    assert.equal(response.headers.get("x-middleware-next"), "1", path);
  }
});

test("malformed and duplicate landing selections return 404 instead of falling back", async () => {
  for (const query of ["landing=a&landing=b", "landing=&landing=", "landing=https://evil.test", "landing=../x", "landing=%2fapi", "landing=..", "landing=.", "landing=%252fapi", "landing=a%5Cb", "landing=a%00b", "landing=a%3Fb", "landing=a%23b", `landing=${"a".repeat(161)}`]) {
    for (const path of ["/", "/l/old"]) {
      const response = await proxy(request(`${path}?${query}`));
      assert.equal(response.status, 404, query);
      assert.equal(response.headers.get("x-middleware-rewrite"), null);
    }
  }
});

test("promotion host restriction is enforced before landing selection", async () => {
  const configured = process.env.NEXT_PUBLIC_PROMOTIONS_PUBLIC_BASE_URL;
  const host = configured ? new URL(configured).host : "sorteosgolden.vercel.app";
  for (const path of ["/?landing=bianca2", "/l/old?landing=bianca2"]) {
    assert.equal((await proxy(request(path, host))).status, 404);
  }
  assert.equal((await proxy(request("/promo/fixture?landing=bianca2", host))).headers.get("x-middleware-next"), "1");
  assert.equal((await proxy(request("/l/asset.png?landing=bianca2", host))).headers.get("x-middleware-rewrite"), null);
});

test("landing names are trimmed and encoded as one public path segment", async () => {
  const response = await proxy(request("/?landing=%20Pe%C3%B1a%20Norte%20"));
  assert.equal(new URL(response.headers.get("x-middleware-rewrite")!).pathname, "/l/Pe%C3%B1a%20Norte");
});
