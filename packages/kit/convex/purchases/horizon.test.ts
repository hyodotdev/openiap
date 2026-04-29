import { describe, expect, test } from "vitest";

import { buildHorizonRemoteId } from "./horizon";

describe("buildHorizonRemoteId", () => {
  test("produces a colon-joined pair of URL-encoded parts", () => {
    expect(buildHorizonRemoteId("user-1", "coin_pack_100")).toBe(
      "user-1:coin_pack_100",
    );
  });

  test("disambiguates across every colon placement", () => {
    // These two inputs would collide with the old `${userId}:${sku}`
    // scheme: split "a:b:c" back into (userId, sku) ambiguously.
    // URL-encoding the parts makes both encodings unique.
    const a = buildHorizonRemoteId("a:b", "c");
    const b = buildHorizonRemoteId("a", "b:c");
    expect(a).not.toBe(b);
  });

  test("encodes slashes and other separator-adjacent characters", () => {
    // Meta SKUs are free-form strings; make sure the encoding handles
    // things that would otherwise look like path separators.
    expect(buildHorizonRemoteId("u/1", "p/2")).toBe("u%2F1:p%2F2");
    expect(buildHorizonRemoteId("u 1", "p 2")).toBe("u%201:p%202");
  });

  test("leaves ASCII-alphanumeric untouched", () => {
    expect(buildHorizonRemoteId("ABC123", "sku_abc-123")).toBe(
      "ABC123:sku_abc-123",
    );
  });
});
