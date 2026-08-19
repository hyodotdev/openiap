import { describe, expect, it } from "vitest";
import {
  EMAIL_SIGN_IN_CLOSES_AT,
  EMAIL_SIGN_IN_CLOSES_ON,
  assertEmailSignInWindowOpen,
  assertLegacyEmailAccount,
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
