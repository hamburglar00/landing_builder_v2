import { preserveJourneyOrigin } from "./event_attribution.ts";

for (const source of ["landing","whatsapp_cloud_api","chatrace","atrio"]) {
  Deno.test(`first and repeat purchases retain ${source} while Atrio emits the event`,()=>{
    const incoming={action:"PURCHASE",source_platform:"atrio",emitter_platform:"atrio"};
    const first=preserveJourneyOrigin(source,incoming.source_platform);
    const repeat=preserveJourneyOrigin(first,incoming.source_platform);
    if(first!==source || repeat!==source || incoming.emitter_platform!=="atrio") throw new Error("Origin or emitter changed");
  });
}
Deno.test("a direct Atrio journey declares its own acquisition origin",()=>{
  if(preserveJourneyOrigin(null,"atrio")!=="atrio" || preserveJourneyOrigin(" ","landing")!=="landing")
    throw new Error("Direct origin missing");
});
