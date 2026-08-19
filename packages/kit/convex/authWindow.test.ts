import { describe, expect, it } from "vitest";
import {
  EMAIL_SIGN_IN_CLOSES_AT,
  EMAIL_SIGN_IN_CLOSES_ON,
  isEmailSignInOpen,
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
