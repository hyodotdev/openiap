export const SUPPORT_EMAIL = "hyo@hyo.dev";

// Mirrors convex/authWindow.ts, which is what actually enforces the cutoff.
// Duplicated deliberately: the sign-in modal must render without depending on
// a freshly deployed Convex function. constants.test.ts asserts they agree.
export const EMAIL_SIGN_IN_CLOSES_ON = "2026-09-30";

export function isEmailSignInOpen(now: number = Date.now()): boolean {
  return now <= Date.UTC(2026, 8, 30, 23, 59, 59, 999);
}
