// Sign-in rules shared by auth.ts and users/query.ts. Not a Convex function
// module.
//
// Sunset for the Resend OTP provider. New signups have been GitHub-only since
// 2026-04; this is the grace period in which the remaining email-only accounts
// can still sign in and get merged onto GitHub by matching email.

export const EMAIL_SIGN_IN_CLOSES_ON = "2026-09-30";

// Inclusive of the whole closing day, in UTC.
export const EMAIL_SIGN_IN_CLOSES_AT = Date.UTC(2026, 8, 30, 23, 59, 59, 999);

export function isEmailSignInOpen(now: number = Date.now()): boolean {
  return now <= EMAIL_SIGN_IN_CLOSES_AT;
}

export function isResendProviderId(providerId: string): boolean {
  return providerId.startsWith("resend-otp");
}

// Once closed, an email user loses access only if their GitHub email differs
// from their account email.
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

interface GitHubEmail {
  email?: unknown;
  primary?: unknown;
  verified?: unknown;
}

// Accounts merge by email, so only an address GitHub verified may be used.
// Keeps Auth.js's order (public, primary, any) but drops unverified ones.
export function pickVerifiedGitHubEmail(
  publicEmail: unknown,
  emails: unknown,
): string | null {
  const list: GitHubEmail[] = Array.isArray(emails) ? emails : [];
  const verified = list
    .filter((entry) => entry.verified === true)
    .map((entry) => entry.email)
    .filter((email): email is string => typeof email === "string");
  const primary = list.find((entry) => entry.primary === true)?.email;
  return (
    [publicEmail, primary, ...verified].find(
      (email): email is string =>
        typeof email === "string" && verified.includes(email),
    ) ?? null
  );
}

/** GitHub's /user profile with `email` replaced by a verified address or null. */
export async function fetchGitHubProfileWithVerifiedEmail(
  accessToken: string,
): Promise<Record<string, unknown>> {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "User-Agent": "authjs",
  };
  const [profileResponse, emailsResponse] = await Promise.all([
    fetch("https://api.github.com/user", { headers }),
    fetch("https://api.github.com/user/emails", { headers }),
  ]);
  if (!profileResponse.ok) {
    throw new Error(`GitHub profile request failed: ${profileResponse.status}`);
  }
  const profile = (await profileResponse.json()) as Record<string, unknown>;
  const emails: unknown = emailsResponse.ok ? await emailsResponse.json() : [];
  return { ...profile, email: pickVerifiedGitHubEmail(profile.email, emails) };
}
