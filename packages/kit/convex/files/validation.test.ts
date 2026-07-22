import { describe, expect, it, vi } from "vitest";

import {
  validateAppleReviewScreenshotContent,
  validateFileUpload,
} from "./validation";

function pngBytes(colorType: number): Uint8Array {
  const bytes = new Uint8Array(26);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  bytes[25] = colorType;
  return bytes;
}

function pngBytesWithTransparencyChunk(): Uint8Array {
  const bytes = new Uint8Array(46);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  new DataView(bytes.buffer).setUint32(8, 13, false);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  bytes[25] = 3;
  new DataView(bytes.buffer).setUint32(33, 1, false);
  bytes.set([0x74, 0x52, 0x4e, 0x53], 37);
  return bytes;
}

describe("Apple App Review screenshot validation", () => {
  it.each([
    ["review.png", "image/png"],
    ["review.jpg", "image/jpeg"],
    ["review.jpeg", "image/jpeg"],
  ])("accepts supported metadata for %s", (fileName, fileType) => {
    expect(() =>
      validateFileUpload(
        fileName,
        fileType,
        1024,
        "apple_iap_review_screenshot",
      ),
    ).not.toThrow();
  });

  it("strictly rejects spoofed MIME, unsupported extensions, empty, and oversized files", () => {
    expect(() =>
      validateFileUpload(
        "review.png",
        "application/octet-stream",
        1024,
        "apple_iap_review_screenshot",
      ),
    ).toThrow(/Invalid MIME type/);
    expect(() =>
      validateFileUpload("review.png", "", 1024, "apple_iap_review_screenshot"),
    ).toThrow(/Invalid MIME type/);
    expect(() =>
      validateFileUpload(
        "review.png",
        "image/jpeg",
        1024,
        "apple_iap_review_screenshot",
      ),
    ).toThrow(/extension must match/);
    expect(() =>
      validateFileUpload(
        "review.gif",
        "image/png",
        1024,
        "apple_iap_review_screenshot",
      ),
    ).toThrow(/Invalid file extension/);
    expect(() =>
      validateFileUpload(
        "review.png",
        "image/png",
        0,
        "apple_iap_review_screenshot",
      ),
    ).toThrow(/cannot be empty/);
    expect(() =>
      validateFileUpload(
        "review.jpg",
        "image/jpeg",
        10 * 1024 * 1024 + 1,
        "apple_iap_review_screenshot",
      ),
    ).toThrow(/too large/);
  });

  it("checks PNG/JPEG magic and MIME at private-blob read time", () => {
    expect(() =>
      validateAppleReviewScreenshotContent(pngBytes(2), "image/png"),
    ).not.toThrow();
    expect(() =>
      validateAppleReviewScreenshotContent(
        Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]),
        "image/jpeg",
      ),
    ).not.toThrow();
    expect(() =>
      validateAppleReviewScreenshotContent(pngBytes(2), "image/jpeg"),
    ).toThrow(/MIME type does not match/);
    expect(() =>
      validateAppleReviewScreenshotContent(
        Uint8Array.from([1, 2, 3, 4]),
        "image/png",
      ),
    ).toThrow(/valid PNG or JPEG/);
  });

  it("rejects PNG alpha channels that ASC cannot process", () => {
    expect(() =>
      validateAppleReviewScreenshotContent(pngBytes(6), "image/png"),
    ).toThrow(/alpha channel/);
    expect(() =>
      validateAppleReviewScreenshotContent(pngBytes(4), "image/png"),
    ).toThrow(/alpha channel/);
    expect(() =>
      validateAppleReviewScreenshotContent(
        pngBytesWithTransparencyChunk(),
        "image/png",
      ),
    ).toThrow(/transparency metadata/);
  });
});

describe("existing file validation", () => {
  it("keeps an empty MIME type optional for non-screenshot uploads", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    try {
      expect(() =>
        validateFileUpload("config.json", "", 1024, "config"),
      ).not.toThrow();
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });
});
