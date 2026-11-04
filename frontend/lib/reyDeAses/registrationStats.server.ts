import { after } from "next/server";
import { getSupabaseServerClient } from "../supabase/server";

export type ConfirmedAccountRegistration = {
  userId: string;
  landingId: string;
  promoCode: string;
  providerAccountId: string;
  agencyId?: number;
};

/** Internal measurement only, after API2 confirmed a new account. No Meta dispatch. */
export function recordConfirmedAccountRegistration(input: ConfirmedAccountRegistration): void {
  after(async () => {
    try {
      const { error } = await getSupabaseServerClient().from("conversion_account_registrations").upsert({
        user_id: input.userId, landing_id: input.landingId, promo_code: input.promoCode,
        provider_account_id: input.providerAccountId,
        agency_id: input.agencyId ?? null,
      }, { onConflict: "user_id,provider_account_id", ignoreDuplicates: true });
      if (error) throw error;
    } catch {
      console.error("[registration-statistics] internal measurement could not be recorded", { landingId: input.landingId });
    }
  });
}
