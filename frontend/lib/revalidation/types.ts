export type RevalidationMotor = "classic" | "constructor";
export type RevalidationAction = {
  action: "publish" | "test-classic";
  landingId: string;
  publishTarget: RevalidationMotor;
};

export type RevalidationResult = {
  ok: boolean;
  revalidated: boolean;
  warmed?: { config: boolean | null; page: boolean; retried: boolean };
  error?: string;
};
