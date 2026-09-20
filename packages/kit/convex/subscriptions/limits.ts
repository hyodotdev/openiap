export const MAX_SUBSCRIPTION_USER_ID_LENGTH = 256;

export function isValidSubscriptionUserId(userId: string): boolean {
  return (
    userId.trim().length > 0 && userId.length <= MAX_SUBSCRIPTION_USER_ID_LENGTH
  );
}

// One store call per bound Amazon/Horizon purchase on every entitlements read.
// Binding enforces the cap; the read keeps the same bound as a backstop. Lives
// here rather than purchases/shared so mutation.ts stays free of the schema import.
export const MAX_BOUND_PURCHASES_PER_USER = 20;
