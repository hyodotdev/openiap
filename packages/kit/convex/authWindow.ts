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
