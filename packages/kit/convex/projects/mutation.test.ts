import { describe, expect, it } from "vitest";

import { normalizeAppAppleId } from "./mutation";

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
