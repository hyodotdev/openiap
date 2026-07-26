import { ConvexError } from "convex/values";
import { describe, expect, it } from "vitest";

import { assertApiKeyAccess, effectiveApiKeyType } from "./helpers";

describe("API key access", () => {
  it("classifies legacy keys as publishable", () => {
    expect(effectiveApiKeyType(undefined)).toBe("publishable");
    expect(effectiveApiKeyType("publishable")).toBe("publishable");
    expect(effectiveApiKeyType("secret")).toBe("secret");
  });

  it("allows both key types on client operations", () => {
    expect(() => assertApiKeyAccess("publishable", "client")).not.toThrow();
    expect(() => assertApiKeyAccess("secret", "client")).not.toThrow();
  });

  it("requires a secret key for admin operations", () => {
    expect(() => assertApiKeyAccess("secret", "admin")).not.toThrow();

    try {
      assertApiKeyAccess("publishable", "admin");
      throw new Error("Expected publishable key to be rejected");
    } catch (error) {
      expect(error).toBeInstanceOf(ConvexError);
      expect((error as ConvexError<{ code: string }>).data.code).toBe(
        "INSUFFICIENT_SCOPE",
      );
    }
  });
});
