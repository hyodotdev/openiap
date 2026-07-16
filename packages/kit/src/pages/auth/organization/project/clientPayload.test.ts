import { describe, expect, it } from "vitest";

import {
  MAX_CLIENT_PAYLOAD_BODY_BYTES,
  formatClientPayloadBytes,
  getClientPayloadByteLength,
  validateClientPayload,
} from "./clientPayload";

describe("validateClientPayload", () => {
  it("rejects blank bodies for every format", () => {
    for (const format of ["toml", "json", "text"] as const) {
      expect(validateClientPayload(format, " \n\t ")).toMatchObject({
        valid: false,
        error: "Payload body must not be blank.",
      });
    }
  });

  it("measures UTF-8 bytes and enforces the exact 16 KiB boundary", () => {
    const atLimit = "😀".repeat(MAX_CLIENT_PAYLOAD_BODY_BYTES / 4);
    const overLimit = `${atLimit}a`;

    expect(getClientPayloadByteLength(atLimit)).toBe(
      MAX_CLIENT_PAYLOAD_BODY_BYTES,
    );
    expect(validateClientPayload("text", atLimit).valid).toBe(true);
    expect(validateClientPayload("text", overLimit)).toMatchObject({
      byteLength: MAX_CLIENT_PAYLOAD_BODY_BYTES + 1,
      valid: false,
    });
  });

  it("accepts JSON objects and rejects malformed or non-object JSON", () => {
    expect(validateClientPayload("json", '{"maxItems":10}').valid).toBe(true);
    expect(validateClientPayload("json", "{").error).toBe(
      "Payload body is not valid JSON.",
    );

    for (const body of ["null", "[]", '"value"', "42", "true"]) {
      expect(validateClientPayload("json", body).error).toBe(
        "JSON payload must be an object, not an array or scalar.",
      );
    }
  });

  it("accepts valid TOML and reports the location of invalid TOML", () => {
    expect(
      validateClientPayload("toml", "[access]\nmax_items = 10").valid,
    ).toBe(true);

    const invalid = validateClientPayload("toml", "max_items =");
    expect(invalid.valid).toBe(false);
    expect(invalid.error).toMatch(
      /^Payload body is not valid TOML at line \d+, column \d+\.$/,
    );
  });

  it("treats text as opaque after nonblank and size checks", () => {
    expect(validateClientPayload("text", "rule => premium").valid).toBe(true);
  });
});

describe("formatClientPayloadBytes", () => {
  it("formats bytes and kibibytes compactly", () => {
    expect(formatClientPayloadBytes(12)).toBe("12 B");
    expect(formatClientPayloadBytes(1024)).toBe("1 KiB");
    expect(formatClientPayloadBytes(1536)).toBe("1.5 KiB");
  });
});
