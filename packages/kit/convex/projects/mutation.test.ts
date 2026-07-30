import { describe, expect, it } from "vitest";

import { normalizeAndroidPackageName, normalizeAppAppleId } from "./mutation";

describe("normalizeAndroidPackageName", () => {
  it("trims whitespace without changing capitalization", () => {
    expect(normalizeAndroidPackageName("  com.markhub.Markly  ")).toBe(
      "com.markhub.Markly",
    );
  });

  it("allows correcting capitalization for a saved package name", () => {
    expect(
      normalizeAndroidPackageName("com.markhub.Markly", "com.markhub.markly"),
    ).toBe("com.markhub.Markly");
  });

  it("rejects changing a saved project to a different package name", () => {
    expect(() =>
      normalizeAndroidPackageName("com.example.Other", "com.markhub.markly"),
    ).toThrow(
      "Android package name can only be updated to correct capitalization once saved.",
    );
  });
});

describe("normalizeAppAppleId", () => {
  it("accepts positive safe integers", () => {
    expect(normalizeAppAppleId(1234567890)).toBe(1_234_567_890);
  });

  it("rejects fractional, unsafe, and non-positive values", () => {
    expect(() => normalizeAppAppleId(123.45)).toThrow(
      "App Apple ID must be a positive safe integer.",
    );
    expect(() => normalizeAppAppleId(Number.MAX_SAFE_INTEGER + 1)).toThrow(
      "App Apple ID must be a positive safe integer.",
    );
    expect(() => normalizeAppAppleId(0)).toThrow(
      "App Apple ID must be a positive safe integer.",
    );
  });
});
