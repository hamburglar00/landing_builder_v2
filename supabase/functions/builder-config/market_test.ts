import {
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

import {
  phoneCountryCodeForMarket,
  phoneCountryCodeForWorkspace,
} from "./market.ts";

Deno.test("usa Paraguay cuando la landing circula en PY", () => {
  assertEquals(phoneCountryCodeForMarket("PY"), "595");
  assertEquals(phoneCountryCodeForMarket("py"), "595");
});

Deno.test("conserva Argentina para landings existentes o valores invalidos", () => {
  assertEquals(phoneCountryCodeForMarket("AR"), "54");
  assertEquals(phoneCountryCodeForMarket(""), "54");
  assertEquals(phoneCountryCodeForMarket(undefined), "54");
});

Deno.test("usa el workspace para publicar el prefijo telefonico operativo", () => {
  assertEquals(phoneCountryCodeForWorkspace("ARS"), "54");
  assertEquals(phoneCountryCodeForWorkspace("PYG"), "595");
  assertEquals(phoneCountryCodeForWorkspace(""), "54");
});
