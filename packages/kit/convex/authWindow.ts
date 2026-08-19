// Sunset for the Resend OTP provider. New signups have been GitHub-only since
// 2026-04; this is the grace period in which the remaining email-only accounts
// can still sign in and get merged onto GitHub by matching email.
//
// Not a Convex function module — plain constants shared by auth.ts and
// users/query.ts so the cutoff is written down once.

export const EMAIL_SIGN_IN_CLOSES_ON = "2026-09-30";

// Inclusive of the whole closing day, in UTC.
export const EMAIL_SIGN_IN_CLOSES_AT = Date.UTC(2026, 8, 30, 23, 59, 59, 999);

export function isEmailSignInOpen(now: number = Date.now()): boolean {
  return now <= EMAIL_SIGN_IN_CLOSES_AT;
}

export function isResendProviderId(providerId: string): boolean {
  return providerId.startsWith("resend-otp");
}

// Grace period, then GitHub-only. Existing email accounts merge onto GitHub
// by matching email, so closing costs access only when the emails differ.
export function assertEmailSignInWindowOpen(
  providerId: string,
  now: number = Date.now(),
): void {
  if (isResendProviderId(providerId) && !isEmailSignInOpen(now)) {
    throw new Error(
      `Email sign-in closed on ${EMAIL_SIGN_IN_CLOSES_ON} (UTC). Sign in with GitHub using the same email address.`,
    );
  }
}

// Email OTP is only for accounts that already used it; a GitHub-created
// account keeps using GitHub even while the window is open.
export function assertLegacyEmailAccount(
  providerId: string,
  hasLegacyEmailAccount: boolean,
): void {
  if (isResendProviderId(providerId) && !hasLegacyEmailAccount) {
    throw new Error(
      "This account uses GitHub sign-in. Please continue with GitHub.",
    );
  }
}
