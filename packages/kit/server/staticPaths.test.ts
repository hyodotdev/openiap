import { describe, expect, test } from "vitest";

import { shouldReturnNotFoundForMissingStaticPath } from "./staticPaths";

describe("shouldReturnNotFoundForMissingStaticPath", () => {
  test("treats missing build assets as static 404s", () => {
    expect(
      shouldReturnNotFoundForMissingStaticPath("/assets/index-QW95BJ-u.js"),
    ).toBe(true);
    expect(
      shouldReturnNotFoundForMissingStaticPath(
        "/assets/index-QW95BJ-u.js.map?debug=1",
      ),
    ).toBe(true);
  });

  test("treats missing root static documents and images as static 404s", () => {
    expect(shouldReturnNotFoundForMissingStaticPath("/manifest.json")).toBe(
      true,
    );
    expect(
      shouldReturnNotFoundForMissingStaticPath("/apple-touch-icon.webp"),
    ).toBe(true);
  });

  test("allows SPA routes to fall through to React Router", () => {
    expect(shouldReturnNotFoundForMissingStaticPath("/")).toBe(false);
    expect(
      shouldReturnNotFoundForMissingStaticPath("/intu/project/intu/apikeys"),
    ).toBe(false);
    expect(
      shouldReturnNotFoundForMissingStaticPath("/docs/verification-apple"),
    ).toBe(false);
  });
});
