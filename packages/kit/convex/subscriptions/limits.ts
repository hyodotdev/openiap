export const MAX_SUBSCRIPTION_USER_ID_LENGTH = 256;

export function isValidSubscriptionUserId(userId: string): boolean {
  return (
    userId.trim().length > 0 && userId.length <= MAX_SUBSCRIPTION_USER_ID_LENGTH
  );
}

// Bound purchase rows per app user, across stores. Each bound Amazon/Horizon
// purchase costs one store call on every entitlements read. Binding enforces
// the cap; the read keeps the same bound as a backstop.
export const MAX_BOUND_PURCHASES_PER_USER = 20;
