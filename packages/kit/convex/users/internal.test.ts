import { describe, expect, it } from "vitest";
import { RESEND_PROVIDER_IDS, hasAnyResendAccount } from "./internal";

describe("hasAnyResendAccount", () => {
  it("finds an account on the first provider", async () => {
    await expect(
      hasAnyResendAccount(async (provider) =>
        provider === "resend-otp-en" ? { _id: "a" } : null,
      ),
    ).resolves.toBe(true);
  });

  it("keeps looking past earlier providers", async () => {
    const asked: string[] = [];
    await expect(
      hasAnyResendAccount(async (provider) => {
        asked.push(provider);
        return provider === "resend-otp-ja" ? { _id: "a" } : null;
      }),
    ).resolves.toBe(true);
    expect(asked).toEqual([...RESEND_PROVIDER_IDS]);
  });

  it("returns false when no provider has an account", async () => {
    await expect(hasAnyResendAccount(async () => null)).resolves.toBe(false);
  });
});
