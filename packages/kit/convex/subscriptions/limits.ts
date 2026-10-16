export const MAX_SUBSCRIPTION_USER_ID_LENGTH = 256;

export const SUBSCRIPTION_ENVIRONMENT_SCOPES = [
  "production",
  "sandbox",
  "all",
] as const;
export type SubscriptionEnvironmentScope =
  (typeof SUBSCRIPTION_ENVIRONMENT_SCOPES)[number];

export function isValidSubscriptionUserId(userId: string): boolean {
  return (
    userId.trim().length > 0 && userId.length <= MAX_SUBSCRIPTION_USER_ID_LENGTH
  );
}

// Bound Amazon and Horizon purchase rows per app user. Each costs one store
// call on every entitlements read; Apple and Google links are never rechecked
// and do not count. Binding enforces the cap; the read keeps it as a backstop.
export const MAX_BOUND_PURCHASES_PER_USER = 20;
