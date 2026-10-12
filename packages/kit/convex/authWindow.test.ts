import { afterEach, describe, expect, it, vi } from "vitest";
import {
  EMAIL_SIGN_IN_CLOSES_AT,
  EMAIL_SIGN_IN_CLOSES_ON,
  assertEmailSignInWindowOpen,
  assertLegacyEmailAccount,
  fetchGitHubProfileWithVerifiedEmail,
  isEmailSignInOpen,
  isResendProviderId,
} from "./authWindow";

describe("email sign-in grace period", () => {
  it("names the same day the timestamp encodes", () => {
    expect(new Date(EMAIL_SIGN_IN_CLOSES_AT).toISOString()).toContain(
      EMAIL_SIGN_IN_CLOSES_ON,
    );
  });

  it("stays open through the whole closing day in UTC", () => {
    expect(isEmailSignInOpen(Date.UTC(2026, 8, 30, 0, 0, 0, 0))).toBe(true);
    expect(isEmailSignInOpen(EMAIL_SIGN_IN_CLOSES_AT)).toBe(true);
  });

  it("closes at the first moment of the next day", () => {
    expect(isEmailSignInOpen(EMAIL_SIGN_IN_CLOSES_AT + 1)).toBe(false);
    expect(isEmailSignInOpen(Date.UTC(2026, 9, 1, 0, 0, 0, 0))).toBe(false);
  });
});

describe("email sign-in gates", () => {
  it("recognizes every resend provider id and nothing else", () => {
    expect(isResendProviderId("resend-otp-en")).toBe(true);
    expect(isResendProviderId("resend-otp-ko")).toBe(true);
    expect(isResendProviderId("github")).toBe(false);
  });

  it("lets email sign-in through while the window is open", () => {
    expect(() =>
      assertEmailSignInWindowOpen("resend-otp-en", EMAIL_SIGN_IN_CLOSES_AT),
    ).not.toThrow();
  });

  it("rejects email sign-in after the window closes", () => {
    expect(() =>
      assertEmailSignInWindowOpen("resend-otp-en", EMAIL_SIGN_IN_CLOSES_AT + 1),
    ).toThrow(/closed on 2026-09-30 \(UTC\)/);
  });

  it("never blocks GitHub, even after the window closes", () => {
    expect(() =>
      assertEmailSignInWindowOpen("github", EMAIL_SIGN_IN_CLOSES_AT + 1),
    ).not.toThrow();
  });

  it("accepts OTP for accounts that already used email", () => {
    expect(() => assertLegacyEmailAccount("resend-otp-en", true)).not.toThrow();
  });

  it("rejects OTP for GitHub-created accounts", () => {
    expect(() => assertLegacyEmailAccount("resend-otp-en", false)).toThrow(
      /continue with GitHub/i,
    );
  });
});

describe("GitHub sign-in email", () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubGitHub(profile: object, emails: object[]) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        Response.json(url.endsWith("/user/emails") ? emails : profile),
      ),
    );
  }

  it("never offers an unverified primary address for account linking", async () => {
    stubGitHub({ id: 1, login: "attacker", email: null }, [
      { email: "victim@example.com", primary: true, verified: false },
    ]);

    await expect(
      fetchGitHubProfileWithVerifiedEmail("token"),
    ).resolves.toMatchObject({ login: "attacker", email: null });
  });

  it("keeps the public, then primary, verified address", async () => {
    const emails = [
      { email: "other@example.com", primary: false, verified: true },
      { email: "primary@example.com", primary: true, verified: true },
    ];
    stubGitHub({ id: 1, email: "other@example.com" }, emails);
    await expect(
      fetchGitHubProfileWithVerifiedEmail("token"),
    ).resolves.toMatchObject({ email: "other@example.com" });

    stubGitHub({ id: 1, email: null }, emails);
    await expect(
      fetchGitHubProfileWithVerifiedEmail("token"),
    ).resolves.toMatchObject({ email: "primary@example.com" });
  });
});
