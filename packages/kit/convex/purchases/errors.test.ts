import { describe, expect, it } from "vitest";
import {
  PlayStorePurchaseVerificationFailedError,
  isPlayStoreTokenNoLongerValidError,
  isPlayStorePackageNameMismatchError,
} from "./errors";

describe("isPlayStoreTokenNoLongerValidError", () => {
  it("detects Google Play 410 purchase token errors", () => {
    const error = new PlayStorePurchaseVerificationFailedError(
      "The purchase token is no longer valid.",
    );
    expect(isPlayStoreTokenNoLongerValidError(error)).toBe(true);
  });

  it("ignores other Play Store verification failures", () => {
    const error = new PlayStorePurchaseVerificationFailedError(
      "Some other verification issue",
    );
    expect(isPlayStoreTokenNoLongerValidError(error)).toBe(false);
  });
});

describe("isPlayStorePackageNameMismatchError", () => {
  it("detects Google Play package mismatch errors", () => {
    const error = new PlayStorePurchaseVerificationFailedError(
      "The purchase token does not match the package name.",
    );
    expect(isPlayStorePackageNameMismatchError(error)).toBe(true);
  });

  it("ignores other Play Store verification failures", () => {
    const error = new PlayStorePurchaseVerificationFailedError(
      "Some other verification issue",
    );
    expect(isPlayStorePackageNameMismatchError(error)).toBe(false);
  });
});
