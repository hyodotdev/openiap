import { describe, expect, it } from "vitest";
import { resolveBrowserConvexUrl } from "./convex-url";

describe("resolveBrowserConvexUrl", () => {
  it("prefers the production build variable when both are set", () => {
    expect(
      resolveBrowserConvexUrl({
        VITE_KIT_CONVEX_URL: "https://production.convex.cloud",
        VITE_CONVEX_URL: "http://127.0.0.1:3210",
      }),
    ).toBe("https://production.convex.cloud");
  });

  it("uses the Convex CLI variable for local development", () => {
    expect(
      resolveBrowserConvexUrl({
        VITE_CONVEX_URL: "http://127.0.0.1:3210",
      }),
    ).toBe("http://127.0.0.1:3210");
  });

  it("rejects an unconfigured environment", () => {
    expect(() => resolveBrowserConvexUrl({})).toThrow(
      "run `convex dev` to generate VITE_CONVEX_URL",
    );
  });
});
