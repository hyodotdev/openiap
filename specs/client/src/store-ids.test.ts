import { describe, expect, it, vi } from "vitest";

vi.mock("./store-registry.json", () => ({
  default: {
    stores: [{ id: "any" }, { id: "self" }, { id: "type" }, { id: "community-store" }],
  },
}));

import { renderStoreIds } from "../codegen/core/store-ids.js";

describe("store identity constants", () => {
  it("escapes registered ids that become Swift keywords", () => {
    const swift = renderStoreIds("swift");
    expect(swift).toContain('public static let `Any` = "any"');
    expect(swift).toContain('public static let `Self` = "self"');
    expect(swift).toContain('public static let `Type` = "type"');
    expect(swift).toContain(
      'public static let CommunityStore = "community-store"',
    );
  });

  it("keeps the same wire id in every language", () => {
    for (const language of [
      "typescript",
      "kotlin",
      "swift",
      "dart",
      "gdscript",
      "csharp",
    ] as const) {
      expect(renderStoreIds(language)).toContain("community-store");
    }
  });
});
