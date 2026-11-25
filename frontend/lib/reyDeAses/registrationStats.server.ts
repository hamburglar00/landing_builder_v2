import { reserveAtrioMetaJourney } from "../tracking/atrioMetaJourney.server";
import { after } from "next/server";
import { getSupabaseServerClient } from "../supabase/server";

export type ConfirmedAccountRegistration = {
  userId: string;
  landingId: string;
  promoCode: string;
  providerAccountId: string;
  agencyId?: number;
  meta?: Omit<Parameters<typeof reserveAtrioMetaJourney>[0], "name" | "key">;
};

/** Account-confirmation tracking runs outside the account response. */
export function recordConfirmedAccountRegistration(input: ConfirmedAccountRegistration): void {
  after(async () => {
    try {
      const { data, error } = await getSupabaseServerClient().from("conversion_account_registrations").upsert({
        user_id: input.userId, landing_id: input.landingId, promo_code: input.promoCode,
        provider_account_id: input.providerAccountId,
        agency_id: input.agencyId ?? null,
      }, { onConflict: "user_id,provider_account_id", ignoreDuplicates: true }).select("id").maybeSingle();
      if (error) throw error;
      if (data && input.meta) {
        const event = await reserveAtrioMetaJourney({ ...input.meta, name: "InitiateCheckout", key: input.providerAccountId });
        await event?.deliver();
      }
    } catch {
      console.error("[registration-statistics] internal measurement could not be recorded", { landingId: input.landingId });
    }
  });
}
