import { describe, expect, it } from "vitest";

import { isContentLengthOverLimit } from "./request-body";

describe("isContentLengthOverLimit", () => {
  it("compares decimal content-length values against the byte limit", () => {
    expect(isContentLengthOverLimit("1024", 1024)).toBe(false);
    expect(isContentLengthOverLimit(" 1025 ", 1024)).toBe(true);
    expect(isContentLengthOverLimit("9".repeat(100), 1024)).toBe(true);
  });

  it("ignores malformed non-decimal content-length values", () => {
    expect(isContentLengthOverLimit(undefined, 1024)).toBe(false);
    expect(isContentLengthOverLimit("", 1024)).toBe(false);
    expect(isContentLengthOverLimit("+1025", 1024)).toBe(false);
    expect(isContentLengthOverLimit("0x401", 1024)).toBe(false);
    expect(isContentLengthOverLimit("1025abc", 1024)).toBe(false);
    expect(isContentLengthOverLimit("-1", 1024)).toBe(false);
  });
});
