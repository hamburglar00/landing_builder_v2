import type { MultiSkinCode, TargetProvider } from "../landing/types";

export type StartRequest = {
  landing_id: string;
  landing_slug: string;
  name: string;
  atrio_client_id: string;
  advisor_id: string;
  advisor_slug: string;
  promo_code: string;
  attribution?: Record<string, string>;
};

export type AssignedAdvisor = {
  atrioClientId: string;
  advisorId: string;
  advisorSlug: string;
};

export type ResolvedPlayer = {
  advisor_id: string;
  advisor_slug: string;
  player_id: string;
  device_id: string;
  created: boolean;
  player_provider_account_id: string;
  target_provider: TargetProvider;
  provider_account_created: boolean;
};

export type PlayerResolveRequest = {
  advisor: AssignedAdvisor;
  deviceId: string;
  name: string;
  landingId: string;
  landingSlug: string;
  promoCode: string;
  targetProvider: TargetProvider;
};

export type Api2ResolveAccountRequest = {
  external_user_id: string;
  name: string;
  target_provider: TargetProvider;
  advisor_id: string;
  advisor_slug: string;
  skin_code?: MultiSkinCode;
};

export type TargetAccount = {
  username: string;
  password: string;
  platform: TargetProvider;
  created: boolean;
  externalAccountId?: string | null;
  testingBypass?: boolean;
};

export type LinkedProviderAccount = {
  player_provider_account_id: string;
  target_provider: TargetProvider;
  provider_username: string;
  provider_external_account_id: string | null;
};

export type HandoffResult = {
  handoff_url: string;
  expires_at: string;
  binding_created: boolean;
  provider_username?: string;
};
