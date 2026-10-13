import {
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { targetProviderForTemplate7 } from "./provider.ts";

Deno.test("preserves every supported Template 7 provider", () => {
  assertEquals(
    targetProviderForTemplate7({ targetProvider: "rey_de_ases" }),
    "rey_de_ases",
  );
  assertEquals(
    targetProviderForTemplate7({ targetProvider: "multi_skin" }),
    "multi_skin",
  );
  assertEquals(
    targetProviderForTemplate7({ targetProvider: "ases_del_norte" }),
    "ases_del_norte",
  );
  assertEquals(
    targetProviderForTemplate7({ targetProvider: "ganamos_net" }),
    "ganamos_net",
  );
});

Deno.test("keeps Rey de Ases as the legacy fallback", () => {
  assertEquals(targetProviderForTemplate7({}), "rey_de_ases");
  assertEquals(
    targetProviderForTemplate7({ targetProvider: "unknown" }),
    "rey_de_ases",
  );
});
