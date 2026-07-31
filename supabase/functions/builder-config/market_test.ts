import {
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

import { phoneCountryCodeForMarket } from "./market.ts";

Deno.test("usa Paraguay cuando la landing circula en PY", () => {
  assertEquals(phoneCountryCodeForMarket("PY"), "595");
  assertEquals(phoneCountryCodeForMarket("py"), "595");
});

Deno.test("conserva Argentina para landings existentes o valores inválidos", () => {
  assertEquals(phoneCountryCodeForMarket("AR"), "54");
  assertEquals(phoneCountryCodeForMarket(""), "54");
  assertEquals(phoneCountryCodeForMarket(undefined), "54");
});
