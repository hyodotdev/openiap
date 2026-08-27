export const MAX_SUBSCRIPTION_USER_ID_LENGTH = 256;

export function isValidSubscriptionUserId(userId: string): boolean {
  return (
    userId.trim().length > 0 && userId.length <= MAX_SUBSCRIPTION_USER_ID_LENGTH
  );
}
